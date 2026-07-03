pub mod actors;
pub mod agent;
pub mod ai;
pub mod audio;
pub mod auth;
pub mod budget;
pub mod byok;
pub mod clipboard;
pub mod cloud_backup;
pub mod commands;
pub mod crypto;
pub mod crypto_commands;
pub mod db;
pub mod flashcards;
pub mod goals;
pub mod habits;
pub mod health;
pub mod island;
pub mod local_store;
pub mod mcp;
pub mod meal_db;
pub mod media_player;
pub mod modules;
pub mod mood;
pub mod notes;
pub mod notifications;
pub mod payments;
pub mod recipes;
pub mod runtime;
pub mod scheduler;
pub mod search;
pub mod session;
pub mod settings;
pub mod share;
pub mod sleep;
pub mod telemetry;
pub mod util;
pub mod window_bounds;
pub mod window_effects;

use chrono::Utc;
use serde::Serialize;
use std::{env, fs, panic::PanicHookInfo, sync::Arc, thread, time::Duration};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg(not(debug_assertions))]
use tauri_plugin_deep_link::DeepLinkExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_window_state::StateFlags;

use crate::auth::AuthManager;
use crate::cloud_backup::{
    apply_pending_restore, backup_now, clear_service_role_key, delete_backup, get_key_state,
    get_state, restore_backup, set_service_role_key, spawn_cloud_backup_worker, test_connection,
};
use crate::commands::{
    backup_desktop_settings, begin_background_task, clear_webview_browsing_data,
    consume_pending_deep_link, emit_main_window_event, export_content_to_file,
    export_focus_sessions, finish_background_task, get_dashboard_data, get_feedback_by_id,
    get_feedback_realtime_config, get_focus_dashboard, get_lifecycle_state, get_my_feedback,
    load_desktop_settings, pick_export_directory, pick_import_file, pick_transcription_model,
    quit_app, record_focus_session, restore_desktop_settings_backup, restore_window,
    save_desktop_settings, save_export_manifest, submit_feedback, write_debug_log, DashboardCache,
    PendingDeepLink,
};
use crate::crypto::CryptoService;
use crate::db::{
    create_quick_task, enforce_auth_user_boundary, flush_module_state, get_module_context,
    get_module_fonts, save_module_context, set_module_fonts, BentoAppState,
};
use crate::modules::{
    fetch_module_registry, get_active_module, get_installed_modules, get_module_settings,
    install_module, register_local_module, set_active_module, set_module_settings,
    uninstall_module,
};
use crate::notes::undo::HistoryRegistry;
use crate::notes::NoteFullCache;
use crate::runtime::DesktopRuntime;
use crate::search::SearchService;
use crate::session::ManagedTabSession;

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

fn write_crash_log(
    app: Option<&AppHandle>,
    message: &str,
    info: &PanicHookInfo<'_>,
) -> Option<CrashPayload> {
    let timestamp = Utc::now().to_rfc3339();
    let location = info
        .location()
        .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
        .unwrap_or_else(|| "unknown".to_string());

    let crash_dir = if let Some(app) = app {
        app.path().app_data_dir().ok()?.join("crash")
    } else {
        std::env::temp_dir().join("bento-desktop").join("crash")
    };

    fs::create_dir_all(&crash_dir).ok()?;

    let filename = format!("crash-{}.log", Utc::now().format("%Y%m%dT%H%M%SZ"));
    let log_path = crash_dir.join(filename);
    let payload = format!("timestamp: {timestamp}\nlocation: {location}\nmessage: {message}\n");

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
        let location = info
            .location()
            .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
            .unwrap_or_else(|| "unknown".to_string());

        eprintln!("[panic] {location}: {message}");

        if let Some(payload) = write_crash_log(Some(&app), &message, info) {
            let _ = emit_main_window_event(&app, "bento://crash", payload.clone());
        }

        thread::sleep(Duration::from_millis(200));
    }));
}

