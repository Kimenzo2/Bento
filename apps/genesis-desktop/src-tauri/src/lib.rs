pub mod commands;
pub mod mcp;
pub mod window_bounds;

use chrono::Utc;
use serde::Serialize;
use std::{
    fs,
    panic::PanicHookInfo,
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_window_state::StateFlags;
use window_bounds::restore_main_window;

use crate::commands::{
    consume_pending_deep_link, emit_main_window_event, send_mcp_request, start_mcp_sidecar,
    McpManager, PendingDeepLink,
};

#[derive(Clone, Serialize)]
struct CrashPayload {
    message: String,
    log_path: String,
    timestamp: String,
}

fn panic_message(info: &PanicHookInfo<'_>) -> String {
    if let Some(message) = info.payload().downcast_ref::<&str>() {
        (*message).to_string()
    } else if let Some(message) = info.payload().downcast_ref::<String>() {
        message.clone()
    } else {
        "Rust backend panic".to_string()
    }
}

fn write_crash_log(app: Option<&AppHandle>, message: &str, info: &PanicHookInfo<'_>) -> Option<CrashPayload> {
    let timestamp = Utc::now().to_rfc3339();
    let location = info
        .location()
        .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
        .unwrap_or_else(|| "unknown".to_string());

    let crash_dir = if let Some(app) = app {
        app.path().app_data_dir().ok()?.join("crash")
    } else {
        std::env::temp_dir().join("genesis-desktop").join("crash")
    };

    fs::create_dir_all(&crash_dir).ok()?;

    let filename = format!("crash-{}.log", Utc::now().format("%Y%m%dT%H%M%SZ"));
    let log_path = crash_dir.join(filename);
    let payload = format!(
        "timestamp: {timestamp}\nlocation: {location}\nmessage: {message}\n"
    );

    fs::write(&log_path, payload).ok()?;

    Some(CrashPayload {
        message: message.to_string(),
        log_path: log_path.to_string_lossy().to_string(),
        timestamp,
    })
}

pub fn install_panic_bootstrap() {
    std::panic::set_hook(Box::new(|info| {
        let message = panic_message(info);
        let _ = write_crash_log(None, &message, info);
    }));
}

fn install_runtime_panic_hook(app: AppHandle) {
    std::panic::set_hook(Box::new(move |info| {
        let message = panic_message(info);

        if let Some(payload) = write_crash_log(Some(&app), &message, info) {
            let _ = emit_main_window_event(&app, "genesis://crash", payload.clone());
        }

        thread::sleep(Duration::from_millis(200));
    }));
}

fn extract_deep_link(args: impl IntoIterator<Item = String>) -> Option<String> {
    args.into_iter()
        .find(|value| value.starts_with("genesis://"))
}

fn queue_deep_link(app: &AppHandle, pending: &PendingDeepLink, url: String) {
    pending.set(url.clone());
    let _ = emit_main_window_event(app, "genesis://deep-link", url);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let window_state_plugin = tauri_plugin_window_state::Builder::new()
        .with_state_flags(StateFlags::all())
        .skip_initial_state("main")
        .build();

    let mut builder = tauri::Builder::default()
        .plugin(window_state_plugin)
        .manage(McpManager::default())
        .manage(PendingDeepLink::default());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let pending = app.state::<PendingDeepLink>().inner().clone();
            if let Some(url) = extract_deep_link(argv) {
                queue_deep_link(app, &pending, url);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            install_runtime_panic_hook(app.handle().clone());

            if let Some(window) = app.get_webview_window("main") {
                restore_main_window(&window)?;
            }

            #[cfg(any(windows, target_os = "linux"))]
            app.deep_link().register_all()?;

            let pending = app.state::<PendingDeepLink>().inner().clone();

            if let Some(urls) = app.deep_link().get_current()? {
                if let Some(url) = urls.first() {
                    queue_deep_link(app.handle(), &pending, url.to_string());
                }
            }

            let app_handle = app.handle().clone();
            let listener_pending = pending.clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    queue_deep_link(&app_handle, &listener_pending, url.to_string());
                }
            });

            if let Some(url) = extract_deep_link(std::env::args().collect::<Vec<_>>()) {
                queue_deep_link(app.handle(), &pending, url);
            }
            
            // Show window immediately after setup to minimize time to first paint
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_mcp_sidecar,
            send_mcp_request,
            consume_pending_deep_link
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
