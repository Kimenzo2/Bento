//! ChatGPT OAuth & Session Management
//!
//! Enables "Sign in with ChatGPT" flow via device code OAuth through a
//! self-hosted app-server. Sessions are stored in the OS keyring for
//! persistence across app restarts.
//!
//! Flow:
//!   1. Frontend calls `chatgpt_start_device_flow(server_url)`
//!   2. Backend POSTs to server's `/api/auth/device-code`, returns user_code + URI
//!   3. Frontend shows code and verification URI to user
//!   4. User opens URI, enters code, authorizes
//!   5. Frontend polls `chatgpt_check_device_flow(device_code)` every 5s
//!   6. On approval, session JWT is stored in OS keyring
//!   7. Subsequent AI requests use the session to route through the proxy

pub mod commands;

pub use commands::load_session;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

/// Device flow response from the app-server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    #[serde(default)]
    pub verification_uri_complete: Option<String>,
    pub expires_in: u64,
    pub interval: u64,
}

/// Poll response from the app-server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResponse {
    pub status: String,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub expires_in: Option<u64>,
    #[serde(default)]
    pub plan: Option<String>,
    /// Server-requested polling interval (seconds), used for slow_down
    #[serde(default)]
    pub interval: Option<u64>,
}

/// ChatGPT session stored locally.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptSession {
    pub server_url: String,
    pub session_id: String,
    pub token: String,
    pub plan: String,
    pub created_at: i64,
    pub expires_at: i64,
}

/// Plan info returned by the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanInfo {
    pub plan: String,
    pub name: String,
    pub tier: String,
    pub description: String,
    pub models: Vec<String>,
    pub max_tokens: u64,
    pub rate_limit: RateLimitInfo,
    pub session_expires_at: i64,
    pub active_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub requests_per_minute: u64,
}

/// Connection test result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
}

// ── Managed state ──────────────────────────────────────────────────────

/// In-memory tracker for active device flows.
/// Tauri State already wraps in Arc, so plain Mutex is sufficient.
pub struct ActiveDeviceFlows {
    pub inner: Mutex<HashMap<String, DeviceFlowResponse>>,
}

impl ActiveDeviceFlows {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}
