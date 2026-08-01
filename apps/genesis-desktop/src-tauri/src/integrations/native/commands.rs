// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::native::registry::{native_config, NativeFlow};
use crate::integrations::native::token::{self, NativeCredentials};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

use super::telegram_poller::TelegramPollerHandle;

/// Holds the running Telegram poller handle so it can be stopped on disconnect.
pub struct TelegramPollerState {
    pub handle: tokio::sync::Mutex<Option<TelegramPollerHandle>>,
}

impl TelegramPollerState {
    pub fn new() -> Self {
        Self {
            handle: tokio::sync::Mutex::new(None),
        }
    }
}

/// Routes a connect request to the right native flow. Handles all four
/// connect shapes: OAuth2 (browser), API key, pasted token, and basic auth.
pub async fn connect_native(
    app: &AppHandle,
    app_key: &str,
    api_key: Option<String>,
    token_value: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    let config = native_config(app_key)
        .ok_or_else(|| format!("Unknown native integration '{app_key}'"))?;

    let creds = match config.flow {
        NativeFlow::OAuth2 => {
            // Browser flow — handled by the native auth manager, which stores
            // the tokens itself on callback.
            let manager = app
                .state::<Arc<crate::integrations::commands::IntegrationState>>()
                .inner()
                .native
                .clone();
            return manager.start_connect(app, app_key).await;
        }
        NativeFlow::ApiKey => NativeCredentials {
            api_key: Some(nonempty(api_key, "API key is required")?),
            ..Default::default()
        },
        NativeFlow::Token => NativeCredentials {
            token: Some(nonempty(token_value, "Token is required")?),
            ..Default::default()
        },
        NativeFlow::Basic => NativeCredentials {
            username: Some(nonempty(username, "Username / Account SID is required")?),
            password: Some(nonempty(password, "Password / Auth token is required")?),
            ..Default::default()
        },
    };

    token::save(app_key, &creds).await?;

    // For Telegram, auto-discover the user's chat ID so the agent can send
    // messages without the user needing to know their numeric chat ID.
    if app_key == "telegram" {
        if let Some(ref bot_token) = creds.api_key {
            eprintln!("[integrations] Telegram: auto-discovering chat ID...");
            match crate::integrations::native::token::discover_telegram_chat_id(bot_token).await {
                Some(chat_id) => {
                    eprintln!("[integrations] Telegram: discovered chat_id = {chat_id}");
                    let mut updated = creds.clone();
                    updated.username = Some(chat_id);
                    let _ = token::save(app_key, &updated).await;
                }
                None => {
                    eprintln!("[integrations] Telegram: no private chat found in getUpdates. User may need to send /start to the bot first.");
                }
            }
        }
    }

    let pool = app.state::<crate::db::BentoAppState>().db();
    crate::integrations::store::save_connection(&pool, app_key, "native").await?;

    // Start the real-time Telegram poller if connecting Telegram
    if app_key == "telegram" {
        start_telegram_poller(app).await;
    }

    Ok(())
}

/// Start the real-time Telegram poller. Reads the bot token from the keyring,
/// spawns the background task, and stores the handle in app state.
pub(crate) async fn start_telegram_poller(app: &AppHandle) {
    // Stop any existing poller first
    stop_telegram_poller(app).await;

    let creds = match token::get("telegram").await {
        Ok(Some(c)) => c,
        Ok(None) => {
            eprintln!("[telegram] Cannot start poller: no credentials found");
            return;
        }
        Err(e) => {
            eprintln!("[telegram] Cannot start poller: {e}");
            return;
        }
    };

    let bot_token = match creds.api_key {
        Some(t) if !t.is_empty() => t,
        _ => {
            eprintln!("[telegram] Cannot start poller: no bot token in credentials");
            return;
        }
    };

    let (handle, _rx) = super::telegram_poller::start_poller(bot_token, app.clone());

    // Store the handle so it stays alive until disconnect
    if let Some(state) = app.try_state::<TelegramPollerState>() {
        let mut guard = state.handle.lock().await;
        *guard = Some(handle);
        eprintln!("[telegram] Poller started and stored in app state");
    } else {
        eprintln!("[telegram] WARNING: TelegramPollerState not registered, poller may not persist");
    }
}

/// Stop the running Telegram poller (drop the handle).
async fn stop_telegram_poller(app: &AppHandle) {
    if let Some(state) = app.try_state::<TelegramPollerState>() {
        let mut guard = state.handle.lock().await;
        if guard.take().is_some() {
            eprintln!("[telegram] Poller stopped");
        }
    }
}

fn nonempty(v: Option<String>, msg: &str) -> Result<String, String> {
    match v {
        Some(s) if !s.trim().is_empty() => Ok(s.trim().to_string()),
        _ => Err(msg.to_string()),
    }
}

/// Clears the native app's keyring entry.
pub async fn disconnect_native(app: &AppHandle, app_key: &str) -> Result<(), String> {
    // Stop the Telegram poller if disconnecting Telegram
    if app_key == "telegram" {
        stop_telegram_poller(app).await;
    }
    let _ = token::delete(app_key).await;
    Ok(())
}

/// Tauri command: manually start the Telegram poller.
#[tauri::command]
pub async fn start_telegram_poller_cmd(app: AppHandle) -> Result<String, String> {
    start_telegram_poller(&app).await;
    Ok("Telegram poller started".to_string())
}

/// Tauri command: manually stop the Telegram poller.
#[tauri::command]
pub async fn stop_telegram_poller_cmd(app: AppHandle) -> Result<String, String> {
    stop_telegram_poller(&app).await;
    Ok("Telegram poller stopped".to_string())
}

/// Tauri command: check if the Telegram poller is running.
#[tauri::command]
pub async fn get_telegram_poller_status(app: AppHandle) -> Result<bool, String> {
    if let Some(state) = app.try_state::<TelegramPollerState>() {
        let guard = state.handle.lock().await;
        Ok(guard.is_some())
    } else {
        Ok(false)
    }
}

/// Executes a native action by slug.
pub async fn execute_native(
    app_key: &str,
    action_slug: &str,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::integrations::native::client::execute(app_key, action_slug, input).await
}

/// Returns the static action list for a native app, mapped onto the same
/// shape the frontend already consumes for Composio tools.
pub fn list_native_actions(
    app_key: &str,
) -> Vec<crate::integrations::ComposioTool> {
    native_config(app_key)
        .map(|config| {
            config
                .actions
                .iter()
                .map(|a| crate::integrations::ComposioTool {
                    slug: a.slug.to_string(),
                    name: Some(a.name.to_string()),
                    description: Some(a.description.to_string()),
                    toolkit_slug: Some(app_key.to_string()),
                })
                .collect()
        })
        .unwrap_or_default()
}