#[cfg(windows)]
fn configure_webview2_user_data_folder() {
    if env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_some() {
        return;
    }

    let base = env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| env::temp_dir());
    let folder = base.join("Bento").join("WebView2").join("User Data");

    if let Err(error) = fs::create_dir_all(&folder) {
        eprintln!(
            "[startup] failed to create WebView2 user data folder {}: {error}",
            folder.display()
        );
        return;
    }

    env::set_var("WEBVIEW2_USER_DATA_FOLDER", &folder);
}

#[cfg(not(windows))]
fn configure_webview2_user_data_folder() {}

fn load_desktop_env() {
    let mut candidates = Vec::new();

    if let Ok(cwd) = env::current_dir() {
        candidates.push(cwd.join(".env"));
        candidates.push(cwd.join(".env.local"));
        candidates.push(cwd.join("apps").join("genesis-desktop").join(".env"));
        candidates.push(cwd.join("apps").join("genesis-desktop").join(".env.local"));
    }

    if let Ok(exe) = env::current_exe() {
        for ancestor in exe.ancestors() {
            candidates.push(ancestor.join(".env.local"));
            candidates.push(ancestor.join(".env"));
        }
    }

    for path in candidates {
        if !path.exists() {
            continue;
        }

        if dotenvy::from_path(&path).is_ok() {
            eprintln!("[startup] loaded env from {}", path.display());
            if env::var("VITE_SUPABASE_URL").is_ok() && env::var("VITE_SUPABASE_ANON_KEY").is_ok() {
                break;
            }
        }
    }
}

#[allow(dead_code)]
fn extract_deep_link(args: impl IntoIterator<Item = String>) -> Option<String> {
    args.into_iter().find(|value| value.starts_with("bento://"))
}

#[allow(dead_code)]
fn queue_deep_link(app: &AppHandle, pending: &PendingDeepLink, url: String) {
    pending.set(url.clone());
    let _ = emit_main_window_event(app, "bento://deep-link", url);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(dependency_on_unit_never_type_fallback)]
