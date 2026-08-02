// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.
//!
//! Typesafe IPC bridge (Rust -> TypeScript) built on `tauri-specta` + `specta`.
//!
//! The [`Builder`] here is used in two independent ways:
//! - [`export_bindings`] regenerates `src/lib/bindings.ts` (env-gated) for the frontend.
//! - The same command/event set is registered at runtime so the app keeps working.
//!
//! IMPORTANT: the runtime `tauri::generate_handler![...]` in `lib.rs` remains the
//! source of truth until every command there is also present in `collect_commands!`
//! below. Never register a command here that isn't annotated `#[specta::specta]`.

use serde::Serialize;
use specta::Type;
use specta_typescript::Typescript;
use tauri_specta::{Builder, Event};

// ───────────────────────────────────────────────────────────────────
// Events
// ───────────────────────────────────────────────────────────────────
// Each compiled event carries its real payload type so the frontend's
// `listen`/`emit` helpers are fully typed.

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "bento://lifecycle")]
pub struct LifecycleEvent(crate::runtime::LifecycleState);

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "app:locked")]
pub struct AppLockedEvent;

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "bento://startup-degraded")]
pub struct StartupDegradedEvent {
    reason: String,
    detail: Option<String>,
}

/// Commands collected for Specta export + runtime registration.
///
/// NOTE: expand this list as more commands are annotated with `#[specta::specta]`.
pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            crate::ping::ping,
            crate::commands::get_lifecycle_state,
            crate::commands::quit_app,
            crate::commands::write_debug_log,
            crate::commands::pick_export_directory,
            crate::commands::clear_webview_browsing_data,
            crate::commands::finish_background_task,
            crate::commands::consume_pending_deep_link,
            crate::commands::begin_background_task,
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
            // Tasks
            crate::commands::tasks::save_task,
            crate::commands::tasks::update_task,
            crate::commands::tasks::toggle_task,
            crate::commands::tasks::get_task,
            crate::commands::tasks::delete_task,
            crate::commands::tasks::list_tasks,
            crate::commands::tasks::get_task_count,
            crate::commands::tasks::log_activity_entry,
            crate::commands::tasks::archive_task,
            crate::commands::tasks::duplicate_task,
            crate::commands::tasks::save_subtask,
            crate::commands::tasks::delete_subtask,
            crate::commands::tasks::list_subtasks_for_task,
            crate::commands::tasks::update_subtask_status,
            crate::commands::tasks::reorder_tasks,
            crate::commands::tasks::list_activity_for_task,
            // Countdown
            crate::commands::countdown::countdown_list_events,
            crate::commands::countdown::countdown_save_event,
            crate::commands::countdown::countdown_update_event,
            crate::commands::countdown::countdown_delete_event,
            crate::commands::countdown::countdown_list_milestones,
            crate::commands::countdown::countdown_save_milestone,
            crate::commands::countdown::countdown_update_milestone_progress,
            crate::commands::countdown::countdown_delete_milestone,
            crate::commands::countdown::countdown_list_birthdays,
            crate::commands::countdown::countdown_save_birthday,
            crate::commands::countdown::countdown_update_birthday,
            crate::commands::countdown::countdown_delete_birthday,
            // Dashboard
            crate::commands::dashboard::get_dashboard_data,
            // Feedback
            crate::commands::feedback::submit_feedback,
            crate::commands::feedback::get_my_feedback,
            crate::commands::feedback::get_feedback_by_id,
            crate::commands::feedback::get_feedback_realtime_config,
            // Focus
            crate::commands::focus::get_focus_dashboard,
            crate::commands::focus::record_focus_session,
            crate::commands::focus::export_focus_sessions,
            // Journal
            crate::commands::journal::create_journal_entry,
            crate::commands::journal::save_journal_entry,
            crate::commands::journal::get_journal_entry,
            crate::commands::journal::delete_journal_entry,
            crate::commands::journal::list_journal_entries,
            // Nutrition
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
            // Passwords
            crate::commands::passwords::passwords_list,
            crate::commands::passwords::passwords_save,
            crate::commands::passwords::passwords_search,
            crate::commands::passwords::passwords_delete,
            // Transcription
            crate::commands::transcription::voice_paste_dictation,
            crate::commands::transcription::voice_save_note,
            crate::commands::transcription::voice_get_note,
            // Voice
            crate::commands::voice::voice_start,
            crate::commands::voice::voice_stop,
            crate::commands::voice::voice_pause,
            crate::commands::voice::voice_resume,
            crate::commands::voice::voice_cancel,
            crate::commands::voice::voice_save_memo,
            crate::commands::voice::dictation_process,
            crate::commands::voice::dictation_detect_agent,
            // Crypto
            crate::crypto_commands::crypto_get_status,
            crate::crypto_commands::crypto_setup_master_password,
            crate::crypto_commands::crypto_unlock_database,
            crate::crypto_commands::crypto_lock_database,
            crate::crypto_commands::crypto_change_master_password,
            crate::crypto_commands::crypto_migrate_unencrypted_db,
            crate::crypto_commands::crypto_create_backup,
            // BYOK
            crate::byok::commands::byok_save_key,
            crate::byok::commands::byok_get_key_preview,
            crate::byok::commands::byok_list_providers,
            crate::byok::commands::byok_delete_key,
            crate::byok::commands::byok_test_connection,
            crate::byok::commands::byok_get_settings,
            crate::byok::commands::byok_update_settings,
            crate::byok::commands::byok_validate_key,
            crate::byok::commands::byok_dismiss_onboarding,
            // ChatGPT auth
            crate::chatgpt_auth::commands::chatgpt_start_device_flow,
            crate::chatgpt_auth::commands::chatgpt_check_device_flow,
            crate::chatgpt_auth::commands::chatgpt_get_session,
            crate::chatgpt_auth::commands::chatgpt_sign_out,
            crate::chatgpt_auth::commands::chatgpt_test_connection,
            // Integrations
            crate::integrations::commands::list_integration_apps,
            crate::integrations::commands::get_integration_connections,
            crate::integrations::commands::connect_integration,
            crate::integrations::commands::disconnect_integration,
            crate::integrations::commands::save_composio_api_key,
            crate::integrations::commands::get_composio_api_key_status,
            crate::integrations::commands::delete_composio_api_key,
            crate::integrations::commands::cancel_integration_flow,
            crate::integrations::commands::test_composio_connection,
            crate::integrations::commands::execute_integration_action,
            crate::integrations::commands::list_integration_actions,
            crate::integrations::commands::get_integration_categories,
            crate::integrations::native::commands::start_telegram_poller_cmd,
            crate::integrations::native::commands::stop_telegram_poller_cmd,
            crate::integrations::native::commands::get_telegram_poller_status,
            // Notes
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
            crate::notes::commands::notes_get_backlinks,
            crate::notes::commands::notes_find_by_title,
            crate::notes::commands::notes_search_by_title,
            crate::notes::commands::notes_index_wikilinks,
            crate::notes::commands::notes_daily_note,
            crate::notes::commands::notes_templates_list,
            crate::notes::commands::notes_template_create,
            crate::notes::commands::notes_create_from_template,
            crate::notes::commands::notes_search,
            crate::notes::commands::notes_tags_list,
            crate::notes::commands::notes_tags_rename,
            crate::notes::commands::notes_tags_delete,
            crate::notes::commands::notes_set_block_fields,
            crate::notes::commands::notes_set_block_content,
            // Settings
            crate::settings::commands::get_account_info,
            crate::settings::commands::update_display_name,
            crate::settings::commands::revoke_device,
            crate::settings::commands::sign_out_backend,
            crate::settings::commands::delete_account_backend,
            crate::settings::commands::set_theme,
            crate::settings::commands::set_appearance,
            crate::settings::commands::get_privacy_settings,
            crate::settings::commands::set_privacy_settings,
            crate::settings::commands::lock_now,
            crate::settings::commands::check_biometric_support,
            crate::settings::commands::get_installed_modules_list,
            crate::settings::commands::get_available_modules,
            crate::settings::commands::install_module_v2,
            crate::settings::commands::uninstall_module_v2,
            crate::settings::commands::reorder_modules,
            crate::settings::commands::set_default_launch_module,
            crate::settings::commands::get_sync_status,
            crate::settings::commands::sync_now,
            crate::settings::commands::set_sync_enabled,
            crate::settings::commands::get_storage_breakdown,
            crate::settings::commands::export_all_data,
            crate::settings::commands::import_data,
            crate::settings::commands::clear_local_data,
            crate::settings::commands::save_api_key,
            crate::settings::commands::get_api_key_status,
            crate::settings::commands::test_ai_connection,
            crate::settings::commands::set_ai_config,
            crate::settings::commands::load_ai_features_prefs,
            crate::settings::commands::save_ai_features_prefs,
            crate::settings::commands::get_system_fonts,
            crate::settings::commands::download_font,
            crate::settings::commands::set_module_fonts_v2,
            crate::settings::commands::set_notification_config,
            crate::settings::commands::send_test_notification,
            crate::settings::commands::set_launch_on_login,
            crate::settings::commands::set_startup_config,
            crate::settings::commands::set_locale_config,
            crate::settings::commands::check_for_updates,
            crate::settings::commands::download_and_install_update,
            crate::settings::commands::set_update_channel,
            crate::settings::commands::get_system_info,
            crate::settings::commands::get_keyboard_shortcuts,
            crate::settings::commands::set_keyboard_shortcut,
            crate::settings::commands::reset_all_shortcuts,
            crate::settings::commands::set_accessibility_config,
            crate::settings::commands::get_active_language,
            crate::settings::commands::set_interface_language,
            crate::settings::commands::get_supported_languages,
            // Spectrum
            crate::spectrum::commands::apply_social_agent_config,
        ])
        .events(tauri_specta::collect_events![
            crate::typed::LifecycleEvent,
            crate::typed::AppLockedEvent,
            crate::typed::StartupDegradedEvent,
        ])
}

/// Regenerate `src/lib/bindings.ts`. Gated behind `BENTO_GEN_BINDINGS=1`
/// so production/CI builds use the committed file instead of rewriting it.
pub fn export_bindings() -> Result<(), String> {
    if std::env::var_os("BENTO_GEN_BINDINGS").is_none() {
        return Ok(());
    }
    let builder = builder();
    builder
        .export(Typescript::default(), "../src/lib/bindings.ts")
        .map_err(|e| format!("web failed to export TypeScript bindings: {e}"))
}

#[cfg(test)]
mod regeneration {
    use super::*;

    #[test]
    fn regenerate_typescript_bindings() {
        builder()
            .export(Typescript::default(), "../src/lib/bindings.ts")
            .expect("failed to export TypeScript bindings");
    }
}