// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::db::BentoAppState;
use crate::integrations::auth::IntegrationAuthManager;
use crate::integrations::store;
use crate::integrations::{curated_apps, AppDefinition, ComposioClient, IntegrationCategory};
use crate::settings;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub struct IntegrationState {
    pub auth: Arc<IntegrationAuthManager>,
    pub native: Arc<crate::integrations::native::NativeAuthManager>,
}

#[derive(Serialize)]
pub struct IntegrationAppEntry {
    pub app: AppDefinition,
    pub connected: bool,
}

#[derive(Serialize)]
pub struct IntegrationApiKeyStatus {
    pub has_key: bool,
    pub key_preview: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteActionInput {
    pub app_key: String,
    pub action_name: String,
    pub input: serde_json::Value,
}

#[tauri::command]
pub async fn list_integration_apps(
    category: Option<String>,
    app: AppHandle,
) -> Result<Vec<IntegrationAppEntry>, String> {
    let pool = app.state::<BentoAppState>().db();
    let all_apps = curated_apps();
    let connected = store::connected_app_keys(&pool).await?;

    let apps: Vec<IntegrationAppEntry> = all_apps
        .into_iter()
        .filter(|a| {
            if let Some(ref cat) = category {
                let cat_lower = cat.to_lowercase();
                format!("{:?}", a.category).to_lowercase() == cat_lower
                    || a.category.label().to_lowercase() == cat_lower
            } else {
                true
            }
        })
        .map(|app_def| IntegrationAppEntry {
            connected: connected.contains(&app_def.key),
            app: app_def,
        })
        .collect();

    Ok(apps)
}

#[tauri::command]
pub async fn get_integration_connections(
    app: AppHandle,
) -> Result<Vec<crate::integrations::IntegrationConnection>, String> {
    let pool = app.state::<BentoAppState>().db();
    store::get_connections(&pool).await
}

#[tauri::command]
pub async fn connect_integration(
    app_key: String,
    api_key: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
    token: Option<String>,
    username: Option<String>,
    password: Option<String>,
    state: State<'_, Arc<crate::integrations::commands::IntegrationState>>,
    app: AppHandle,
) -> Result<(), String> {
    let curated = crate::integrations::curated_apps();
    let app_def = curated.iter().find(|a| a.key == app_key);

    // Native apps run their auth entirely on-device — no Composio key needed.
    if app_def.map(|d| d.auth_type) == Some(crate::integrations::AuthType::Native) {
        return crate::integrations::native::commands::connect_native(
            &app,
            &app_key,
            api_key,
            token,
            username,
            password,
        )
        .await;
    }

    // Custom-OAuth credentials (if provided) are forwarded to Composio so the
    // auth config actually uses the user's own client ID/secret.
    let mut custom_oauth_creds: Option<(String, String)> = None;

    let is_custom_oauth = matches!(
        app_def.map(|d| d.auth_type),
        Some(crate::integrations::AuthType::CustomOAuth)
    );

    match app_def.map(|d| d.auth_type) {
        Some(crate::integrations::AuthType::ApiKey) => {
            let cred = api_key.ok_or_else(|| "API key is required for this app".to_string())?;
            let trimmed = cred.trim();
            if trimmed.is_empty() {
                return Err("API key cannot be empty".to_string());
            }
            // Store the credential in the OS keyring, never in plaintext SQLite.
            store::save_app_api_key_async(&app_key, trimmed).await?;
            let pool = app.state::<crate::db::BentoAppState>().db();
            // Local marker row only — the actual key lives in the keyring.
            store::save_connection(&pool, &app_key, "api_key").await?;
            return Ok(());
        }
        Some(crate::integrations::AuthType::CustomOAuth) => {
            let cid = client_id.ok_or_else(|| "Client ID is required".to_string())?;
            let csecret = client_secret.ok_or_else(|| "Client Secret is required".to_string())?;
            // Persist the credentials in the keyring and pass them to Composio
            // when creating the auth config below.
            store::save_app_oauth_creds_async(&app_key, &cid, &csecret).await?;
            custom_oauth_creds = Some((cid, csecret));
            // Fall through to the OAuth flow below.
        }
        Some(crate::integrations::AuthType::NoAuth) => {
            let pool = app.state::<crate::db::BentoAppState>().db();
            store::save_connection(&pool, &app_key, "no_auth").await?;
            return Ok(());
        }
        Some(crate::integrations::AuthType::Unavailable) => {
            return Err(format!("{app_key} is not available on Composio yet"))
        }
        _ => {}
    }

    // Only the OAuth flows below need a Composio key — local-only apps
    // (ApiKey/NoAuth) already returned above without one.
    let composio_key = store::get_api_key_async().await?.ok_or_else(|| {
        "Composio API key not configured. Set it in Integrations settings first.".to_string()
    })?;

    let user_id = composio_user_id(&app).await;

    let auth = state.inner().auth.clone();
    let redirect_uri = match auth.clone().start_connect(&app, &app_key).await {
        Ok(uri) => uri,
        Err(e) => {
            rollback_oauth_creds(is_custom_oauth, &app_key).await;
            return Err(e);
        }
    };

    let client = ComposioClient::new(&composio_key);
    let result = async {
        let auth_config_id = client
            .get_auth_config_id(
                &composio_toolkit_slug(&app_key),
                custom_oauth_creds
                    .as_ref()
                    .map(|(a, b)| (a.as_str(), b.as_str())),
            )
            .await?;
        let link = client
            .create_auth_link(&auth_config_id, &user_id, &redirect_uri)
            .await?;

        crate::integrations::auth::IntegrationAuthManager::open_url(&app, &link.redirect_url).await?;
        Ok(())
    }
    .await;

    if let Err(e) = result {
        // Roll back the local state we created so a failed connect doesn't
        // leave stale OAuth creds in the keyring or a dangling OAuth server.
        auth.cancel_active().await;
        rollback_oauth_creds(is_custom_oauth, &app_key).await;
        return Err(e);
    }

    Ok(())
}

/// On a failed OAuth connect, remove any client creds we just wrote to the
/// keyring so a later retry starts from a clean state.
async fn rollback_oauth_creds(is_custom_oauth: bool, app_key: &str) {
    if is_custom_oauth {
        if let Err(e) = store::delete_app_oauth_creds_async(app_key).await {
            eprintln!("[integrations] Failed to roll back OAuth creds for '{app_key}': {e}");
        }
    }
}

/// Resolve the Composio `user_id`/`entity_id` for this connection. Prefer the
/// logged-in Bento user's id so accounts are scoped to the actual user instead
/// of a shared static id; fall back to the configured value when signed out.
async fn composio_user_id(app: &AppHandle) -> String {
    if let Some(manager) = app.try_state::<crate::auth::AuthManager>() {
        if let Some(session) = manager.current_session().await {
            let id = session.user.id.trim();
            if !id.is_empty() {
                return id.to_string();
            }
        }
    }
    settings::current_settings(app).integrations.composio_user_id
}

/// Map a curated `app_key` to its Composio toolkit slug. Most curated keys
/// already match the Composio slug; only known divergences are listed here.
fn composio_toolkit_slug(app_key: &str) -> String {
    match app_key {
        // Composio exposes a single Microsoft Outlook toolkit for both the mail
        // and calendar surfaces.
        "outlookcalendar" => "outlook".to_string(),
        _ => app_key.to_string(),
    }
}

#[tauri::command]
pub async fn disconnect_integration(app_key: String, app: AppHandle) -> Result<(), String> {
    let pool = app.state::<BentoAppState>().db();

    // Always purge locally-stored credentials (OS keyring) regardless of the
    // connection row's status — a failed or in-progress connect must still be
    // cleanable. Custom-OAuth apps store client creds, API-key apps store the
    // key, and native apps store their credential blob.
    let _ = store::delete_app_oauth_creds_async(&app_key).await;
    let _ = store::delete_app_api_key_async(&app_key).await;
    let _ = crate::integrations::native::token::delete(&app_key).await;

    // Determine the app's auth type from the curated list rather than relying
    // on the connection id marker. This also handles legacy rows saved before
    // the keyring change, which still hold the raw API key as connection_id.
    let app_auth_type = crate::integrations::curated_apps()
        .iter()
        .find(|a| a.key == app_key)
        .map(|a| a.auth_type);

    let conn = store::get_connection(&pool, &app_key).await?;
    if let Some(c) = conn {
        match app_auth_type {
            // Local-only connections have no real Composio connected account —
            // their keyring entries were already cleared above.
            Some(crate::integrations::AuthType::ApiKey)
            | Some(crate::integrations::AuthType::NoAuth) => {}
            Some(crate::integrations::AuthType::Native) => {
                let _ = crate::integrations::native::commands::disconnect_native(&app, &app_key).await;
            }
            _ => {
                // Real Composio connected account — only attempt the remote
                // delete when the connection actually reached Connected.
                if let crate::integrations::ConnectionStatus::Connected = c.status {
                    match store::get_api_key_async().await {
                        Ok(Some(key)) => {
                            let client = ComposioClient::new(&key);
                            if let Err(e) = client.delete_connection(&c.id).await {
                                eprintln!("[integrations] Failed to delete Composio connection '{}': {e}", c.id);
                            }
                        }
                        Ok(None) => {
                            eprintln!("[integrations] No API key — skipping Composio disconnect for '{}'", app_key);
                        }
                        Err(e) => {
                            eprintln!("[integrations] Failed to read API key for disconnect: {e}");
                        }
                    }
                }
            }
        }
    }

    store::delete_connection(&pool, &app_key).await
}

#[tauri::command]
pub async fn save_composio_api_key(api_key: String, app: AppHandle) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    store::save_api_key_async(api_key.trim().to_string()).await?;
    crate::settings::update_desktop_settings(&app, |s| {
        s.integrations.composio_api_key_set = true;
    })?;
    Ok(())
}

