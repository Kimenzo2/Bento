// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use chrono::Timelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_schedules".into(),
            description: "List all active schedules and alarms with their trigger times.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_schedule".into(),
            description: "Create a new schedule for a reminder or recurring alarm. Supports once, daily, and weekly types.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Schedule label/name (required)"},
                    "schedule_type": {"type": "string", "enum": ["once", "daily", "weekly"], "description": "Recurrence type (required)"},
                    "module_id": {"type": "string", "description": "Module this belongs to, e.g. 'sleep', 'nutrition', 'custom'"},
                    "start_at": {"type": "string", "description": "ISO 8601 start time (required)"},
                    "interval_seconds": {"type": "integer", "description": "Interval in seconds for custom schedules"},
                    "end_at": {"type": "string", "description": "Optional ISO 8601 end time"},
                    "wake_window_minutes": {"type": "integer", "description": "Optional wake window in minutes"},
                    "sound": {"type": "string", "description": "Optional notification sound name"}
                },
                "required": ["label", "schedule_type", "start_at"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_schedule".into(),
            description: "Delete a schedule by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "schedule_id": {"type": "string", "description": "The unique ID of the schedule to delete"}
                },
                "required": ["schedule_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "toggle_schedule".into(),
            description: "Enable or disable a schedule without deleting it.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "schedule_id": {"type": "string", "description": "The unique ID of the schedule"},
                    "enabled": {"type": "boolean", "description": "True to enable, false to disable"}
                },
                "required": ["schedule_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_alarms".into(),
            description: "List all sleep alarms with their time, sound, and active status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_alarm".into(),
            description: "Create a new sleep alarm with time (HH:MM), label, sound, and wake window.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Alarm label (required)"},
                    "time": {"type": "string", "description": "Time in HH:MM format (required)"},
                    "sound": {"type": "string", "description": "Sound name, defaults to 'default'"},
                    "wake_window": {"type": "string", "description": "Wake window, e.g. '30min' or '1h'"}
                },
                "required": ["label", "time"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_alarm".into(),
            description: "Delete a sleep alarm by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "alarm_id": {"type": "string", "description": "The unique ID of the alarm to delete"}
                },
                "required": ["alarm_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "toggle_alarm".into(),
            description: "Toggle a sleep alarm on or off.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "alarm_id": {"type": "string", "description": "The unique ID of the alarm"},
                    "active": {"type": "boolean", "description": "True to activate, false to deactivate"}
                },
                "required": ["alarm_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_reminders".into(),
            description: "List all nutrition reminders (drink water, eat meals, etc.).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_reminder".into(),
            description: "Create a new nutrition or custom reminder with label and optional schedule.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Reminder label (required)"},
                    "detail": {"type": "string", "description": "Optional detail text"},
                    "mode": {"type": "string", "enum": ["active", "scheduled", "smart"], "description": "Reminder mode, defaults to active"},
                    "schedule": {"type": "string", "description": "JSON schedule config"}
                },
                "required": ["label"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_reminder".into(),
            description: "Delete a reminder by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "reminder_id": {"type": "string", "description": "The unique ID of the reminder to delete"}
                },
                "required": ["reminder_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "list_schedules" => Ok(Some(list_schedules(pool).await?)),
        "create_schedule" => Ok(Some(create_schedule(args, pool).await?)),
        "delete_schedule" => Ok(Some(delete_schedule(args, pool).await?)),
        "toggle_schedule" => Ok(Some(toggle_schedule(args, pool).await?)),
        "list_alarms" => Ok(Some(list_alarms(pool).await?)),
        "create_alarm" => Ok(Some(create_alarm(args, pool).await?)),
        "delete_alarm" => Ok(Some(delete_alarm(args, pool).await?)),
        "toggle_alarm" => Ok(Some(toggle_alarm(args, pool).await?)),
        "list_reminders" => Ok(Some(list_reminders(pool).await?)),
        "create_reminder" => Ok(Some(create_reminder(args, pool).await?)),
        "delete_reminder" => Ok(Some(delete_reminder(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn list_schedules(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Option<i64>, i64, bool)>(
        "SELECT id, label, schedule_type, module_id, next_fire_at, created_at, enabled FROM schedules ORDER BY next_fire_at ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let schedules: Vec<Value> = rows.into_iter().map(|(id, label, stype, module, next_fire, created, enabled)| {
        json!({"id": id, "label": label, "type": stype, "module": module, "nextFireAt": next_fire, "createdAt": created, "enabled": enabled})
    }).collect();

    Ok(json!({ "schedules": schedules, "count": schedules.len() }))
}

async fn create_schedule(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let label = args["label"].as_str().ok_or("label is required")?;
    let schedule_type = args["schedule_type"].as_str().ok_or("schedule_type is required")?;
    let start_at = args["start_at"].as_str().ok_or("start_at is required")?;

    let start_ms = chrono::DateTime::parse_from_rfc3339(start_at)
        .map_err(|_| "Invalid start_at format.".to_string())?.timestamp_millis();
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let module_id = args["module_id"].as_str().unwrap_or("custom");
    let end_at = args["end_at"].as_str().and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok().map(|dt| dt.timestamp_millis()));
    let interval = args["interval_seconds"].as_i64();
    let wake_window = args["wake_window_minutes"].as_i64();
    let sound = args["sound"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO schedules (id, module_id, label, schedule_type, interval_seconds, start_at, end_at, next_fire_at, wake_window_minutes, sound, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .bind(&id).bind(module_id).bind(label).bind(schedule_type).bind(interval)
    .bind(start_ms).bind(end_at).bind(start_ms).bind(wake_window).bind(sound)
    .bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create schedule: {e}"))?;

    Ok(json!({ "id": id, "label": label, "data_coverage": 1.0, "message": format!("Schedule \"{label}\" created.") }))
}

async fn delete_schedule(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let schedule_id = args["schedule_id"].as_str().ok_or("schedule_id is required")?;
    sqlx::query("DELETE FROM schedules WHERE id = ?").bind(schedule_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete schedule: {e}"))?;
    Ok(json!({ "id": schedule_id, "data_coverage": 1.0, "message": "Schedule deleted." }))
}

async fn toggle_schedule(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let schedule_id = args["schedule_id"].as_str().ok_or("schedule_id is required")?;
    let enabled = args["enabled"].as_bool().unwrap_or(true);
    let now_ms = time::now_ms();
    let val = if enabled { 1i64 } else { 0 };

    sqlx::query("UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?")
        .bind(val).bind(now_ms).bind(schedule_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to toggle schedule: {e}"))?;

    Ok(json!({ "id": schedule_id, "enabled": enabled, "data_coverage": 1.0 }))
}

async fn list_alarms(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, String, bool)>(
        "SELECT id, label, time, wake_window, sound, active FROM sleep_alarms ORDER BY time ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let alarms: Vec<Value> = rows.into_iter().map(|(id, label, time, wake_window, sound, active)| {
        json!({"id": id, "label": label, "time": time, "wakeWindow": wake_window, "sound": sound, "active": active})
    }).collect();

    Ok(json!({ "alarms": alarms, "count": alarms.len() }))
}

async fn create_alarm(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let label = args["label"].as_str().ok_or("label is required")?;
    let time_str = args["time"].as_str().ok_or("time is required")?;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let sound = args["sound"].as_str().unwrap_or("default");
    let wake_window = args["wake_window"].as_str().unwrap_or("30min");

    sqlx::query(
        "INSERT INTO sleep_alarms (id, label, time, wake_window, mode, sound, active, created_at) VALUES (?, ?, ?, ?, 'Smart', ?, 1, ?)"
    )
    .bind(&id).bind(label).bind(time_str).bind(wake_window).bind(sound).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create alarm: {e}"))?;

    let schedule_id = Uuid::new_v4().to_string();
    let parts: Vec<&str> = time_str.split(':').collect();
    let hour: i64 = parts.first().and_then(|h| h.parse().ok()).unwrap_or(7);
    let minute: i64 = parts.get(1).and_then(|m| m.parse().ok()).unwrap_or(0);
    let now = chrono::Utc::now();
    let alarm_today = chrono::Utc::now()
        .with_hour(hour as u32).and_then(|d| d.with_minute(minute as u32))
        .and_then(|d| d.with_second(0))
        .unwrap_or(now);
    let start_ms = alarm_today.timestamp_millis();

    sqlx::query(
        "INSERT OR REPLACE INTO schedules (id, module_id, label, schedule_type, interval_seconds, start_at, next_fire_at, enabled, created_at, updated_at) VALUES (?, 'sleep', ?, 'daily', 86400, ?, ?, 1, ?, ?)"
    )
    .bind(&schedule_id).bind(label).bind(start_ms).bind(start_ms).bind(now_ms).bind(now_ms)
    .execute(pool).await.ok();

    Ok(json!({ "id": id, "label": label, "time": time_str, "data_coverage": 1.0, "message": format!("Alarm \"{label}\" created for {time_str}.") }))
}

async fn delete_alarm(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let alarm_id = args["alarm_id"].as_str().ok_or("alarm_id is required")?;
    sqlx::query("DELETE FROM sleep_alarms WHERE id = ?").bind(alarm_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete alarm: {e}"))?;
    sqlx::query("DELETE FROM schedules WHERE id = ?").bind(alarm_id).execute(pool).await.ok();
    Ok(json!({ "id": alarm_id, "data_coverage": 1.0, "message": "Alarm deleted." }))
}

async fn toggle_alarm(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let alarm_id = args["alarm_id"].as_str().ok_or("alarm_id is required")?;
    let active = args["active"].as_bool().unwrap_or(true);
    let val = if active { 1i64 } else { 0 };

    sqlx::query("UPDATE sleep_alarms SET active = ? WHERE id = ?")
        .bind(val).bind(alarm_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to toggle alarm: {e}"))?;

    sqlx::query("UPDATE schedules SET enabled = ? WHERE id = ?")
        .bind(val).bind(alarm_id).execute(pool).await.ok();

    Ok(json!({ "id": alarm_id, "active": active, "data_coverage": 1.0 }))
}

async fn list_reminders(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, bool)>(
        "SELECT id, label, detail, mode, schedule, enabled FROM nutrition_reminders ORDER BY created_at ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let reminders: Vec<Value> = rows.into_iter().map(|(id, label, detail, mode, schedule, enabled)| {
        json!({"id": id, "label": label, "detail": detail, "mode": mode, "schedule": schedule, "enabled": enabled})
    }).collect();

    Ok(json!({ "reminders": reminders, "count": reminders.len() }))
}

async fn create_reminder(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let label = args["label"].as_str().ok_or("label is required")?;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let detail = args["detail"].as_str().unwrap_or("");
    let mode = args["mode"].as_str().unwrap_or("active");
    let schedule = args["schedule"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO nutrition_reminders (id, label, detail, mode, schedule, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .bind(&id).bind(label).bind(detail).bind(mode).bind(schedule).bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create reminder: {e}"))?;

    Ok(json!({ "id": id, "label": label, "data_coverage": 1.0, "message": format!("Reminder \"{label}\" created.") }))
}

async fn delete_reminder(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let reminder_id = args["reminder_id"].as_str().ok_or("reminder_id is required")?;
    sqlx::query("DELETE FROM nutrition_reminders WHERE id = ?").bind(reminder_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete reminder: {e}"))?;
    Ok(json!({ "id": reminder_id, "data_coverage": 1.0, "message": "Reminder deleted." }))
}
