// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::native::registry::{native_config, NativeAppConfig, OAuth2Config};
use crate::integrations::native::token::{self, NativeCredentials};
use base64::Engine as _;
use once_cell::sync::Lazy;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_oauth::{start_with_config, OauthConfig};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

const FLOW_TIMEOUT_SECS: u64 = 180;

const CALLBACK_RESPONSE_HTML: &str = r#"<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#1a1a1a;text-align:center}div{padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#666;margin:0}</style></head><body><div><h1>✅ Connected</h1><p>You can close this tab and return to Bento.</p></div></body></html>"#;

#[allow(dead_code)]
struct ActiveNativeFlow {
    port: Option<u16>,
    state: Option<String>,
    app_key: String,
    client_id: String,
    client_secret: String,
    token_url: String,
    redirect_uri: String,
}

pub struct NativeAuthManager {
    inner: Mutex<NativeAuthInner>,
}

struct NativeAuthInner {
    active_flow: Option<ActiveNativeFlow>,
}

impl NativeAuthManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(NativeAuthInner { active_flow: None }),
        })
    }

    /// Runs the full OAuth2 connect flow for a native app locally:
    /// 1. dynamically registers a client (DCR) when the app has no embedded
    ///    client id (Hermes/OpenClaw pattern),
    /// 2. opens the provider authorize page,
    /// 3. on the loopback callback, exchanges the code for tokens and stores
    ///    them in the OS keyring.
    pub async fn start_connect(
        self: Arc<Self>,
        app: &AppHandle,
        app_key: &str,
    ) -> Result<(), String> {
        self.cancel_active().await;

        let config = native_config(app_key)
            .ok_or_else(|| format!("Unknown native integration '{app_key}'"))?;
        let oauth = config
            .oauth
            .as_ref()
            .ok_or_else(|| format!("'{app_key}' is not an OAuth2 app"))?;

        let state = Uuid::new_v4().to_string();

        let self_clone = self.clone();
        let app_for_callback = app.clone();
        let key_for_callback = app_key.to_string();
        let state_for_callback = state.clone();
        let cb_port = start_with_config(
            OauthConfig {
                ports: Some(vec![0]),
                response: Some(Cow::Borrowed(CALLBACK_RESPONSE_HTML)),
            },
            move |callback_url| {
                let self_clone = self_clone.clone();
                let app = app_for_callback.clone();
                let key = key_for_callback.clone();
                let expected_state = state_for_callback.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = Self::handle_callback(
                        self_clone,
                        app.clone(),
                        &key,
                        &callback_url,
                        &expected_state,
                    )
                    .await
                    {
                        eprintln!("[integrations] Native OAuth callback failed: {e}");
                        let _ = app.emit(
                            "integrations:error",
                            serde_json::json!({ "message": e }),
                        );
                    }
                });
            },
        )
        .map_err(|e| format!("Failed to start OAuth server: {e}"))?;

        let redirect_uri = format!("http://127.0.0.1:{cb_port}/integrations/callback");

        // Step 1: client registration (embedded client id OR dynamic DCR).
        let (client_id, client_secret) = register_client(app_key, oauth, &redirect_uri).await?;

        // Step 2: build the authorize URL.
        let authorize_url = build_authorize_url(config, oauth, &client_id, &redirect_uri, &state)?;

        {
            let mut inner = self.inner.lock().await;
            inner.active_flow = Some(ActiveNativeFlow {
                port: Some(cb_port),
                state: Some(state.clone()),
                app_key: app_key.to_string(),
                client_id: client_id.clone(),
                client_secret: client_secret.clone(),
                token_url: oauth.token_url.to_string(),
                redirect_uri: redirect_uri.clone(),
            });
        }

        // Timeout watchdog — mirrors the Composio flow manager.
        let self_timeout = self.clone();
        let app_timeout = app.clone();
        let key_timeout = app_key.to_string();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_secs(FLOW_TIMEOUT_SECS)).await;
            let had_flow = {
                let inner = self_timeout.inner.lock().await;
                inner.active_flow.is_some()
            };
            if had_flow {
                eprintln!("[integrations] Native connect flow for '{key_timeout}' timed out after {FLOW_TIMEOUT_SECS}s");
                self_timeout.cancel_active().await;
                let _ = app_timeout.emit(
                    "integrations:flow-timeout",
                    serde_json::json!({ "appKey": key_timeout }),
                );
            }
        });

        // Step 3: open the provider page in the default browser.
        app.opener()
            .open_url(&authorize_url, None::<&str>)
            .map_err(|e| format!("Failed to open browser: {e}"))
    }

    pub async fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|e| format!("Failed to open browser: {e}"))
    }

    async fn handle_callback(
        self: Arc<Self>,
        app: AppHandle,
        app_key: &str,
        callback_url: &str,
        expected_state: &str,
    ) -> Result<(), String> {
        let parsed = url::Url::parse(callback_url)
            .map_err(|e| format!("Failed to parse callback URL '{callback_url}': {e}"))?;

        let actual_state = parsed
            .query_pairs()
            .find(|(k, _)| k == "state")
            .map(|(_, v)| v.to_string());

        if let Some(ref state_val) = actual_state {
            if state_val != expected_state {
                return Err(format!(
                    "CSRF state mismatch: expected '{expected_state}', got '{state_val}'"
                ));
            }
        } else {
            return Err(format!(
                "Callback missing 'state' parameter — possible CSRF attack. URL: {callback_url}"
            ));
        }

        let code = parsed
            .query_pairs()
            .find(|(k, _)| k == "code")
            .map(|(_, v)| v.to_string())
            .ok_or_else(|| {
                format!(
                    "Callback missing 'code'. Query params: {:?}",
                    parsed
                        .query_pairs()
                        .map(|(k, v)| format!("{k}={v}"))
                        .collect::<Vec<_>>()
                )
            })?;

        // Read the stored flow data BEFORE cancelling — it holds the
        // client credentials from the DCR step that must be reused.
        let flow = {
            let mut inner = self.inner.lock().await;
            inner.active_flow.take()
        }
        .ok_or_else(|| "No active OAuth flow — possible timeout or duplicate callback".to_string())?;

        if let Some(port) = flow.port {
            let _ = tauri_plugin_oauth::cancel(port);
        }

        let redirect_uri = flow.redirect_uri;
        let client_id = flow.client_id;
        let client_secret = flow.client_secret;
        let token_url = flow.token_url;

        let creds = exchange_code(
            &flow.app_key,
            &token_url,
            &code,
            &redirect_uri,
            &client_id,
            &client_secret,
        )
        .await?;

        token::save(app_key, &creds).await?;

        let pool = app.state::<crate::db::BentoAppState>().db();
        crate::integrations::store::save_connection(&pool, app_key, "native_oauth").await?;

        let _ = app.emit(
            "integrations:connected",
            serde_json::json!({
                "appKey": app_key,
                "connectedAccountId": "native_oauth",
            }),
        );

        Ok(())
    }

    pub async fn cancel_active(&self) {
        let mut inner = self.inner.lock().await;
        if let Some(flow) = inner.active_flow.take() {
            if let Some(port) = flow.port {
                let _ = tauri_plugin_oauth::cancel(port);
            }
        }
    }
}