#[tauri::command]
pub async fn get_composio_api_key_status() -> Result<IntegrationApiKeyStatus, String> {
    // `has_key` reflects whether any usable key exists (user-set keyring entry
    // or the compiled-in developer fallback). The preview, however, is only
    // shown for a key the user actually set — never the fallback, which must
    // not be advertised as the user's own key.
    let has_key = store::has_api_key_async().await;
    let key_preview = store::get_user_api_key_async().await?.map(|k| preview_key(&k));
    Ok(IntegrationApiKeyStatus {
        has_key,
        key_preview,
    })
}

/// Build a short preview of a credential without panicking on multi-byte
/// UTF-8 (byte slicing `&k[..4]` panics on non-ASCII keys).
fn preview_key(k: &str) -> String {
    let chars: Vec<char> = k.chars().collect();
    if chars.len() > 8 {
        let head: String = chars[..4].iter().collect();
        let tail: String = chars[chars.len() - 4..].iter().collect();
        format!("{head}...{tail}")
    } else {
        "••••".to_string()
    }
}

#[tauri::command]
pub async fn delete_composio_api_key(app: AppHandle) -> Result<(), String> {
    store::delete_api_key_async().await?;
    crate::settings::update_desktop_settings(&app, |s| {
        s.integrations.composio_api_key_set = false;
    })?;
    Ok(())
}

