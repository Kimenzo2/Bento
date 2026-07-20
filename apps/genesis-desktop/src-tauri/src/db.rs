use std::{
    str::FromStr,
    sync::{Arc, Mutex},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    Row, SqlitePool,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use uuid::Uuid;

use crate::agent_core::state_channel::{StateChannel, StateEvent};
use crate::auth::AuthManager;
use crate::commands::{emit_main_window_event, DashboardCache};
use crate::crypto::CryptoService;
use crate::search::SearchService;

const MAX_AI_PROMPT_BYTES: usize = 32 * 1024;

#[derive(Clone)]
pub struct BentoAppState {
    /// Writer pool — `max_connections(1)`. SQLite WAL allows one writer
    /// at a time; a single dedicated connection avoids file-level lock
    /// contention between concurrent write transactions.
    db: Arc<Mutex<SqlitePool>>,
    /// Reader pool — `max_connections(4)`. Dedicated connections for
    /// background workers (scheduler, dashboard, clipboard) so read-heavy
    /// queries never compete with writes for pool slots.
    db_reader: Arc<Mutex<SqlitePool>>,
    active_module: Arc<Mutex<String>>,
}
impl BentoAppState {
    pub fn new(db: SqlitePool, db_reader: SqlitePool) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            db_reader: Arc::new(Mutex::new(db_reader)),
            active_module: Arc::new(Mutex::new(ModuleId::Dashboard.as_str().to_string())),
        }
    }

    /// Return the writer pool (backward compatible — most IPC commands
    /// use this). Writes are serialized through the single writer
    /// connection.
    pub fn db(&self) -> SqlitePool {
        self.db
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    }

    /// Return the dedicated reader pool (higher concurrency).
    /// Use for read-heavy background workers and dashboard queries
    /// that would otherwise contend with user-facing IPC writes.
    pub fn db_reader(&self) -> SqlitePool {
        self.db_reader
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    }

    /// Close the writer pool and replace with a new one atomically.
    /// Used by the crypto service to close the plaintext pool before
    /// encrypting, and to hot-swap in the encrypted pool after setup.
    pub async fn close_and_replace(&self, new_pool: SqlitePool) {
        let old = {
            if let Ok(mut guard) = self.db.lock() {
                Some(std::mem::replace(&mut *guard, new_pool))
            } else {
                None
            }
        };
        // Await close outside the mutex to avoid holding a lock across an await.
        if let Some(old_pool) = old {
            old_pool.close().await;
        }
    }

    /// Close BOTH writer and reader pools and replace them atomically.
    /// Used by crypto on full encryption unlock/change so that all
    /// connections use the new SQLCipher key.
    pub async fn close_and_replace_all(&self, writer: SqlitePool, reader: SqlitePool) {
        let old_writer = {
            if let Ok(mut guard) = self.db.lock() {
                Some(std::mem::replace(&mut *guard, writer))
            } else {
                None
            }
        };
        let old_reader = {
            if let Ok(mut guard) = self.db_reader.lock() {
                Some(std::mem::replace(&mut *guard, reader))
            } else {
                None
            }
        };
        if let Some(old_pool) = old_writer {
            old_pool.close().await;
        }
        if let Some(old_pool) = old_reader {
            old_pool.close().await;
        }
    }

    /// Hot-swap the writer pool without closing the old one.
    pub fn replace_pool(&self, new_pool: SqlitePool) {
        if let Ok(mut guard) = self.db.lock() {
            *guard = new_pool;
        }
    }

    /// Hot-swap the reader pool without closing the old one.
    pub fn replace_reader_pool(&self, new_pool: SqlitePool) {
        if let Ok(mut guard) = self.db_reader.lock() {
            *guard = new_pool;
        }
    }

    pub fn active_module(&self) -> String {
        self.active_module
            .lock()
            .map(|module| module.clone())
            .unwrap_or_else(|_| ModuleId::Dashboard.as_str().to_string())
    }

    pub fn active_module_handle(&self) -> Arc<Mutex<String>> {
        self.active_module.clone()
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
    Goals,
    Clipboard,
    VoiceMemos,
    Countdown,
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
            ModuleId::Goals => "goals",
            ModuleId::Clipboard => "clipboard",
            ModuleId::VoiceMemos => "voice-memos",
            ModuleId::Countdown => "countdown",
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
            "goals" => Ok(ModuleId::Goals),
            "clipboard" => Ok(ModuleId::Clipboard),
            "voice-memos" => Ok(ModuleId::VoiceMemos),
            "countdown" => Ok(ModuleId::Countdown),
            "ai" => Ok(ModuleId::Ai),
            "settings" => Ok(ModuleId::Settings),
            _ => Err(format!("Unsupported Bento module: {value}")),
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

pub async fn write_runtime_state(pool: &SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO runtime_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

async fn delete_from_table_if_exists(pool: &SqlitePool, table_name: &str) -> Result<(), String> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table_name)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    if exists == 0 {
        return Ok(());
    }

    let escaped = table_name.replace('"', "\"\"");
    let statement = format!("DELETE FROM \"{escaped}\"");
    sqlx::query(&statement)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(())
}

