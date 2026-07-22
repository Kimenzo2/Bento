use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;
#[cfg(target_os = "windows")]
use tauri::Manager;

use crate::util::time;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRecord {
    pub id: Option<i64>,
    pub schedule_id: Option<String>,
    pub module_id: String,
    pub title: String,
    pub body: String,
    pub fired_at: i64,
    pub dismissed_at: Option<i64>,
    pub snoozed_until: Option<i64>,
    pub action_taken: Option<String>,
}

pub struct NotificationStore {
    db: SqlitePool,
}

impl NotificationStore {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    pub async fn record_fired(
        &self,
        module_id: &str,
        title: &str,
        body: &str,
        schedule_id: Option<&str>,
    ) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO notification_history (schedule_id, module_id, title, body, fired_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(schedule_id)
        .bind(module_id)
        .bind(title)
        .bind(body)
        .bind(time::now_ms())
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(result.last_insert_rowid())
    }

    pub async fn mark_dismissed(&self, id: i64) -> Result<(), String> {
        sqlx::query("UPDATE notification_history SET dismissed_at = ? WHERE id = ?")
            .bind(time::now_ms())
            .bind(id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn mark_snoozed(&self, id: i64, snooze_minutes: i64) -> Result<(), String> {
        let snoozed_until = time::now_ms() + (snooze_minutes * 60 * 1000);
        sqlx::query("UPDATE notification_history SET snoozed_until = ? WHERE id = ?")
            .bind(snoozed_until)
            .bind(id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn mark_actioned(&self, id: i64, action: &str) -> Result<(), String> {
        sqlx::query("UPDATE notification_history SET action_taken = ? WHERE id = ?")
            .bind(action)
            .bind(id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_recent(
        &self,
        module_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<NotificationRecord>, String> {
        let query = match module_id {
            Some(_) => "SELECT * FROM notification_history WHERE module_id = ? ORDER BY fired_at DESC LIMIT ?",
            None => "SELECT * FROM notification_history ORDER BY fired_at DESC LIMIT ?",
        };

        let mut q = sqlx::query(query);
        if let Some(mid) = module_id {
            q = q.bind(mid);
        }
        q = q.bind(limit);

        let rows = q.fetch_all(&self.db).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(Self::row_to_record).collect())
    }

    pub async fn get_pending_snoozed(&self) -> Result<Vec<NotificationRecord>, String> {
        let now = time::now_ms();
        let rows = sqlx::query(
            "SELECT * FROM notification_history WHERE snoozed_until IS NOT NULL AND snoozed_until <= ? AND dismissed_at IS NULL",
        )
        .bind(now)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(Self::row_to_record).collect())
    }

    fn row_to_record(row: sqlx::sqlite::SqliteRow) -> NotificationRecord {
        NotificationRecord {
            id: row.try_get("id").ok(),
            schedule_id: row.try_get("schedule_id").ok().flatten(),
            module_id: row.try_get("module_id").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            body: row.try_get("body").unwrap_or_default(),
            fired_at: row.try_get("fired_at").unwrap_or_default(),
            dismissed_at: row.try_get("dismissed_at").ok().flatten(),
            snoozed_until: row.try_get("snoozed_until").ok().flatten(),
            action_taken: row.try_get("action_taken").ok().flatten(),
        }
    }
}

// ─── Permission Handling ──────────────────────────────────────────────

pub fn is_permission_granted(app: &AppHandle) -> bool {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .permission_state()
        .ok()
        .map(|s| s == tauri_plugin_notification::PermissionState::Granted)
        .unwrap_or(false)
}

pub fn request_notification_permission(app: &AppHandle) -> bool {
    use tauri_plugin_notification::NotificationExt;
    match app.notification().request_permission() {
        Ok(tauri_plugin_notification::PermissionState::Granted) => {
            true
        }
        Ok(state) => {
            eprintln!("[notifications] Permission denied: {state:?}");
            false
        }
        Err(e) => {
            eprintln!("[notifications] Permission request error: {e}");
            false
        }
    }
}

pub fn ensure_permission(app: &AppHandle) -> bool {
    if is_permission_granted(app) {
        return true;
    }
    request_notification_permission(app)
}

// ─── Notification Dispatch ────────────────────────────────────────────

pub fn dispatch_notification(app: &AppHandle, title: &str, body: &str) -> Result<(), String> {
    if !ensure_permission(app) {
        return Err("Notification permission not granted".to_string());
    }

    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn dispatch_sound_notification(app: &AppHandle, title: &str, body: &str) -> Result<(), String> {
    if !ensure_permission(app) {
        return Err("Notification permission not granted".to_string());
    }

    use tauri_plugin_notification::NotificationExt;

    let mut builder = app.notification().builder().title(title).body(body);

    #[cfg(target_os = "macos")]
    {
        builder = builder.sound("Pong");
    }
    #[cfg(target_os = "linux")]
    {
        builder = builder.sound("message-new-instant");
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(resource_dir) = app.path().resource_dir() {
            let wav_path = resource_dir.join("assets").join("alarm.wav");
            if wav_path.exists() {
                builder = builder.sound(wav_path.to_string_lossy());
            }
        }
    }

    builder.show().map_err(|e| {
        e.to_string()
    })?;
    Ok(())
}

pub fn dispatch_notification_with_sound(
    app: &AppHandle,
    title: &str,
    body: &str,
    play_sound: bool,
) -> Result<(), String> {
    if play_sound {
        dispatch_sound_notification(app, title, body)
    } else {
        dispatch_notification(app, title, body)
    }
}

pub async fn notify_and_record(
    app: &AppHandle,
    db: &SqlitePool,
    module_id: &str,
    title: &str,
    body: &str,
    schedule_id: Option<&str>,
) -> Result<i64, String> {
    let dispatch_result = dispatch_notification(app, title, body);

    let store = NotificationStore::new(db.clone());
    match dispatch_result {
        Ok(()) => {
            store
                .record_fired(module_id, title, body, schedule_id)
                .await
        }
        Err(e) => Err(format!("Notification dispatch failed and was not recorded: {e}"))
    }
}

// ─── Table Bootstrap ─────────────────────────────────────────────────

pub async fn ensure_notification_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS notification_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id TEXT,
            module_id TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            fired_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            snoozed_until INTEGER,
            action_taken TEXT
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_notif_fired ON notification_history(fired_at DESC)",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
pub fn request_notification_permission_cmd(
    app: AppHandle,
) -> Result<bool, String> {
    Ok(request_notification_permission(&app))
}

#[tauri::command]
pub fn check_notification_permission(app: AppHandle) -> Result<bool, String> {
    Ok(is_permission_granted(&app))
}

#[tauri::command]
pub async fn send_module_notification(
    app: AppHandle,
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: String,
    title: String,
    body: String,
) -> Result<i64, String> {
    notify_and_record(&app, &db.db(), &module_id, &title, &body, None).await
}

#[tauri::command]
pub async fn dismiss_notification(
    db: tauri::State<'_, crate::db::BentoAppState>,
    notification_id: i64,
) -> Result<(), String> {
    let store = NotificationStore::new(db.db().clone());
    store.mark_dismissed(notification_id).await
}

#[tauri::command]
pub async fn snooze_notification(
    db: tauri::State<'_, crate::db::BentoAppState>,
    notification_id: i64,
    snooze_minutes: i64,
) -> Result<(), String> {
    let store = NotificationStore::new(db.db().clone());
    store.mark_snoozed(notification_id, snooze_minutes).await
}

#[tauri::command]
pub async fn get_notification_history(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<NotificationRecord>, String> {
    let store = NotificationStore::new(db.db().clone());
    store
        .get_recent(module_id.as_deref(), limit.unwrap_or(50))
        .await
}
