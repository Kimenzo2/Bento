use crate::util::time;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::{
    http::{Request, Response, StatusCode},
    ipc::Channel,
    AppHandle, Manager, Runtime, State, UriSchemeContext,
};

use crate::agent_core::state_channel::{StateChannel, StateEvent};
use crate::auth::AuthManager;
use crate::commands::{emit_main_window_event, DashboardCache};
use crate::db::{is_builtin_module_id, write_runtime_state, BentoAppState};

const BUILTIN_MODULES: &[(&str, &str, &str, &str, f64, &str, &str)] = &[
    (
        "dashboard",
        "Dashboard",
        "Local orchestration overview and launch surface.",
        "0.1.0",
        0.4,
        "shell",
        "#ff9f6e",
    ),
    (
        "notes",
        "Notes",
        "Markdown-first note surface backed by the Bento shell.",
        "0.1.0",
        1.2,
        "shell",
        "#7c3aed",
    ),
    (
        "journal",
        "Journal / Diary",
        "Daily prompts, mood check-ins, private recaps, and timeline writing.",
        "0.1.0",
        1.1,
        "productivity",
        "#818cf8",
    ),
    (
        "tasks",
        "To-Do / Tasks",
        "Natural-language task capture, recurring work, and action-first planning.",
        "0.1.0",
        1.0,
        "productivity",
        "#52b788",
    ),
    (
        "habits",
        "Habit Tracker",
        "Streaks, flexible frequency, heatmaps, and weekly review summaries.",
        "0.1.0",
        0.8,
        "wellness",
        "#c8f535",
    ),
    (
        "focus",
        "Focus Timer",
        "Pomodoro sessions, custom intervals, ambient modes, and history.",
        "0.1.0",
        0.9,
        "wellness",
        "#f5c400",
    ),
    (
        "passwords",
        "Password Vault",
        "Local-first vault, passkeys, breach alerts, and secure notes.",
        "0.1.0",
        0.9,
        "security",
        "#9eff57",
    ),
    (
        "health",
        "Health Tracker",
        "Workout logs, body metrics, progress photos, and personal health state.",
        "0.1.0",
        1.0,
        "wellness",
        "#c8f535",
    ),
    (
        "sleep",
        "Sleep Tracker",
        "Scores, smart alarm prep, snore detection, and weekly sleep trends.",
        "0.1.0",
        0.9,
        "wellness",
        "#8cc8ff",
    ),
    (
        "nutrition",
        "Water & Nutrition",
        "Hydration goals, macros, meal logging, and reminder-driven tracking.",
        "0.1.0",
        1.0,
        "wellness",
        "#1aa6a6",
    ),
    (
        "mood",
        "Mood Tracker",
        "One-tap emotion logging, activity correlation, and pattern detection.",
        "0.1.0",
        0.9,
        "wellness",
        "#d92b67",
    ),
    (
        "budget",
        "Budget Tracker",
        "Manual transactions, category budgets, and privacy-first planning.",
        "0.1.0",
        1.0,
        "finance",
        "#e05a3a",
    ),
    (
        "flashcards",
        "Flashcards / Study",
        "Spaced repetition, AI card generation, and deck progress.",
        "0.1.0",
        1.1,
        "education",
        "#6d5ce7",
    ),
    (
        "reading",
        "Reading Tracker",
        "Book logs, sessions, highlights, and annual reading goals.",
        "0.1.0",
        1.0,
        "education",
        "#e11d48",
    ),
    (
        "grocery",
        "Grocery / Shopping",
        "Shared lists, store sections, and recipe-to-list conversion.",
        "0.1.0",
        0.9,
        "lifestyle",
        "#22c55e",
    ),
    (
        "recipes",
        "Recipe Manager",
        "Recipe import, cooking mode, meal planning, and shopping generation.",
        "0.1.0",
        1.0,
        "lifestyle",
        "#d4a017",
    ),
    (
        "time",
        "Time Tracker",
        "One-tap timers, project tagging, idle detection, and export.",
        "0.1.0",
        0.9,
        "productivity",
        "#ffd95b",
    ),
    (
        "goals",
        "Goal Tracker",
        "Long-term goals, milestones, check-ins, and review loops.",
        "0.1.0",
        0.9,
        "productivity",
        "#ccff00",
    ),
    (
        "clipboard",
        "Clipboard Manager",
        "Clipboard history, pinned snippets, images, and sensitive expiry.",
        "0.1.0",
        0.8,
        "utility",
        "#e11d48",
    ),
    (
        "breathing",
        "Breathing / Calm",
        "Guided breathing, calm sessions, check-ins, and session streaks.",
        "0.1.0",
        0.8,
        "wellness",
        "#65d7c1",
    ),
    (
        "voice-memos",
        "Voice Memos",
        "One-tap recording, transcription, and searchable memo capture.",
        "0.1.0",
        0.8,
        "productivity",
        "#8b5cf6",
    ),
    (
        "countdown",
        "Countdown / Life Events",
        "Event countdowns, birthdays, days-since tracking, and shareable cards.",
        "0.1.0",
        0.8,
        "lifestyle",
        "#ec4899",
    ),
    (
        "telemetry",
        "Personal Telemetry",
        "On-device health, anomaly detection, and self-healing system intelligence.",
        "0.1.0",
        1.1,
        "intelligence",
        "#38bdf8",
    ),
    (
        "ai",
        "AI",
        "AI assistant module using native channels for token streaming.",
        "0.1.0",
        1.4,
        "intelligence",
        "#ec4899",
    ),
    (
        "settings",
        "Settings",
        "Bento shell preferences and local platform controls.",
        "0.1.0",
        0.6,
        "shell",
        "#94a3b8",
    ),
];

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModule {
    pub id: String,
    pub version: String,
    pub installed_at: i64,
    pub builtin: bool,
    pub manifest: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleRegistryEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub size_mb: f64,
    pub category: String,
    pub bundle_url: Option<String>,
    pub checksum_sha256: Option<String>,
    pub icon_url: Option<String>,
    pub accent: String,
    pub free: bool,
    pub installed: bool,
    pub builtin: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModuleManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub size_mb: Option<f64>,
    #[serde(default)]
    pub min_shell_version: Option<String>,
    #[serde(default)]
    pub rust_commands: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
}