async fn local_user_content_exists(pool: &SqlitePool) -> Result<bool, String> {
    for table_name in [
        "notes",
        "objects",
        "note_objects",
        "tasks",
        "habits",
        "health_logs",
        "journal_entries",
        "recording_metadata",
        "mood_checkins",
        "health_daily_logs",
        "dashboard_events",
    ] {
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .bind(table_name)
        .fetch_one(pool)
        .await
        .map_err(|error| error.to_string())?;

        if exists == 0 {
            continue;
        }

        let escaped = table_name.replace('"', "\"\"");
        let count =
            sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM \"{escaped}\" LIMIT 1"))
                .fetch_one(pool)
                .await
                .map_err(|error| error.to_string())?;

        if count > 0 {
            return Ok(true);
        }
    }

    Ok(false)
}

async fn purge_local_user_content(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("PRAGMA foreign_keys=ON")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    for table_name in [
        "object_children",
        "marks",
        "relations",
        "blocks",
        "note_objects",
        "objects",
        "notes",
        "subtasks",
        "activity_logs",
        "tasks",
        "habit_completions",
        "habits",
        "health_logs",
        "journal_entries",
        "recording_transcripts",
        "recording_metadata",
        "mood_private_notes",
        "mood_activities",
        "mood_checkins",
        "health_doses",
        "health_meds",
        "health_vitals",
        "health_daily_logs",
        "module_settings",
        "module_context",
        "sleep_logs",
        "sleep_routines",
        "sleep_routine_tracking",
        "sleep_alarms",
        "sleep_sessions",
        "sleep_goals",
        "dashboard_events",
        "performance_baselines",
    ] {
        delete_from_table_if_exists(pool, table_name).await?;
    }

    sqlx::query(
        "DELETE FROM runtime_state WHERE key IN ('last_active_module', 'dashboard:last_refresh')",
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn enforce_auth_user_boundary(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    cache: State<'_, DashboardCache>,
    state: State<'_, BentoAppState>,
) -> Result<(), String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "No authenticated session available.".to_string())?;
    let user_id = session.user.id.trim();

    if user_id.is_empty() {
        return Err("Authenticated session is missing a user id.".to_string());
    }

    let pool = state.db();
    let previous_user_id = read_runtime_state(&pool, "auth_user_id").await?;
    let should_purge = match previous_user_id.as_deref() {
        Some(previous) if previous == user_id => false,
        Some(_) => true,
        None => local_user_content_exists(&pool).await?,
    };

    if should_purge {
        purge_local_user_content(&pool).await?;
        // SearchService may not be available if both primary and temp fallback failed.
        // Use try_state to avoid panicking — index clear is best-effort.
        if let Some(search_svc) = app.try_state::<SearchService>() {
            if let Err(e) = search_svc.clear_all_user_indexes().await {
                eprintln!("[auth] failed to clear search indexes: {e}");
            }
        }
        cache.invalidate();
        state.set_active_module(ModuleId::Dashboard.as_str());
        let _ = emit_main_window_event(
            &app,
            "bento://local-user-boundary-reset",
            user_id.to_string(),
        );
    }

    write_runtime_state(&pool, "auth_user_id", user_id).await?;

    Ok(())
}

