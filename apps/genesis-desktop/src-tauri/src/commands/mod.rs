pub mod dashboard;
pub mod feedback;
pub mod focus;
pub mod journal;
pub mod countdown;
pub mod nutrition;
pub mod passwords;
pub mod sync;
pub mod tasks;
pub use dashboard::{DashboardCache, get_dashboard_data};
pub use feedback::{
    get_feedback_by_id, get_feedback_realtime_config, get_my_feedback, submit_feedback,
};
pub use focus::{export_focus_sessions, get_focus_dashboard, record_focus_session};

use std::{
    collections::VecDeque,
    fs,
    sync::{Arc, Mutex},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    auth::{AuthBootstrapState, AuthManager},
    runtime::{DesktopRuntime, LifecycleState},
    settings::{self, DesktopSettings},
    window_bounds::restore_main_window,
};

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

fn finish_busy_task(app: &AppHandle) {
    if let Some(runtime) = app.try_state::<DesktopRuntime>() {
        let next_state = runtime.finish_busy_task();
        emit_lifecycle(app, next_state.clone());
        if next_state == LifecycleState::Exiting {
            app.exit(0);
        }
    }
}

#[tauri::command]
pub fn write_debug_log(app: AppHandle, msg: String) {
    let log_path = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("debug.log");
    let line = format!("[{}] {}\n", chrono::Utc::now().format("%H:%M:%S%.3f"), msg);
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut f| {
            use std::io::Write;
            f.write_all(line.as_bytes())
        });
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
            .set_title("Back up Bento settings")
            .set_file_name("bento-desktop-settings-backup.json")
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
            .add_filter("Bento settings", &["json"])
            .set_title("Restore Bento settings")
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
        .set_title("Choose Bento export folder")
        .blocking_pick_folder();

    Ok(path.map(|value| value.to_string()))
}

/// Open a file dialog and read the selected file's content.
#[tauri::command]
pub fn pick_import_file(app: AppHandle) -> Result<Option<ImportFileResult>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("Todoist JSON", &["json"])
        .add_filter("CSV files", &["csv"])
        .add_filter("All supported", &["json", "csv"])
        .set_title("Select an import file")
        .blocking_pick_file();

    let Some(path) = path else {
        return Ok(None);
    };

    let file_path = path.into_path().map_err(|e| e.to_string())?;
    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let ext = file_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "".to_string());
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    Ok(Some(ImportFileResult {
        content,
        file_name,
        extension: ext,
    }))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFileResult {
    pub content: String,
    pub file_name: String,
    pub extension: String,
}

#[tauri::command]
pub fn export_content_to_file(
    app: AppHandle,
    content: String,
    default_name: String,
    extension: String,
    filter_name: String,
) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .set_title("Save export file")
        .add_filter(&filter_name, &[&extension])
        .set_file_name(default_name)
        .blocking_save_file();

    let Some(path) = path else {
        return Ok(None);
    };

    let path = path.into_path().map_err(|e| e.to_string())?;
    fs::write(&path, &content).map_err(|e| e.to_string())?;

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_transcription_model(app: AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("Whisper model", &["bin", "gguf", "ggml"])
        .set_title("Choose a local Whisper model")
        .blocking_pick_file();

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
pub async fn restore_window(app: AppHandle) -> Result<LifecycleState, String> {
    let runtime = app
        .try_state::<DesktopRuntime>()
        .ok_or_else(|| "Desktop runtime is unavailable.".to_string())?;

    runtime.clear_backgrounded();

    let auth_state = if let Some(auth) = app.try_state::<AuthManager>() {
        Some(auth.snapshot().await)
    } else {
        None
    };

    if let Some(window) = app.get_webview_window("main") {
        match auth_state {
            Some(AuthBootstrapState::Restored { .. }) => {
                crate::window_bounds::transition_to_shell(&window)
                    .map_err(|error| error.to_string())?;
            }
            _ => {
                restore_main_window(&window).map_err(|error| error.to_string())?;
            }
        }
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
            "bento-export-{}.json",
            manifest.created_at.replace([':', '.'], "-")
        );

        let path = app
            .dialog()
            .file()
            .set_title("Save Bento export manifest")
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
pub fn consume_pending_deep_link(pending: State<'_, PendingDeepLink>) -> Option<String> {
    pending.take()
}

#[cfg(test)]
mod tests {
    use super::PendingDeepLink;

    #[test]
    fn pending_deep_links_are_consumed_in_fifo_order() {
        let pending = PendingDeepLink::default();

        pending.set("bento://auth".to_string());
        pending.set("bento://shared?id=one".to_string());

        assert_eq!(pending.take().as_deref(), Some("bento://auth"));
        assert_eq!(pending.take().as_deref(), Some("bento://shared?id=one"));
        assert_eq!(pending.take(), None);
    }
}