pub fn validate_module_id(module_id: &str) -> Result<(), String> {
    let len = module_id.len();
    if !(1..=48).contains(&len) {
        return Err("Module id must be 1-48 characters.".to_string());
    }

    if !module_id
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(
            "Module id may only contain lowercase letters, digits, and hyphens.".to_string(),
        );
    }

    Ok(())
}

pub(crate) async fn is_installed(state: &BentoAppState, module_id: &str) -> Result<bool, String> {
    if is_builtin_module_id(module_id) {
        return Ok(true);
    }

    let count: i64 = sqlx::query("SELECT COUNT(*) AS count FROM installed_modules WHERE id = ?")
        .bind(module_id)
        .fetch_one(&state.db())
        .await
        .map_err(|error| error.to_string())?
        .try_get("count")
        .unwrap_or(0);

    Ok(count > 0)
}

#[tauri::command]
pub async fn get_active_module(state: tauri::State<'_, BentoAppState>) -> Result<String, String> {
    Ok(state.active_module())
}

#[tauri::command]
pub async fn set_active_module(
    app: AppHandle,
    cache: State<'_, DashboardCache>,
    auth: State<'_, AuthManager>,
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
) -> Result<String, String> {
    validate_module_id(&module_id)?;

    if !is_installed(&state, &module_id).await? {
        return Err(format!("Module is not installed: {module_id}"));
    }

    // Centralized billing tier check
    crate::auth::require_billing_tier(&auth, &module_id).await?;

    write_runtime_state(&state.db(), "last_active_module", &module_id).await?;
    state.set_active_module(module_id.clone());
    if let Some(channel) = app.try_state::<StateChannel>() {
        channel.publish(StateEvent::ActiveModule { module_id: module_id.clone() });
    }
    cache.invalidate();
    let _ = emit_main_window_event(&app, "bento://dashboard-refresh", module_id.clone());
    Ok(module_id)
}

