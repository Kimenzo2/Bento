use std::{str::FromStr, sync::Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{
    Row, SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};
use tauri::{AppHandle, Manager, ipc::Channel};

const MAX_AI_PROMPT_BYTES: usize = 32 * 1024;

#[derive(Clone)]
pub struct GenesisAppState {
    db: SqlitePool,
    active_module: std::sync::Arc<Mutex<String>>,
}

impl GenesisAppState {
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            active_module: std::sync::Arc::new(Mutex::new(
                ModuleId::Dashboard.as_str().to_string(),
            )),
        }
    }

    pub fn db(&self) -> &SqlitePool {
        &self.db
    }

    pub fn active_module(&self) -> String {
        self.active_module
            .lock()
            .map(|module| module.clone())
            .unwrap_or_else(|_| ModuleId::Dashboard.as_str().to_string())
    }

    pub fn set_active_module(&self, module: impl Into<String>) {
        if let Ok(mut active_module) = self.active_module.lock() {
            *active_module = module.into();
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ModuleId {
    Dashboard,
    Notes,
    Journal,
    Tasks,
    Habits,
    Focus,
    Passwords,
    Health,
    Sleep,
    Nutrition,
    Mood,
    Budget,
    Flashcards,
    Reading,
    Grocery,
    Recipes,
    Time,
    Goals,
    Clipboard,
    Breathing,
    VoiceMemos,
    Countdown,
    Telemetry,
    Ai,
    Settings,
}

impl ModuleId {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModuleId::Dashboard => "dashboard",
            ModuleId::Notes => "notes",
            ModuleId::Journal => "journal",
            ModuleId::Tasks => "tasks",
            ModuleId::Habits => "habits",
            ModuleId::Focus => "focus",
            ModuleId::Passwords => "passwords",
            ModuleId::Health => "health",
            ModuleId::Sleep => "sleep",
            ModuleId::Nutrition => "nutrition",
            ModuleId::Mood => "mood",
            ModuleId::Budget => "budget",
            ModuleId::Flashcards => "flashcards",
            ModuleId::Reading => "reading",
            ModuleId::Grocery => "grocery",
            ModuleId::Recipes => "recipes",
            ModuleId::Time => "time",
            ModuleId::Goals => "goals",
            ModuleId::Clipboard => "clipboard",
            ModuleId::Breathing => "breathing",
            ModuleId::VoiceMemos => "voice-memos",
            ModuleId::Countdown => "countdown",
            ModuleId::Telemetry => "telemetry",
            ModuleId::Ai => "ai",
            ModuleId::Settings => "settings",
        }
    }
}

