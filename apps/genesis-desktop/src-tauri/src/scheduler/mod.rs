// ═══════════════════════════════════════════════════════════════════════
// Scheduler Engine — SQLite-backed persistent reminders & recurring schedules
// ═══════════════════════════════════════════════════════════════════════
// Schedules survive app restart. Each schedule tracks its next fire time.
// A background worker periodically checks and dispatches due schedules.
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{Emitter, Manager};

use crate::util::time;

// ─── Schedule Types ───────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleType {
    Once,
    Daily,
    Weekly,
    Custom,
}

impl ScheduleType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Once => "once",
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::Custom => "custom",
        }
    }
}

impl std::str::FromStr for ScheduleType {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "once" => Ok(Self::Once),
            "daily" => Ok(Self::Daily),
            "weekly" => Ok(Self::Weekly),
            "custom" => Ok(Self::Custom),
            other => Err(format!("Unknown schedule type: {other}")),
        }
    }
}

// ─── Schedule ─────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: Option<String>,
    pub module_id: String,
    pub label: String,
    pub schedule_type: String,
    pub interval_seconds: Option<i64>,
    pub start_at: Option<i64>,
    pub end_at: Option<i64>,
    pub last_fired_at: Option<i64>,
    pub next_fire_at: Option<i64>,
    pub wake_window_minutes: Option<i64>,
    pub sound: Option<String>,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Schedule {
    pub fn new(module_id: &str, label: &str, schedule_type: &str) -> Self {
        let now = time::now_ms();
        Self {
            id: None,
            module_id: module_id.to_string(),
            label: label.to_string(),
            schedule_type: schedule_type.to_string(),
            interval_seconds: None,
            start_at: None,
            end_at: None,
            last_fired_at: None,
            next_fire_at: Some(now),
            wake_window_minutes: None,
            sound: None,
            enabled: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set schedule to repeat every N seconds (for daily, use 86400)
    pub fn every_seconds(mut self, seconds: i64) -> Self {
        self.interval_seconds = Some(seconds);
        self
    }

    /// Set start time (UTC ms)
    pub fn starting_at(mut self, start_ms: i64) -> Self {
        self.start_at = Some(start_ms);
        self.next_fire_at = Some(start_ms);
        self
    }

    /// Calculate and advance the next fire time after firing
    pub fn advance(&mut self) {
        self.last_fired_at = Some(time::now_ms());

        // Check end_at boundary — disable if past end
        if let Some(end) = self.end_at {
            if time::now_ms() >= end {
                self.enabled = false;
                self.next_fire_at = None;
                self.updated_at = time::now_ms();
                return;
            }
        }

        match self.schedule_type.parse::<ScheduleType>() {
            Ok(ScheduleType::Once) => {
                self.enabled = false;
                self.next_fire_at = None;
            }
            Ok(ScheduleType::Daily) => {
                if let Some(start) = self.start_at {
                    let elapsed = time::now_ms() - start;
                    let days = elapsed / 86_400_000;
                    let mut next = start + (days + 1) * 86_400_000;
                    // Apply wake window offset: fire early by wake_window_minutes
                    if let Some(w) = self.wake_window_minutes {
                        if w > 0 {
                            next -= w * 60_000;
                        }
                    }
                    self.next_fire_at = Some(next);
                } else if let Some(last) = self.last_fired_at {
                    self.next_fire_at = Some(last + 86_400_000);
                }
            }
            Ok(ScheduleType::Weekly) => {
                if let Some(start) = self.start_at {
                    let elapsed = time::now_ms() - start;
                    let weeks = elapsed / 604_800_000;
                    let mut next = start + (weeks + 1) * 604_800_000;
                    // Apply wake window offset for weekly schedules too
                    if let Some(w) = self.wake_window_minutes {
                        if w > 0 {
                            next -= w * 60_000;
                        }
                    }
                    self.next_fire_at = Some(next);
                } else if let Some(last) = self.last_fired_at {
                    self.next_fire_at = Some(last + 604_800_000);
                }
            }
            Ok(ScheduleType::Custom) => {
                if let Some(interval) = self.interval_seconds {
                    let now = time::now_ms();
                    self.next_fire_at = Some(now + interval * 1000);
                }
            }
            Err(_) => {}
        }
        self.updated_at = time::now_ms();
    }
}

// ─── Schedule Store ───────────────────────────────────────────────────

pub struct ScheduleStore {
    db: SqlitePool,
}

impl ScheduleStore {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    pub async fn create(&self, schedule: &Schedule) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let enabled = if schedule.enabled { 1 } else { 0 };

        sqlx::query(
            r#"
            INSERT INTO schedules (id, module_id, label, schedule_type, interval_seconds,
                start_at, end_at, last_fired_at, next_fire_at, wake_window_minutes,
                sound, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&schedule.module_id)
        .bind(&schedule.label)
        .bind(&schedule.schedule_type)
        .bind(schedule.interval_seconds)
        .bind(schedule.start_at)
        .bind(schedule.end_at)
        .bind(schedule.last_fired_at)
        .bind(schedule.next_fire_at)
        .bind(schedule.wake_window_minutes)
        .bind(&schedule.sound)
        .bind(enabled)
        .bind(schedule.created_at)
        .bind(schedule.updated_at)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(id)
    }

    pub async fn update(&self, schedule: &Schedule) -> Result<(), String> {
        let id = schedule
            .id
            .as_ref()
            .ok_or_else(|| "Schedule id is required for update.".to_string())?;
        let enabled = if schedule.enabled { 1 } else { 0 };

        sqlx::query(
            r#"
            UPDATE schedules SET
                label = ?, schedule_type = ?, interval_seconds = ?,
                start_at = ?, end_at = ?, last_fired_at = ?,
                next_fire_at = ?, wake_window_minutes = ?, sound = ?, enabled = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&schedule.label)
        .bind(&schedule.schedule_type)
        .bind(schedule.interval_seconds)
        .bind(schedule.start_at)
        .bind(schedule.end_at)
        .bind(schedule.last_fired_at)
        .bind(schedule.next_fire_at)
        .bind(schedule.wake_window_minutes)
        .bind(&schedule.sound)
        .bind(enabled)
        .bind(schedule.updated_at)
        .bind(id)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM schedules WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get(&self, id: &str) -> Result<Option<Schedule>, String> {
        let row = sqlx::query("SELECT * FROM schedules WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await
            .map_err(|e| e.to_string())?;

        Ok(row.map(Self::row_to_schedule))
    }

    pub async fn list_by_module(&self, module_id: &str) -> Result<Vec<Schedule>, String> {
        let rows =
            sqlx::query("SELECT * FROM schedules WHERE module_id = ? ORDER BY next_fire_at ASC")
                .bind(module_id)
                .fetch_all(&self.db)
                .await
                .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(Self::row_to_schedule).collect())
    }

    pub async fn list_all_enabled(&self) -> Result<Vec<Schedule>, String> {
        let rows =
            sqlx::query("SELECT * FROM schedules WHERE enabled = 1 ORDER BY next_fire_at ASC")
                .fetch_all(&self.db)
                .await
                .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(Self::row_to_schedule).collect())
    }

    /// Find all schedules that are due (next_fire_at <= now)
    pub async fn get_due(&self) -> Result<Vec<Schedule>, String> {
        let now = time::now_ms();
        let rows = sqlx::query(
            "SELECT * FROM schedules WHERE enabled = 1 AND next_fire_at IS NOT NULL AND next_fire_at <= ? ORDER BY next_fire_at ASC",
        )
        .bind(now)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(Self::row_to_schedule).collect())
    }

    pub async fn mark_fired(&self, id: &str) -> Result<(), String> {
        let now = time::now_ms();
        sqlx::query("UPDATE schedules SET last_fired_at = ?, updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(now)
            .bind(id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn row_to_schedule(row: sqlx::sqlite::SqliteRow) -> Schedule {
        Schedule {
            id: Some(row.try_get("id").unwrap_or_default()),
            module_id: row.try_get("module_id").unwrap_or_default(),
            label: row.try_get("label").unwrap_or_default(),
            schedule_type: row.try_get("schedule_type").unwrap_or_default(),
            interval_seconds: row.try_get("interval_seconds").ok().flatten(),
            start_at: row.try_get("start_at").ok().flatten(),
            end_at: row.try_get("end_at").ok().flatten(),
            last_fired_at: row.try_get("last_fired_at").ok().flatten(),
            next_fire_at: row.try_get("next_fire_at").ok().flatten(),
            wake_window_minutes: row.try_get("wake_window_minutes").ok().flatten(),
            sound: row.try_get("sound").ok(),
            enabled: row.try_get::<i64, _>("enabled").unwrap_or(0) == 1,
            created_at: row.try_get("created_at").unwrap_or_default(),
            updated_at: row.try_get("updated_at").unwrap_or_default(),
        }
    }
}

// ─── Table Bootstrap ─────────────────────────────────────────────────

pub async fn ensure_scheduler_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            module_id TEXT NOT NULL,
            label TEXT NOT NULL,
            schedule_type TEXT NOT NULL,
            interval_seconds INTEGER,
            start_at INTEGER,
            end_at INTEGER,
            last_fired_at INTEGER,
            next_fire_at INTEGER,
            wake_window_minutes INTEGER DEFAULT 0,
            sound TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_schedules_next_fire ON schedules(enabled, next_fire_at)",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Migrate existing tables: add columns that may be missing from older DBs.
    let _ = sqlx::query("ALTER TABLE schedules ADD COLUMN wake_window_minutes INTEGER DEFAULT 0")
        .execute(pool).await;
    let _ = sqlx::query("ALTER TABLE schedules ADD COLUMN sound TEXT")
        .execute(pool).await;

    Ok(())
}

// ─── Background Scheduler Worker ──────────────────────────────────────

pub fn spawn_scheduler_worker(state: crate::db::BentoAppState, app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        let db = state.db();

        // Ensure scheduler + notification tables exist before entering the loop
        if let Err(e) = ensure_scheduler_tables(&db).await {
            eprintln!("[scheduler] Failed to bootstrap scheduler tables: {e}");
        }
        if let Err(e) = crate::notifications::ensure_notification_tables(&db).await {
            eprintln!("[scheduler] Failed to bootstrap notification tables: {e}");
        }

        loop {
            interval.tick().await;

            let store = ScheduleStore::new(db.clone());

            // Check for due schedules
            let due = match store.get_due().await {
                Ok(schedules) => schedules,
                Err(e) => {
                    eprintln!("[scheduler] Failed to query due schedules: {e}");
                    continue;
                }
            };

            if due.is_empty() {
                continue;
            }

            for schedule in due {
                // Guard: skip if already fired within the last 60s (crash recovery guard)
                if let Some(last) = schedule.last_fired_at {
                    if time::now_ms() - last < 60_000 {
                        eprintln!("[scheduler] Skip {} — fired {}ms ago", schedule.label, time::now_ms() - last);
                        continue;
                    }
                }

                let app = app_handle.clone();
                let sched = schedule.clone();
                let dbc = db.clone();

                // Fire notification for this schedule
                tauri::async_runtime::spawn(async move {
                    // 1. Emit event to frontend so passive-intelligence can pick it up
                    if let Some(window) = app.get_webview_window("main") {
                        let payload: serde_json::Value = serde_json::json!({
                            "scheduleId": sched.id,
                            "moduleId": sched.module_id,
                            "label": sched.label,
                            "sound": sched.sound,
                        });
                        if let Err(e) = window.emit("bento://schedule-fire", payload) {
                            eprintln!("[scheduler] Failed to emit schedule-fire event: {e}");
                        }
                    }

                    // 2. Dispatch native OS notification (with sound for sleep alarms)
                    let title = &sched.label;
                    let body = &format!("Your scheduled {} reminder is due.", sched.label);
                    if let Err(e) = crate::notifications::dispatch_sound_notification(
                        &app, title, body,
                    ) {
                        eprintln!("[scheduler] Notification dispatch failed: {e}");
                    }
                    // Record in history (best-effort)
                    let notif_store = crate::notifications::NotificationStore::new(dbc.clone());
                    if let Err(e) = notif_store
                        .record_fired(&sched.module_id, title, body, sched.id.as_deref())
                        .await
                    {
                        eprintln!("[scheduler] Failed to record notification: {e}");
                    }

                    // 3. Advance schedule (snaps daily to start_at to prevent drift)
                    let mut updated = sched.clone();
                    updated.advance();

                    // 4. Persist advanced schedule (advance() already sets last_fired_at + updated_at)
                    let store = ScheduleStore::new(dbc.clone());
                    if let Some(id) = updated.id.as_ref() {
                        if let Err(e) = store.update(&updated).await {
                            eprintln!("[scheduler] Failed to persist advanced schedule {id}: {e}");
                        }
                    }

                    // 5. Check for pending snoozed notifications
                    if let Ok(pending) = notif_store.get_pending_snoozed().await {
                        for n in pending {
                            if let Some(_nid) = n.id {
                                if let Err(e) = crate::notifications::dispatch_sound_notification(
                                    &app, &n.title, &n.body,
                                ) {
                                    eprintln!("[scheduler] Snoozed dispatch failed: {e}");
                                }
                            }
                        }
                    }
                });
            }
        }
    });
}

// ─── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn create_schedule(
    db: tauri::State<'_, crate::db::BentoAppState>,
    schedule: Schedule,
) -> Result<String, String> {
    let pool = db.db();
    ensure_scheduler_tables(&pool).await?;
    let store = ScheduleStore::new(pool.clone());
    store.create(&schedule).await
}

