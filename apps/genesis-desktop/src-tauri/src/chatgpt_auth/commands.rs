//! Tauri commands for ChatGPT Codex OAuth and session management.
//!
//! Uses a shared reqwest::Client with cookie store so the session cookie
//! is automatically included in every request to the app-server.

use std::time::Instant;

use keyring::Entry;
use tauri::{AppHandle, Manager};

use super::{ChatGptClient, ChatGptSession, ConnectionTestResult, DeviceFlowInfo, LoginResponse, StatusResponse};

const KEYRING_SERVICE: &str = "Bento Desktop";
const KEYRING_SERVER_URL: &str = "chatgpt-server-url";

/// Load the persisted server URL from OS keyring.
pub fn load_server_url() -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SERVER_URL).map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(url) => Ok(Some(url)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keyring error: {e}")),
    }
}

fn save_server_url(url: &str) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SERVER_URL).map_err(|e| format!("Keyring error: {e}"))?;
    entry.set_password(url).map_err(|e| format!("Failed to save server URL: {e}"))
}

fn delete_server_url() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SERVER_URL).map_err(|e| format!("Keyring error: {e}"))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete server URL: {e}")),
    }
}

/// Get the reqwest client from managed state.
fn get_client(app: &AppHandle) -> reqwest::Client {
    app.state::<ChatGptClient>().client.clone()
}

/// Lock the server_url mutex with error handling.
fn with_server_url<F, R>(app: &AppHandle, f: F) -> Result<R, String>
where
    F: FnOnce(&mut Option<String>) -> R,
{
    let state = app.state::<ChatGptClient>();
    let mut guard = state.server_url
        .lock()
        .map_err(|e| format!("Internal lock error: {e}"))?;
    Ok(f(&mut guard))
}

fn set_server_url(app: &AppHandle, url: String) {
    let _ = with_server_url(app, |u| *u = Some(url));
}

fn clear_server_url(app: &AppHandle) {
    let _ = with_server_url(app, |u| *u = None);
}

/// Lock the session_cookie mutex with error handling.
fn with_session_cookie<F, R>(app: &AppHandle, f: F) -> Result<R, String>
where
    F: FnOnce(&mut Option<String>) -> R,
{
    let state = app.state::<ChatGptClient>();
    let mut guard = state.session_cookie
        .lock()
        .map_err(|e| format!("Internal lock error: {e}"))?;
    Ok(f(&mut guard))
}

fn set_session_cookie(app: &AppHandle, cookie: String) {
    let _ = with_session_cookie(app, |c| *c = Some(cookie));
}

// ── Tauri Commands ─────────────────────────────────────────────────────

/// Start the Codex device-code login flow.
#[tauri::command]
pub async fn chatgpt_start_device_flow(
    app: AppHandle,
    server_url: String,
) -> Result<DeviceFlowInfo, String> {
    let url = server_url.trim_end_matches('/').to_string();
    let client = get_client(&app);

    let resp = client
        .post(format!("{url}/api/chatgpt/login"))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server returned {status}: {body}"));
    }

    // Extract session cookie from Set-Cookie header before consuming response body.
    // The proxy sets a session cookie on login; we store it for use by AI stream
    // requests that create their own reqwest clients.
    if let Some(cookie_val) = resp
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
    {
        // Take only the name=value part (before first ';')
        let session_cookie = cookie_val.split(';').next().unwrap_or(cookie_val).to_string();
        set_session_cookie(&app, session_cookie);
    }

    let login: LoginResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    // Persist the server URL
    save_server_url(&url)?;
    set_server_url(&app, url);

    Ok(DeviceFlowInfo {
        user_code: login.user_code,
        verification_url: login.verification_url,
        interval: login.interval,
        expires_at: login.expires_at,
    })
}

/// Poll the device code status (uses cookie for session).
#[tauri::command]
pub async fn chatgpt_check_device_flow(app: AppHandle) -> Result<StatusResponse, String> {
    let server_url = with_server_url(&app, |u| u.clone())
        .ok()
        .flatten()
        .or_else(|| load_server_url().ok().flatten())
        .ok_or_else(|| "No server URL configured. Start a login first.".to_string())?;

    let client = get_client(&app);
    let resp = client
        .get(format!("{server_url}/api/chatgpt/status"))
        .send()
        .await
        .map_err(|e| format!("Failed to reach server: {e}"))?;

    let status: StatusResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    Ok(status)
}

/// Get the current ChatGPT session status.
#[tauri::command]
pub async fn chatgpt_get_session(app: AppHandle) -> Result<Option<ChatGptSession>, String> {
    let server_url = with_server_url(&app, |u| u.clone())
        .ok()
        .flatten()
        .or_else(|| load_server_url().ok().flatten());

    let Some(url) = server_url else {
        return Ok(None);
    };

    let client = get_client(&app);
    let resp = client
        .get(format!("{url}/api/chatgpt/session"))
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let status: StatusResponse = r.json().await.map_err(|e| format!("Parse error: {e}"))?;
            if status.status == "authenticated" {
                Ok(Some(ChatGptSession {
                    server_url: url,
                    user: status.user,
                    status: status.status,
                }))
            } else {
                Ok(None)
            }
        }
        Ok(r) => {
            let _ = r.text().await;
            Ok(None)
        }
        Err(_) => Ok(None),
    }
}

/// Sign out: tell server to revoke session, clear local state.
#[tauri::command]
pub async fn chatgpt_sign_out(app: AppHandle) -> Result<(), String> {
    if let Some(server_url) = with_server_url(&app, |u| u.clone())
        .ok()
        .flatten()
        .or_else(|| load_server_url().ok().flatten())
    {
        let client = get_client(&app);
        let _ = client
            .post(format!("{server_url}/api/chatgpt/logout"))
            .send()
            .await;
    }

    // Also clear session cookie
    let _ = with_session_cookie(&app, |c| *c = None);
    let _ = delete_server_url();
    clear_server_url(&app);
    Ok(())
}

/// Test connection to the app-server.
#[tauri::command]
pub async fn chatgpt_test_connection(
    app: AppHandle,
    server_url: String,
) -> Result<ConnectionTestResult, String> {
    let start = Instant::now();
    let client = get_client(&app);
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
