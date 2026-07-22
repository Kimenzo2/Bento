pub mod commands;

use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

use crate::{
    byok::ByokSettings, payments::PaymentReceipt, runtime::DesktopRuntime,
    window_bounds::restore_main_window,
};

use std::collections::HashMap;

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
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
    #[serde(default)]
    pub payment: PaymentSettings,
    #[serde(default)]
    pub byok: ByokSettings,
    #[serde(default)]
    pub cloud_backup: CloudBackupSettings,
    #[serde(default)]
    pub habits: HabitSettings,
    #[serde(default)]
    pub ai: AiFeaturesPrefs,
    #[serde(default = "default_dynamic_island_enabled")]
    pub dynamic_island_enabled: bool,
    #[serde(default = "default_agent_dock_enabled")]
    pub agent_dock_enabled: bool,
    #[serde(default)]
    pub voice: VoiceSettings,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSettings {
    /// Microphone device ID (empty = system default).
    #[serde(default)]
    pub input_device_id: String,
    /// Push-to-talk global shortcut key.
    #[serde(default = "default_ptt_shortcut")]
    pub push_to_talk_shortcut: String,
    /// Whether to use local Whisper (Moonshine) or cloud transcription.
    #[serde(default = "default_transcription_provider")]
    pub transcription_provider: String,
    /// Automatically paste dictation result at cursor.
    #[serde(default = "default_auto_paste")]
    pub auto_paste_dictation: bool,
    /// Keep audio recordings after transcription.
    #[serde(default = "default_keep_audio")]
    pub keep_audio_recordings: bool,
    /// Enable wake word detection ("Hey Bento").
    #[serde(default = "default_wake_word")]
    pub wake_word_enabled: bool,
}

fn default_ptt_shortcut() -> String {
    "Ctrl+Shift+M".to_string()
}

fn default_transcription_provider() -> String {
    "local".to_string()
}

fn default_auto_paste() -> bool {
    true
}

fn default_keep_audio() -> bool {
    false
}

fn default_wake_word() -> bool {
    false
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
    #[serde(default)]
    pub glass_enabled: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LanguageSettings {
    #[serde(default = "default_language_code")]
    pub code: LanguageCode,
    #[serde(default = "default_date_format")]
    pub date_format: DateFormat,
    #[serde(default = "default_time_format")]
    pub time_format: TimeFormat,
    #[serde(default = "default_first_day")]
    pub first_day: FirstDay,
}

/// Date format — mirrors Anytype's I.DateFormat enum values used in language.tsx.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DateFormat {
    /// MM/DD/YYYY  (Anytype default — DateFormat.Short / ShortUS)
    #[default]
    #[serde(rename = "MM/DD/YYYY")]
    MmDdYyyy,
    /// DD/MM/YYYY
    #[serde(rename = "DD/MM/YYYY")]
    DdMmYyyy,
    /// YYYY-MM-DD  (ISO 8601)
    #[serde(rename = "YYYY-MM-DD")]
    YyyyMmDd,
    /// DD.MM.YYYY
    #[serde(rename = "DD.MM.YYYY")]
    DdMmYyyyDot,
    /// Long natural form: "May 22, 2026"
    #[serde(rename = "MMMM D, YYYY")]
    Long,
}

/// Time format — mirrors Anytype's I.TimeFormat (H12 = 0, H24 = 1).
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TimeFormat {
    #[default]
    #[serde(rename = "12h")]
    H12,
    #[serde(rename = "24h")]
    H24,
}

/// First day of week — mirrors Anytype's firstDayOptions (1 = Monday, 7 = Sunday).
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FirstDay {
    #[default]
    #[serde(rename = "monday")]
    Monday,
    #[serde(rename = "sunday")]
    Sunday,
    #[serde(rename = "saturday")]
    Saturday,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSettings {
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default)]
    pub sidebar_hidden: bool,
    #[serde(default = "default_sidebar_top")]
    pub sidebar_top: f64,
    #[serde(default)]
    pub tabs_enabled: bool,
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
    #[serde(default = "default_sound_enabled")]
    pub sound_enabled: bool,
}

