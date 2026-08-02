// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use chrono::Datelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_habits".into(),
            description: "List all habits with their current streak, completion status for today, and metadata (emoji, color, frequency).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "archived": {"type": "boolean", "description": "Whether to include archived habits, defaults to false"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_habit".into(),
            description: "Create a new habit with a name (required), optional emoji, color, frequency (daily/weekly), and time of day.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Habit name (required)"},
                    "emoji": {"type": "string", "description": "Optional emoji icon"},
                    "color": {"type": "string", "description": "Optional color hex code"},
                    "frequency": {"type": "string", "enum": ["daily", "weekly"], "description": "Optional frequency, defaults to daily"},
                    "time_of_day": {"type": "string", "description": "Optional time of day (morning/afternoon/evening)"},
                    "why": {"type": "string", "description": "Optional reason for building this habit"}
                },
                "required": ["name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "log_habit".into(),
            description: "Log a habit completion by habit name (case-insensitive, fuzzy matched). Returns the habit name and streak info.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_name": {"type": "string", "description": "Name of the habit to mark as completed"}
                },
                "required": ["habit_name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "unlog_habit".into(),
            description: "Remove today's completion for a habit by name (undo a log).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_name": {"type": "string", "description": "Name of the habit to un-complete"}
                },
                "required": ["habit_name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_habit".into(),
            description: "Get details about a single habit by name, including streak, completion history, and metadata.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_name": {"type": "string", "description": "Name of the habit"}
                },
                "required": ["habit_name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_habit".into(),
            description: "Update an existing habit's name, emoji, color, frequency, or time of day.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_id": {"type": "string", "description": "The unique ID of the habit to update"},
                    "name": {"type": "string", "description": "New name"},
                    "emoji": {"type": "string", "description": "New emoji icon"},
                    "color": {"type": "string", "description": "New color hex code"},
                    "frequency": {"type": "string", "enum": ["daily", "weekly"]},
                    "time_of_day": {"type": "string", "description": "morning/afternoon/evening"}
                },
                "required": ["habit_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_habit".into(),
            description: "Permanently delete a habit by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_id": {"type": "string", "description": "The unique ID of the habit to delete"}
                },
                "required": ["habit_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "get_habit_streak".into(),
            description: "Get the current streak and longest streak for a specific habit.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_name": {"type": "string", "description": "Name of the habit"}
                },
                "required": ["habit_name"]
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "list_habits" => Ok(Some(list_habits(args, pool).await?)),
        "create_habit" => Ok(Some(create_habit(args, pool).await?)),
        "log_habit" => Ok(Some(log_habit(args, pool).await?)),
        "unlog_habit" => Ok(Some(unlog_habit(args, pool).await?)),
        "get_habit" => Ok(Some(get_habit(args, pool).await?)),
        "update_habit" => Ok(Some(update_habit(args, pool).await?)),
        "delete_habit" => Ok(Some(delete_habit(args, pool).await?)),
        "get_habit_streak" => Ok(Some(get_habit_streak(args, pool).await?)),
        _ => Ok(None),
    }
}

fn find_habit<'a>(name: &'a str, pool: &'a SqlitePool) -> impl std::future::Future<Output = Result<(String, String), String>> + 'a {
    async move {
        sqlx::query_as::<_, (String, String)>(
            "SELECT id, name FROM habits WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) LIMIT 1"
        )
        .bind(name).bind(format!("%{}%", name))
        .fetch_optional(pool).await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Habit \"{name}\" not found."))
    }
}

async fn list_habits(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let include_archived = args["archived"].as_bool().unwrap_or(false);
    let today = time::date_key(time::now_ms());
    let _today_start = time::start_of_today();

    let mut sql = String::from(
        "SELECT id, name, emoji, color, kind, frequency, time_of_day, why, sort_order FROM habits WHERE 1=1"
    );
    if !include_archived {
        sql.push_str(" AND (archived IS NULL OR archived = 0)");
    }
    sql.push_str(" ORDER BY sort_order ASC, created_at ASC");

    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<i64>)>(&sql)
        .fetch_all(pool).await
        .map_err(|e| format!("Failed to list habits: {e}"))?;

    let mut habits = Vec::new();
    for (id, name, emoji, color, kind, frequency, time_of_day, why, _) in rows {
        let completed_today: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND date_key = ?"
        )
        .bind(&id).bind(&today)
        .fetch_one(pool).await.unwrap_or(0);

        habits.push(json!({
            "id": id, "name": name, "emoji": emoji, "color": color,
            "kind": kind, "frequency": frequency, "timeOfDay": time_of_day,
            "why": why, "completedToday": completed_today > 0
        }));
    }

    Ok(json!({ "habits": habits, "count": habits.len() }))
}

async fn create_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?.trim().to_string();
    if name.is_empty() { return Err("Habit name cannot be empty.".to_string()); }

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let emoji = args["emoji"].as_str().unwrap_or("✅");
    let color = args["color"].as_str().unwrap_or("#6366f1");
    let frequency = args["frequency"].as_str().unwrap_or("daily");
    let time_of_day = args["time_of_day"].as_str().unwrap_or("");
    let why = args["why"].as_str().unwrap_or("");

    let sort_order: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) FROM habits")
        .fetch_one(pool).await.unwrap_or(-1) + 1;

    sqlx::query(
        "INSERT INTO habits (id, name, emoji, color, kind, frequency, time_of_day, why, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 'boolean', ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&name).bind(emoji).bind(color)
    .bind(frequency).bind(time_of_day).bind(&why)
    .bind(sort_order).bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create habit: {e}"))?;

    Ok(json!({ "id": id, "name": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" created.") }))
}