#[tauri::command]
pub async fn cancel_integration_flow(
    state: State<'_, Arc<crate::integrations::commands::IntegrationState>>,
) -> Result<(), String> {
    state.inner().auth.cancel_active().await;
    Ok(())
}

#[tauri::command]
pub async fn test_composio_connection() -> Result<bool, String> {
    let api_key = store::get_api_key_async().await?.ok_or_else(|| "No API key configured".to_string())?;
    let client = ComposioClient::new(&api_key);
    client.test_connection().await
}

#[tauri::command]
pub async fn execute_integration_action(
    params: ExecuteActionInput,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    execute_integration(&app, &params.app_key, &params.action_name, params.input).await
}

/// Execute an integration action against the correct backend (native client,
/// API-key injection, or Composio connected account). Shared by the UI command
/// and the AI agent's integration tools.
pub async fn execute_integration(
    app: &AppHandle,
    app_key: &str,
    action_name: &str,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let pool = app.state::<BentoAppState>().db();

    let app_auth_type = curated_apps()
        .iter()
        .find(|a| a.key == app_key)
        .map(|a| a.auth_type);

    // Native apps execute locally through the native client.
    if app_auth_type == Some(crate::integrations::AuthType::Native) {
        return crate::integrations::native::commands::execute_native(app_key, action_name, input)
            .await;
    }

    // No-auth apps expose public endpoints that need no connected account and
    // no stored credential — executing them must never send a literal
    // "no_auth" placeholder as the connected account id.
    if app_auth_type == Some(crate::integrations::AuthType::NoAuth) {
        store::get_connection(&pool, app_key)
            .await?
            .ok_or_else(|| format!("No connection for '{app_key}'. Connect it first."))?;
        let api_key = store::get_api_key_async()
            .await?
            .ok_or_else(|| "Composio API key not configured".to_string())?;
        let client = ComposioClient::new(&api_key);
        return client.execute_tool_no_auth(action_name, input).await;
    }

    let api_key =
        store::get_api_key_async().await?.ok_or_else(|| "Composio API key not configured".to_string())?;
    let client = ComposioClient::new(&api_key);

    // API-key-authenticated apps don't have a Composio connected account — the
    // key is stored locally in the OS keyring and injected via custom_connection_data.
    if app_auth_type == Some(crate::integrations::AuthType::ApiKey) {
        let slug = composio_toolkit_slug(app_key);
        let app_key_secret = match store::get_app_api_key_async(app_key).await? {
            Some(k) => k,
            None => {
                // Legacy connections (saved before the keyring change) stored
                // the raw API key in the connection_id column — fall back to it
                // and migrate it into the keyring so it isn't lost.
                match store::get_connection(&pool, app_key).await? {
                    Some(c) if c.id != "api_key" => {
                        store::save_app_api_key_async(app_key, &c.id).await?;
                        c.id
                    }
                    _ => {
                        return Err(format!(
                            "No stored API key for '{app_key}'. Disconnect and reconnect it first."
                        ))
                    }
                }
            }
        };
        return client
            .execute_tool_with_api_key(action_name, &slug, &app_key_secret, input)
            .await;
    }

    let conn = store::get_connection(&pool, app_key)
        .await?
        .ok_or_else(|| format!("No connection for '{app_key}'. Connect it first."))?;
    let entity_id = composio_user_id(app).await;
    client.execute_tool(action_name, &conn.id, &entity_id, input).await
}