pub fn run() {
    configure_webview2_user_data_folder();
    load_desktop_env();

    let mut builder = tauri::Builder::default()
        .manage(PendingDeepLink::default())
        .manage(DashboardCache::new())
        .manage(Arc::new(NoteFullCache::new()))
        .manage(Arc::new(HistoryRegistry::new()))
        .manage(ManagedTabSession::new());

    #[cfg(not(debug_assertions))]
    {
        let window_state_plugin = tauri_plugin_window_state::Builder::new()
            .with_state_flags(StateFlags::all())
            .skip_initial_state("main")
            .skip_initial_state("island")
            .build();

        builder = builder.plugin(window_state_plugin);
    }

    #[cfg(all(desktop, not(debug_assertions)))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let pending = app.state::<PendingDeepLink>().inner().clone();
            if let Some(url) = extract_deep_link(argv) {
                queue_deep_link(app, &pending, url);
            }
        }));
    }

    builder = builder
        .register_uri_scheme_protocol("module", modules::module_protocol)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_liquid_glass::init());

    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    builder = builder.setup(|app| {
        install_runtime_panic_hook(app.handle().clone());

        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| std::io::Error::other(e))?;

        if let Err(error) = apply_pending_restore(app.handle()) {
            eprintln!("[cloud-backup] pending restore skipped: {error}");
        }

        let settings = settings::load_desktop_settings(app.handle());
        app.manage(DesktopRuntime::new(settings.clone()));
        let _ = settings::apply_configured_shortcuts(app.handle(), &settings);

        // ── Native window frame (border + shadow, custom titlebar) ──────
        if let Some(ww) = app.get_webview_window("main") {
            #[cfg(target_os = "windows")]
            if let Err(e) = crate::window_effects::configure_native_frame(&ww) {
                eprintln!("[window] native frame setup failed: {e}");
            }

            #[cfg(target_os = "macos")]
            crate::window_effects::configure_macos_titlebar(&ww).unwrap_or_else(|e| {
                eprintln!("[window] macOS titlebar setup failed: {e}");
            });
        }

        // ── Dynamic Island overlay window ────────────────────────────
        if let Err(e) = crate::island::setup_island_window(app) {
            eprintln!("[island] failed to setup island window: {e}");
        }

        // ── Agent dock window ────────────────────────────────────────
        if let Err(e) = crate::agent::setup_agent_window(app) {
            eprintln!("[agent] failed to setup agent window: {e}");
        }

        // ── System tray icon (persistent background operation) ───────
        if let Err(e) = crate::agent::setup_tray(app) {
            eprintln!("[agent] failed to setup tray icon: {e}");
        }

        // ── Global shortcut: Ctrl+Shift+A → toggle agent ──
        {
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyA);
            match app.global_shortcut().on_shortcut(
                shortcut,
                |app_handle: &AppHandle,
                 _shortcut: &Shortcut,
                 event: tauri_plugin_global_shortcut::ShortcutEvent| {
                    if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        return;
                    }
                    let _ = crate::agent::toggle_agent(app_handle.clone());
                },
            ) {
                Ok(_) => eprintln!("[shortcut] registered Ctrl+Shift+A for agent toggle"),
                Err(e) => eprintln!("[shortcut] failed to register agent shortcut: {e}"),
            }
        }

        // ── Database ──────────────────────────────────────────────────
        let db = match tauri::async_runtime::block_on(db::init_db(app.handle())) {
            Ok(db) => db,
            Err(error) => {
                return Err(std::io::Error::other(error).into());
            }
        };
        app.manage(BentoAppState::new(db));

        // ── Encryption service ────────────────────────────────────────
        let crypto = CryptoService::new(data_dir.clone());
        app.manage(crypto.clone());

        // ── Voice Engine audio state ────────────────────────────────
        {
            let audio_state = crate::audio::AudioState::new(
                data_dir.clone(),
                app.state::<BentoAppState>().inner().db(),
                Some(app.handle().clone()),
            );
            app.manage(audio_state);
        }

        // ── Media player audio state ────────────────────────────────
        crate::media_player::init_audio_state();
        crate::media_player::setup_audio_monitoring(app.handle().clone());

        // ── Global shortcut: Ctrl+Shift+I → toggle island ──
        {
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyI);
            match app
                .global_shortcut()
                .on_shortcut(shortcut, |handle, _event, _shortcut| {
                    if let Some(window) = handle.get_webview_window("island") {
                        let _ = crate::island::position_top_center(&window);
                        let _ = window.emit("island:toggle", ());
                    }
                }) {
                Ok(_) => eprintln!("[shortcut] registered Ctrl+Shift+I for island toggle"),
                Err(e) => eprintln!("[shortcut] failed to register island shortcut: {e}"),
            }
        }

        let search_base_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| std::io::Error::other(error))?;
        let search_service =
            SearchService::new(search_base_dir).map_err(|error| std::io::Error::other(error))?;
        app.manage(search_service);

        let auth_manager =
            AuthManager::new(data_dir.clone()).map_err(|e| std::io::Error::other(e))?;
        app.manage(auth_manager);

        #[cfg(not(debug_assertions))]
        {
            #[cfg(any(windows, target_os = "linux"))]
            if let Err(error) = app.deep_link().register_all() {
                eprintln!("deep-link registration skipped: {error}");
            }

            let pending = app.state::<PendingDeepLink>().inner().clone();

            if let Ok(Some(urls)) = app.deep_link().get_current() {
                if let Some(url) = urls.first() {
                    queue_deep_link(app.handle(), &pending, url.as_str().to_string());
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
        }

        // Spawn background scheduler worker
        crate::scheduler::spawn_scheduler_worker(
            app.state::<BentoAppState>().inner().clone(),
            app.handle().clone(),
        );

        spawn_cloud_backup_worker(app.handle().clone());

        // Spawn last-active timestamp tracker (updates every 60s)
        crate::sleep::spawn_last_active_tracker();

        // Spawn OS sleep detection monitor
        crate::sleep::spawn_sleep_monitor(app.handle().clone());

        // Ensure clipboard database tables exist before starting the monitor
        let clipboard_pool = app.state::<BentoAppState>().inner().db();
        if let Err(e) = tauri::async_runtime::block_on(crate::clipboard::ensure_clipboard_tables(
            &clipboard_pool,
        )) {
            eprintln!("[clipboard] failed to ensure clipboard tables: {e}");
        }

        // Spawn clipboard background monitor (poller + writer tasks)
        crate::clipboard::spawn_clipboard_monitor(app.handle().clone());

        // ── Spawn MCP Streamable HTTP server ────────────────────────────
        {
            let pool = app.state::<BentoAppState>().inner().db();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match crate::mcp::spawn_mcp_server(app_handle, pool).await {
                    Ok((port, _)) => {
                        eprintln!("[mcp] MCP server started on port {port}");
                    }
                    Err(e) => {
                        eprintln!("[mcp] Failed to start MCP server: {e}");
                    }
                }
            });
        }

        Ok(())
    });

    builder
        .invoke_handler(tauri::generate_handler![
            load_desktop_settings,
            save_desktop_settings,
            get_state,
            test_connection,
            backup_now,
            restore_backup,
            delete_backup,
            get_key_state,
            set_service_role_key,
            clear_service_role_key,
            backup_desktop_settings,
            restore_desktop_settings_backup,
            write_debug_log,
            pick_export_directory,
            pick_transcription_model,
            save_export_manifest,
            get_lifecycle_state,
            begin_background_task,
            finish_background_task,
            restore_window,
            quit_app,
            clear_webview_browsing_data,
            get_dashboard_data,
            get_focus_dashboard,
            get_module_context,
            save_module_context,
            flush_module_state,
            get_module_fonts,
            set_module_fonts,
            export_content_to_file,
            pick_import_file,
            create_quick_task,
            enforce_auth_user_boundary,
            get_active_module,
            set_active_module,
            get_installed_modules,
            fetch_module_registry,
            get_module_settings,
            set_module_settings,
            register_local_module,
            install_module,
            uninstall_module,
            // MCP Streamable HTTP Server
            crate::mcp::get_mcp_connection_info,
            crate::search::service::index_content,
            crate::search::service::search_in_module,
            crate::search::service::rebuild_index,
            crate::search::service::delete_from_index,
            consume_pending_deep_link,
            // Anytype-style local store
            crate::local_store::operations::local_store_block_add,
            crate::local_store::operations::local_store_block_update,
            crate::local_store::operations::local_store_block_delete,
            crate::local_store::operations::local_store_block_move,
            crate::local_store::operations::local_store_block_split,
            crate::local_store::operations::local_store_block_merge,
            crate::local_store::operations::local_store_get_blocks,
            crate::local_store::operations::local_store_get_block_children,
            crate::local_store::operations::local_store_create_object,
            crate::local_store::operations::local_store_get_object,
            crate::local_store::operations::local_store_get_objects,
            crate::local_store::operations::local_store_update_object,
            crate::local_store::operations::local_store_delete_object,
            crate::local_store::operations::local_store_search_objects,
            crate::local_store::operations::local_store_get_recent_objects,
            crate::local_store::operations::local_store_get_favorite_objects,
            crate::local_store::operations::local_store_toggle_favorite,
            crate::local_store::operations::local_store_set_relation,
            crate::local_store::operations::local_store_get_relations,
            crate::local_store::operations::local_store_get_objects_by_relation,
            crate::local_store::operations::local_store_delete_relation,
            // Notes Anytype-heart CRUD port
            crate::notes::commands::notes_object_create,
            crate::notes::commands::notes_object_get,
            crate::notes::commands::notes_object_full,
            crate::notes::commands::notes_list,
            crate::notes::commands::notes_object_update,
            crate::notes::commands::notes_object_delete,
            crate::notes::commands::notes_object_duplicate,
            crate::notes::commands::notes_block_create,
            crate::notes::commands::notes_block_unlink,
            crate::notes::commands::notes_block_split,
            crate::notes::commands::notes_block_merge,
            crate::notes::commands::notes_block_replace,
            crate::notes::commands::notes_block_duplicate,
            crate::notes::commands::notes_block_move,
            crate::notes::commands::notes_set_text_content,
            crate::notes::commands::notes_set_text_style,
            crate::notes::commands::notes_set_text_checked,
            crate::notes::commands::notes_set_text_color,
            crate::notes::commands::notes_set_text_mark,
            crate::notes::commands::notes_clear_text_style,
            crate::notes::commands::notes_clear_text_content,
            crate::notes::commands::notes_set_background_color,
            crate::notes::commands::notes_set_align,
            crate::notes::commands::notes_turn_into,
            crate::notes::commands::notes_set_layout,
            crate::notes::commands::notes_undo,
            crate::notes::commands::notes_redo,
            crate::notes::commands::notes_set_icon,
            crate::notes::commands::notes_get_blocks,
            crate::notes::commands::notes_search,
            crate::auth::bootstrap_auth_state,
            crate::auth::get_auth_bootstrap_state,
            crate::auth::check_auth_session,
            crate::auth::begin_google_auth,
            crate::auth::set_session_from_deep_link,
            crate::auth::prepare_login_window,
            crate::auth::prepare_shell_window,
            crate::auth::sign_out,
            crate::auth::open_external_url,
            crate::auth::get_billing_profile,
            crate::auth::get_billing_profile_cached,
            crate::auth::force_refresh_billing,
            crate::auth::finalize_subscription,
            // AI — Completion & streaming commands
            crate::ai::ai_complete,
            crate::ai::ai_stream,
            crate::ai::list_ai_models,
            crate::ai::get_ai_provider_status,
            // BYOK — Bring Your Own Key
            crate::byok::commands::byok_save_key,
            crate::byok::commands::byok_get_key_preview,
            crate::byok::commands::byok_list_providers,
            crate::byok::commands::byok_delete_key,
            crate::byok::commands::byok_test_connection,
            crate::byok::commands::byok_get_settings,
            crate::byok::commands::byok_update_settings,
            crate::byok::commands::byok_toggle_enabled,
            crate::byok::commands::byok_dismiss_onboarding,
            // Clipboard Manager
            crate::clipboard::clipboard_list,
            crate::clipboard::clipboard_get,
            crate::clipboard::clipboard_save,
            crate::clipboard::clipboard_pin,
            crate::clipboard::clipboard_favorite,
            crate::clipboard::clipboard_copy,
            crate::clipboard::clipboard_toggle_pin,
            crate::clipboard::clipboard_toggle_favorite,
            crate::clipboard::clipboard_delete,
            crate::clipboard::clipboard_delete_batch,
            crate::clipboard::clipboard_clear_unpinned,
            crate::clipboard::clipboard_clear_all,
            crate::clipboard::clipboard_search,
            crate::clipboard::clipboard_count,
            crate::clipboard::clipboard_expire_sensitive,
            crate::clipboard::clipboard_gc,
            crate::clipboard::clipboard_get_image_data,
            crate::clipboard::clipboard_get_image_path,
            crate::clipboard::clipboard_get_image_paths,
            crate::clipboard::clipboard_inject_stress,
            // Budget — Intelligent Budget Planner
            crate::budget::budget_list_categories,
            crate::budget::budget_suggest_limits,
            crate::budget::budget_set_category_budget,
            crate::budget::budget_add_transaction,
            crate::budget::budget_list_transactions,
            crate::budget::budget_delete_transaction,
            crate::budget::budget_update_transaction,
            crate::budget::budget_add_bill,
            crate::budget::budget_list_bills,
            crate::budget::budget_toggle_bill_paid,
            crate::budget::budget_delete_bill,
            crate::budget::budget_add_ai_cost,
            crate::budget::budget_list_ai_costs,
            crate::budget::budget_ai_cost_summary,
            crate::budget::budget_delete_ai_cost,
            crate::budget::budget_monthly_overview,
            crate::budget::budget_financial_health,
            crate::budget::budget_cash_flow_forecast,
            crate::budget::budget_cross_module_spending,
            crate::budget::budget_save_template,
            crate::budget::budget_list_templates,
            crate::budget::budget_delete_template,
            crate::budget::budget_forecast_chart_data,
            crate::budget::budget_export_pdf,
            crate::budget::budget_export_csv,
            // Audio recording & playback
            crate::audio::start_recording,
            crate::audio::stop_recording,
            crate::audio::pause_recording,
            crate::audio::resume_recording,
            crate::audio::get_recording_status,
            crate::audio::get_current_session,
            crate::audio::list_audio_devices,
            crate::audio::list_recordings,
            crate::audio::delete_recording,
            crate::audio::update_recording_title,
            crate::audio::playback_start,
            crate::audio::playback_pause,
            crate::audio::playback_resume,
            crate::audio::playback_stop,
            crate::audio::playback_is_playing,
            crate::audio::cancel_recording,
            crate::audio::retry_recording,
            crate::audio::check_microphone_permission,
            crate::audio::transcribe_recording,
            // Media player
            crate::media_player::get_now_playing,
            crate::media_player::get_audio_levels,
            crate::media_player::media_play_pause,
            crate::media_player::media_next_track,
            crate::media_player::media_previous_track,
            crate::media_player::media_seek,
            crate::media_player::activate_media_app,
            // Scheduler
            crate::scheduler::create_schedule,
            crate::scheduler::update_schedule,
            crate::scheduler::delete_schedule,
            crate::scheduler::get_schedules,
            crate::scheduler::get_due_schedules,
            // Notifications
            crate::notifications::send_module_notification,
            crate::notifications::dismiss_notification,
            crate::notifications::snooze_notification,
            crate::notifications::get_notification_history,
            // Health tracker
            crate::health::health_log_save,
            crate::health::health_log_today,
            crate::health::health_logs_week,
            crate::health::health_vitals_save,
            crate::health::health_vitals_list,
            crate::health::health_meds_list,
            crate::health::health_med_add,
            crate::health::health_med_toggle,
            crate::health::health_med_delete,
            // Mood tracker
            crate::mood::mood_checkin_save,
            crate::mood::mood_checkins_today,
            crate::mood::mood_checkins_month,
            crate::mood::mood_checkins_recent,
            crate::mood::mood_checkin_delete,
            crate::mood::mood_stats,
            crate::mood::mood_activity_library,
            crate::mood::mood_activity_add,
            crate::mood::mood_activity_delete,
            crate::mood::mood_patterns,
            crate::mood::mood_private_note_save,
            crate::mood::mood_private_notes_list,
            crate::mood::mood_private_note_delete,
            // Recipes
            crate::recipes::recipes_list,
            crate::recipes::recipe_save,
            crate::recipes::recipe_delete,
            crate::recipes::recipe_toggle_favorite,
            crate::recipes::recipe_rate,
            crate::recipes::recipe_add_to_collection,
            crate::recipes::recipe_toggle_ingredient,
            crate::recipes::collections_list,
            crate::recipes::collection_create,
            crate::recipes::collection_delete,
            crate::recipes::pantry_list,
            crate::recipes::pantry_upsert,
            crate::recipes::pantry_toggle,
            crate::recipes::shopping_list,
            crate::recipes::shopping_add,
            crate::recipes::shopping_toggle,
            crate::recipes::shopping_delete,
            crate::recipes::shopping_clear_checked,
            crate::recipes::shopping_add_from_recipe,
            crate::recipes::meal_plan_get,
            crate::recipes::meal_plan_set,
            crate::recipes::meal_plan_clear_slot,
            crate::recipes::diet_profile_get,
            crate::recipes::diet_profile_save,
            crate::recipes::cook_history_list,
            crate::recipes::cook_history_add,
            crate::recipes::recipes_seed_if_empty,
            // Sleep — session system (OS + manual)
            crate::sleep::get_sleep_sessions,
            crate::sleep::get_last_night,
            crate::sleep::get_sleep_goal,
            crate::sleep::update_sleep_goal,
            crate::sleep::add_manual_sleep_session,
            crate::sleep::delete_sleep_session,
            crate::sleep::confirm_sleep_session,
            crate::sleep::get_sleep_stats,
            // Sleep — legacy manual logs
            crate::sleep::sleep_log_save,
            crate::sleep::sleep_log_save_for_date,
            crate::sleep::sleep_log_today,
            crate::sleep::sleep_log_get,
            crate::sleep::sleep_logs_week,
            crate::sleep::sleep_logs_recent,
            crate::sleep::sleep_log_delete,
            // Sleep — legacy routines
            crate::sleep::sleep_routine_list,
            crate::sleep::sleep_routine_save,
            crate::sleep::sleep_routine_delete,
            crate::sleep::sleep_routine_reorder,
            crate::sleep::sleep_routine_status,
            crate::sleep::sleep_routine_toggle,
            // Sleep — legacy alarms
            crate::sleep::sleep_alarm_list,
            crate::sleep::sleep_alarm_save,
            crate::sleep::sleep_alarm_delete,
            crate::sleep::sleep_alarm_toggle,
            // Countdown — events, milestones, birthdays
            crate::commands::countdown::countdown_list_events,
            crate::commands::countdown::countdown_save_event,
            crate::commands::countdown::countdown_delete_event,
            crate::commands::countdown::countdown_list_milestones,
            crate::commands::countdown::countdown_save_milestone,
            crate::commands::countdown::countdown_update_milestone_progress,
            crate::commands::countdown::countdown_delete_milestone,
            crate::commands::countdown::countdown_list_birthdays,
            crate::commands::countdown::countdown_save_birthday,
            crate::commands::countdown::countdown_delete_birthday,
            // Nutrition — hydration, meals, macros, goals, reminders
            crate::commands::nutrition::nutrition_log_water,
            crate::commands::nutrition::nutrition_get_today_water,
            crate::commands::nutrition::nutrition_reset_water,
            crate::commands::nutrition::nutrition_get_weekly_water,
            crate::commands::nutrition::nutrition_log_meal,
            crate::commands::nutrition::nutrition_get_today_meals,
            crate::commands::nutrition::nutrition_get_meals_for_date,
            crate::commands::nutrition::nutrition_delete_meal,
            crate::commands::nutrition::nutrition_add_food_to_meal,
            crate::commands::nutrition::nutrition_get_goals,
            crate::commands::nutrition::nutrition_update_goals,
            crate::commands::nutrition::nutrition_get_today_summary,
            crate::commands::nutrition::nutrition_get_macro_totals,
            crate::commands::nutrition::nutrition_get_reminders,
            crate::commands::nutrition::nutrition_save_reminder,
            crate::commands::nutrition::nutrition_delete_reminder,
            crate::commands::nutrition::nutrition_toggle_reminder,
            crate::commands::nutrition::nutrition_get_hydration_stats,
            crate::commands::nutrition::nutrition_export_data,
            // Flashcards (Bento Recall)
            crate::flashcards::flashcards_list,
            crate::flashcards::flashcards_deck_create,
            crate::flashcards::flashcards_deck_delete,
            crate::flashcards::flashcards_card_create,
            crate::flashcards::flashcards_card_grade,
            crate::flashcards::flashcards_card_toggle_pin,
            crate::flashcards::flashcards_card_archive,
            crate::flashcards::flashcards_card_restore,
            crate::flashcards::flashcards_search,
            crate::flashcards::flashcards_review_queue,
            // Habits — Habit Tracker
            crate::habits::habits_list,
            crate::habits::habits_save,
            crate::habits::habits_delete,
            crate::habits::habits_toggle_complete,
            crate::habits::habits_increment,
            crate::habits::habits_get_stats,
            crate::habits::habits_export_csv,
            crate::habits::habits_get_freeze_state,
            crate::habits::habits_save_freeze_state,
            crate::habits::habits_skip_today,
            crate::habits::habits_unskip_today,
            crate::habits::habits_freeze_streak,
            crate::habits::habits_unfreeze_streak,
            // Goals — Goal Tracker
            crate::goals::goals_list,
            crate::goals::goals_save,
            crate::goals::goals_delete,
            crate::goals::goals_progress_update,
            crate::goals::goal_subtasks_list,
            crate::goals::goal_subtask_save,
            crate::goals::goal_subtask_toggle,
            crate::goals::goal_add_review,
            crate::goals::goal_reviews_list,
            crate::goals::goals_toggle_big_3,
            crate::goals::focus_areas_list,
            crate::goals::focus_area_save,
            crate::goals::focus_area_delete,
            // TheMealDB Discover & Import
            crate::meal_db::discover_search,
            crate::meal_db::discover_random,
            crate::meal_db::discover_meal_detail,
            crate::meal_db::discover_categories,
            crate::meal_db::discover_areas,
            crate::meal_db::discover_ingredients,
            crate::meal_db::discover_filter_by_category,
            crate::meal_db::discover_filter_by_area,
            crate::meal_db::discover_filter_by_ingredient,
            crate::meal_db::discover_import_meal,
            // Tab session
            crate::session::tab_open,
            crate::session::tab_close,
            crate::session::tab_switch,
            crate::session::tab_set_foreground,
            crate::session::tab_list,
            crate::session::tab_get_foreground,
            crate::session::tab_get,
            crate::session::tab_is_module_open,
            crate::session::tab_restore,
            crate::session::tab_handle_sync_event,
            // Journal
            crate::commands::journal::create_journal_entry,
            crate::commands::journal::save_journal_entry,
            crate::commands::journal::get_journal_entry,
            crate::commands::journal::list_journal_entries,
            crate::commands::journal::delete_journal_entry,
            // Tasks
            crate::commands::tasks::save_task,
            crate::commands::tasks::update_task,
            crate::commands::tasks::toggle_task,
            crate::commands::tasks::get_task,
            crate::commands::tasks::list_tasks,
            crate::commands::tasks::delete_task,
            crate::commands::tasks::log_activity_entry,
            crate::commands::tasks::list_activity_for_task,
            crate::commands::tasks::archive_task,
            crate::commands::tasks::duplicate_task,
            crate::commands::tasks::save_subtask,
            crate::commands::tasks::delete_subtask,
            crate::commands::tasks::list_subtasks_for_task,
            crate::commands::tasks::update_subtask_status,
            crate::commands::tasks::reorder_tasks,
            record_focus_session,
            export_focus_sessions,
            // Passwords Vault (E2EE SQLCipher)
            crate::commands::passwords::passwords_list,
            crate::commands::passwords::passwords_get,
            crate::commands::passwords::passwords_search,
            crate::commands::passwords::passwords_save,
            crate::commands::passwords::passwords_delete,
            crate::commands::passwords::passwords_migrate_from_storage,
            // AI Features Prefs (persisted via settings.json)
            crate::settings::commands::load_ai_features_prefs,
            crate::settings::commands::save_ai_features_prefs,
            // Language & Region
            crate::settings::commands::get_active_language,
            crate::settings::commands::set_interface_language,
            crate::settings::commands::get_supported_languages,
            // Share — central middle layer
            crate::share::share_content,
            crate::share::share_markdown,
            crate::share::share_json_to_file,
            crate::share::share_csv_to_file,
            // Feedback & Bug Reports
            submit_feedback,
            get_my_feedback,
            get_feedback_by_id,
            get_feedback_realtime_config,
            // Database encryption
            crate::crypto_commands::crypto_get_status,
            crate::crypto_commands::crypto_setup_master_password,
            crate::crypto_commands::crypto_unlock_database,
            crate::crypto_commands::crypto_lock_database,
            crate::crypto_commands::crypto_change_master_password,
            crate::crypto_commands::crypto_migrate_unencrypted_db,
            crate::crypto_commands::crypto_create_backup,
            crate::window_effects::set_window_glass,
            // Agent dock
            crate::agent::toggle_agent,
            crate::agent::show_agent,
            crate::agent::hide_agent,
            crate::agent::agent_start_drag,
            crate::agent::agent_set_composer_open,
            crate::agent::focus_main_from_agent,
            crate::agent::capture_screen,
            // Voice Engine
            crate::commands::voice::voice_start,
            crate::commands::voice::voice_stop,
            crate::commands::voice::voice_pause,
            crate::commands::voice::voice_resume,
            crate::commands::voice::voice_cancel,
            // Voice Engine — Transcription & Dictation
            crate::commands::transcription::voice_paste_dictation,
            crate::commands::transcription::voice_save_note,
            crate::commands::transcription::voice_get_note,
            // Dynamic Island
            crate::island::toggle_island,
            crate::island::show_island,
            crate::island::hide_island,
            crate::island::island_compact,
            crate::island::island_expand,
            crate::island::island_start_drag,
            crate::island::island_set_ignore_cursor_events,
            crate::island::set_island_enabled,
            crate::island::focus_main_window,
            crate::island::voice_set_island_state,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            eprintln!("[startup] error while running tauri application: {error}");
            std::process::exit(1);
        });
}
