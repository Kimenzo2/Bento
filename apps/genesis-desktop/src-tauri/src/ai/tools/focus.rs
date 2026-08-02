// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "log_focus_session".into(),
            description: "Log a completed focus session with label/name, duration in minutes, and optional note.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Session label or task name (required)"},
                    "minutes": {"type": "integer", "description": "Duration in minutes (required)"},
                    "note": {"type": "string", "description": "Optional note about the session"}
                },
                "required": ["label", "minutes"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_focus_sessions".into(),
            description: "Get recent focus sessions with duration, label, and timestamps.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of days to look back (default 7, max 365)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_focus_today".into(),
            description: "Get today's focus session summary: total minutes, session count, and individual sessions.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_focus_session".into(),
            description: "Delete a focus session by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The unique ID of the focus session to delete"}
                },
                "required": ["session_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "log_focus_session" => Ok(Some(log_focus_session(args, pool).await?)),
        "get_focus_sessions" => Ok(Some(get_focus_sessions(args, pool).await?)),
        "get_focus_today" => Ok(Some(get_focus_today(pool).await?)),
        "delete_focus_session" => Ok(Some(delete_focus_session(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn log_focus_session(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let label = args["label"].as_str().ok_or("label is required")?;
    let minutes = args["minutes"].as_i64().ok_or("minutes is required")?;
    if minutes <= 0 { return Err("Minutes must be positive.".to_string()); }

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let note = args["note"].as_str().unwrap_or("");

    let metadata = json!({"label": label, "note": note}).to_string();

    sqlx::query(
        "INSERT INTO health_events (id, module_id, event_type, value, unit, metadata, started_at, ended_at, logged_at) VALUES (?, 'focus', 'focus_session', ?, 'min', ?, ?, ?, ?)"
    )
    .bind(&id).bind(minutes).bind(&metadata).bind(now_ms).bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to log focus session: {e}"))?;

    Ok(json!({
        "id": id, "label": label, "minutes": minutes,
        "data_coverage": 1.0,
        "message": format!("Focus session \"{label}\" logged: {minutes} minutes.")
    }))
}

async fn get_focus_sessions(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let days = args["days"].as_i64().unwrap_or(7).max(1).min(365);
    let cutoff = time::now_ms() - days * time::DAY_MS;

    let rows = sqlx::query_as::<_, (String, i64, Option<String>, i64)>(
        "SELECT id, value, metadata, logged_at FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? ORDER BY logged_at DESC"
    )
    .bind(cutoff)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get focus sessions: {e}"))?;

    let sessions: Vec<Value> = rows.into_iter().map(|(id, minutes, metadata, logged_at)| {
        let meta = metadata.as_deref().and_then(|m| serde_json::from_str::<Value>(m).ok()).unwrap_or(json!({}));
        json!({"id": id, "minutes": minutes, "label": meta["label"], "note": meta["note"], "loggedAt": logged_at})
    }).collect();

    Ok(json!({ "sessions": sessions, "count": sessions.len() }))
}

async fn get_focus_today(pool: &SqlitePool) -> Result<Value, String> {
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let rows = sqlx::query_as::<_, (String, i64, Option<String>, i64)>(
        "SELECT id, value, metadata, logged_at FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC"
    )
    .bind(today_start).bind(tomorrow_start)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get today's focus: {e}"))?;

    let total_minutes: i64 = rows.iter().map(|(_, m, _, _)| m).sum();
    let sessions: Vec<Value> = rows.into_iter().map(|(id, minutes, metadata, logged_at)| {
        let meta = metadata.as_deref().and_then(|m| serde_json::from_str::<Value>(m).ok()).unwrap_or(json!({}));
        json!({"id": id, "minutes": minutes, "label": meta["label"], "note": meta["note"], "loggedAt": logged_at})
    }).collect();

    Ok(json!({ "totalMinutes": total_minutes, "sessions": sessions, "count": sessions.len() }))
}

async fn delete_focus_session(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let session_id = args["session_id"].as_str().ok_or("session_id is required")?;
    let result = sqlx::query("DELETE FROM health_events WHERE id = ? AND module_id = 'focus'")
        .bind(session_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete session: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Focus session \"{session_id}\" not found."));
    }
    Ok(json!({ "id": session_id, "data_coverage": 1.0, "message": "Focus session deleted." }))
}
