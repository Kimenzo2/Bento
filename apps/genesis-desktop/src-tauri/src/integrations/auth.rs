// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::store;
use std::borrow::Cow;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_oauth::{start_with_config, OauthConfig};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

const FLOW_TIMEOUT_SECS: u64 = 180;

#[allow(dead_code)]
struct ActiveIntegrationFlow {
    port: Option<u16>,
    app_key: String,
    state: String,
}

pub struct IntegrationAuthManager {
    inner: Mutex<IntegrationAuthInner>,
}

struct IntegrationAuthInner {
    active_flow: Option<ActiveIntegrationFlow>,
}

const CALLBACK_RESPONSE_HTML: &str = r#"<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#1a1a1a;text-align:center}div{padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#666;margin:0}</style></head><body><div><h1>✅ Connected</h1><p>You can close this tab and return to Bento.</p></div></body></html>"#;

impl IntegrationAuthManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(IntegrationAuthInner { active_flow: None }),
        })
    }

    pub async fn start_connect(
        self: Arc<Self>,
        app: &AppHandle,
        app_key: &str,
    ) -> Result<String, String> {
        self.cancel_active().await;

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
                        eprintln!("[integrations] OAuth callback failed: {e}");
                        let _ = app.emit(
                            "integrations:error",
                            serde_json::json!({ "message": e }),
                        );
                    }
                });
            },
        )
        .map_err(|e| format!("Failed to start OAuth server: {e}"))?;

        {
            let mut inner = self.inner.lock().await;
            inner.active_flow = Some(ActiveIntegrationFlow {
                port: Some(cb_port),
                app_key: app_key.to_string(),
                state: state.clone(),
            });
        }

        let self_timeout = self.clone();
        let app_timeout = app.clone();
        let key_timeout = app_key.to_string();
        let state_timeout = state.clone();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_secs(FLOW_TIMEOUT_SECS)).await;
            // Only treat this as a timeout if the flow that's active is still
            // the one we started. A newer connect (same or different app)
            // supersedes it, and its own timeout task will handle it.
            let still_ours = {
                let inner = self_timeout.inner.lock().await;
                inner
                    .active_flow
                    .as_ref()
                    .map(|f| f.app_key == key_timeout && f.state == state_timeout)
                    .unwrap_or(false)
            };
            if still_ours {
                eprintln!("[integrations] Connection flow for '{key_timeout}' timed out after {FLOW_TIMEOUT_SECS}s");
                self_timeout.cancel_active().await;
                let _ = app_timeout.emit(
                    "integrations:flow-timeout",
                    serde_json::json!({ "appKey": key_timeout }),
                );
            }
        });

        let redirect_uri = format!("http://127.0.0.1:{cb_port}/integrations/callback");
        Ok(format!("{redirect_uri}?state={state}"))
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

        let connected_account_id = parsed
            .query_pairs()
            .find(|(k, _)| {
                k == "connected_account_id" || k == "connectionId" || k == "connection_id"
            })
            .map(|(_, v)| v.to_string())
            .ok_or_else(|| {
                format!(
                    "Callback missing connected_account_id. Query params: {:?}",
                    parsed
                        .query_pairs()
                        .map(|(k, v)| format!("{k}={v}"))
                        .collect::<Vec<_>>()
                )
            })?;

        // Only resolve the connection if the flow that is active is the one
        // this callback belongs to (same app and same CSRF state). A callback
        // arriving after a timeout, a user cancel, a newer connect for the
        // same app, or a connect for a different app must not mark anything
        // as connected.
        {
            let inner = self.inner.lock().await;
            let flow_matches = inner
                .active_flow
                .as_ref()
                .map(|f| f.app_key == app_key && f.state == *expected_state)
                .unwrap_or(false);
            if !flow_matches {
                return Err(format!(
                    "No active connection flow for '{app_key}' matching this callback — stale callback rejected"
                ));
            }
        }

        self.cancel_active().await;

        let pool = app.state::<crate::db::BentoAppState>().db();
        store::save_connection(&pool, app_key, &connected_account_id).await?;

        let _ = app.emit(
            "integrations:connected",
            serde_json::json!({
                "appKey": app_key,
                "connectedAccountId": connected_account_id,
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