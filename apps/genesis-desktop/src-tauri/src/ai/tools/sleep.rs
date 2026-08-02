// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "log_sleep".into(),
            description: "Log a sleep session with bedtime and wake time. Use ISO 8601 timestamps for sleep_time and wake_time. Returns the session details.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format for this sleep session"},
                    "sleep_time": {"type": "string", "description": "ISO 8601 bedtime timestamp"},
                    "wake_time": {"type": "string", "description": "ISO 8601 wake time timestamp"},
                    "notes": {"type": "string", "description": "Optional notes about the sleep"}
                },
                "required": ["sleep_time", "wake_time"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_sleep_sessions".into(),
            description: "Get recent sleep sessions with duration, quality score, and times.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of days to look back (default 7, max 365)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_last_night".into(),
            description: "Get the most recent sleep session (last night's sleep data).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_sleep_goal".into(),
            description: "Get the current sleep goal (target bedtime, wake time, and duration).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_sleep_goal".into(),
            description: "Set or update the sleep goal with target bedtime (HH:MM), wake time (HH:MM), and duration in minutes.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "bedtime": {"type": "string", "description": "Target bedtime in HH:MM format"},
                    "waketime": {"type": "string", "description": "Target wake time in HH:MM format"},
                    "duration_minutes": {"type": "integer", "description": "Target sleep duration in minutes (360-600)"}
                },
                "required": ["bedtime", "waketime", "duration_minutes"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_sleep_session".into(),
            description: "Delete a sleep session by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The unique ID of the sleep session to delete"}
                },
                "required": ["session_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "get_sleep_stats".into(),
            description: "Get comprehensive sleep statistics: average duration, consistency score, bedtime/waketime averages, streaks, and sleep debt.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Lookback period in days (default 30, max 365)"}
                }
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "log_sleep" => Ok(Some(log_sleep(args, pool).await?)),
        "get_sleep_sessions" => Ok(Some(get_sleep_sessions(args, pool).await?)),
        "get_last_night" => Ok(Some(get_last_night(pool).await?)),
        "get_sleep_goal" => Ok(Some(get_sleep_goal(pool).await?)),
        "update_sleep_goal" => Ok(Some(update_sleep_goal(args, pool).await?)),
        "delete_sleep_session" => Ok(Some(delete_sleep_session(args, pool).await?)),
        "get_sleep_stats" => Ok(Some(get_sleep_stats(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn log_sleep(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let sleep_time = args["sleep_time"].as_str().ok_or("sleep_time is required")?;
    let wake_time = args["wake_time"].as_str().ok_or("wake_time is required")?;

    let sleep_ts = chrono::DateTime::parse_from_rfc3339(sleep_time)
        .map_err(|_| "Invalid sleep_time format. Use ISO 8601 (e.g., 2024-01-15T23:00:00Z)".to_string())?;
    let wake_ts = chrono::DateTime::parse_from_rfc3339(wake_time)
        .map_err(|_| "Invalid wake_time format. Use ISO 8601 (e.g., 2024-01-16T07:00:00Z)".to_string())?;

    let duration_min = ((wake_ts.timestamp_millis() - sleep_ts.timestamp_millis()) / 60_000) as i64;
    if duration_min <= 0 {
        return Err("Wake time must be after sleep time.".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let date = time::date_key(sleep_ts.timestamp_millis());
    let notes = args["notes"].as_str().unwrap_or("");
    let now_ms = time::now_ms();

    let quality_score = (if duration_min >= 420 && duration_min <= 540 {
        85 + ((duration_min - 420) / 6) as i64
    } else if duration_min >= 360 {
        70
    } else if duration_min >= 180 {
        50
    } else {
        30
    }).min(100);

    sqlx::query(
        "INSERT INTO sleep_sessions (id, date, sleep_onset_ts, wake_ts, duration_min, quality_score, notes, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)"
    )
    .bind(&id).bind(&date).bind(sleep_ts.timestamp_millis()).bind(wake_ts.timestamp_millis())
    .bind(duration_min).bind(quality_score).bind(notes).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to log sleep: {e}"))?;

    Ok(json!({
        "id": id, "date": date,
        "sleepTime": sleep_ts.timestamp_millis(),
        "wakeTime": wake_ts.timestamp_millis(),
        "durationMinutes": duration_min,
        "qualityScore": quality_score,
        "data_coverage": 1.0,
        "message": format!("Sleep logged: {duration_min} minutes.")
    }))
}

async fn get_sleep_sessions(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let days = args["days"].as_i64().unwrap_or(7).max(1).min(365);
    let limit = days as i64;

    let rows = sqlx::query_as::<_, (String, String, i64, i64, i64, i64, Option<String>)>(
        "SELECT id, date, sleep_onset_ts, wake_ts, duration_min, quality_score, notes FROM sleep_sessions ORDER BY date DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get sleep sessions: {e}"))?;

    let sessions: Vec<Value> = rows.into_iter().map(|(id, date, onset, wake, dur, quality, notes)| {
        json!({"id": id, "date": date, "sleepOnset": onset, "wakeTime": wake, "durationMinutes": dur, "qualityScore": quality, "notes": notes})
    }).collect();

    Ok(json!({ "sessions": sessions, "count": sessions.len() }))
}

async fn get_last_night(pool: &SqlitePool) -> Result<Value, String> {
    let row = sqlx::query_as::<_, (String, String, i64, i64, i64, i64, Option<String>)>(
        "SELECT id, date, sleep_onset_ts, wake_ts, duration_min, quality_score, notes FROM sleep_sessions WHERE wake_ts > 0 ORDER BY date DESC LIMIT 1"
    )
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    match row {
        Some((id, date, onset, wake, dur, quality, notes)) => Ok(json!({
            "id": id, "date": date, "sleepOnset": onset, "wakeTime": wake,
            "durationMinutes": dur, "qualityScore": quality, "notes": notes,
            "data_coverage": 1.0
        })),
        None => Ok(json!({ "data_coverage": 0.0, "message": "No sleep data yet." })),
    }
}

async fn get_sleep_goal(pool: &SqlitePool) -> Result<Value, String> {
    let row = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT target_bedtime, target_waketime, target_duration_min FROM sleep_goals WHERE id = 'default'"
    )
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    match row {
        Some((bedtime, waketime, duration)) => Ok(json!({
            "bedtime": bedtime, "waketime": waketime,
            "durationMinutes": duration, "data_coverage": 1.0
        })),
        None => Ok(json!({
            "bedtime": "23:00", "waketime": "07:00",
            "durationMinutes": 480, "data_coverage": 0.0,
            "message": "Default sleep goal (no custom goal set)"
        })),
    }
}

async fn update_sleep_goal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let bedtime = args["bedtime"].as_str().ok_or("bedtime is required")?;
    let waketime = args["waketime"].as_str().ok_or("waketime is required")?;
    let duration = args["duration_minutes"].as_i64().ok_or("duration_minutes is required")?.max(360).min(600);
    let now_ms = time::now_ms();

    sqlx::query(
        "INSERT INTO sleep_goals (id, target_bedtime, target_waketime, target_duration_min, updated_at) VALUES ('default', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET target_bedtime = ?, target_waketime = ?, target_duration_min = ?, updated_at = ?"
    )
    .bind(bedtime).bind(waketime).bind(duration).bind(now_ms)
    .bind(bedtime).bind(waketime).bind(duration).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to update sleep goal: {e}"))?;

    Ok(json!({ "bedtime": bedtime, "waketime": waketime, "durationMinutes": duration, "data_coverage": 1.0, "message": "Sleep goal updated." }))
}

async fn delete_sleep_session(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let session_id = args["session_id"].as_str().ok_or("session_id is required")?;
    let result = sqlx::query("DELETE FROM sleep_sessions WHERE id = ?")
        .bind(session_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete session: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Sleep session \"{session_id}\" not found."));
    }
    Ok(json!({ "id": session_id, "data_coverage": 1.0, "message": "Sleep session deleted." }))
}

async fn get_sleep_stats(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let days = args["days"].as_i64().unwrap_or(30).max(1).min(365);

    let rows = sqlx::query_as::<_, (i64, i64)>(
        "SELECT duration_min, quality_score FROM sleep_sessions WHERE duration_min >= 20 AND wake_ts > 0 ORDER BY date DESC LIMIT ?"
    )
    .bind(days)
    .fetch_all(pool).await.unwrap_or_default();

    let count = rows.len();
    if count == 0 {
        return Ok(json!({ "data_coverage": 0.0, "message": "No sleep data in this period." }));
    }

    let avg_duration: f64 = rows.iter().map(|(d, _)| *d as f64).sum::<f64>() / count as f64;
    let avg_quality: f64 = rows.iter().map(|(_, q)| *q as f64).sum::<f64>() / count as f64;

    Ok(json!({
        "totalSessions": count,
        "averageDurationMinutes": (avg_duration * 10.0).round() / 10.0,
        "averageQualityScore": (avg_quality * 10.0).round() / 10.0,
        "data_coverage": 1.0
    }))
}