pub(crate) async fn record_dashboard_event(
    pool: &SqlitePool,
    event_type: &str,
    module_id: &str,
    related_module_id: Option<&str>,
    action: &str,
    payload: Value,
) -> Result<(), String> {
    let payload = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let created_at = crate::util::time::now_ms();

    sqlx::query(
        r#"
        INSERT INTO dashboard_events (
            event_type,
            module_id,
            related_module_id,
            action,
            payload,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(event_type)
    .bind(module_id)
    .bind(related_module_id)
    .bind(action)
    .bind(payload)
    .bind(created_at)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

fn invalidate_dashboard(cache: &DashboardCache) {
    cache.invalidate();
}

/// Create TWO SQLite pools — one writer and one reader — both pointing at
/// the same `app.db` file (WAL mode).
///
/// ── Writer pool  (`max_connections(1)`) ──
/// SQLite WAL mode allows exactly one writer at a time. A single dedicated
/// connection avoids file-level lock contention between concurrent write
/// transactions. All IPC commands that INSERT/UPDATE/DELETE use this pool.
///
/// ── Reader pool  (`max_connections(4)`) ──
/// Dedicated connections for background workers (scheduler, dashboard,
/// clipboard monitoring) so read-heavy queries never compete with writes
/// for pool slots. This prevents the "pool timed out" errors when auth
/// refresh storms, dashboard queries, and the scheduler all contend for
/// connections simultaneously.
///
/// Returns `(writer_pool, reader_pool)`.
pub async fn init_db(app: &AppHandle) -> Result<(SqlitePool, SqlitePool), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;

    // ── Encrypted path ────────────────────────────────────────────────────
    // If encryption is configured (salt in keyring), the CryptoService owns
    // the pool. We retrieve it from the managed state.
    // On first launch (no password yet), we start unencrypted and the setup
    // UI will call `crypto_setup_master_password` to encrypt on first run.
    if crate::crypto::encryption_is_configured() {
        // The CryptoService should already be unlocked by this point
        // (lib.rs setup calls crypto.unlock() after loading settings).
        // This path is a fallback — return in-memory bootstrap pools that
        // will be replaced once unlock() succeeds. Do not open app.db without
        // SQLCipher here: that path may already contain encrypted bytes.
        if let Some(crypto) = app.try_state::<CryptoService>() {
            match crypto.main_pool().await {
                Ok(pool) => {
                    // Create a dedicated reader pool with its own connection pool
                    // and acquire_timeout, so read-heavy background workers (scheduler,
                    // dashboard, clipboard) never compete with user-facing IPC writes
                    // for the crypto pool's connections or its 3-second timeout.
                    let reader = match crypto.reader_main_pool().await {
                        Ok(r) => r,
                        Err(e) => {
                            eprintln!(
                                "[db] reader pool creation failed: {e} — fallback to shared pool"
                            );
                            pool.clone()
                        }
                    };
                    return Ok((pool, reader));
                }
                Err(_) => {
                    // Still locked — caller will handle unlock UI.
                    // Create twin in-memory bootstrap pools.
                    let (w, r) = create_memory_pair().await?;
                    return Ok((w, r));
                }
            }
        }
    }

    // ── Unencrypted path (first launch or pre-setup) ──────────────────────
    let db_path = app_data_dir.join("app.db");
    let base_options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5))
        .foreign_keys(true);

    // Writer pool: single connection — SQLite serializes WAL writes anyway.
    let writer = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .acquire_slow_threshold(std::time::Duration::from_secs(2))
        .connect_with(base_options.clone())
        .await
        .map_err(|error| error.to_string())?;

    // Reader pool: 4 connections — enough for background workers without
    // competing with the writer's single slot.
    // `read_only(true)` ensures no reader connection can accidentally acquire
    // a write lock, even if a query misuses BEGIN DEFERRED with a write path.
    let reader_options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5))
        .foreign_keys(true)
        .read_only(true);
    let reader = SqlitePoolOptions::new()
        .max_connections(4)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .acquire_slow_threshold(std::time::Duration::from_secs(2))
        .connect_with(reader_options)
        .await
        .map_err(|error| error.to_string())?;

    run_encrypted_migrations(&writer).await?;
    Ok((writer, reader))
}