#[tauri::command]
pub async fn update_schedule(
    db: tauri::State<'_, crate::db::BentoAppState>,
    schedule: Schedule,
) -> Result<(), String> {
    let pool = db.db();
    ensure_scheduler_tables(&pool).await?;
    let store = ScheduleStore::new(pool.clone());
    store.update(&schedule).await
}

#[tauri::command]
pub async fn delete_schedule(
    db: tauri::State<'_, crate::db::BentoAppState>,
    id: String,
) -> Result<(), String> {
    let pool = db.db();
    ensure_scheduler_tables(&pool).await?;
    let store = ScheduleStore::new(pool.clone());
    store.delete(&id).await
}

#[tauri::command]
pub async fn get_schedules(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: Option<String>,
) -> Result<Vec<Schedule>, String> {
    let pool = db.db();
    ensure_scheduler_tables(&pool).await?;
    let store = ScheduleStore::new(pool.clone());
    match module_id {
        Some(mid) => store.list_by_module(&mid).await,
        None => store.list_all_enabled().await,
    }
}

#[tauri::command]
pub async fn get_due_schedules(
    db: tauri::State<'_, crate::db::BentoAppState>,
) -> Result<Vec<Schedule>, String> {
    let pool = db.db();
    ensure_scheduler_tables(&pool).await?;
    let store = ScheduleStore::new(pool.clone());
    store.get_due().await
}