#[tauri::command]
pub async fn get_installed_modules(
    state: tauri::State<'_, BentoAppState>,
) -> Result<Vec<InstalledModule>, String> {
    let mut modules = BUILTIN_MODULES
        .iter()
        .map(
            |(id, name, description, version, size_mb, category, accent)| InstalledModule {
                id: (*id).to_string(),
                version: (*version).to_string(),
                installed_at: 0,
                builtin: true,
                manifest: json!({
                    "id": id,
                    "name": name,
                    "description": description,
                    "sizeMb": size_mb,
                    "category": category,
                    "accent": accent
                }),
            },
        )
        .collect::<Vec<_>>();

    let rows = sqlx::query(
        "SELECT id, version, installed_at, builtin, manifest FROM installed_modules ORDER BY id",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|error| error.to_string())?;

    for row in rows {
        let id = row.try_get::<String, _>("id").unwrap_or_default();
        if is_builtin_module_id(&id) {
            continue;
        }

        let manifest = row
            .try_get::<String, _>("manifest")
            .ok()
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
            .unwrap_or_else(|| json!({}));

        modules.push(InstalledModule {
            id,
            version: row
                .try_get("version")
                .unwrap_or_else(|_| "0.0.0".to_string()),
            installed_at: row.try_get("installed_at").unwrap_or(0),
            builtin: row.try_get::<i64, _>("builtin").unwrap_or(0) == 1,
            manifest,
        });
    }

    Ok(modules)
}

