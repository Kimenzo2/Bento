pub mod actors;
pub mod commands;
pub mod db;
pub mod mcp;
pub mod modules;
pub mod runtime;
pub mod session;
pub mod settings;
pub mod telemetry;
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

use crate::commands::{
    backup_desktop_settings, begin_background_task, consume_pending_deep_link,
    emit_main_window_event, finish_background_task, get_cursor_screen_position,
    get_lifecycle_state, load_desktop_settings, pick_export_directory, quit_app,
    restore_desktop_settings_backup, restore_window, save_desktop_settings,
    save_export_manifest, send_mcp_request, start_mcp_sidecar, McpManager, PendingDeepLink,
};
use crate::db::{
    flush_module_state, get_module_context, get_module_fonts, save_module_context,
    set_module_fonts, stream_ai_response, GenesisAppState,
};
use crate::modules::{
    fetch_module_registry, get_active_module, get_installed_modules, get_module_settings,
    install_module, register_local_module, set_active_module, set_module_settings,
    uninstall_module,
};
use crate::runtime::DesktopRuntime;
use crate::session::{
    tab_close, tab_get, tab_get_foreground, tab_handle_sync_event, tab_is_module_open,
    tab_list, tab_open, tab_set_foreground, tab_switch, ManagedTabSession,
};
use crate::telemetry::{
    TelemetryState, get_telemetry_brain_overview,
    get_telemetry_insights, get_telemetry_module_detail, record_active_js_heap,
    spawn_collector, subscribe_brain_events,
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
        .register_uri_scheme_protocol("module", modules::module_protocol)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            install_runtime_panic_hook(app.handle().clone());

            let settings = settings::load_desktop_settings(app.handle());
            app.manage(DesktopRuntime::new(settings.clone()));
            let _ = settings::apply_configured_shortcuts(app.handle(), &settings);

            let db = match tauri::async_runtime::block_on(db::init_db(app.handle())) {
                Ok(db) => db,
                Err(error) => {
                    return Err(std::io::Error::new(std::io::ErrorKind::Other, error).into());
                }
            };
            let app_state = GenesisAppState::new(db);
            let telemetry = TelemetryState::new(
                app_state.db().clone(),
                app_state.active_module_handle(),
            )
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            spawn_collector(app.handle().clone(), telemetry.clone());
            app.manage(app_state);
            app.manage(telemetry);
            app.manage(ManagedTabSession::new());

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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_desktop_settings,
            save_desktop_settings,
            backup_desktop_settings,
            restore_desktop_settings_backup,
            pick_export_directory,
            save_export_manifest,
            get_lifecycle_state,
            begin_background_task,
            finish_background_task,
            restore_window,
            quit_app,
            get_module_context,
            save_module_context,
            flush_module_state,
            get_module_fonts,
            set_module_fonts,
            get_active_module,
            set_active_module,
            get_installed_modules,
            fetch_module_registry,
            get_module_settings,
            set_module_settings,
            register_local_module,
            install_module,
            uninstall_module,
            stream_ai_response,
            record_active_js_heap,
            subscribe_brain_events,
            get_cursor_screen_position,
            get_telemetry_brain_overview,
            get_telemetry_module_detail,
            get_telemetry_insights,
            start_mcp_sidecar,
            send_mcp_request,
            consume_pending_deep_link,
            tab_open,
            tab_close,
            tab_switch,
            tab_set_foreground,
            tab_list,
            tab_get_foreground,
            tab_get,
            tab_is_module_open,
            tab_handle_sync_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