fn default_sound_enabled() -> bool {
    true
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

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PaymentSettings {
    /// Locally-stored receipt for offline-first Pro unlocking.
    #[serde(default)]
    pub receipt: Option<PaymentReceipt>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HabitSettings {
    #[serde(default = "default_freeze_tokens")]
    pub freeze_tokens: i32,
    #[serde(default)]
    pub used_freeze_tokens: i32,
}

fn default_freeze_tokens() -> i32 {
    3
}

// ── AI Features Prefs ────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiFeaturesPrefs {
    /// Master toggle for AI features.
    #[serde(default = "default_ai_enabled")]
    pub enabled: bool,

    /// Per-feature toggles. Key = feature ID, value = enabled.
    /// Known keys: smartSuggestions, journalPrompts, noteSummarization,
    ///             taskBreakdown, moodInsights, habitRecommendations.
    #[serde(default)]
    pub features: HashMap<String, bool>,

    /// Custom system prompt sent with every AI request.
    #[serde(default = "default_ai_system_prompt")]
    pub system_prompt: String,
}

fn default_ai_enabled() -> bool {
    true
}

fn default_ai_system_prompt() -> String {
    "You are Bento, a helpful AI assistant integrated into a personal productivity app. \
Be concise, practical, and warm. Use the user's data context when available to provide \
personalized suggestions."
        .to_string()
}

/// Populate the AI features map with defaults if it's empty.
pub fn default_ai_features() -> HashMap<String, bool> {
    let mut m = HashMap::new();
    m.insert("smartSuggestions".to_string(), true);
    m.insert("journalPrompts".to_string(), true);
    m.insert("noteSummarization".to_string(), true);
    m.insert("taskBreakdown".to_string(), true);
    m.insert("moodInsights".to_string(), true);
    m.insert("habitRecommendations".to_string(), false);
    m
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiFeaturesPrefsPatch {
    pub enabled: Option<bool>,
    pub features: Option<HashMap<String, bool>>,
    pub system_prompt: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CloudBackupScope {
    #[default]
    All,
    Selected,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CloudBackupSchedule {
    #[default]
    Daily,
    Weekly,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub project_url: String,
    #[serde(default)]
    pub anon_key: String,
    #[serde(default)]
    pub bucket_name: String,
    #[serde(default)]
    pub schedule_enabled: bool,
    #[serde(default)]
    pub schedule: CloudBackupSchedule,
    #[serde(default)]
    pub scope: CloudBackupScope,
    #[serde(default)]
    pub selected_modules: Vec<String>,
    #[serde(default)]
    pub last_backup_at: Option<String>,
    #[serde(default)]
    pub last_backup_size_bytes: Option<u64>,
    #[serde(default)]
    pub last_backup_object_path: Option<String>,
    #[serde(default)]
    pub last_backup_status: Option<String>,
    #[serde(default)]
    pub storage_usage_bytes: Option<u64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
    #[default]
    Light,
    Dark,
    System,
}

/**
 * Language codes — full port of Anytype-ts src/json/lang.ts `enabled` list.
 * 27 interface languages, with RTL correctly identified (Ar, Fa).
 * The Rust enum is the canonical source for validation;
 * the TypeScript schema mirrors it via z.enum([...]) in settings.ts.
 */
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum LanguageCode {
    #[default]
    #[serde(alias = "en", rename = "en")]
    En,
    /// Right-to-left
    #[serde(alias = "ar", rename = "ar")]
    Ar,
    #[serde(alias = "be", rename = "be")]
    Be,
    #[serde(alias = "cs", rename = "cs")]
    Cs,
    #[serde(alias = "da", rename = "da")]
    Da,
    #[serde(alias = "de", rename = "de")]
    De,
    #[serde(alias = "es", rename = "es")]
    Es,
    /// Right-to-left
    #[serde(alias = "fa", rename = "fa")]
    Fa,
    #[serde(alias = "fr", rename = "fr")]
    Fr,
    #[serde(alias = "hi", rename = "hi")]
    Hi,
    #[serde(alias = "id", rename = "id")]
    Id,
    #[serde(alias = "it", rename = "it")]
    It,
    #[serde(alias = "ja", rename = "ja")]
    Ja,
    #[serde(alias = "ko", rename = "ko")]
    Ko,
    #[serde(alias = "lt", rename = "lt")]
    Lt,
    #[serde(alias = "nl", rename = "nl")]
    Nl,
    #[serde(alias = "no", rename = "no")]
    No,
    #[serde(alias = "pl", rename = "pl")]
    Pl,
    #[serde(rename = "pt-BR")]
    PtBr,
    #[serde(rename = "pt-PT")]
    PtPt,
    #[serde(alias = "ro", rename = "ro")]
    Ro,
    #[serde(alias = "ru", rename = "ru")]
    Ru,
    #[serde(alias = "tr", rename = "tr")]
    Tr,
    #[serde(alias = "uk", rename = "uk")]
    Uk,
    #[serde(alias = "vi", rename = "vi")]
    Vi,
    #[serde(rename = "zh-CN")]
    ZhCn,
    #[serde(rename = "zh-TW")]
    ZhTw,
}

impl LanguageCode {
    /// Returns true for right-to-left languages.
    pub fn is_rtl(&self) -> bool {
        matches!(self, LanguageCode::Ar | LanguageCode::Fa)
    }

    /// Returns the BCP-47 locale string for Intl use.
    pub fn locale(&self) -> &'static str {
        match self {
            LanguageCode::En => "en-US",
            LanguageCode::Ar => "ar-SA",
            LanguageCode::Be => "be-BY",
            LanguageCode::Cs => "cs-CZ",
            LanguageCode::Da => "da-DK",
            LanguageCode::De => "de-DE",
            LanguageCode::Es => "es-ES",
            LanguageCode::Fa => "fa-IR",
            LanguageCode::Fr => "fr-FR",
            LanguageCode::Hi => "hi-IN",
            LanguageCode::Id => "id-ID",
            LanguageCode::It => "it-IT",
            LanguageCode::Ja => "ja-JP",
            LanguageCode::Ko => "ko-KR",
            LanguageCode::Lt => "lt-LT",
            LanguageCode::Nl => "nl-NL",
            LanguageCode::No => "no-NO",
            LanguageCode::Pl => "pl-PL",
            LanguageCode::PtBr => "pt-BR",
            LanguageCode::PtPt => "pt-PT",
            LanguageCode::Ro => "ro-RO",
            LanguageCode::Ru => "ru-RU",
            LanguageCode::Tr => "tr-TR",
            LanguageCode::Uk => "uk-UA",
            LanguageCode::Vi => "vi-VN",
            LanguageCode::ZhCn => "zh-CN",
            LanguageCode::ZhTw => "zh-TW",
        }
    }

    /// Returns the native-script label for this language.
    pub fn label(&self) -> String {
        match self {
            LanguageCode::En => "English",
            LanguageCode::Ar => "العربية",
            LanguageCode::Be => "Беларуская",
            LanguageCode::Cs => "Čeština",
            LanguageCode::Da => "Dansk",
            LanguageCode::De => "Deutsch",
            LanguageCode::Es => "Español",
            LanguageCode::Fa => "فارسی",
            LanguageCode::Fr => "Français",
            LanguageCode::Hi => "हिन्दी",
            LanguageCode::Id => "Bahasa Indonesia",
            LanguageCode::It => "Italiano",
            LanguageCode::Ja => "日本語",
            LanguageCode::Ko => "한국어",
            LanguageCode::Lt => "Lietuvių",
            LanguageCode::Nl => "Nederlands",
            LanguageCode::No => "Norsk",
            LanguageCode::Pl => "Polski",
            LanguageCode::PtBr => "Português (Brasil)",
            LanguageCode::PtPt => "Português (Portugal)",
            LanguageCode::Ro => "Română",
            LanguageCode::Ru => "Русский",
            LanguageCode::Tr => "Türkçe",
            LanguageCode::Uk => "Українська",
            LanguageCode::Vi => "Tiếng Việt",
            LanguageCode::ZhCn => "简体中文",
            LanguageCode::ZhTw => "繁體中文",
        }
        .to_string()
    }
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

fn default_date_format() -> DateFormat {
    DateFormat::MmDdYyyy
}

fn default_time_format() -> TimeFormat {
    TimeFormat::H12
}

fn default_first_day() -> FirstDay {
    FirstDay::Monday
}

fn default_restore_on_launch() -> bool {
    true
}

fn default_sidebar_top() -> f64 {
    54.0
}

fn default_reopen_shortcut_id() -> ReopenShortcutId {
    ReopenShortcutId::CtrlShiftG
}

fn default_background_alerts() -> bool {
    true
}

fn default_dynamic_island_enabled() -> bool {
    false
}

fn default_agent_dock_enabled() -> bool {
    false
}

pub fn settings_file_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("bento-desktop"))
        .join(SETTINGS_FILE_NAME)
}

pub fn resolve_export_directory(app: &AppHandle, settings: &DesktopSettings) -> PathBuf {
    if !settings.files.export_directory.trim().is_empty() {
        return PathBuf::from(&settings.files.export_directory);
    }

    app.path()
        .download_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("Downloads"))
        .join("Bento")
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
            glass_enabled: false,
        },
        language: LanguageSettings {
            code: default_language_code(),
            date_format: DateFormat::MmDdYyyy,
            time_format: TimeFormat::H12,
            first_day: FirstDay::Monday,
        },
        workspace: WorkspaceSettings {
            sidebar_collapsed: false,
            sidebar_hidden: false,
            sidebar_top: default_sidebar_top(),
            tabs_enabled: false,
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
            sound_enabled: default_sound_enabled(),
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
        payment: PaymentSettings::default(),
        byok: ByokSettings::default(),
        cloud_backup: CloudBackupSettings::default(),
        habits: HabitSettings::default(),
        ai: AiFeaturesPrefs {
            enabled: default_ai_enabled(),
            features: default_ai_features(),
            system_prompt: default_ai_system_prompt(),
        },
        dynamic_island_enabled: default_dynamic_island_enabled(),
        agent_dock_enabled: default_agent_dock_enabled(),
        voice: VoiceSettings::default(),
    }
}

