// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "log_mood".into(),
            description: "Log a mood check-in with mood label (e.g., energized, calm, anxious, tired, bright, steady, low), intensity (0-100), optional note, and activity tags (e.g., exercise, reading, social).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "mood": {"type": "string", "description": "Mood label (required): energized, calm, anxious, tired, bright, steady, low, or custom"},
                    "intensity": {"type": "integer", "description": "Intensity 0-100 (required)"},
                    "note": {"type": "string", "description": "Optional note about your mood"},
                    "activities": {"type": "array", "items": {"type": "string"}, "description": "Optional activity tags"}
                },
                "required": ["mood", "intensity"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_mood_today".into(),
            description: "Get all mood check-ins logged today.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_mood_history".into(),
            description: "Get mood check-in history, with optional limit and date range.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of days of history to fetch (default 30, max 365)"},
                    "limit": {"type": "integer", "description": "Max results (default 90)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_mood_stats".into(),
            description: "Get mood statistics: streak, total check-ins, most common moods, and average intensity.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_mood_checkin".into(),
            description: "Delete a mood check-in by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "checkin_id": {"type": "string", "description": "The unique ID of the mood check-in to delete"}
                },
                "required": ["checkin_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "log_mood" => Ok(Some(log_mood(args, pool).await?)),
        "get_mood_today" => Ok(Some(get_mood_today(pool).await?)),
        "get_mood_history" => Ok(Some(get_mood_history(args, pool).await?)),
        "get_mood_stats" => Ok(Some(get_mood_stats(pool).await?)),
        "delete_mood_checkin" => Ok(Some(delete_mood_checkin(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn log_mood(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let mood = args["mood"].as_str().ok_or("mood is required")?;
    let intensity = args["intensity"].as_i64().ok_or("intensity is required")?;
    if !(0..=100).contains(&intensity) {
        return Err("Intensity must be between 0 and 100.".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let today = time::date_key(now_ms);
    let note = args["note"].as_str().unwrap_or("");
    let activities = args["activities"].as_array()
        .map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());

    sqlx::query(
        "INSERT INTO mood_checkins (id, mood, intensity, note, activities, logged_at, date_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(mood).bind(intensity).bind(note).bind(&activities).bind(now_ms).bind(&today)
    .execute(pool).await
    .map_err(|e| format!("Failed to log mood: {e}"))?;

    Ok(json!({
        "id": id, "mood": mood, "intensity": intensity,
        "data_coverage": 1.0,
        "message": format!("Mood \"{mood}\" ({intensity}/100) logged.")
    }))
}

async fn get_mood_today(pool: &SqlitePool) -> Result<Value, String> {
    let today = time::date_key(time::now_ms());
    let rows = sqlx::query_as::<_, (String, String, i64, Option<String>, String, i64)>(
        "SELECT id, mood, intensity, note, activities, logged_at FROM mood_checkins WHERE date_key = ? ORDER BY logged_at ASC"
    )
    .bind(&today)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get mood: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(id, mood, intensity, note, activities, logged_at)| {
        json!({"id": id, "mood": mood, "intensity": intensity, "note": note, "activities": activities, "loggedAt": logged_at})
    }).collect();

    Ok(json!({ "date": today, "entries": entries, "count": entries.len() }))
}

async fn get_mood_history(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let limit = args["limit"].as_i64().unwrap_or(90).min(365);
    let days = args["days"].as_i64().unwrap_or(30);

    let cutoff = time::now_ms() - days * time::DAY_MS;
    let rows = sqlx::query_as::<_, (String, String, i64, Option<String>, i64)>(
        "SELECT id, mood, intensity, note, logged_at FROM mood_checkins WHERE logged_at >= ? ORDER BY logged_at DESC LIMIT ?"
    )
    .bind(cutoff).bind(limit)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get mood history: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(id, mood, intensity, note, logged_at)| {
        json!({"id": id, "mood": mood, "intensity": intensity, "note": note, "loggedAt": logged_at})
    }).collect();

    Ok(json!({ "entries": entries, "count": entries.len() }))
}

async fn get_mood_stats(pool: &SqlitePool) -> Result<Value, String> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mood_checkins")
        .fetch_one(pool).await.unwrap_or(0);

    let mood_counts: Vec<(String, i64)> = sqlx::query_as(
        "SELECT mood, COUNT(*) as count FROM mood_checkins GROUP BY mood ORDER BY count DESC"
    )
    .fetch_all(pool).await.unwrap_or_default();

    let avg_intensity: f64 = sqlx::query_scalar("SELECT AVG(intensity) FROM mood_checkins")
        .fetch_one(pool).await.unwrap_or(0.0);

    let recent: Vec<(String, i64)> = sqlx::query_as(
        "SELECT date_key, AVG(intensity) as avg_i FROM mood_checkins GROUP BY date_key ORDER BY date_key DESC LIMIT 7"
    )
    .fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "totalCheckins": total,
        "moodDistribution": mood_counts.into_iter().map(|(m, c)| json!({"mood": m, "count": c})).collect::<Vec<_>>(),
        "averageIntensity": (avg_intensity * 100.0).round() / 100.0,
        "recentDays": recent.into_iter().map(|(d, a)| json!({"date": d, "avgIntensity": a})).collect::<Vec<_>>(),
        "data_coverage": if total > 0 { 1.0 } else { 0.0 }
    }))
}

async fn delete_mood_checkin(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let checkin_id = args["checkin_id"].as_str().ok_or("checkin_id is required")?;

    let result = sqlx::query("DELETE FROM mood_checkins WHERE id = ?")
        .bind(checkin_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete check-in: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Mood check-in \"{checkin_id}\" not found."));
    }

    Ok(json!({ "id": checkin_id, "data_coverage": 1.0, "message": "Mood check-in deleted." }))
}
