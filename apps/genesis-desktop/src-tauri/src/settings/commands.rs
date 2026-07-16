use std::collections::HashMap;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle, Emitter, State};

use crate::auth::AuthManager;
use crate::byok::{self, ByokProvider, ConnectionTestResult};
use crate::db::BentoAppState;
use crate::settings;

// ──────────────────────────────────────────────────────────
// Shared types for all settings commands
// ──────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub plan: String,
    pub renewal_date: Option<String>,
    pub devices: Vec<DeviceInfo>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub os: String,
    pub last_synced: Option<String>,
    pub is_current: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearancePatch {
    pub theme_id: Option<String>,
    pub mode: Option<String>,
    pub accent_color: Option<String>,
    pub border_radius: Option<String>,
    pub density: Option<String>,
    pub animations_enabled: Option<bool>,
    pub sidebar_labels: Option<bool>,
    pub font_scale: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivacySettings {
    pub analytics: bool,
    pub crash_reports: bool,
    pub session_lock_timeout: Option<u64>,
    pub biometric_unlock: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModuleEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub active: bool,
    pub order: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableModuleEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_mb: f64,
    pub icon_url: Option<String>,
    pub accent: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub last_synced: Option<String>,
    pub pending_count: u32,
    pub devices: Vec<DeviceInfo>,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageBreakdownEntry {
    pub module: String,
    pub bytes_used: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    pub enabled: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub stream_tokens: bool,
    pub telemetry_healing: bool,
    pub ollama_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub is_set: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationConfig {
    pub enabled: bool,
    pub do_not_disturb_from: Option<String>,
    pub do_not_disturb_to: Option<String>,
    pub dnd_days: Vec<u8>,
    pub sound_enabled: bool,
    pub module_settings: HashMap<String, String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupConfig {
    pub launch_on_login: bool,
    pub start_minimized: bool,
    pub close_behavior: String,
    pub hardware_acceleration: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilityConfig {
    pub reduce_motion: bool,
    pub high_contrast: bool,
    pub focus_indicators_always_visible: bool,
    pub keyboard_navigation_mode: bool,
    pub text_size_override: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocaleConfig {
    pub language: String,
    pub date_format: String,
    pub time_format: String,
    pub week_starts_on: String,
    pub currency: String,
    pub units: String,
    pub number_format: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current_version: String,
    pub available_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_size: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub app_version: String,
    pub rust_version: String,
    pub webview_version: String,
    pub build_target: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutEntry {
    pub action: String,
    pub combo: String,
    pub category: String,
    pub default_combo: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConflict {
    pub action: String,
    pub current_combo: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyShortcutResult {
    pub success: bool,
    pub conflict: Option<ShortcutConflict>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFonts {
    pub primary: Option<String>,
    pub secondary: Option<String>,
    pub mono: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiometricSupportInfo {
    pub supported: bool,
    pub device_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSnapshot {
    pub desktop_settings: settings::DesktopSettings,
    pub account_info: Option<AccountInfo>,
    pub sync_status: SyncStatus,
    pub installed_modules: Vec<InstalledModuleEntry>,
    pub keyboard_shortcuts: Vec<ShortcutEntry>,
    pub privacy_settings: PrivacySettings,
    pub update_info: UpdateInfo,
    pub system_info: SystemInfo,
    pub biometric_support: BiometricSupportInfo,
    pub api_key_status: HashMap<String, ApiKeyStatus>,
    pub unsupported_commands: Vec<String>,
}

fn unsupported(setting: &str) -> String {
    format!("{setting} is not supported yet in the backend.")
}

fn platform_name() -> String {
    if cfg!(windows) {
        "Windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macOS".to_string()
    } else {
        "Linux".to_string()
    }
}

fn current_device_info(id: String) -> DeviceInfo {
    DeviceInfo {
        id,
        name: "This Device".to_string(),
        os: platform_name(),
        last_synced: None,
        is_current: true,
    }
}

fn privacy_from_settings(settings: &settings::DesktopSettings) -> PrivacySettings {
    PrivacySettings {
        analytics: settings.telemetry.consented,
        crash_reports: settings.telemetry.crash_reports,
        session_lock_timeout: None,
        biometric_unlock: false,
    }
}

// ──────────────────────────────────────────────────────────
// SECTION 1 — ACCOUNT
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_account_info(
    app: AppHandle,
    auth: State<'_, AuthManager>,
) -> Result<AccountInfo, String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to view account information.".to_string())?;
    let local_settings = settings::current_settings(&app);
    let billing_profile = auth.get_billing_profile().await.ok();

    let name = billing_profile
        .as_ref()
        .map(|profile| profile.display_name.clone())
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            if local_settings.display_name.trim().is_empty() {
                None
            } else {
                Some(local_settings.display_name.clone())
            }
        })
        .unwrap_or_else(|| session.user.name.clone());

    let email = billing_profile
        .as_ref()
        .map(|profile| profile.email.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| session.user.email.clone());

    let avatar_url = billing_profile
        .as_ref()
        .and_then(|profile| {
            if profile.avatar_url.trim().is_empty() {
                None
            } else {
                Some(profile.avatar_url.clone())
            }
        })
        .or_else(|| {
            if session.user.avatar_url.trim().is_empty() {
                None
            } else {
                Some(session.user.avatar_url.clone())
            }
        });

    let plan = billing_profile
        .as_ref()
        .map(|profile| match profile.billing_tier.as_str() {
            "core" => "Core".to_string(),
            "pro" => "Pro".to_string(),
            "power" => "Power".to_string(),
            _ => "Free".to_string(),
        })
        .unwrap_or_else(|| "Free".to_string());

    let renewal_date = billing_profile
        .as_ref()
        .and_then(|profile| profile.subscription_end_date.clone());

    Ok(AccountInfo {
        name,
        email,
        avatar_url,
        plan,
        renewal_date,
        devices: vec![DeviceInfo {
            id: session.user.id.clone(),
            name: "This Device".to_string(),
            os: platform_name(),
            last_synced: None,
            is_current: true,
        }],
    })
}

#[tauri::command]
pub async fn update_display_name(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    name: String,
) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Display name cannot be empty.".to_string());
    }
    if trimmed.len() > 100 {
        return Err("Display name must be 100 characters or fewer.".to_string());
    }

    if auth.current_session().await.is_some() {
        auth.update_display_name(trimmed.to_string()).await?;
    }

    settings::update_desktop_settings(&app, |next| {
        next.display_name = trimmed.to_string();
    })?;
    Ok(())
}

#[tauri::command]
pub async fn revoke_device(auth: State<'_, AuthManager>, device_id: String) -> Result<(), String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to revoke a device.".to_string())?;

    if device_id == session.user.id {
        auth.sign_out().await?;
        return Ok(());
    }

    Err(unsupported("Revoking other devices"))
}

#[tauri::command]
pub async fn sign_out_backend(auth: State<'_, AuthManager>) -> Result<(), String> {
    auth.sign_out().await
}

#[tauri::command]
pub async fn delete_account_backend(auth: State<'_, AuthManager>) -> Result<(), String> {
    auth.delete_account().await
}

// ──────────────────────────────────────────────────────────
// SECTION 2 — APPEARANCE
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let trimmed = theme.trim();
    if trimmed.is_empty() {
        return Err("Theme id cannot be empty.".to_string());
    }

    settings::update_desktop_settings(&app, |next| {
        next.appearance.theme_id = trimmed.to_string();
    })?;
    Ok(())
}

#[tauri::command]
pub async fn set_appearance(app: AppHandle, patch: AppearancePatch) -> Result<(), String> {
    if patch.accent_color.is_some()
        || patch.border_radius.is_some()
        || patch.density.is_some()
        || patch.animations_enabled.is_some()
        || patch.sidebar_labels.is_some()
        || patch.font_scale.is_some()
    {
        return Err(unsupported("Advanced appearance overrides"));
    }

    if patch.theme_id.is_none() && patch.mode.is_none() {
        return Err("No supported appearance fields were provided.".to_string());
    }

    settings::update_desktop_settings(&app, |next| {
        if let Some(theme_id) = patch.theme_id {
            next.appearance.theme_id = theme_id;
        }
        if let Some(mode) = patch.mode {
            next.appearance.mode = settings::normalize_mode(&mode);
        }
    })?;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 9 — PRIVACY & SECURITY
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_privacy_settings(app: AppHandle) -> Result<PrivacySettings, String> {
    Ok(privacy_from_settings(&settings::current_settings(&app)))
}

#[tauri::command]
pub async fn set_privacy_settings(app: AppHandle, patch: PrivacySettings) -> Result<(), String> {
    if patch.session_lock_timeout.is_some() || patch.biometric_unlock {
        return Err(unsupported("Session lock timeout and biometric unlock"));
    }

    settings::update_desktop_settings(&app, |next| {
        next.telemetry.consented = patch.analytics;
        next.telemetry.crash_reports = patch.crash_reports;
    })?;
    Ok(())
}

#[tauri::command]
pub async fn lock_now(app: AppHandle) -> Result<(), String> {
    let _ = app.emit("app:locked", ());
    Ok(())
}

#[tauri::command]
pub async fn check_biometric_support() -> Result<serde_json::Value, String> {
    // Stub: return OS-specific result
    let supported = cfg!(windows) || cfg!(target_os = "macos");
    let bio_type = if cfg!(windows) {
        "Windows Hello"
    } else if cfg!(target_os = "macos") {
        "Touch ID"
    } else {
        ""
    };
    Ok(serde_json::json!({
        "supported": supported,
        "type": bio_type
    }))
}

// ──────────────────────────────────────────────────────────
// SECTION 4 — MODULES & APPS
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_installed_modules_list(
    state: State<'_, BentoAppState>,
) -> Result<Vec<InstalledModuleEntry>, String> {
    let active_module = state.active_module();
    let modules = crate::modules::get_installed_modules(state).await?;

    Ok(modules
        .into_iter()
        .enumerate()
        .map(|(index, module)| {
            let name = module
                .manifest
                .get("name")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    module
                        .id
                        .split('-')
                        .filter(|segment| !segment.is_empty())
                        .map(|segment| {
                            let mut chars = segment.chars();
                            match chars.next() {
                                Some(first) => {
                                    first.to_uppercase().chain(chars).collect::<String>()
                                }
                                None => String::new(),
                            }
                        })
                        .collect::<Vec<_>>()
                        .join(" ")
                });

            InstalledModuleEntry {
                id: module.id.clone(),
                name,
                version: module.version,
                active: module.id == active_module,
                order: index as u32,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn get_available_modules(
    state: State<'_, BentoAppState>,
) -> Result<Vec<AvailableModuleEntry>, String> {
    Ok(crate::modules::fetch_module_registry(state)
        .await?
        .into_iter()
        .map(|module| AvailableModuleEntry {
            id: module.id,
            name: module.name,
            description: module.description,
            size_mb: module.size_mb,
            icon_url: module.icon_url,
            accent: module.accent,
        })
        .collect())
}

#[tauri::command]
pub async fn install_module_v2(
    _app: AppHandle,
    state: State<'_, BentoAppState>,
    module_id: String,
    bundle_url: String,
    checksum: String,
    on_progress: Channel<f32>,
) -> Result<(), String> {
    crate::modules::install_module(module_id, bundle_url, checksum, on_progress).await?;
    let _ = state;
    Ok(())
}

#[tauri::command]
pub async fn uninstall_module_v2(
    app: AppHandle,
    state: State<'_, BentoAppState>,
    module_id: String,
) -> Result<(), String> {
    crate::modules::uninstall_module(app, state, module_id).await
}

#[tauri::command]
pub async fn reorder_modules(order: Vec<String>) -> Result<(), String> {
    let _ = order;
    Err(unsupported("Module reordering"))
}

#[tauri::command]
pub async fn set_default_launch_module(module_id: String) -> Result<(), String> {
    let _ = module_id;
    Err(unsupported("Default launch module"))
}

// ──────────────────────────────────────────────────────────
// SECTION 5 — SYNC & STORAGE
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sync_status(auth: State<'_, AuthManager>) -> Result<SyncStatus, String> {
    let session = auth.current_session().await;
    let status = if session.is_some() {
        "synced"
    } else {
        "signed_out"
    };

    Ok(SyncStatus {
        last_synced: None,
        pending_count: 0,
        devices: session
            .map(|session| vec![current_device_info(session.user.id)])
            .unwrap_or_default(),
        status: status.to_string(),
    })
}

#[tauri::command]
pub async fn sync_now(app: AppHandle, auth: State<'_, AuthManager>) -> Result<(), String> {
    app.emit("sync:progress", serde_json::json!({"status": "syncing"}))
        .map_err(|error| error.to_string())?;
    auth.sync_profile_now().await?;
    app.emit("sync:complete", serde_json::json!({"status": "synced"}))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_sync_enabled(enabled: bool) -> Result<(), String> {
    let _ = enabled;
    Err(unsupported("Sync enablement"))
}

#[tauri::command]
pub async fn get_storage_breakdown() -> Result<Vec<StorageBreakdownEntry>, String> {
    Err(unsupported("Storage breakdown reporting"))
}

#[tauri::command]
pub async fn export_all_data() -> Result<Option<String>, String> {
    Err(unsupported("Full data export"))
}

#[tauri::command]
pub async fn import_data(file_path: String) -> Result<(), String> {
    let _ = file_path;
    Err(unsupported("Data import"))
}

#[tauri::command]
pub async fn clear_local_data() -> Result<(), String> {
    Err(unsupported("Clearing local data"))
}

// ──────────────────────────────────────────────────────────
// SECTION 6 — AI & INTELLIGENCE
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn save_api_key(app: AppHandle, provider: String, key: String) -> Result<(), String> {
    ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;
    crate::settings::update_desktop_settings(&app, |next| {
        byok::save_api_key(&provider, key.trim(), &mut next.byok);
    })
    .map(|_| ())
}
#[tauri::command]
pub async fn get_api_key_status(app: AppHandle, provider: String) -> Result<ApiKeyStatus, String> {
    let parsed =
        ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;
    let settings = crate::settings::current_settings(&app);
    let is_set = !parsed.requires_key() || byok::has_api_key(&provider, &settings.byok);
    Ok(ApiKeyStatus { is_set })
}

#[tauri::command]
pub async fn test_ai_connection(
    app: AppHandle,
    provider: String,
) -> Result<ConnectionTestResult, String> {
    ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;
    let settings = crate::settings::current_settings(&app);
    let base_url_overrides = settings.byok.base_url_overrides.clone();
    let result = byok::test_connection(&provider, &base_url_overrides, &settings.byok).await;
    Ok(result)
}

#[tauri::command]
pub async fn set_ai_config(patch: AiConfig) -> Result<(), String> {
    let _ = patch;
    Ok(())
}

// ── AI Features Prefs ─────────────────────────────────────────────────────────

/// Load the current AI features preferences from settings.
#[tauri::command]
pub async fn load_ai_features_prefs(app: AppHandle) -> Result<settings::AiFeaturesPrefs, String> {
    let settings = settings::current_settings(&app);
    let mut prefs = settings.ai;

    // Ensure the features map is populated with defaults if it's empty
    if prefs.features.is_empty() {
        prefs.features = settings::default_ai_features();
    }

    Ok(prefs)
}

/// Save AI features preferences (partial patch allowed).
/// Fields set to `None` are left unchanged.
#[tauri::command]
pub async fn save_ai_features_prefs(
    app: AppHandle,
    patch: settings::AiFeaturesPrefsPatch,
) -> Result<settings::AiFeaturesPrefs, String> {
    let result = settings::update_desktop_settings(&app, |next| {
        if let Some(enabled) = patch.enabled {
            next.ai.enabled = enabled;
        }
        if let Some(features) = patch.features {
            // Merge: only update the keys that were provided
            for (key, value) in features {
                next.ai.features.insert(key, value);
            }
        }
        if let Some(system_prompt) = patch.system_prompt {
            next.ai.system_prompt = system_prompt;
        }
    })?;

    Ok(result.ai)
}

// ──────────────────────────────────────────────────────────
// SECTION 3 — TYPOGRAPHY
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    // Stub: return common system fonts
    Ok(vec![
        "Arial".to_string(),
        "Helvetica".to_string(),
        "Times New Roman".to_string(),
        "Georgia".to_string(),
        "Courier New".to_string(),
        "Segoe UI".to_string(),
        "SF Pro".to_string(),
        "System UI".to_string(),
    ])
}

#[tauri::command]
pub async fn download_font(font_id: String) -> Result<String, String> {
    // Stub: pretend to download font
    let path = std::env::temp_dir()
        .join("fonts")
        .join(format!("{font_id}.woff2"));
    std::fs::create_dir_all(path.parent().unwrap()).ok();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_module_fonts_v2(module: String, fonts: ModuleFonts) -> Result<(), String> {
    let _ = module;
    let _ = fonts;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 7 — NOTIFICATIONS
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_notification_config(config: NotificationConfig) -> Result<(), String> {
    let _ = config;
    Ok(())
}

#[tauri::command]
pub async fn send_test_notification(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title("Bento")
        .body("This is a test notification from your settings.")
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 10 — SYSTEM & STARTUP
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_launch_on_login(enabled: bool) -> Result<(), String> {
    let _ = enabled;
    // Stub: would use tauri-plugin-autostart
    Ok(())
}

#[tauri::command]
pub async fn set_startup_config(config: StartupConfig) -> Result<(), String> {
    let _ = config;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 12 — LANGUAGE & REGION
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_locale_config(app: AppHandle, config: LocaleConfig) -> Result<(), String> {
    let normalized_lang = settings::normalize_language_code(&config.language);
    let date_fmt = match config.date_format.as_str() {
        "DD/MM/YYYY" => settings::DateFormat::DdMmYyyy,
        "YYYY-MM-DD" => settings::DateFormat::YyyyMmDd,
        "DD.MM.YYYY" => settings::DateFormat::DdMmYyyyDot,
        "MMMM D, YYYY" => settings::DateFormat::Long,
        _ => settings::DateFormat::MmDdYyyy,
    };
    let time_fmt = match config.time_format.as_str() {
        "24h" => settings::TimeFormat::H24,
        _ => settings::TimeFormat::H12,
    };
    let first_day = match config.week_starts_on.as_str() {
        "sunday" => settings::FirstDay::Sunday,
        "saturday" => settings::FirstDay::Saturday,
        _ => settings::FirstDay::Monday,
    };
    settings::update_desktop_settings(&app, |next| {
        next.language.code = normalized_lang;
        next.language.date_format = date_fmt;
        next.language.time_format = time_fmt;
        next.language.first_day = first_day;
    })?;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 13 — UPDATES
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    // Stub: return current version only (no update available)
    Ok(UpdateInfo {
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        available_version: None,
        release_notes: None,
        download_size: None,
    })
}

#[tauri::command]
pub async fn download_and_install_update(_on_progress: Channel<f32>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn set_update_channel(channel: String) -> Result<(), String> {
    let supported = ["stable", "beta"];
    if !supported.contains(&channel.as_str()) {
        return Err(format!("Unknown update channel: {channel}"));
    }
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 14 — ABOUT
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os_name: std::env::consts::OS.to_string(),
        os_version: "Unknown".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        rust_version: "1.85".to_string(),
        webview_version: "WebView2 (Chromium)".to_string(),
        build_target: std::env::consts::ARCH.to_string(),
    })
}

// ──────────────────────────────────────────────────────────
// SECTION 8 — KEYBOARD SHORTCUTS
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_keyboard_shortcuts() -> Result<Vec<ShortcutEntry>, String> {
    Ok(vec![
        ShortcutEntry {
            action: "Open Settings".to_string(),
            combo: "Cmd+,".to_string(),
            category: "Global".to_string(),
            default_combo: "Cmd+,".to_string(),
        },
        ShortcutEntry {
            action: "Switch Module".to_string(),
            combo: "Cmd+Shift+M".to_string(),
            category: "Global".to_string(),
            default_combo: "Cmd+Shift+M".to_string(),
        },
        ShortcutEntry {
            action: "Search".to_string(),
            combo: "Cmd+F".to_string(),
            category: "Global".to_string(),
            default_combo: "Cmd+F".to_string(),
        },
        ShortcutEntry {
            action: "New Item".to_string(),
            combo: "Cmd+N".to_string(),
            category: "Global".to_string(),
            default_combo: "Cmd+N".to_string(),
        },
        ShortcutEntry {
            action: "Toggle Sidebar".to_string(),
            combo: "Cmd+B".to_string(),
            category: "Navigation".to_string(),
            default_combo: "Cmd+B".to_string(),
        },
        ShortcutEntry {
            action: "Next Tab".to_string(),
            combo: "Option+Right".to_string(),
            category: "Navigation".to_string(),
            default_combo: "Option+Right".to_string(),
        },
        ShortcutEntry {
            action: "Previous Tab".to_string(),
            combo: "Option+Left".to_string(),
            category: "Navigation".to_string(),
            default_combo: "Option+Left".to_string(),
        },
    ])
}

#[tauri::command]
pub async fn set_keyboard_shortcut(
    _action: String,
    _combo: String,
) -> Result<KeyShortcutResult, String> {
    // Stub: accept shortcut
    Ok(KeyShortcutResult {
        success: true,
        conflict: None,
    })
}

#[tauri::command]
pub async fn reset_all_shortcuts() -> Result<(), String> {
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 11 — ACCESSIBILITY
// ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_accessibility_config(config: AccessibilityConfig) -> Result<(), String> {
    let _ = config;
    Ok(())
}

// ──────────────────────────────────────────────────────────
// SECTION 12 — LANGUAGE (extended Tauri commands)
// Port of Anytype's Action.setInterfaceLang pattern.
// The heavy lifting (bundle loading, HTML dir) is done in the frontend;
// Rust is responsible for validation and persistence only.
// ──────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageInfo {
    pub code: String,
    pub label: String,
    pub direction: String,
    pub locale: String,
    pub is_rtl: bool,
}

/// Returns metadata for the currently active interface language.
/// Matches Anytype's S.Common.interfaceLang getter.
#[tauri::command]
pub async fn get_active_language(app: AppHandle) -> Result<LanguageInfo, String> {
    let settings = settings::current_settings(&app);
    let lang = &settings.language.code;
    Ok(LanguageInfo {
        code: serde_json::to_value(lang)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "en".to_string()),
        label: lang.label(),
        direction: if lang.is_rtl() {
            "rtl".to_string()
        } else {
            "ltr".to_string()
        },
        locale: lang.locale().to_string(),
        is_rtl: lang.is_rtl(),
    })
}

/// Persist the chosen interface language code.
/// Mirrors Anytype's Action.setInterfaceLang (Renderer.send side).
#[tauri::command]
pub async fn set_interface_language(app: AppHandle, code: String) -> Result<LanguageInfo, String> {
    let normalized = settings::normalize_language_code(&code);
    settings::update_desktop_settings(&app, |next| {
        next.language.code = normalized.clone();
    })?;
    Ok(LanguageInfo {
        code: serde_json::to_value(&normalized)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "en".to_string()),
        label: normalized.label(),
        direction: if normalized.is_rtl() {
            "rtl".to_string()
        } else {
            "ltr".to_string()
        },
        locale: normalized.locale().to_string(),
        is_rtl: normalized.is_rtl(),
    })
}

/// Returns the full list of supported interface languages.
/// Matches Anytype's U.Menu.getInterfaceLanguages().
#[tauri::command]
pub async fn get_supported_languages() -> Result<Vec<LanguageInfo>, String> {
    use settings::LanguageCode;
    let all: &[LanguageCode] = &[
        LanguageCode::En,
        LanguageCode::Ar,
        LanguageCode::Be,
        LanguageCode::Cs,
        LanguageCode::Da,
        LanguageCode::De,
        LanguageCode::Es,
        LanguageCode::Fa,
        LanguageCode::Fr,
        LanguageCode::Hi,
        LanguageCode::Id,
        LanguageCode::It,
        LanguageCode::Ja,
        LanguageCode::Ko,
        LanguageCode::Lt,
        LanguageCode::Nl,
        LanguageCode::No,
        LanguageCode::Pl,
        LanguageCode::PtBr,
        LanguageCode::PtPt,
        LanguageCode::Ro,
        LanguageCode::Ru,
        LanguageCode::Tr,
        LanguageCode::Uk,
        LanguageCode::Vi,
        LanguageCode::ZhCn,
        LanguageCode::ZhTw,
    ];
    Ok(all
        .iter()
        .map(|lang| LanguageInfo {
            code: serde_json::to_value(lang)
                .ok()
                .and_then(|v| v.as_str().map(str::to_string))
                .unwrap_or_default(),
            label: lang.label(),
            direction: if lang.is_rtl() {
                "rtl".to_string()
            } else {
                "ltr".to_string()
            },
            locale: lang.locale().to_string(),
            is_rtl: lang.is_rtl(),
        })
        .collect())
}