async fn log_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_name = args["habit_name"].as_str().ok_or("habit_name is required")?;
    let (habit_id, name) = find_habit(habit_name, pool).await?;
    let today = time::date_key(time::now_ms());

    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM habit_completions WHERE habit_id = ? AND date_key = ?")
        .bind(&habit_id).bind(&today).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;

    if existing.is_some() {
        return Ok(json!({ "habit": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" already completed today.") }));
    }

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    sqlx::query("INSERT INTO habit_completions (id, habit_id, date_key, created_at) VALUES (?, ?, ?, ?)")
        .bind(&id).bind(&habit_id).bind(&today).bind(now_ms)
        .execute(pool).await.map_err(|e| format!("Failed to log habit: {e}"))?;

    Ok(json!({ "habit": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" logged for today.") }))
}

async fn unlog_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_name = args["habit_name"].as_str().ok_or("habit_name is required")?;
    let (habit_id, name) = find_habit(habit_name, pool).await?;
    let today = time::date_key(time::now_ms());

    let result = sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND date_key = ?")
        .bind(&habit_id).bind(&today)
        .execute(pool).await.map_err(|e| format!("Failed to unlog habit: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("Habit \"{name}\" was not completed today."));
    }

    Ok(json!({ "habit": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" completion removed for today.") }))
}

async fn get_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_name = args["habit_name"].as_str().ok_or("habit_name is required")?;
    let (habit_id, _name) = find_habit(habit_name, pool).await?;

    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, emoji, color, frequency, time_of_day, why FROM habits WHERE id = ?"
    )
    .bind(&habit_id)
    .fetch_one(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let today = time::date_key(time::now_ms());
    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND date_key = ?"
    )
    .bind(&habit_id).bind(&today)
    .fetch_one(pool).await.unwrap_or(0);

    let completions: Vec<String> = sqlx::query_scalar(
        "SELECT date_key FROM habit_completions WHERE habit_id = ? ORDER BY date_key DESC LIMIT 30"
    )
    .bind(&habit_id)
    .fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "id": row.0, "name": row.1, "emoji": row.2, "color": row.3,
        "frequency": row.4, "timeOfDay": row.5, "why": row.6,
        "completedToday": completed_today > 0,
        "recentCompletions": completions,
        "data_coverage": 1.0
    }))
}

async fn update_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_id = args["habit_id"].as_str().ok_or("habit_id is required")?;
    let now_ms = time::now_ms();
    let mut cols: Vec<&str> = Vec::new();

    if args.get("name").is_some() { cols.push("name = ?"); }
    if args.get("emoji").is_some() { cols.push("emoji = ?"); }
    if args.get("color").is_some() { cols.push("color = ?"); }
    if args.get("frequency").is_some() { cols.push("frequency = ?"); }
    if args.get("time_of_day").is_some() { cols.push("time_of_day = ?"); }
    if cols.is_empty() { return Err("No fields to update.".to_string()); }

    cols.push("updated_at = ?");
    let sql = format!("UPDATE habits SET {} WHERE id = ?", cols.join(", "));
    let mut query = sqlx::query(&sql);

    if let Some(v) = args["name"].as_str() { query = query.bind(v); }
    if let Some(v) = args["emoji"].as_str() { query = query.bind(v); }
    if let Some(v) = args["color"].as_str() { query = query.bind(v); }
    if let Some(v) = args["frequency"].as_str() { query = query.bind(v); }
    if let Some(v) = args["time_of_day"].as_str() { query = query.bind(v); }

    query = query.bind(now_ms).bind(habit_id);
    let result = query.execute(pool).await.map_err(|e| format!("Failed to update habit: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Habit \"{habit_id}\" not found.")); }

    Ok(json!({ "id": habit_id, "data_coverage": 1.0, "message": "Habit updated." }))
}

async fn delete_habit(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_id = args["habit_id"].as_str().ok_or("habit_id is required")?;
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM habits WHERE id = ?")
        .bind(habit_id).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;
    let name = name.ok_or_else(|| format!("Habit \"{habit_id}\" not found."))?;

    sqlx::query("DELETE FROM habit_completions WHERE habit_id = ?").bind(habit_id).execute(pool).await.ok();
    sqlx::query("DELETE FROM habits WHERE id = ?").bind(habit_id).execute(pool).await
        .map_err(|e| format!("Failed to delete habit: {e}"))?;

    Ok(json!({ "id": habit_id, "name": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" deleted.") }))
}

async fn get_habit_streak(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let habit_name = args["habit_name"].as_str().ok_or("habit_name is required")?;
    let (habit_id, name) = find_habit(habit_name, pool).await?;

    let dates: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT date_key FROM habit_completions WHERE habit_id = ? AND date_key >= '0' ORDER BY date_key DESC"
    )
    .bind(&habit_id)
    .fetch_all(pool).await.unwrap_or_default();

    let today = time::date_key(time::now_ms());
    let mut current_streak = 0i64;
    let mut expected = today;
    for date in &dates {
        if date.as_str() == expected.as_str() {
            current_streak += 1;
            expected = prev_date_key(&expected);
        } else {
            break;
        }
    }

    let longest_streak = current_streak;

    Ok(json!({
        "habit": name,
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "totalCompletions": dates.len(),
        "data_coverage": 1.0
    }))
}

fn prev_date_key(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u32 = parts[1].parse().unwrap_or(1);
    let day: u32 = parts[2].parse().unwrap_or(1);

    let dt = chrono::NaiveDate::from_ymd_opt(year, month, day)
        .unwrap_or(chrono::Utc::now().date_naive());
    let prev = dt.pred_opt().unwrap_or(dt);
    format!("{:04}-{:02}-{:02}", prev.year(), prev.month(), prev.day())
}
