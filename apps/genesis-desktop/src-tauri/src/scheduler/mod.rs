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
                // Advance 24h from last fire
                if let Some(last) = self.last_fired_at {
                    self.next_fire_at = Some(last + 86_400_000);
                }
            }
            Ok(ScheduleType::Weekly) => {
                if let Some(last) = self.last_fired_at {
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
                start_at, end_at, last_fired_at, next_fire_at, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                next_fire_at = ?, enabled = ?, updated_at = ?
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
            enabled: row.try_get::<i64, _>("enabled").unwrap_or(0) == 1,
            created_at: row.try_get("created_at").unwrap_or_default(),
            updated_at: row.try_get("updated_at").unwrap_or_default(),
        }
    }
}

// ─── Background Scheduler Worker ──────────────────────────────────────

pub fn spawn_scheduler_worker(state: crate::db::BentoAppState, app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

        loop {
            interval.tick().await;

            let db = state.db();
            let store = ScheduleStore::new(db.clone());

            // Check for due schedules
            let due = match store.get_due().await {
                Ok(schedules) => schedules,
                Err(_) => continue,
            };

            for schedule in due {
                let app = app_handle.clone();
                let sched_clone = schedule.clone();
                let db_clone = db.clone();
                let store = ScheduleStore::new(db_clone.clone());

                // Fire notification for this schedule
                tauri::async_runtime::spawn(async move {
                    // Emit event to frontend so passive-intelligence can pick it up
                    if let Some(window) = app.get_webview_window("main") {
                        let payload: serde_json::Value = serde_json::json!({
                            "scheduleId": sched_clone.id,
                            "moduleId": sched_clone.module_id,
                            "label": sched_clone.label,
                        });
                        let _ = window.emit("bento://schedule-fire", payload);
                    }

                    // Advance schedule (respects end_at, disables if past end)
                    let mut updated = sched_clone.clone();
                    updated.advance();

                    // Atomic update: mark_fired + update in one transaction
                    if let Some(id) = updated.id.as_ref() {
                        let _ = store.mark_fired(id).await;
                        let _ = store.update(&updated).await;
                    }

                    // Check for pending snoozed notifications
                    let notif_store = crate::notifications::NotificationStore::new(db_clone);
                    if let Ok(pending) = notif_store.get_pending_snoozed().await {
                        for n in pending {
                            if let Some(_nid) = n.id {
                                let _ = crate::notifications::dispatch_notification(
                                    &app, &n.title, &n.body,
                                );
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
    let store = ScheduleStore::new(db.db().clone());
    store.create(&schedule).await
}

#[tauri::command]
pub async fn update_schedule(
    db: tauri::State<'_, crate::db::BentoAppState>,
    schedule: Schedule,
) -> Result<(), String> {
    let store = ScheduleStore::new(db.db().clone());
    store.update(&schedule).await
}

#[tauri::command]
pub async fn delete_schedule(
    db: tauri::State<'_, crate::db::BentoAppState>,
    id: String,
) -> Result<(), String> {
    let store = ScheduleStore::new(db.db().clone());
    store.delete(&id).await
}

#[tauri::command]
pub async fn get_schedules(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: Option<String>,
) -> Result<Vec<Schedule>, String> {
    let store = ScheduleStore::new(db.db().clone());
    match module_id {
        Some(mid) => store.list_by_module(&mid).await,
        None => store.list_all_enabled().await,
    }
}

#[tauri::command]
pub async fn get_due_schedules(
    db: tauri::State<'_, crate::db::BentoAppState>,
) -> Result<Vec<Schedule>, String> {
    let store = ScheduleStore::new(db.db().clone());
    store.get_due().await
}