pub fn load_desktop_settings(app: &AppHandle) -> DesktopSettings {
    let path = settings_file_path(app);
    let settings = if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(s) = serde_json::from_str::<DesktopSettings>(&raw) {
            s
        } else {
            let defaults = default_settings();
            let _ = save_desktop_settings(app, &defaults);
            return defaults;
        }
    } else {
        let defaults = default_settings();
        let _ = save_desktop_settings(app, &defaults);
        return defaults;
    };

    let mut settings = settings;

    // BYOK sanity check: if an active provider or configured providers exist,
    // ensure enabled=true. This catches the edge case where keys were saved
    // before auto-enable was implemented, or settings were partially reset.
    let needs_enable = !settings.byok.enabled
        && (settings.byok.active_provider.is_some() || !settings.byok.configured_providers.is_empty());
    if needs_enable {
        settings.byok.enabled = true;
    }

    let normalized = normalize_settings(&settings);
    if normalized != settings || needs_enable {
        let _ = save_desktop_settings(app, &normalized);
        return normalized;
    }

    settings
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

    let shortcut_changed = previous_shortcut
        .as_ref()
        .map(|prev| prev != &normalized.shortcuts.reopen_id)
        .unwrap_or(true);

    if let Some(runtime) = app.try_state::<DesktopRuntime>() {
        runtime.replace_settings(normalized.clone());
    }

    if shortcut_changed {
        apply_reopen_shortcut(
            app,
            previous_shortcut,
            normalized.shortcuts.reopen_id.clone(),
        )?;
    }

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
        "system" => ThemeMode::System,
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