/// Dynamic client registration (DCR). When the app ships an embedded client
/// id, it is returned directly; otherwise a client is registered against the
/// provider's registration endpoint at connect time.
async fn register_client(
    app_key: &str,
    oauth: &OAuth2Config,
    redirect_uri: &str,
) -> Result<(String, String), String> {
    if !oauth.client_id.is_empty() {
        return Ok((oauth.client_id.to_string(), oauth.client_secret.to_string()));
    }

    let dcr = oauth
        .dynamic_registration
        .ok_or_else(|| format!("'{app_key}' has neither an embedded client id nor a registration endpoint"))?;

    let client = reqwest::Client::new();
    let resp = client
        .post(dcr.url)
        .form(&[
            ("client_name", "Bento Desktop"),
            ("redirect_uris", redirect_uri),
            (dcr.scope_field, oauth.scopes),
            ("website", "https://github.com/BentoHQ"),
        ])
        .send()
        .await
        .map_err(|e| format!("Client registration failed: {e}"))?;
    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse registration response: {e}"))?;

    if !status.is_success() {
        return Err(format!(
            "Client registration failed (HTTP {}): {}",
            status,
            body
        ));
    }

    let client_id = body["client_id"]
        .as_str()
        .ok_or_else(|| format!("Registration response missing client_id: {body}"))?
        .to_string();
    let client_secret = body["client_secret"].as_str().unwrap_or_default().to_string();

    Ok((client_id, client_secret))
}

