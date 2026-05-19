pub mod commands;

use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

use crate::{runtime::DesktopRuntime, window_bounds::restore_main_window};

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    #[serde(default)]
    pub schema_version: u32,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub language: LanguageSettings,
    #[serde(default)]
    pub workspace: WorkspaceSettings,
    #[serde(default)]
    pub window: WindowSettings,
    #[serde(default)]
    pub shortcuts: ShortcutSettings,
    #[serde(default)]
    pub notifications: NotificationSettings,
    #[serde(default)]
    pub telemetry: TelemetrySettings,
    #[serde(default)]
    pub files: FileSettings,
    #[serde(default)]
    pub migration: MigrationSettings,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    #[serde(default = "default_theme_id")]
    pub theme_id: String,
    #[serde(default)]
    pub mode: ThemeMode,
    #[serde(default = "default_font_pairing_id")]
    pub font_pairing_id: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LanguageSettings {
    #[serde(default = "default_language_code")]
    pub code: LanguageCode,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSettings {
    #[serde(default)]
    pub sidebar_collapsed: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowSettings {
    #[serde(default = "default_restore_on_launch")]
    pub restore_on_launch: bool,
    #[serde(default)]
    pub start_hidden: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutSettings {
    #[serde(default = "default_reopen_shortcut_id")]
    pub reopen_id: ReopenShortcutId,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    #[serde(default = "default_background_alerts")]
    pub background_alerts: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySettings {
    #[serde(default)]
    pub consented: bool,
    #[serde(default)]
    pub crash_reports: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileSettings {
    #[serde(default)]
    pub export_directory: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationSettings {
    #[serde(default)]
    pub legacy_browser_storage_migrated: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
    #[default]
    Light,
    Dark,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LanguageCode {
    #[default]
    En,
    Ar,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ReopenShortcutId {
    #[serde(alias = "ctrlAltG")]
    CtrlAltG,
    #[default]
    #[serde(alias = "ctrlShiftG")]
    CtrlShiftG,
    #[serde(alias = "ctrlShiftSpace")]
    CtrlShiftSpace,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyDesktopSettings {
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub font_pairing_id: Option<String>,
    #[serde(default)]
    pub language_code: Option<String>,
    #[serde(default)]
    pub sidebar_collapsed: Option<bool>,
    #[serde(default)]
    pub reopen_id: Option<String>,
    #[serde(default)]
    pub background_alerts: Option<bool>,
    #[serde(default)]
    pub telemetry_consented: Option<bool>,
    #[serde(default)]
    pub export_directory: Option<String>,
}

fn default_theme_id() -> String {
    "default".to_string()
}

fn default_font_pairing_id() -> String {
    "playful-classic".to_string()
}

fn default_language_code() -> LanguageCode {
    LanguageCode::En
}

fn default_restore_on_launch() -> bool {
    true
}

fn default_reopen_shortcut_id() -> ReopenShortcutId {
    ReopenShortcutId::CtrlShiftG
}

fn default_background_alerts() -> bool {
    true
}

pub fn settings_file_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("genesis-desktop"))
        .join(SETTINGS_FILE_NAME)
}

pub fn resolve_export_directory(app: &AppHandle, settings: &DesktopSettings) -> PathBuf {
    if !settings.files.export_directory.trim().is_empty() {
        return PathBuf::from(&settings.files.export_directory);
    }

    app.path()
        .download_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("Downloads"))
        .join("Genesis")
        .join("exports")
}

pub fn default_settings() -> DesktopSettings {
    DesktopSettings {
        schema_version: 1,
        display_name: String::new(),
        appearance: AppearanceSettings {
            theme_id: default_theme_id(),
            mode: ThemeMode::Light,
            font_pairing_id: default_font_pairing_id(),
        },
        language: LanguageSettings {
            code: default_language_code(),
        },
        workspace: WorkspaceSettings {
            sidebar_collapsed: false,
        },
        window: WindowSettings {
            restore_on_launch: true,
            start_hidden: false,
        },
        shortcuts: ShortcutSettings {
            reopen_id: default_reopen_shortcut_id(),
        },
        notifications: NotificationSettings {
            background_alerts: default_background_alerts(),
        },
        telemetry: TelemetrySettings {
            consented: false,
            crash_reports: false,
        },
        files: FileSettings {
            export_directory: String::new(),
        },
        migration: MigrationSettings {
            legacy_browser_storage_migrated: false,
        },
    }
}

pub fn load_desktop_settings(app: &AppHandle) -> DesktopSettings {
    let path = settings_file_path(app);
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<DesktopSettings>(&raw) {
            let normalized = normalize_settings(&settings);
            if normalized != settings {
                let _ = save_desktop_settings(app, &normalized);
                return normalized;
            }

            return settings;
        }
    }

    let defaults = default_settings();
    let _ = save_desktop_settings(app, &defaults);
    defaults
}

pub fn save_desktop_settings(
    app: &AppHandle,
    settings: &DesktopSettings,
) -> Result<DesktopSettings, String> {
    let path = settings_file_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let normalized = normalize_settings(settings);
    let payload = serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?;
    fs::write(&path, payload).map_err(|error| error.to_string())?;

    let previous_shortcut = app
        .try_state::<DesktopRuntime>()
        .map(|runtime| runtime.settings().shortcuts.reopen_id);

    if let Some(runtime) = app.try_state::<DesktopRuntime>() {
        runtime.replace_settings(normalized.clone());
    }

    apply_reopen_shortcut(
        app,
        previous_shortcut,
        normalized.shortcuts.reopen_id.clone(),
    )?;

    Ok(normalized)
}

pub fn normalize_settings(settings: &DesktopSettings) -> DesktopSettings {
    let mut normalized = settings.clone();
    normalized.schema_version = 1;
    normalized.appearance.theme_id = normalize_theme_id(&normalized.appearance.theme_id);
    normalized.appearance.font_pairing_id =
        normalize_font_pairing_id(&normalized.appearance.font_pairing_id);
    normalized.shortcuts.reopen_id = normalize_shortcut_id(&normalized.shortcuts.reopen_id);
    normalized
}

pub fn apply_legacy_settings(
    base: &DesktopSettings,
    legacy: &LegacyDesktopSettings,
) -> DesktopSettings {
    let mut merged = base.clone();

    if let Some(theme_id) = legacy.theme_id.as_ref() {
        merged.appearance.theme_id = normalize_theme_id(theme_id);
    }

    if let Some(mode) = legacy.mode.as_ref() {
        merged.appearance.mode = normalize_mode(mode);
    }

    if let Some(font_pairing_id) = legacy.font_pairing_id.as_ref() {
        merged.appearance.font_pairing_id = normalize_font_pairing_id(font_pairing_id);
    }

    if let Some(language_code) = legacy.language_code.as_ref() {
        merged.language.code = normalize_language_code(language_code);
    }

    if let Some(sidebar_collapsed) = legacy.sidebar_collapsed {
        merged.workspace.sidebar_collapsed = sidebar_collapsed;
    }

    if let Some(reopen_id) = legacy.reopen_id.as_ref() {
        merged.shortcuts.reopen_id = normalize_shortcut_id_from_str(reopen_id);
    }

    if let Some(background_alerts) = legacy.background_alerts {
        merged.notifications.background_alerts = background_alerts;
    }

    if let Some(telemetry_consented) = legacy.telemetry_consented {
        merged.telemetry.consented = telemetry_consented;
    }

    if let Some(export_directory) = legacy.export_directory.as_ref() {
        merged.files.export_directory = export_directory.clone();
    }

    normalize_settings(&merged)
}

pub fn normalize_mode(mode: &str) -> ThemeMode {
    match mode.to_ascii_lowercase().as_str() {
        "dark" => ThemeMode::Dark,
        _ => ThemeMode::Light,
    }
}

pub fn normalize_theme_id(theme_id: &str) -> String {
    if theme_id.trim().is_empty() {
        default_theme_id()
    } else {
        theme_id.to_string()
    }
}

pub fn normalize_font_pairing_id(font_pairing_id: &str) -> String {
    if font_pairing_id.trim().is_empty() {
        default_font_pairing_id()
    } else {
        font_pairing_id.to_string()
    }
}

pub fn normalize_language_code(language_code: &str) -> LanguageCode {
    match language_code.to_ascii_lowercase().as_str() {
        "ar" => LanguageCode::Ar,
        _ => LanguageCode::En,
    }
}

pub fn normalize_shortcut_id(shortcut_id: &ReopenShortcutId) -> ReopenShortcutId {
    shortcut_id.clone()
}

pub fn normalize_shortcut_id_from_str(shortcut_id: &str) -> ReopenShortcutId {
    match shortcut_id {
        "ctrl-alt-g" => ReopenShortcutId::CtrlAltG,
        "ctrl-shift-space" => ReopenShortcutId::CtrlShiftSpace,
        _ => ReopenShortcutId::CtrlShiftG,
    }
}

fn reopen_shortcut(shortcut_id: &ReopenShortcutId) -> Shortcut {
    match shortcut_id {
        ReopenShortcutId::CtrlAltG => {
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG)
        }
        ReopenShortcutId::CtrlShiftSpace => {
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
        }
        ReopenShortcutId::CtrlShiftG => {
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyG)
        }
    }
}

pub fn apply_configured_shortcuts(
    app: &AppHandle,
    settings: &DesktopSettings,
) -> Result<(), String> {
    apply_reopen_shortcut(app, None, settings.shortcuts.reopen_id.clone())
}

fn apply_reopen_shortcut(
    app: &AppHandle,
    previous_shortcut_id: Option<ReopenShortcutId>,
    shortcut_id: ReopenShortcutId,
) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();

    if let Some(previous_shortcut_id) = previous_shortcut_id {
        let _ = global_shortcut.unregister(reopen_shortcut(&previous_shortcut_id));
    }

    let shortcut = reopen_shortcut(&shortcut_id);

    global_shortcut
        .on_shortcut(
            shortcut,
            move |app_handle: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent| {
                if event.state != ShortcutState::Pressed {
                    return;
                }

                if let Some(runtime) = app_handle.try_state::<DesktopRuntime>() {
                    runtime.clear_backgrounded();
                    let state = runtime.lifecycle_state();
                    let _ = DesktopRuntime::emit_lifecycle_state(app_handle, state.clone());

                    if state != crate::runtime::LifecycleState::Exiting {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = restore_main_window(&window);
                        }
                    }
                }
            },
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn current_settings(app: &AppHandle) -> DesktopSettings {
    app.try_state::<DesktopRuntime>()
        .map(|runtime| runtime.settings())
        .unwrap_or_else(default_settings)
}

pub fn update_desktop_settings<F>(app: &AppHandle, mutator: F) -> Result<DesktopSettings, String>
where
    F: FnOnce(&mut DesktopSettings),
{
    let mut settings = current_settings(app);
    mutator(&mut settings);
    save_desktop_settings(app, &settings)
}

pub fn format_reopen_shortcut(shortcut_id: &ReopenShortcutId) -> String {
    let modifier = if cfg!(target_os = "macos") {
        "Cmd"
    } else {
        "Ctrl"
    };

    match shortcut_id {
        ReopenShortcutId::CtrlAltG => format!("{modifier}+Alt+G"),
        ReopenShortcutId::CtrlShiftSpace => format!("{modifier}+Shift+Space"),
        ReopenShortcutId::CtrlShiftG => format!("{modifier}+Shift+G"),
    }
}

pub fn parse_reopen_shortcut_combo(combo: &str) -> Option<ReopenShortcutId> {
    let normalized = combo
        .trim()
        .replace(' ', "")
        .to_ascii_lowercase();

    match normalized.as_str() {
        "cmd+alt+g" | "ctrl+alt+g" => Some(ReopenShortcutId::CtrlAltG),
        "cmd+shift+space" | "ctrl+shift+space" => Some(ReopenShortcutId::CtrlShiftSpace),
        "cmd+shift+g" | "ctrl+shift+g" => Some(ReopenShortcutId::CtrlShiftG),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        default_settings, format_reopen_shortcut, normalize_settings, parse_reopen_shortcut_combo,
        DesktopSettings, ReopenShortcutId,
    };
    use serde_json::json;

    #[test]
    fn default_settings_start_with_legacy_browser_migration_pending() {
        let settings = default_settings();

        assert!(!settings.migration.legacy_browser_storage_migrated);
    }

    #[test]
    fn normalize_settings_preserves_completed_legacy_browser_migration() {
        let mut settings = DesktopSettings::default();
        settings.migration.legacy_browser_storage_migrated = true;

        let normalized = normalize_settings(&settings);

        assert!(normalized.migration.legacy_browser_storage_migrated);
    }

    #[test]
    fn legacy_shortcut_serializes_in_kebab_case_and_accepts_old_camel_case() {
        let legacy = json!({
            "schemaVersion": 1,
            "appearance": {
                "themeId": "default",
                "mode": "light",
                "fontPairingId": "playful-classic"
            },
            "language": { "code": "en" },
            "workspace": { "sidebarCollapsed": false },
            "window": { "restoreOnLaunch": true, "startHidden": false },
            "shortcuts": { "reopenId": "ctrlShiftG" },
            "notifications": { "backgroundAlerts": true },
            "telemetry": { "consented": false, "crashReports": false },
            "files": { "exportDirectory": "" },
            "migration": { "legacyBrowserStorageMigrated": false }
        });

        let parsed: DesktopSettings = serde_json::from_value(legacy).expect("legacy settings should parse");
        let reserialized = serde_json::to_value(&parsed).expect("settings should serialize");

        assert_eq!(reserialized["shortcuts"]["reopenId"], "ctrl-shift-g");
    }

    #[test]
    fn parse_reopen_shortcut_combo_accepts_common_platform_variants() {
        assert_eq!(
            parse_reopen_shortcut_combo("Cmd+Alt+G"),
            Some(ReopenShortcutId::CtrlAltG)
        );
        assert_eq!(
            parse_reopen_shortcut_combo("Ctrl+Shift+Space"),
            Some(ReopenShortcutId::CtrlShiftSpace)
        );
        assert_eq!(
            parse_reopen_shortcut_combo("Cmd+Shift+G"),
            Some(ReopenShortcutId::CtrlShiftG)
        );
    }

    #[test]
    fn format_reopen_shortcut_produces_a_display_combo() {
        assert!(!format_reopen_shortcut(&ReopenShortcutId::CtrlShiftG).is_empty());
    }
}
