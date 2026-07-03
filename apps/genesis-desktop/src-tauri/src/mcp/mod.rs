//! MCP Server — Model Context Protocol server embedded inside the Tauri backend.
//!
//! Uses rmcp's Streamable HTTP transport so that persistent AI clients like
//! Claude Desktop and Codex can maintain a connection.
//!
//! On startup, a discovery file (mcp-server.json) is written to the app data
//! directory containing the local URL and session token. External AI clients
//! read this file to know how to connect. The file is deleted when the app
//! closes cleanly.

pub mod analytics;
pub mod auth;
pub mod intelligence;
pub mod tools;

use std::sync::Arc;

use auth::{validate_mcp_token, McpAuthToken};
use axum::{
    body::Body,
    http::{Request, StatusCode},
    response::IntoResponse,
};
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener as TokioTcpListener;
use tools::BentoMcpServer;
use tower::Service;

use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager,
    tower::{StreamableHttpServerConfig, StreamableHttpService},
};

/// Write the MCP server discovery file to the app data directory.
fn write_discovery_file(
    app: &AppHandle,
    port: u16,
    token: &str,
) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data dir: {e}"))?;

    #[derive(Serialize)]
    struct McpDiscovery {
        url: String,
        token: String,
        name: String,
        version: String,
    }

    let discovery = McpDiscovery {
        url: format!("http://localhost:{port}"),
        token: token.to_string(),
        name: "bento".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };

    let path = data_dir.join("mcp-server.json");
    let payload = serde_json::to_string_pretty(&discovery)
        .map_err(|e| format!("Serialization error: {e}"))?;
    std::fs::write(&path, payload).map_err(|e| format!("Failed to write discovery file: {e}"))?;

    eprintln!("[mcp] discovery file written to {}", path.display());
    Ok(path)
}

/// Delete the MCP server discovery file.
fn delete_discovery_file(app: &AppHandle) {
    if let Ok(data_dir) = app.path().app_data_dir() {
        let path = data_dir.join("mcp-server.json");
        if path.exists() {
            let _ = std::fs::remove_file(&path);
            eprintln!("[mcp] discovery file deleted: {}", path.display());
        }
    }
}

/// Default MCP port for stable Codex/Claude/Cursor connectivity.
/// Falls back to a random port if this is unavailable.
const DEFAULT_MCP_PORT: u16 = 14872;

/// Try the default port first, then fall back to a random available port.
/// Returns a bound `TokioTcpListener` and its port to avoid TOCTOU races
/// (bind → drop → rebind window that another process could exploit).
async fn find_available_port() -> Result<(TokioTcpListener, u16), String> {
    match TokioTcpListener::bind(format!("127.0.0.1:{DEFAULT_MCP_PORT}")).await {
        Ok(listener) => {
            let port = listener
                .local_addr()
                .map_err(|e| format!("Failed to get local address: {e}"))?
                .port();
            eprintln!("[mcp] using default port {port}");
            Ok((listener, port))
        }
        Err(_) => {
            eprintln!("[mcp] default port {DEFAULT_MCP_PORT} taken, using random port");
            let listener = TokioTcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("Failed to bind port: {e}"))?;
            let port = listener
                .local_addr()
                .map_err(|e| format!("Failed to get local address: {e}"))?
                .port();
            Ok((listener, port))
        }
    }
}

/// MCP connection info returned to the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConnectionInfo {
    pub url: String,
    pub token: String,
    pub name: String,
    pub version: String,
    pub port: u16,
}

/// Tauri command — return MCP connection info for the Settings UI.
#[tauri::command]
pub async fn get_mcp_connection_info(app: AppHandle) -> Result<McpConnectionInfo, String> {
    app.try_state::<McpConnectionInfo>()
        .ok_or_else(|| "MCP server not initialized".to_string())
        .map(|info| info.inner().clone())
}

/// Spawn the MCP server as a Tokio task inside the Tauri backend.
///
/// Called from lib.rs setup after the SqlitePool and AppState are initialized.
pub async fn spawn_mcp_server(app: AppHandle, pool: SqlitePool) -> Result<(u16, String), String> {
    // ── Generate session token ───────────────────────────────────────
    let token = McpAuthToken::new();
    let token_str = token.as_str().to_string();
    app.manage(token);

    // ── Find available port (returns bound listener to avoid TOCTOU) ─
    let (listener, port) = find_available_port().await?;
    let url = format!("http://localhost:{port}");

    eprintln!("[mcp] starting MCP server on {url}");

    // ── Create the service factory ──────────────────────────────────
    // The factory creates a new BentoMcpServer per session.
    let pool_for_factory = pool.clone();
    let service_factory = move || -> Result<BentoMcpServer, std::io::Error> {
        Ok(BentoMcpServer {
            pool: pool_for_factory.clone(),
        })
    };

    // ── Session management ──────────────────────────────────────────
    let session_manager = Arc::new(LocalSessionManager::default());

    // ── HTTP server config ──────────────────────────────────────────
    let config = StreamableHttpServerConfig::default().with_stateful_mode(true);

    // ── Create the StreamableHttpService (tower Service) ────────────
    let http_service = StreamableHttpService::new(service_factory, session_manager, config);

    // ── Auth middleware: validate x-bento-token header ──────────────
    let app_handle_for_auth = app.clone();
    let auth_layer = tower::service_fn(move |req: Request<Body>| {
        let app = app_handle_for_auth.clone();
        let mut service = http_service.clone();
        async move {
            let token = req
                .headers()
                .get("x-bento-token")
                .and_then(|v| v.to_str().ok());

            match validate_mcp_token(&app, token) {
                Ok(()) => {
                    let resp = service.call(req).await;
                    // service.call() returns Infallible error, so unwrap is safe
                    Ok(resp.unwrap_or_else(|never| match never {}).into_response())
                }
                Err(auth_error) => Ok((
                    StatusCode::UNAUTHORIZED,
                    serde_json::json!({"error": auth_error.error, "code": auth_error.code})
                        .to_string(),
                )
                    .into_response()),
            }
        }
    });

    // ── Mount in axum at root path ──────────────────────────────────
    use axum::Router;

    let app_router = Router::new().route_service("/", auth_layer);

    // ── Write discovery file ────────────────────────────────────────
    let _ = write_discovery_file(&app, port, &token_str)?;

    // ── Store connection info in Tauri state ────────────────────────
    app.manage(McpConnectionInfo {
        url: url.clone(),
        token: token_str.clone(),
        name: "bento".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        port,
    });

    // ── Spawn the server task ───────────────────────────────────────
    let app_handle = app.clone();
    tokio::spawn(async move {
        eprintln!("[mcp] server listening on port {port}");

        match axum::serve(listener, app_router).await {
            Ok(_) => eprintln!("[mcp] server stopped gracefully"),
            Err(e) => eprintln!("[mcp] server error: {e}"),
        }

        // Clean up discovery file on shutdown
        delete_discovery_file(&app_handle);
    });

    // ── Signal that MCP is ready ────────────────────────────────────
    let _ = app.emit(
        "bento://mcp-ready",
        serde_json::json!({ "url": url, "port": port }),
    );

    Ok((port, token_str))
}