fn build_authorize_url(
    config: &'static NativeAppConfig,
    oauth: &OAuth2Config,
    client_id: &str,
    redirect_uri: &str,
    state: &str,
) -> Result<String, String> {
    let mut url = url::Url::parse(oauth.authorize_url)
        .map_err(|e| format!("Invalid authorize URL '{}': {e}", oauth.authorize_url))?;
    {
        let mut pairs = url.query_pairs_mut();
        pairs.append_pair("client_id", client_id);
        pairs.append_pair("redirect_uri", redirect_uri);
        pairs.append_pair("response_type", "code");
        pairs.append_pair("state", state);
        if !oauth.scopes.is_empty() {
            pairs.append_pair("scope", oauth.scopes);
        }
        if oauth.use_pkce {
            let verifier = generate_pkce_verifier();
            let challenge = pkce_challenge(&verifier);
            pairs.append_pair("code_challenge", &challenge);
            pairs.append_pair("code_challenge_method", "S256");
            // Carry the verifier through to the token exchange.
            config_keyring_pkce_verifier(config.key, &verifier);
        }
    }
    Ok(url.to_string())
}

/// PKCE verifier is stashed in-memory for the token exchange. A real shared
/// store lives in the auth manager; for now the exchange reads it from here.
static PKCE_VERIFIERS: Lazy<std::sync::Mutex<HashMap<String, String>>> =
    Lazy::new(|| std::sync::Mutex::new(HashMap::new()));

fn config_keyring_pkce_verifier(app_key: &str, verifier: &str) {
    if let Ok(mut m) = PKCE_VERIFIERS.lock() {
        m.insert(app_key.to_string(), verifier.to_string());
    }
}

fn take_pkce_verifier(app_key: &str) -> Option<String> {
    if let Ok(mut m) = PKCE_VERIFIERS.lock() {
        return m.remove(app_key);
    }
    None
}

fn generate_pkce_verifier() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: String = (0..64)
        .map(|_| {
            const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
            ALPHABET[rng.gen_range(0..ALPHABET.len())] as char
        })
        .collect();
    chars
}

fn pkce_challenge(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

async fn exchange_code(
    app_key: &str,
    token_url: &str,
    code: &str,
    redirect_uri: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<NativeCredentials, String> {
    let verifier = take_pkce_verifier(app_key);

    let mut form: Vec<(&str, String)> = vec![
        ("grant_type", "authorization_code".to_string()),
        ("code", code.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
        ("client_id", client_id.to_string()),
    ];
    if !client_secret.is_empty() {
        form.push(("client_secret", client_secret.to_string()));
    }
    if let Some(v) = verifier {
        form.push(("code_verifier", v));
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(token_url)
        .form(&form)
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {e}"))?;
    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {e}"))?;

    if !status.is_success() {
        return Err(format!(
            "Token exchange failed (HTTP {}): {}",
            status,
            body
        ));
    }

    let access_token = body["access_token"]
        .as_str()
        .ok_or_else(|| format!("Token response missing access_token: {body}"))?
        .to_string();
    let refresh_token = body["refresh_token"].as_str().map(|s| s.to_string());
    let expires_at_ms = body["expires_in"]
        .as_i64()
        .map(|secs| crate::util::time::now_ms() + secs * 1000);

    Ok(NativeCredentials {
        access_token: Some(access_token),
        refresh_token,
        expires_at_ms,
        api_key: None,
        token: None,
        username: None,
        password: None,
        raw_oauth: Some(body),
    })
}
