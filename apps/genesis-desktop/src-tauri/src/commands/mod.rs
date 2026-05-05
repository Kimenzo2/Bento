use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::{oneshot, Mutex as AsyncMutex};

use crate::mcp::{McpError, McpRequest, McpResponse};

#[derive(Default, Clone)]
pub struct PendingDeepLink(Arc<Mutex<Option<String>>>);

impl PendingDeepLink {
    pub fn set(&self, url: String) {
        if let Ok(mut pending) = self.0.lock() {
            *pending = Some(url);
        }
    }

    pub fn take(&self) -> Option<String> {
        self.0.lock().ok()?.take()
    }
}

struct ManagedSidecar {
    child: Arc<AsyncMutex<CommandChild>>,
    pending: Arc<AsyncMutex<HashMap<String, oneshot::Sender<McpResponse>>>>,
}

#[derive(Default)]
pub struct McpManager {
    process: AsyncMutex<Option<ManagedSidecar>>,
}

#[derive(Serialize)]
pub struct McpSidecarStatus {
    started: bool,
    pid: Option<u32>,
    command: String,
}

pub fn emit_main_window_event<T: Serialize + Clone>(
    app: &AppHandle,
    event: &str,
    payload: T,
) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.emit(event, payload)?;
    }

    Ok(())
}

async fn spawn_mcp_sidecar(
    app: &AppHandle,
    manager: &McpManager,
) -> Result<McpSidecarStatus, String> {
    let mut guard = manager.process.lock().await;

    if guard.is_some() {
        return Ok(McpSidecarStatus {
            started: true,
            pid: None,
            command: "genesis-mcp".to_string(),
        });
    }

    let sidecar = app
        .shell()
        .sidecar("genesis-mcp")
        .map_err(|error| format!("Failed to prepare MCP sidecar: {error}"))?;

    let (mut receiver, child) = sidecar
        .spawn()
        .map_err(|error| format!("Failed to spawn MCP sidecar: {error}"))?;

    let child = Arc::new(AsyncMutex::new(child));
    let pending = Arc::new(AsyncMutex::new(HashMap::<String, oneshot::Sender<McpResponse>>::new()));

    let pending_reader = pending.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if line.is_empty() {
                        continue;
                    }

                    if let Ok(response) = serde_json::from_str::<McpResponse>(&line) {
                        if let Some(sender) = pending_reader.lock().await.remove(&response.id) {
                            let _ = sender.send(response);
                        }
                    } else {
                        let _ = emit_main_window_event(
                            &app_handle,
                            "genesis://mcp-log",
                            format!("Unparsed MCP output: {line}"),
                        );
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if !line.is_empty() {
                        let _ = emit_main_window_event(&app_handle, "genesis://mcp-log", line);
                    }
                }
                CommandEvent::Error(error) => {
                    let mut pending = pending_reader.lock().await;
                    for (id, sender) in pending.drain() {
                        let _ = sender.send(McpResponse {
                            id,
                            result: None,
                            error: Some(McpError {
                                code: -32098,
                                message: format!("MCP sidecar error: {error}"),
                            }),
                        });
                    }
                }
                CommandEvent::Terminated(payload) => {
                    let mut pending = pending_reader.lock().await;
                    for (id, sender) in pending.drain() {
                        let _ = sender.send(McpResponse {
                            id,
                            result: None,
                            error: Some(McpError {
                                code: -32097,
                                message: format!(
                                    "MCP sidecar terminated with code {:?} and signal {:?}",
                                    payload.code, payload.signal
                                ),
                            }),
                        });
                    }
                }
                _ => {}
            }
        }
    });

    *guard = Some(ManagedSidecar { child, pending });

    Ok(McpSidecarStatus {
        started: true,
        pid: None,
        command: "genesis-mcp".to_string(),
    })
}

#[tauri::command]
pub async fn start_mcp_sidecar(
    app: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<McpSidecarStatus, String> {
    spawn_mcp_sidecar(&app, manager.inner()).await
}

#[tauri::command]
pub async fn send_mcp_request(
    app: AppHandle,
    manager: State<'_, McpManager>,
    request: McpRequest,
) -> Result<McpResponse, String> {
    let _ = spawn_mcp_sidecar(&app, manager.inner()).await?;

    let (child, pending) = {
        let guard = manager.process.lock().await;
        let process = guard
            .as_ref()
            .ok_or_else(|| "MCP sidecar is not available.".to_string())?;
        (process.child.clone(), process.pending.clone())
    };

    let (sender, receiver) = oneshot::channel();
    pending
        .lock()
        .await
        .insert(request.id.clone(), sender);

    let payload = format!(
        "{}\n",
        serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize MCP request: {error}"))?
    );

    if let Err(error) = child.lock().await.write(payload.as_bytes()) {
        pending.lock().await.remove(&request.id);
        return Err(format!("Failed to write MCP request: {error}"));
    }

    match tokio::time::timeout(Duration::from_secs(8), receiver).await {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(_)) => Err("MCP sidecar channel closed before a response was received.".to_string()),
        Err(_) => {
            pending.lock().await.remove(&request.id);
            Err("MCP sidecar request timed out.".to_string())
        }
    }
}

#[tauri::command]
pub fn consume_pending_deep_link(pending: State<'_, PendingDeepLink>) -> Option<String> {
    pending.take()
}