/// Normalize/validate a language code string — accepts all 27 Anytype-ported codes.
pub fn normalize_language_code(language_code: &str) -> LanguageCode {
    match language_code {
        "en" => LanguageCode::En,
        "ar" => LanguageCode::Ar,
        "be" => LanguageCode::Be,
        "cs" => LanguageCode::Cs,
        "da" => LanguageCode::Da,
        "de" => LanguageCode::De,
        "es" => LanguageCode::Es,
        "fa" => LanguageCode::Fa,
        "fr" => LanguageCode::Fr,
        "hi" => LanguageCode::Hi,
        "id" => LanguageCode::Id,
        "it" => LanguageCode::It,
        "ja" => LanguageCode::Ja,
        "ko" => LanguageCode::Ko,
        "lt" => LanguageCode::Lt,
        "nl" => LanguageCode::Nl,
        "no" => LanguageCode::No,
        "pl" => LanguageCode::Pl,
        "pt-BR" => LanguageCode::PtBr,
        "pt-PT" => LanguageCode::PtPt,
        "ro" => LanguageCode::Ro,
        "ru" => LanguageCode::Ru,
        "tr" => LanguageCode::Tr,
        "uk" => LanguageCode::Uk,
        "vi" => LanguageCode::Vi,
        "zh-CN" => LanguageCode::ZhCn,
        "zh-TW" => LanguageCode::ZhTw,
        // Fuzzy prefix fallback
        s if s.starts_with("pt") => LanguageCode::PtBr,
        s if s.starts_with("zh") => LanguageCode::ZhCn,
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
    let normalized = combo.trim().replace(' ', "").to_ascii_lowercase();

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
            "notifications": { "backgroundAlerts": true, "soundEnabled": true },
            "telemetry": { "consented": false, "crashReports": false },
            "files": { "exportDirectory": "" },
            "migration": { "legacyBrowserStorageMigrated": false }
        });

        let parsed: DesktopSettings =
            serde_json::from_value(legacy).expect("legacy settings should parse");
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