#[tauri::command]
pub async fn list_integration_actions(
    app_key: String,
) -> Result<Vec<crate::integrations::ComposioTool>, String> {
    // Native apps return their static action table instead of querying Composio.
    let is_native = curated_apps()
        .iter()
        .any(|a| a.key == app_key && a.auth_type == crate::integrations::AuthType::Native);
    if is_native {
        return Ok(crate::integrations::native::commands::list_native_actions(&app_key));
    }

    // If we have curated human-useful tools for this app, return them directly
    // without hitting the Composio API.
    if let Some(curated) = crate::integrations::tools::get_curated_tools(&app_key) {
        let tools: Vec<crate::integrations::ComposioTool> = curated
            .iter()
            .map(|t| crate::integrations::ComposioTool {
                slug: t.slug.to_string(),
                name: Some(t.name.to_string()),
                description: Some(t.description.to_string()),
                toolkit_slug: Some(app_key.clone()),
            })
            .collect();
        return Ok(tools);
    }

    // Fall back to Composio API for apps without curated tools.
    let api_key =
        store::get_api_key_async().await?.ok_or_else(|| "Composio API key not configured".to_string())?;
    let client = ComposioClient::new(&api_key);
    client.list_tools(&app_key).await
}

#[tauri::command]
pub async fn get_integration_categories() -> Vec<CategoryEntry> {
    let all_apps = curated_apps();
    IntegrationCategory::ALL
        .iter()
        .map(|c| {
            let count = all_apps.iter().filter(|a| matches_category(&a.category, c)).count();
            CategoryEntry {
                id: format!("{:?}", c).to_lowercase(),
                label: c.label().to_string(),
                count,
            }
        })
        .collect()
}

fn matches_category(a: &IntegrationCategory, b: &IntegrationCategory) -> bool {
    a == b
}

#[derive(Serialize)]
pub struct CategoryEntry {
    pub id: String,
    pub label: String,
    pub count: usize,
}
