// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! MCP authentication — session token generation and validation.
//!
//! A cryptographically random 32-byte token is generated on every app launch.
//! Every incoming MCP request must present this token in the `x-bento-token`
//! header. Requests without it return 401 immediately.
//!
//! Auth middleware is implemented in `mod.rs` using `tower::service_fn`.

use rand::RngCore;
use serde::Serialize;
use tauri::{AppHandle, Manager};

/// The MCP auth token, generated once at startup and stored in Tauri managed state.
#[derive(Clone)]
pub struct McpAuthToken {
    token: String,
}

impl McpAuthToken {
    /// Generate a fresh 32-byte random token encoded as hex (64 chars).
    pub fn new() -> Self {
        let mut bytes = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut bytes);
        let token = hex::encode(bytes);
        Self { token }
    }

    /// Return the token string.
    pub fn as_str(&self) -> &str {
        &self.token
    }
}

impl Default for McpAuthToken {
    fn default() -> Self {
        Self::new()
    }
}

/// Error response for auth failures.
#[derive(Clone, Serialize)]
pub struct McpAuthError {
    pub error: String,
    pub code: u16,
}

/// Validate an incoming MCP request token against the stored session token.
pub fn validate_mcp_token(
    app: &AppHandle,
    request_token: Option<&str>,
) -> Result<(), McpAuthError> {
    let stored = app
        .try_state::<McpAuthToken>()
        .map(|t| t.as_str().to_string())
        .unwrap_or_default();

    match request_token {
        Some(token) if token == stored => Ok(()),
        Some(_) => Err(McpAuthError {
            error: "Invalid MCP session token. Check your bento mcp-server.json configuration."
                .to_string(),
            code: 401,
        }),
        None => Err(McpAuthError {
            error: "Missing x-bento-token header. All MCP requests require authentication."
                .to_string(),
            code: 401,
        }),
    }
}