/// Create a pair of in-memory pools (writer + reader) as placeholder during
/// crypto bootstrap or fallback scenarios.
///
/// Uses `file::memory:?cache=shared` URI so all connections — even across
/// separate pools — share the same underlying in-memory database. Without
/// this, `:memory:` creates a separate private database for each connection,
/// leaving the reader pool with no tables (only the writer's single
/// connection would have the migrated schema).
async fn create_memory_pair() -> Result<(SqlitePool, SqlitePool), String> {
    let options = SqliteConnectOptions::new()
        .filename("file::memory:?cache=shared")
        .journal_mode(SqliteJournalMode::Memory)
        .foreign_keys(true);

    let writer = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options.clone())
        .await
        .map_err(|error| error.to_string())?;

    // Run migrations on the writer first — because of `cache=shared`, the
    // reader pool will see the same schema on its connections.
    run_migrations(&writer).await?;

    let reader = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await
        .map_err(|error| error.to_string())?;

    Ok((writer, reader))
}

/// Create an in-memory SQLite pair (writer + reader) used when `init_db`
/// fails so the app can always show its window.
/// Data in this pool pair is lost when the app exits.
pub async fn init_in_memory_db() -> Result<(SqlitePool, SqlitePool), String> {
    create_memory_pair().await
}

