//! Tauri commands for ChatGPT OAuth and session management.

use std::time::Instant;

use keyring::Entry;
use serde::Deserialize;
use tauri::AppHandle;

use super::{ActiveDeviceFlows, ChatGptSession, ConnectionTestResult, DeviceFlowResponse, PlanInfo, PollResponse};

const KEYRING_SERVICE: &str = "Bento Desktop";
const KEYRING_ACCOUNT: &str = "chatgpt-session";

/// HTTP client shared across commands.
/// Uses `expect` because TLS backends are always available in a Tauri desktop app.
fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("reqwest client build (TLS required)")
}

/// Load the stored ChatGPT session from OS keyring, with in-memory caching.
/// Uses the cache to avoid blocking on OS keyring IPC (10-100ms) on every call.
pub async fn load_session() -> Result<Option<ChatGptSession>, String> {
    tokio::task::spawn_blocking(|| {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| format!("Keyring error: {e}"))?;
        match entry.get_password() {
            Ok(raw) => serde_json::from_str(&raw).map(Some).map_err(|e| format!("Failed to parse session: {e}")),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Keyring error: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Keyring thread error: {e}"))?
}

/// Save the ChatGPT session to OS keyring.
async fn save_session(session: ChatGptSession) -> Result<(), String> {
    let raw = serde_json::to_string(&session).map_err(|e| format!("Serialization error: {e}"))?;
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| format!("Keyring error: {e}"))?;
        entry.set_password(&raw).map_err(|e| format!("Failed to save session: {e}"))
    })
    .await
    .map_err(|e| format!("Keyring thread error: {e}"))?
}

/// Delete the stored session.
async fn delete_session() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| format!("Keyring error: {e}"))?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete session: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Keyring thread error: {e}"))?
}

// ── Tauri Commands ─────────────────────────────────────────────────────

/// Start the device code OAuth flow with the app-server.
#[tauri::command]
pub async fn chatgpt_start_device_flow(
    server_url: String,
    state: tauri::State<'_, ActiveDeviceFlows>,
) -> Result<DeviceFlowResponse, String> {
    let client = http_client();
    let resp = client
        .post(format!("{}/api/auth/device-code", server_url.trim_end_matches('/')))
        .json(&serde_json::json!({ "clientId": "bento-desktop" }))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server returned {status}: {body}"));
    }

    let flow: DeviceFlowResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    // Track the flow for polling
    // unwrap: Mutex poison is a catastrophic bug; surface it immediately
    state.inner.lock().unwrap().insert(flow.device_code.clone(), flow.clone());

    Ok(flow)
}

/// Poll the device code status.
#[tauri::command]
pub async fn chatgpt_check_device_flow(
    device_code: String,
    server_url: String,
    state: tauri::State<'_, ActiveDeviceFlows>,
) -> Result<PollResponse, String> {
    let client = http_client();
    let resp = client
        .post(format!("{}/api/auth/poll", server_url.trim_end_matches('/')))
        .json(&serde_json::json!({ "deviceCode": device_code }))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    let poll: PollResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    // If approved, store the session locally
    if poll.status == "approved" {
        let (token, session_id) = (&poll.token, &poll.session_id);
        if let (Some(token), Some(session_id)) = (token, session_id) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            let session = ChatGptSession {
                server_url: server_url.trim_end_matches('/').to_string(),
                session_id: session_id.clone(),
                token: token.clone(),
                plan: poll.plan.clone().unwrap_or_else(|| "chatgpt_plus".to_string()),
                created_at: now,
                expires_at: now + poll.expires_in.unwrap_or(86400) as i64,
            };

            save_session(session).await?;
            // Remove the device flow from state
            state.inner.lock().unwrap().remove(&device_code);
        } else {
            // Server returned "approved" without token — malformed response
            state.inner.lock().unwrap().remove(&device_code);
            return Err("Server approved the flow but did not return a session token".to_string());
        }
    }

    Ok(poll)
}

/// Get the current ChatGPT session status.
#[tauri::command]
pub async fn chatgpt_get_session() -> Result<Option<ChatGptSession>, String> {
    let session = load_session().await?;

    // Check if expired
    if let Some(ref s) = session {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if now >= s.expires_at {
            // Try refresh, if fails, clear silently
            if chatgpt_refresh_session_inner(s).await.is_err() {
                let _ = delete_session().await;
                return Ok(None);
            }
            // Reload the freshly-refreshed session
            return load_session().await;
        }
    }

    Ok(session)
}

async fn chatgpt_refresh_session_inner(session: &ChatGptSession) -> Result<ChatGptSession, String> {
    let client = http_client();
    let resp = client
        .post(format!("{}/api/auth/refresh", session.server_url))
        .json(&serde_json::json!({ "sessionId": session.session_id }))
        .header("Authorization", format!("Bearer {}", session.token))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Refresh failed: {}", resp.status()));
    }

    #[derive(Deserialize)]
    struct RefreshResponse {
        token: String,
        expires_in: u64,
    }

    let refresh: RefreshResponse = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let updated = ChatGptSession {
        token: refresh.token,
        expires_at: now + refresh.expires_in as i64,
        ..session.clone()
    };

    save_session(updated.clone()).await?;
    Ok(updated)
}

/// Refresh the current session.
#[tauri::command]
pub async fn chatgpt_refresh_session() -> Result<ChatGptSession, String> {
    let session = load_session().await?
        .ok_or_else(|| "No active session".to_string())?;
    chatgpt_refresh_session_inner(&session).await
}

/// Sign out: revoke session on server and delete local storage.
#[tauri::command]
pub async fn chatgpt_sign_out(_app: AppHandle) -> Result<(), String> {
    if let Ok(Some(session)) = load_session().await {
        // Best-effort server logout
        let client = http_client();
        let _ = client
            .post(format!("{}/api/auth/logout", session.server_url))
            .header("Authorization", format!("Bearer {}", session.token))
            .send()
            .await;
    }

    delete_session().await?;
    Ok(())
}

/// Get plan info from the server.
#[tauri::command]
pub async fn chatgpt_get_plan_info() -> Result<PlanInfo, String> {
    let session = load_session().await?
        .ok_or_else(|| "No active session".to_string())?;

    let client = http_client();
    let resp = client
        .get(format!("{}/api/plan", session.server_url))
        .header("Authorization", format!("Bearer {}", session.token))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Plan info request failed ({status}): {body}"));
    }

    resp.json().await.map_err(|e| format!("Parse error: {e}"))
}

/// Test connection to the app-server.
#[tauri::command]
pub async fn chatgpt_test_connection(server_url: String) -> Result<ConnectionTestResult, String> {
    let start = Instant::now();
    let client = http_client();
    let url = format!("{}/api/health", server_url.trim_end_matches('/'));

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(ConnectionTestResult {
                ok: true,
                error: None,
                latency_ms: Some(latency),
            })
        }
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(ConnectionTestResult {
                ok: false,
                error: Some(format!("Server returned {}", resp.status())),
                latency_ms: Some(latency),
            })
        }
        Err(e) => Ok(ConnectionTestResult {
            ok: false,
            error: Some(e.to_string()),
            latency_ms: None,
        }),
    }
}
