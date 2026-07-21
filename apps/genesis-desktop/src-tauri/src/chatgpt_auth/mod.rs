//! ChatGPT OAuth & Session Management (Codex OAuth)
//!
//! Enables "Sign in with ChatGPT" via real Codex device-code OAuth through
//! a self-hosted Express proxy. Sessions are cookie-based: the reqwest
//! client's cookie jar handles auth transparently.
//!
//! Flow:
//!   1. Frontend calls `chatgpt_start_device_flow(server_url)`
//!   2. Backend POSTs to server's `/api/chatgpt/login`, gets user_code + URL
//!   3. Frontend shows code and verification URL to user
//!   4. User opens URL, enters code on auth.openai.com, authorizes
//!   5. Frontend polls `chatgpt_check_device_flow()` (cookie-driven)
//!   6. On approval, the session cookie is stored in the reqwest client
//!   7. Subsequent AI requests use the same client (cookie = auth)

pub mod commands;

pub use commands::load_server_url;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

// ── API response types (Codex `createChatGPTHandler` shapes) ──────────

/// Response from POST /api/chatgpt/login.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub status: String,
    pub user_code: String,
    pub verification_url: String,
    pub interval: u64,
    pub expires_at: i64,
}

/// Public ChatGPT user profile from the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptUserInfo {
    pub account_id: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub plan: Option<String>,
}

/// Response from GET /api/chatgpt/session or /api/chatgpt/status.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub status: String,
    #[serde(default)]
    pub user: Option<ChatGptUserInfo>,
}

/// Response from GET /api/chatgpt/models.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsResponse {
    pub models: Vec<String>,
}

/// ChatGPT session info returned to the frontend.
/// No tokens — auth is cookie-based.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptSession {
    pub server_url: String,
    pub user: Option<ChatGptUserInfo>,
    pub status: String,
}

/// Connection test result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
}

// ── Device flow info (returned to frontend for display) ───────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowInfo {
    pub user_code: String,
    pub verification_url: String,
    pub interval: u64,
    pub expires_at: i64,
}

// ── Managed state ──────────────────────────────────────────────────────

/// Shared reqwest client with cookie store, plus persisted server URL.
/// The cookie jar keeps the session alive across requests within the app
/// session. Server URL is also persisted in OS keyring.
pub struct ChatGptClient {
    pub client: reqwest::Client,
    pub server_url: Mutex<Option<String>>,
    /// Extracted session cookie value for use by codex stream requests
    /// that create their own reqwest clients (cannot share the cookie jar).
    pub session_cookie: Mutex<Option<String>>,
}

impl ChatGptClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .cookie_store(true)
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("reqwest client with cookie store"),
            server_url: Mutex::new(None),
            session_cookie: Mutex::new(None),
        }
    }
}

/// Handle to the running ChatGPT proxy sidecar process.
/// Stored in managed Tauri state so it can be killed on app exit.
/// Implements Drop to kill the child process when managed state is dropped.
pub struct ChatGptProxyChild(pub Mutex<Option<CommandChild>>);

impl ChatGptProxyChild {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

impl Drop for ChatGptProxyChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}