#[tauri::command]
pub async fn fetch_module_registry(
    state: tauri::State<'_, BentoAppState>,
) -> Result<Vec<ModuleRegistryEntry>, String> {
    let installed = get_installed_modules(state).await?;
    let installed_ids = installed
        .iter()
        .map(|module| module.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    Ok(BUILTIN_MODULES
        .iter()
        .map(
            |(id, name, description, version, size_mb, category, accent)| ModuleRegistryEntry {
                id: (*id).to_string(),
                name: (*name).to_string(),
                description: (*description).to_string(),
                version: (*version).to_string(),
                size_mb: *size_mb,
                category: (*category).to_string(),
                bundle_url: None,
                checksum_sha256: None,
                icon_url: None,
                accent: (*accent).to_string(),
                free: true,
                installed: installed_ids.contains(id),
                builtin: true,
            },
        )
        .collect())
}

#[tauri::command]
pub async fn get_module_settings(
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
) -> Result<Value, String> {
    validate_module_id(&module_id)?;

    let row = sqlx::query("SELECT data FROM module_settings WHERE module_id = ?")
        .bind(&module_id)
        .fetch_optional(&state.db())
        .await
        .map_err(|error| error.to_string())?;

    Ok(row
        .and_then(|row| row.try_get::<String, _>("data").ok())
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .unwrap_or_else(|| json!({})))
}

#[tauri::command]
pub async fn set_module_settings(
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
    data: Value,
) -> Result<Value, String> {
    validate_module_id(&module_id)?;

    if !data.is_object() {
        return Err("Module settings must be a JSON object.".to_string());
    }

    let raw = serde_json::to_string(&data).map_err(|error| error.to_string())?;
    sqlx::query(
        r#"
        INSERT INTO module_settings (module_id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(module_id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&module_id)
    .bind(raw)
    .bind(time::now_secs())
    .execute(&state.db())
    .await
    .map_err(|error| error.to_string())?;

    Ok(data)
}

#[tauri::command]
pub async fn register_local_module(
    app: tauri::AppHandle,
    state: tauri::State<'_, BentoAppState>,
    manifest: LocalModuleManifest,
) -> Result<InstalledModule, String> {
    validate_module_id(&manifest.id)?;

    if is_builtin_module_id(&manifest.id) {
        return Err("Built-in modules are registered by the shell.".to_string());
    }

    let modules_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("modules")
        .join(&manifest.id);

    let entry_js = modules_dir.join("index.js");
    let manifest_file = modules_dir.join("manifest.json");
    if !entry_js.is_file() || !manifest_file.is_file() {
        return Err(
            "Local module must contain manifest.json and index.js under app-data/modules/{id}."
                .to_string(),
        );
    }

    let manifest_value = serde_json::to_value(&manifest).map_err(|error| error.to_string())?;
    let manifest_raw = serde_json::to_string(&manifest_value).map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO installed_modules (id, version, installed_at, builtin, manifest)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            version = excluded.version,
            installed_at = excluded.installed_at,
            builtin = 0,
            manifest = excluded.manifest
        "#,
    )
    .bind(&manifest.id)
    .bind(&manifest.version)
    .bind(time::now_secs())
    .bind(manifest_raw)
    .execute(&state.db())
    .await
    .map_err(|error| error.to_string())?;

    Ok(InstalledModule {
        id: manifest.id,
        version: manifest.version,
        installed_at: time::now_secs(),
        builtin: false,
        manifest: manifest_value,
    })
}

#[tauri::command]
pub async fn install_module(
    module_id: String,
    bundle_url: String,
    expected_checksum: String,
    on_progress: Channel<f32>,
) -> Result<(), String> {
    validate_module_id(&module_id)?;
    let _ = on_progress.send(0.0);

    if bundle_url.trim().is_empty() || expected_checksum.trim().is_empty() {
        return Err(
            "Bundle URL and checksum are required for remote module installation.".to_string(),
        );
    }

    Err("Remote module installation is intentionally disabled until the signed Bento module registry is configured. Use register_local_module for trusted local bundles.".to_string())
}

#[tauri::command]
pub async fn uninstall_module(
    app: tauri::AppHandle,
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
) -> Result<(), String> {
    validate_module_id(&module_id)?;

    if is_builtin_module_id(&module_id) {
        return Err("Built-in modules cannot be uninstalled.".to_string());
    }

    let modules_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("modules")
        .join(&module_id);

    if modules_dir.exists() {
        std::fs::remove_dir_all(&modules_dir).map_err(|error| error.to_string())?;
    }

    sqlx::query("DELETE FROM installed_modules WHERE id = ?")
        .bind(&module_id)
        .execute(&state.db())
        .await
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn module_mime(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()) {
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("html") => "text/html; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn protocol_response(status: StatusCode, mime: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("content-type", mime)
        .header("cross-origin-resource-policy", "same-origin")
        .header("cache-control", "no-store")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn resolve_module_file<R: Runtime>(
    ctx: &UriSchemeContext<'_, R>,
    request_path: &str,
) -> Result<PathBuf, String> {
    let rel = request_path.trim_start_matches('/');
    if rel.is_empty() || rel.contains('\\') || rel.contains("..") {
        return Err("Invalid module asset path.".to_string());
    }

    let mut safe = PathBuf::new();
    let mut components = Path::new(rel).components();
    let Some(Component::Normal(module_id)) = components.next() else {
        return Err("Module id is required.".to_string());
    };

    let module_id = module_id.to_string_lossy();
    validate_module_id(&module_id)?;
    safe.push(module_id.as_ref());

    for component in components {
        match component {
            Component::Normal(value) => safe.push(value),
            _ => return Err("Invalid module asset path.".to_string()),
        }
    }

    let root = ctx
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("modules");

    let resolved = root.join(safe);
    if !resolved.starts_with(&root) {
        return Err("Module asset escaped the module root.".to_string());
    }

    Ok(resolved)
}

pub fn module_protocol<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let path = request.uri().path();
    let module_file = match resolve_module_file(&ctx, path) {
        Ok(path) => path,
        Err(error) => {
            return protocol_response(
                StatusCode::FORBIDDEN,
                "text/plain; charset=utf-8",
                error.into_bytes(),
            );
        }
    };

    if !module_file.is_file() {
        return protocol_response(
            StatusCode::NOT_FOUND,
            "text/plain; charset=utf-8",
            b"Module asset not found.".to_vec(),
        );
    }

    match std::fs::read(&module_file) {
        Ok(bytes) => protocol_response(StatusCode::OK, module_mime(&module_file), bytes),
        Err(error) => protocol_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "text/plain; charset=utf-8",
            error.to_string().into_bytes(),
        ),
    }
}
