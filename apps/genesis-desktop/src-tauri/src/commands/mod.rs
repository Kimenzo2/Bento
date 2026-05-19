use std::{
    collections::{HashMap, VecDeque},
    fs,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::{oneshot, Mutex as AsyncMutex};

use crate::{
    mcp::{McpError, McpRequest, McpResponse},
    runtime::{DesktopRuntime, LifecycleState},
    settings::{self, DesktopSettings},
    window_bounds::restore_main_window,
};

const MAX_MCP_REQUEST_BYTES: usize = 64 * 1024;

#[derive(Default, Clone)]
pub struct PendingDeepLink(Arc<Mutex<VecDeque<String>>>);

impl PendingDeepLink {
    pub fn set(&self, url: String) {
        if let Ok(mut pending) = self.0.lock() {
            pending.push_back(url);
        }
    }

    pub fn take(&self) -> Option<String> {
        self.0.lock().ok()?.pop_front()
    }
}

struct ManagedSidecar {
    child: Arc<AsyncMutex<CommandChild>>,
    pending: Arc<AsyncMutex<HashMap<String, oneshot::Sender<McpResponse>>>>,
    alive: Arc<AtomicBool>,
    pid: u32,
}

#[derive(Default)]
pub struct McpManager {
    process: AsyncMutex<Option<ManagedSidecar>>,
}

#[derive(Clone, Serialize)]
pub struct McpSidecarStatus {
    started: bool,
    pid: Option<u32>,
    command: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifestRequest {
    created_at: String,
    presets: Vec<serde_json::Value>,
    pipeline: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTaskRequest {
    #[serde(default)]
    label: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTaskResponse {
    task_id: String,
    state: LifecycleState,
}

fn emit_lifecycle(app: &AppHandle, state: LifecycleState) {
    let _ = DesktopRuntime::emit_lifecycle_state(app, state);
}

struct CommandBusyGuard {
    app: AppHandle,
    finished: bool,
}

impl CommandBusyGuard {
    fn begin(app: &AppHandle) -> Result<Self, String> {
        let runtime = app
            .try_state::<DesktopRuntime>()
            .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

        let next_state = runtime.begin_busy_task();
        emit_lifecycle(app, next_state);

        Ok(Self {
            app: app.clone(),
            finished: false,
        })
    }

    fn finish(mut self) {
        self.finished = true;
        finish_busy_task(&self.app);
    }
}

impl Drop for CommandBusyGuard {
    fn drop(&mut self) {
        if !self.finished {
            finish_busy_task(&self.app);
        }
    }
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

    if let Some(process) = guard.as_ref() {
        if process.alive.load(Ordering::SeqCst) {
            return Ok(McpSidecarStatus {
                started: true,
                pid: Some(process.pid),
                command: "genesis-mcp".to_string(),
            });
        }

        *guard = None;
    }

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

    let pid = child.pid();
    let child = Arc::new(AsyncMutex::new(child));
    let pending = Arc::new(AsyncMutex::new(HashMap::<
        String,
        oneshot::Sender<McpResponse>,
    >::new()));
    let alive = Arc::new(AtomicBool::new(true));

    let pending_reader = pending.clone();
    let app_handle = app.clone();
    let alive_reader = alive.clone();

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
                    alive_reader.store(false, Ordering::SeqCst);
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
                    alive_reader.store(false, Ordering::SeqCst);
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

    *guard = Some(ManagedSidecar {
        child,
        pending,
        alive,
        pid,
    });

    Ok(McpSidecarStatus {
        started: true,
        pid: Some(pid),
        command: "genesis-mcp".to_string(),
    })
}

fn finish_busy_task(app: &AppHandle) {
    if let Some(runtime) = app.try_state::<DesktopRuntime>() {
        let next_state = runtime.finish_busy_task();
        emit_lifecycle(app, next_state.clone());
        if next_state == LifecycleState::Exiting {
            app.exit(0);
        }
    }
}

fn validate_mcp_request(request: &McpRequest) -> Result<(), String> {
    if request.id.trim().is_empty() || request.id.len() > 128 {
        return Err("MCP request id must be between 1 and 128 bytes.".to_string());
    }

    let size = serde_json::to_vec(request)
        .map_err(|error| format!("Failed to measure MCP request size: {error}"))?
        .len();

    if size > MAX_MCP_REQUEST_BYTES {
        return Err(format!(
            "MCP request is too large. Maximum size is {MAX_MCP_REQUEST_BYTES} bytes."
        ));
    }

    Ok(())
}

#[tauri::command]
pub fn load_desktop_settings(app: AppHandle) -> Result<DesktopSettings, String> {
    Ok(settings::current_settings(&app))
}

#[tauri::command]
pub fn save_desktop_settings(
    app: AppHandle,
    settings: DesktopSettings,
) -> Result<DesktopSettings, String> {
    settings::save_desktop_settings(&app, &settings).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn backup_desktop_settings(app: AppHandle) -> Result<Option<String>, String> {
    let busy = CommandBusyGuard::begin(&app)?;
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    let result = (|| -> Result<Option<String>, String> {
        let settings = runtime.settings();
        let path = app
            .dialog()
            .file()
            .set_title("Back up Genesis settings")
            .set_file_name("genesis-desktop-settings-backup.json")
            .blocking_save_file();

        let Some(path) = path else {
            return Ok(None);
        };

        let payload = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
        let path = path.into_path().map_err(|error| error.to_string())?;
        fs::write(&path, payload).map_err(|error| error.to_string())?;

        Ok(Some(path.to_string_lossy().to_string()))
    })();

    busy.finish();
    result
}

#[tauri::command]
pub fn restore_desktop_settings_backup(app: AppHandle) -> Result<Option<DesktopSettings>, String> {
    let busy = CommandBusyGuard::begin(&app)?;

    let result = (|| -> Result<Option<DesktopSettings>, String> {
        let path = app
            .dialog()
            .file()
            .add_filter("Genesis settings", &["json"])
            .set_title("Restore Genesis settings")
            .blocking_pick_file();

        let Some(path) = path else {
            return Ok(None);
        };

        let path = path.into_path().map_err(|error| error.to_string())?;
        let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let settings =
            serde_json::from_str::<DesktopSettings>(&raw).map_err(|error| error.to_string())?;
        let saved =
            settings::save_desktop_settings(&app, &settings).map_err(|error| error.to_string())?;

        Ok(Some(saved))
    })();

    busy.finish();
    result
}

#[tauri::command]
pub fn pick_export_directory(app: AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .set_title("Choose Genesis export folder")
        .blocking_pick_folder();

    Ok(path.map(|value| value.to_string()))
}

#[tauri::command]
pub fn get_lifecycle_state(app: AppHandle) -> Result<LifecycleState, String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    Ok(runtime.lifecycle_state())
}

#[tauri::command]
pub fn begin_background_task(
    app: AppHandle,
    request: BackgroundTaskRequest,
) -> Result<BackgroundTaskResponse, String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    let (task_id, state) = runtime.begin_background_task(request.label);
    emit_lifecycle(&app, state.clone());

    Ok(BackgroundTaskResponse { task_id, state })
}

#[tauri::command]
pub fn finish_background_task(app: AppHandle, task_id: String) -> Result<LifecycleState, String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    let state = runtime.finish_background_task(&task_id);
    emit_lifecycle(&app, state.clone());

    if state == LifecycleState::Exiting {
        app.exit(0);
    }

    Ok(state)
}

#[tauri::command]
pub fn restore_window(app: AppHandle) -> Result<LifecycleState, String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    runtime.clear_backgrounded();

    if let Some(window) = app.get_webview_window("main") {
        restore_main_window(&window).map_err(|error| error.to_string())?;
    }

    let state = runtime.lifecycle_state();
    emit_lifecycle(&app, state.clone());
    Ok(state)
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), String> {
    if let Some(runtime) = app.try_state::<DesktopRuntime>() {
        runtime.request_exit();
        emit_lifecycle(&app, LifecycleState::Exiting);
        runtime.clear_tray();
    }

    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn save_export_manifest(
    app: AppHandle,
    manifest: ExportManifestRequest,
) -> Result<Option<String>, String> {
    let busy = CommandBusyGuard::begin(&app)?;
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    let result = (|| -> Result<Option<String>, String> {
        let default_directory = settings::resolve_export_directory(&app, &runtime.settings());
        let default_name = format!(
            "genesis-export-{}.json",
            manifest.created_at.replace(':', "-").replace('.', "-")
        );

        let path = app
            .dialog()
            .file()
            .set_title("Save Genesis export manifest")
            .set_directory(default_directory)
            .set_file_name(default_name)
            .blocking_save_file();

        let Some(path) = path else {
            return Ok(None);
        };

        let payload = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
        let path = path.into_path().map_err(|error| error.to_string())?;
        fs::write(&path, payload).map_err(|error| error.to_string())?;

        Ok(Some(path.to_string_lossy().to_string()))
    })();

    busy.finish();
    result
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
    validate_mcp_request(&request)?;
    let _ = spawn_mcp_sidecar(&app, manager.inner()).await?;

    let (child, pending) = {
        let guard = manager.process.lock().await;
        let process = guard
            .as_ref()
            .ok_or_else(|| "MCP sidecar is not available.".to_string())?;
        if !process.alive.load(Ordering::SeqCst) {
            return Err("MCP sidecar is not running.".to_string());
        }
        (process.child.clone(), process.pending.clone())
    };

    let (sender, receiver) = oneshot::channel();
    pending.lock().await.insert(request.id.clone(), sender);

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

#[cfg(test)]
mod tests {
    use super::PendingDeepLink;

    #[test]
    fn pending_deep_links_are_consumed_in_fifo_order() {
        let pending = PendingDeepLink::default();

        pending.set("genesis://auth".to_string());
        pending.set("genesis://shared?id=one".to_string());

        assert_eq!(pending.take().as_deref(), Some("genesis://auth"));
        assert_eq!(pending.take().as_deref(), Some("genesis://shared?id=one"));
        assert_eq!(pending.take(), None);
    }
}
