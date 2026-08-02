// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_countdowns".into(),
            description: "List all countdown events with their target date and days remaining.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_countdown".into(),
            description: "Create a new countdown event with name and target date (ISO 8601).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Countdown event name (required)"},
                    "target_date": {"type": "string", "description": "ISO 8601 target date/time (required)"},
                    "category": {"type": "string", "description": "Optional category"},
                    "accent": {"type": "string", "description": "Optional accent color hex"},
                    "note": {"type": "string", "description": "Optional note"}
                },
                "required": ["name", "target_date"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_countdown".into(),
            description: "Delete a countdown event by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "countdown_id": {"type": "string", "description": "The unique ID of the countdown to delete"}
                },
                "required": ["countdown_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "list_milestones".into(),
            description: "List all milestones with their target date and progress.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_milestone".into(),
            description: "Create a new milestone with name, target date, and optional progress.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Milestone name (required)"},
                    "target_date": {"type": "string", "description": "ISO 8601 target date (required)"},
                    "accent": {"type": "string", "description": "Optional accent color hex"},
                    "note": {"type": "string", "description": "Optional note"}
                },
                "required": ["name", "target_date"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_milestone".into(),
            description: "Delete a milestone by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "milestone_id": {"type": "string", "description": "The unique ID of the milestone to delete"}
                },
                "required": ["milestone_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "list_birthdays".into(),
            description: "List all saved birthday reminders.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "list_countdowns" => Ok(Some(list_countdowns(pool).await?)),
        "create_countdown" => Ok(Some(create_countdown(args, pool).await?)),
        "delete_countdown" => Ok(Some(delete_countdown(args, pool).await?)),
        "list_milestones" => Ok(Some(list_milestones(pool).await?)),
        "create_milestone" => Ok(Some(create_milestone(args, pool).await?)),
        "delete_milestone" => Ok(Some(delete_milestone(args, pool).await?)),
        "list_birthdays" => Ok(Some(list_birthdays(pool).await?)),
        _ => Ok(None),
    }
}

async fn list_countdowns(pool: &SqlitePool) -> Result<Value, String> {
    let now_ms = time::now_ms();
    let rows = sqlx::query_as::<_, (String, String, i64, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, target_ms, category, accent, note FROM countdown_events ORDER BY target_ms ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let events: Vec<Value> = rows.into_iter().map(|(id, name, target, cat, accent, note)| {
        let days_remaining = ((target - now_ms) as f64 / time::DAY_MS as f64).round() as i64;
        json!({"id": id, "name": name, "target": target, "daysRemaining": days_remaining, "category": cat, "accent": accent, "note": note})
    }).collect();

    Ok(json!({ "countdowns": events, "count": events.len() }))
}

async fn create_countdown(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let target_date = args["target_date"].as_str().ok_or("target_date is required")?;
    let target_ms = chrono::DateTime::parse_from_rfc3339(target_date)
        .map_err(|_| "Invalid date format. Use ISO 8601.".to_string())?
        .timestamp_millis();

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let category = args["category"].as_str().unwrap_or("");
    let accent = args["accent"].as_str().unwrap_or("");
    let note = args["note"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO countdown_events (id, name, target_ms, category, accent, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(name).bind(target_ms).bind(category).bind(accent).bind(note).bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create countdown: {e}"))?;

    Ok(json!({ "id": id, "name": name, "data_coverage": 1.0, "message": format!("Countdown \"{name}\" created.") }))
}

async fn delete_countdown(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let countdown_id = args["countdown_id"].as_str().ok_or("countdown_id is required")?;
    sqlx::query("DELETE FROM countdown_events WHERE id = ?").bind(countdown_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete countdown: {e}"))?;
    Ok(json!({ "id": countdown_id, "data_coverage": 1.0, "message": "Countdown deleted." }))
}

async fn list_milestones(pool: &SqlitePool) -> Result<Value, String> {
    let now_ms = time::now_ms();
    let rows = sqlx::query_as::<_, (String, String, i64, i64, Option<String>, Option<String>)>(
        "SELECT id, name, target_ms, progress, accent, note FROM countdown_milestones ORDER BY target_ms ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let milestones: Vec<Value> = rows.into_iter().map(|(id, name, target, progress, accent, note)| {
        let days_remaining = ((target - now_ms) as f64 / time::DAY_MS as f64).round() as i64;
        json!({"id": id, "name": name, "target": target, "progress": progress, "daysRemaining": days_remaining, "accent": accent, "note": note})
    }).collect();

    Ok(json!({ "milestones": milestones, "count": milestones.len() }))
}

async fn create_milestone(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let target_date = args["target_date"].as_str().ok_or("target_date is required")?;
    let target_ms = chrono::DateTime::parse_from_rfc3339(target_date)
        .map_err(|_| "Invalid date format.".to_string())?.timestamp_millis();

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let accent = args["accent"].as_str().unwrap_or("");
    let note = args["note"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO countdown_milestones (id, name, target_ms, progress, accent, note, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?)"
    )
    .bind(&id).bind(name).bind(target_ms).bind(accent).bind(note).bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create milestone: {e}"))?;

    Ok(json!({ "id": id, "name": name, "data_coverage": 1.0, "message": format!("Milestone \"{name}\" created.") }))
}

async fn delete_milestone(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let milestone_id = args["milestone_id"].as_str().ok_or("milestone_id is required")?;
    sqlx::query("DELETE FROM countdown_milestones WHERE id = ?").bind(milestone_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete milestone: {e}"))?;
    Ok(json!({ "id": milestone_id, "data_coverage": 1.0, "message": "Milestone deleted." }))
}

async fn list_birthdays(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, i32, i32, Option<String>)>(
        "SELECT id, name, month, day, accent FROM countdown_birthdays ORDER BY month, day"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let birthdays: Vec<Value> = rows.into_iter().map(|(id, name, month, day, accent)| {
        json!({"id": id, "name": name, "month": month, "day": day, "accent": accent})
    }).collect();

    Ok(json!({ "birthdays": birthdays, "count": birthdays.len() }))
}