impl FromStr for ModuleId {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "dashboard" => Ok(ModuleId::Dashboard),
            "notes" => Ok(ModuleId::Notes),
            "journal" => Ok(ModuleId::Journal),
            "tasks" => Ok(ModuleId::Tasks),
            "habits" => Ok(ModuleId::Habits),
            "focus" => Ok(ModuleId::Focus),
            "passwords" => Ok(ModuleId::Passwords),
            "health" => Ok(ModuleId::Health),
            "sleep" => Ok(ModuleId::Sleep),
            "nutrition" => Ok(ModuleId::Nutrition),
            "mood" => Ok(ModuleId::Mood),
            "budget" => Ok(ModuleId::Budget),
            "flashcards" => Ok(ModuleId::Flashcards),
            "reading" => Ok(ModuleId::Reading),
            "grocery" => Ok(ModuleId::Grocery),
            "recipes" => Ok(ModuleId::Recipes),
            "time" => Ok(ModuleId::Time),
            "goals" => Ok(ModuleId::Goals),
            "clipboard" => Ok(ModuleId::Clipboard),
            "breathing" => Ok(ModuleId::Breathing),
            "voice-memos" => Ok(ModuleId::VoiceMemos),
            "countdown" => Ok(ModuleId::Countdown),
            "telemetry" => Ok(ModuleId::Telemetry),
            "ai" => Ok(ModuleId::Ai),
            "settings" => Ok(ModuleId::Settings),
            _ => Err(format!("Unsupported Genesis module: {value}")),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleContext {
    #[serde(default)]
    pub module: Option<String>,
    #[serde(default)]
    pub scroll_position: f64,
    #[serde(default)]
    pub last_open_id: Option<String>,
    #[serde(default)]
    pub cursor_position: Option<u32>,
    #[serde(default)]
    pub extra: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleSwitchReceipt {
    pub from_module: String,
    pub to_module: String,
    pub committed: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFontPreference {
    pub module: String,
    pub role: String,
    pub family: String,
    pub source: String,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default = "default_size_scale")]
    pub size_scale: f64,
}

fn default_size_scale() -> f64 {
    1.0
}

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    let db_path = app_data_dir.join("app.db");

    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|error| error.to_string())?;

    run_migrations(&pool).await?;
    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("PRAGMA foreign_keys=ON")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    let migrations = [
        r#"
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            pinned INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            priority TEXT NOT NULL DEFAULT 'medium',
            due_at INTEGER,
            parent_id TEXT REFERENCES tasks(id),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS health_logs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            value REAL,
            unit TEXT,
            metadata TEXT DEFAULT '{}',
            logged_at INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            frequency TEXT NOT NULL DEFAULT 'daily',
            created_at INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS habit_completions (
            habit_id TEXT REFERENCES habits(id) ON DELETE CASCADE,
            completed_at INTEGER NOT NULL,
            PRIMARY KEY (habit_id, completed_at)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS installed_modules (
            id TEXT PRIMARY KEY,
            version TEXT NOT NULL,
            installed_at INTEGER NOT NULL,
            builtin INTEGER NOT NULL DEFAULT 0,
            manifest TEXT NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS module_settings (
            module_id TEXT PRIMARY KEY,
            data TEXT NOT NULL DEFAULT '{}',
            updated_at INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS module_context (
            module TEXT PRIMARY KEY,
            scroll_position REAL NOT NULL DEFAULT 0,
            last_open_id TEXT,
            cursor_position INTEGER,
            extra TEXT NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS module_fonts (
            module TEXT NOT NULL,
            role TEXT NOT NULL,
            family TEXT NOT NULL,
            source TEXT NOT NULL,
            file_path TEXT,
            size_scale REAL DEFAULT 1.0,
            PRIMARY KEY (module, role)
        )
        "#,
    ];

    for migration in migrations {
        sqlx::query(migration)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn parse_module(module: &str) -> Result<ModuleId, String> {
    ModuleId::from_str(module)
}

pub fn is_builtin_module_id(module: &str) -> bool {
    ModuleId::from_str(module).is_ok()
}

fn normalize_context(module: &ModuleId, context: ModuleContext) -> ModuleContext {
    ModuleContext {
        module: Some(module.as_str().to_string()),
        scroll_position: context.scroll_position.max(0.0),
        last_open_id: context
            .last_open_id
            .filter(|value| !value.trim().is_empty()),
        cursor_position: context.cursor_position,
        extra: if context.extra.is_object() {
            context.extra
        } else {
            json!({})
        },
    }
}

pub async fn read_module_context(
    pool: &SqlitePool,
    module: &ModuleId,
) -> Result<Option<ModuleContext>, String> {
    let row = sqlx::query(
        "SELECT scroll_position, last_open_id, cursor_position, extra FROM module_context WHERE module = ?",
    )
    .bind(module.as_str())
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return Ok(None);
    };

    let extra = row
        .try_get::<String, _>("extra")
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .unwrap_or_else(|| json!({}));

    Ok(Some(ModuleContext {
        module: Some(module.as_str().to_string()),
        scroll_position: row.try_get::<f64, _>("scroll_position").unwrap_or(0.0),
        last_open_id: row
            .try_get::<Option<String>, _>("last_open_id")
            .unwrap_or(None),
        cursor_position: row
            .try_get::<Option<i64>, _>("cursor_position")
            .ok()
            .flatten()
            .and_then(|value| u32::try_from(value).ok()),
        extra,
    }))
}

pub async fn write_module_context(
    pool: &SqlitePool,
    module: &ModuleId,
    context: ModuleContext,
) -> Result<ModuleContext, String> {
    let normalized = normalize_context(module, context);
    let extra = serde_json::to_string(&normalized.extra).map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO module_context (module, scroll_position, last_open_id, cursor_position, extra)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(module) DO UPDATE SET
            scroll_position = excluded.scroll_position,
            last_open_id = excluded.last_open_id,
            cursor_position = excluded.cursor_position,
            extra = excluded.extra
        "#,
    )
    .bind(module.as_str())
    .bind(normalized.scroll_position)
    .bind(&normalized.last_open_id)
    .bind(normalized.cursor_position.map(i64::from))
    .bind(extra)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(normalized)
}

#[tauri::command]
pub async fn get_module_context(
    state: tauri::State<'_, GenesisAppState>,
    module: String,
) -> Result<Option<ModuleContext>, String> {
    let module = parse_module(&module)?;
    read_module_context(state.db(), &module).await
}

#[tauri::command]
pub async fn save_module_context(
    state: tauri::State<'_, GenesisAppState>,
    module: String,
    context: ModuleContext,
) -> Result<ModuleContext, String> {
    let module = parse_module(&module)?;
    write_module_context(state.db(), &module, context).await
}

#[tauri::command]
pub async fn flush_module_state(
    state: tauri::State<'_, GenesisAppState>,
    from_module: String,
    to_module: String,
    context: ModuleContext,
) -> Result<ModuleSwitchReceipt, String> {
    let from_module = parse_module(&from_module)?;
    let to_module = parse_module(&to_module)?;

    write_module_context(state.db(), &from_module, context).await?;
    state.set_active_module(to_module.as_str());

    Ok(ModuleSwitchReceipt {
        from_module: from_module.as_str().to_string(),
        to_module: to_module.as_str().to_string(),
        committed: true,
    })
}

#[tauri::command]
pub async fn get_module_fonts(
    state: tauri::State<'_, GenesisAppState>,
    module: String,
) -> Result<Vec<ModuleFontPreference>, String> {
    let module = parse_module(&module)?;
    let rows = sqlx::query(
        "SELECT module, role, family, source, file_path, size_scale FROM module_fonts WHERE module = ? ORDER BY role",
    )
    .bind(module.as_str())
    .fetch_all(state.db())
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ModuleFontPreference {
            module: row
                .try_get("module")
                .unwrap_or_else(|_| module.as_str().to_string()),
            role: row.try_get("role").unwrap_or_default(),
            family: row.try_get("family").unwrap_or_default(),
            source: row
                .try_get("source")
                .unwrap_or_else(|_| "bundled".to_string()),
            file_path: row.try_get("file_path").unwrap_or(None),
            size_scale: row.try_get("size_scale").unwrap_or(1.0),
        })
        .collect())
}

#[tauri::command]
pub async fn set_module_fonts(
    state: tauri::State<'_, GenesisAppState>,
    module: String,
    fonts: Vec<ModuleFontPreference>,
) -> Result<Vec<ModuleFontPreference>, String> {
    let module = parse_module(&module)?;
    let mut tx = state
        .db()
        .begin()
        .await
        .map_err(|error| error.to_string())?;

    sqlx::query("DELETE FROM module_fonts WHERE module = ?")
        .bind(module.as_str())
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;

    for font in fonts {
        let role = font.role.trim();
        if !matches!(role, "primary" | "secondary" | "mono") {
            return Err(format!("Unsupported font role: {}", font.role));
        }

        let source = font.source.trim();
        if !matches!(source, "bundled" | "system" | "downloaded") {
            return Err(format!("Unsupported font source: {}", font.source));
        }

        sqlx::query(
            "INSERT INTO module_fonts (module, role, family, source, file_path, size_scale) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(module.as_str())
        .bind(role)
        .bind(font.family.trim())
        .bind(source)
        .bind(font.file_path)
        .bind(font.size_scale.clamp(0.8, 1.4))
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    tx.commit().await.map_err(|error| error.to_string())?;
    get_module_fonts(state, module.as_str().to_string()).await
}

#[tauri::command]
pub async fn stream_ai_response(prompt: String, on_token: Channel<String>) -> Result<(), String> {
    if prompt.trim().is_empty() {
        return Err("Prompt is required.".to_string());
    }

    if prompt.len() > MAX_AI_PROMPT_BYTES {
        return Err(format!(
            "Prompt is too large. Maximum size is {MAX_AI_PROMPT_BYTES} bytes."
        ));
    }

    let response = format!(
        "Genesis AI channel is ready.\n\nPrompt received: {}\n\nProduct model routing is not connected yet.",
        prompt.trim()
    );

    for token in response.split_inclusive(' ') {
        on_token
            .send(token.to_string())
            .map_err(|error| error.to_string())?;
        tokio::time::sleep(std::time::Duration::from_millis(12)).await;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ModuleId;
    use std::str::FromStr;

    #[test]
    fn rejects_unknown_modules() {
        assert!(ModuleId::from_str("spreadsheet").is_err());
    }

    #[test]
    fn accepts_foundation_modules() {
        assert_eq!(ModuleId::from_str("notes").expect("notes"), ModuleId::Notes);
        assert_eq!(ModuleId::from_str("ai").expect("ai"), ModuleId::Ai);
    }
}