/// Public migrations entry point — called by both the plain init_db
/// path and CryptoService.setup_master_password / unlock.
pub async fn run_encrypted_migrations(pool: &SqlitePool) -> Result<(), String> {
    run_migrations(pool).await
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    // PRAGMA journal_mode=WAL and foreign_keys=ON are already set via
    // SqliteConnectOptions in init_db — no need to re-apply here.

    // ── Batched DDL migrations (fewer round-trips = faster startup) ─────
    // Multiple semicolon-separated statements per query. ALTER TABLE
    // statements are kept separate because they may fail harmlessly when
    // the column already exists (handled by the per-statement loop below).
    let batches = [
        // Batch 1: Core notes + objects schema
        r#"
        CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]', pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, type TEXT NOT NULL, layout TEXT NOT NULL, name TEXT, icon TEXT, cover TEXT, is_archived INTEGER NOT NULL DEFAULT 0, is_deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, space_id TEXT, details TEXT NOT NULL DEFAULT '{}');
        CREATE INDEX IF NOT EXISTS idx_objects_type_updated ON objects(type, updated_at DESC);
        CREATE TABLE IF NOT EXISTS note_objects (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', icon TEXT, cover TEXT, tags TEXT NOT NULL DEFAULT '[]', pinned INTEGER NOT NULL DEFAULT 0, layout TEXT NOT NULL DEFAULT 'note', is_archived INTEGER NOT NULL DEFAULT 0, details TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_note_objects_updated ON note_objects(is_archived, pinned DESC, updated_at DESC)
        "#,
        // Batch 2: Blocks + relations
        r#"
        CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, object_id TEXT NOT NULL, parent_id TEXT, type TEXT NOT NULL, content TEXT NOT NULL DEFAULT '{}', fields TEXT NOT NULL DEFAULT '{}', align INTEGER NOT NULL DEFAULT 0, bg_color TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE, FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE SET NULL);
        CREATE INDEX IF NOT EXISTS idx_blocks_object_position ON blocks(object_id, parent_id, position);
        CREATE INDEX IF NOT EXISTS idx_blocks_object_type_position ON blocks(object_id, type, position);
        CREATE TABLE IF NOT EXISTS relations (id TEXT NOT NULL, object_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL DEFAULT 'null', PRIMARY KEY (object_id, key), FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE);
        CREATE INDEX IF NOT EXISTS idx_relations_key ON relations(key)
        "#,
        // Batch 3: Marks + object_children
        r#"
        CREATE TABLE IF NOT EXISTS marks (id INTEGER PRIMARY KEY AUTOINCREMENT, block_id TEXT NOT NULL, type INTEGER NOT NULL, param TEXT, range_start INTEGER NOT NULL, range_end INTEGER NOT NULL, FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE);
        CREATE INDEX IF NOT EXISTS idx_marks_block_id ON marks(block_id);
        CREATE TABLE IF NOT EXISTS object_children (object_id TEXT NOT NULL, block_id TEXT NOT NULL, child_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY (block_id, child_id), FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE, FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE, FOREIGN KEY (child_id) REFERENCES blocks(id) ON DELETE CASCADE);
        CREATE INDEX IF NOT EXISTS idx_object_children_object ON object_children(object_id);
        CREATE INDEX IF NOT EXISTS idx_object_children_block ON object_children(block_id)
        "#,
        // Batch 4: Tasks + subtasks
        r#"
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL DEFAULT 'medium', project TEXT NOT NULL DEFAULT 'inbox', tags TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', due_at INTEGER, due_time TEXT, start_at INTEGER, estimated_minutes INTEGER, tracked_minutes INTEGER NOT NULL DEFAULT 0, recurrence_rule TEXT, archived INTEGER NOT NULL DEFAULT 0, sort_order REAL NOT NULL DEFAULT 0, parent_id TEXT REFERENCES tasks(id), completed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS subtasks (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)
        "#,
        // Batch 5: Health, habits
        r#"
        CREATE TABLE IF NOT EXISTS health_logs (id TEXT PRIMARY KEY, type TEXT NOT NULL, value REAL, unit TEXT, metadata TEXT DEFAULT '{}', logged_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS health_events (id INTEGER PRIMARY KEY AUTOINCREMENT, module_id TEXT NOT NULL, event_type TEXT NOT NULL, value REAL, unit TEXT, metadata TEXT NOT NULL DEFAULT '{}', started_at INTEGER, ended_at INTEGER, logged_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_health_events_module_event_logged_at ON health_events(module_id, event_type, logged_at DESC);
        CREATE INDEX IF NOT EXISTS idx_health_events_logged_at ON health_events(logged_at DESC);
        CREATE TABLE IF NOT EXISTS habits (id TEXT PRIMARY KEY, name TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'daily', created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS habit_completions (habit_id TEXT REFERENCES habits(id) ON DELETE CASCADE, completed_at INTEGER NOT NULL, PRIMARY KEY (habit_id, completed_at))
        "#,
        // Batch 6: Recording, modules, contexts
        r#"
        CREATE TABLE IF NOT EXISTS recording_metadata (id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_secs REAL NOT NULL, file_path TEXT NOT NULL, file_size_bytes INTEGER NOT NULL, module_id TEXT NOT NULL, created_at INTEGER NOT NULL, device_name TEXT, sample_rate INTEGER NOT NULL, channels INTEGER NOT NULL, tags TEXT NOT NULL DEFAULT '[]', transcribed INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS idx_recording_metadata_module_created_at ON recording_metadata(module_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS recording_transcripts (recording_id TEXT PRIMARY KEY REFERENCES recording_metadata(id) ON DELETE CASCADE, transcript TEXT NOT NULL DEFAULT '', language TEXT, model_path TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS installed_modules (id TEXT PRIMARY KEY, version TEXT NOT NULL, installed_at INTEGER NOT NULL, builtin INTEGER NOT NULL DEFAULT 0, manifest TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS module_settings (module_id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS module_context (module TEXT PRIMARY KEY, scroll_position REAL NOT NULL DEFAULT 0, last_open_id TEXT, cursor_position INTEGER, extra TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS module_fonts (module TEXT NOT NULL, role TEXT NOT NULL, family TEXT NOT NULL, source TEXT NOT NULL, file_path TEXT, size_scale REAL DEFAULT 1.0, PRIMARY KEY (module, role))
        "#,
        // Batch 7: Passwords, runtime, dashboard, journal
        r#"
        CREATE TABLE IF NOT EXISTS passwords (id TEXT PRIMARY KEY, site TEXT NOT NULL, username TEXT NOT NULL, password_encrypted TEXT NOT NULL DEFAULT '', notes_encrypted TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS dashboard_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, module_id TEXT NOT NULL, related_module_id TEXT, action TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_dashboard_events_created_at ON dashboard_events(created_at DESC);
        CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, blocks TEXT NOT NULL DEFAULT '[]', word_count INTEGER DEFAULT 0, mood TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
        "#,
        // Batch 8: Nutrition
        r#"
        CREATE TABLE IF NOT EXISTS water_logs (id TEXT PRIMARY KEY, amount_ml INTEGER NOT NULL, logged_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_water_logs_logged_at ON water_logs(logged_at DESC);
        CREATE TABLE IF NOT EXISTS meals (id TEXT PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL DEFAULT 'meal', notes TEXT NOT NULL DEFAULT '', total_kcal INTEGER NOT NULL DEFAULT 0, logged_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_meals_logged_at ON meals(logged_at DESC);
        CREATE TABLE IF NOT EXISTS meal_foods (id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE, name TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1.0, unit TEXT NOT NULL DEFAULT 'serving', calories_kcal INTEGER NOT NULL DEFAULT 0, protein_g REAL NOT NULL DEFAULT 0, carbs_g REAL NOT NULL DEFAULT 0, fat_g REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_meal_foods_meal_id ON meal_foods(meal_id);
        CREATE TABLE IF NOT EXISTS nutrition_goals (id INTEGER PRIMARY KEY CHECK (id = 1), water_goal_ml INTEGER NOT NULL DEFAULT 2000, calorie_goal INTEGER NOT NULL DEFAULT 2200, protein_goal_g INTEGER NOT NULL DEFAULT 150, carbs_goal_g INTEGER NOT NULL DEFAULT 250, fat_goal_g INTEGER NOT NULL DEFAULT 70, updated_at INTEGER NOT NULL DEFAULT 0);
        INSERT OR IGNORE INTO nutrition_goals (id, updated_at) VALUES (1, 0);
        CREATE TABLE IF NOT EXISTS nutrition_reminders (id TEXT PRIMARY KEY, label TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL DEFAULT 'Active', schedule TEXT NOT NULL DEFAULT '{}', enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
        "#,
        // Batch 9: Countdown + commitment bonds + birthdays
        r#"
        CREATE TABLE IF NOT EXISTS countdown_events (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_ms INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'Personal', accent TEXT NOT NULL DEFAULT '#6366f1', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS countdown_milestones (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_ms INTEGER NOT NULL, progress INTEGER NOT NULL DEFAULT 0, accent TEXT NOT NULL DEFAULT '#6366f1', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS commitment_bonds (id TEXT PRIMARY KEY, title TEXT NOT NULL, goal_id TEXT REFERENCES goals(id), deadline INTEGER NOT NULL, success_metric TEXT NOT NULL, consequence TEXT NOT NULL, check_in_days INTEGER DEFAULT 7, status TEXT DEFAULT 'active', check_in_history TEXT DEFAULT '[]', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS countdown_birthdays (id TEXT PRIMARY KEY, name TEXT NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL, accent TEXT NOT NULL DEFAULT '#6366f1', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
        "#,
        // Batch 10: suspicious events audit trail (subscription gating)
        r#"
        CREATE TABLE IF NOT EXISTS suspicious_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            module_id TEXT,
            detail TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_suspicious_events_type_created
            ON suspicious_events(event_type, created_at DESC)
        "#,
        // Batch 11: tasks sort order index
        r#"
        CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order ASC)
        "#,
        // Batch 12: Wiki links / backlinks
        r#"
        CREATE TABLE IF NOT EXISTS note_links (id TEXT PRIMARY KEY, source_note_id TEXT NOT NULL REFERENCES note_objects(id) ON DELETE CASCADE, target_note_id TEXT REFERENCES note_objects(id) ON DELETE SET NULL, target_title TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_target_title ON note_links(target_title);
        CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id)
        "#,
        // Batch 13: Note templates
        r#"
        CREATE TABLE IF NOT EXISTS note_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT 'note-doc', blocks_json TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
        "#,
    ];

    for batch in &batches {
        sqlx::query(batch)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    // ── Additive column migrations (safely skipped if column exists) ───
    // These handle upgrades from databases created before the full column
    // set was included in the CREATE TABLE IF NOT EXISTS statements.
    // Errors are caught individually — the column either already exists or
    // the ALTER TABLE does not apply; neither is fatal on startup.
    let alter_statements: &[&str] = &[
        "ALTER TABLE objects ADD COLUMN type TEXT NOT NULL DEFAULT 'note'",
        "ALTER TABLE objects ADD COLUMN layout TEXT NOT NULL DEFAULT 'note'",
        "ALTER TABLE objects ADD COLUMN name TEXT",
        "ALTER TABLE objects ADD COLUMN icon TEXT",
        "ALTER TABLE objects ADD COLUMN cover TEXT",
        "ALTER TABLE objects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE objects ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE objects ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE objects ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE objects ADD COLUMN space_id TEXT",
        "ALTER TABLE objects ADD COLUMN details TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE blocks ADD COLUMN object_id TEXT",
        "ALTER TABLE blocks ADD COLUMN parent_id TEXT",
        "ALTER TABLE blocks ADD COLUMN type TEXT NOT NULL DEFAULT 'text'",
        "ALTER TABLE blocks ADD COLUMN content TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE blocks ADD COLUMN fields TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE blocks ADD COLUMN align INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE blocks ADD COLUMN bg_color TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE blocks ADD COLUMN position INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE blocks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE blocks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE note_objects ADD COLUMN title TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE note_objects ADD COLUMN icon TEXT",
        "ALTER TABLE note_objects ADD COLUMN cover TEXT",
        "ALTER TABLE note_objects ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE note_objects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE note_objects ADD COLUMN layout TEXT NOT NULL DEFAULT 'note'",
        "ALTER TABLE note_objects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE note_objects ADD COLUMN details TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE note_objects ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE note_objects ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN sort_order REAL NOT NULL DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN due_time TEXT",
        "ALTER TABLE tasks ADD COLUMN start_at INTEGER",
        "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER",
        "ALTER TABLE tasks ADD COLUMN tracked_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT",
        "ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN parent_id TEXT",
        "ALTER TABLE tasks ADD COLUMN completed_at INTEGER",
    ];

    for stmt in alter_statements {
        let result = sqlx::query(stmt).execute(pool).await;
        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("duplicate column name")
                || msg.contains("Cannot add a NOT NULL")
                || msg.starts_with("error returned from database: cannot add")
            {
                continue;
            }
            return Err(msg);
        }
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
    state: tauri::State<'_, BentoAppState>,
    module: String,
) -> Result<Option<ModuleContext>, String> {
    let module = parse_module(&module)?;
    read_module_context(&state.db(), &module).await
}

#[tauri::command]
pub async fn save_module_context(
    state: tauri::State<'_, BentoAppState>,
    module: String,
    context: ModuleContext,
) -> Result<ModuleContext, String> {
    let module = parse_module(&module)?;
    write_module_context(&state.db(), &module, context).await
}

#[tauri::command]
pub async fn flush_module_state(
    app: AppHandle,
    cache: State<'_, DashboardCache>,
    auth: State<'_, AuthManager>,
    state: tauri::State<'_, BentoAppState>,
    from_module: String,
    to_module: String,
    context: ModuleContext,
) -> Result<ModuleSwitchReceipt, String> {
    let from_module = parse_module(&from_module)?;
    let to_module = parse_module(&to_module)?;

    // Centralized billing tier check
    crate::auth::require_billing_tier(&auth, to_module.as_str()).await?;

    write_module_context(&state.db(), &from_module, context).await?;
    write_runtime_state(&state.db(), "last_active_module", to_module.as_str()).await?;
    record_dashboard_event(
        &state.db(),
        "module-switch",
        to_module.as_str(),
        Some(from_module.as_str()),
        &format!("Switched to {}", to_module.as_str()),
        json!({
            "fromModule": from_module.as_str(),
            "toModule": to_module.as_str(),
        }),
    )
    .await?;
    state.set_active_module(to_module.as_str());
    if let Some(channel) = app.try_state::<StateChannel>() {
        channel.publish(StateEvent::ActiveModule { module_id: to_module.as_str().to_string() });
    }
    invalidate_dashboard(cache.inner());
    let _ = emit_main_window_event(
        &app,
        "bento://dashboard-refresh",
        to_module.as_str().to_string(),
    );

    Ok(ModuleSwitchReceipt {
        from_module: from_module.as_str().to_string(),
        to_module: to_module.as_str().to_string(),
        committed: true,
    })
}

#[tauri::command]
pub async fn get_module_fonts(
    state: tauri::State<'_, BentoAppState>,
    module: String,
) -> Result<Vec<ModuleFontPreference>, String> {
    let module = parse_module(&module)?;
    let rows = sqlx::query(
        "SELECT module, role, family, source, file_path, size_scale FROM module_fonts WHERE module = ? ORDER BY role",
    )
    .bind(module.as_str())
    .fetch_all(&state.db())
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
    state: tauri::State<'_, BentoAppState>,
    module: String,
    fonts: Vec<ModuleFontPreference>,
) -> Result<Vec<ModuleFontPreference>, String> {
    let module = parse_module(&module)?;
    let pool = state.db();
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| format!("Transaction error: {e}"))?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *conn)
        .await
        .map_err(|error| error.to_string())?;

    let tx_result: Result<Vec<ModuleFontPreference>, String> = async {
        sqlx::query("DELETE FROM module_fonts WHERE module = ?")
            .bind(module.as_str())
            .execute(&mut *conn)
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
            .execute(&mut *conn)
            .await
            .map_err(|error| error.to_string())?;
        }

        get_module_fonts(state, module.as_str().to_string()).await
    }.await;

    match tx_result {
        Ok(val) => {
            sqlx::query("COMMIT")
                .execute(&mut *conn)
                .await
                .map_err(|error| error.to_string())?;
            Ok(val)
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn read_runtime_state(pool: &SqlitePool, key: &str) -> Result<Option<String>, String> {
    let row = sqlx::query("SELECT value FROM runtime_state WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(row.and_then(|r| r.try_get::<String, _>("value").ok()))
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickTaskResult {
    pub id: String,
    pub title: String,
    pub created_at: i64,
}

#[tauri::command]
pub async fn create_quick_task(
    app: AppHandle,
    cache: State<'_, DashboardCache>,
    state: tauri::State<'_, BentoAppState>,
    title: String,
) -> Result<QuickTaskResult, String> {
    let cleaned = title.trim();
    if cleaned.is_empty() {
        return Err("Task title is required.".to_string());
    }

    let created_at = crate::util::time::now_ms();
    let due_at_ms = crate::util::time::start_of_today() + 86_400_000 - 1;
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO tasks (
            id,
            title,
            done,
            priority,
            due_at,
            parent_id,
            created_at,
            updated_at
        ) VALUES (?, ?, 0, 'medium', ?, NULL, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(cleaned)
    .bind(due_at_ms)
    .bind(created_at)
    .bind(created_at)
    .execute(&state.db())
    .await
    .map_err(|error| error.to_string())?;

    record_dashboard_event(
        &state.db(),
        "quick-add",
        "tasks",
        None,
        &format!("Added task: {cleaned}"),
        json!({
            "taskId": id,
            "title": cleaned,
        }),
    )
    .await?;

    invalidate_dashboard(cache.inner());
    let _ = emit_main_window_event(&app, "bento://dashboard-refresh", "tasks".to_string());

    Ok(QuickTaskResult {
        id,
        title: cleaned.to_string(),
        created_at,
    })
}

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
        "Bento AI channel is ready.\n\nPrompt received: {}\n\nProduct model routing is not connected yet.",
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
