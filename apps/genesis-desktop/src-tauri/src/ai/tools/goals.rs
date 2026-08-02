// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_goals".into(),
            description: "List all life goals, optionally filtered by horizon (weekly/monthly/yearly). Returns title, horizon, progress, and status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "horizon": {"type": "string", "enum": ["weekly", "monthly", "yearly"], "description": "Optional horizon filter"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_goal".into(),
            description: "Get a single goal by ID with all details including subtasks, reviews, and progress history.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal"}
                },
                "required": ["goal_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_goal".into(),
            description: "Create a new life goal with title (required), horizon (weekly/monthly/yearly), optional description, target date, success criteria, and focus area.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Goal title (required)"},
                    "description": {"type": "string", "description": "Description of the goal"},
                    "horizon": {"type": "string", "enum": ["weekly", "monthly", "yearly"], "description": "Time horizon, defaults to monthly"},
                    "target_date": {"type": "string", "description": "Optional ISO 8601 target date"},
                    "success_criteria": {"type": "string", "description": "How to measure success"},
                    "focus_area_id": {"type": "string", "description": "Optional ID of a focus area"}
                },
                "required": ["title"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_goal".into(),
            description: "Update an existing goal's title, description, horizon, progress percentage, or success criteria.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal to update"},
                    "title": {"type": "string", "description": "New title"},
                    "description": {"type": "string", "description": "New description"},
                    "horizon": {"type": "string", "enum": ["weekly", "monthly", "yearly"]},
                    "progress": {"type": "integer", "description": "Progress 0-100"},
                    "success_criteria": {"type": "string", "description": "New success criteria"},
                    "notes": {"type": "string", "description": "New notes"}
                },
                "required": ["goal_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_goal".into(),
            description: "Permanently delete a goal by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal to delete"}
                },
                "required": ["goal_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "get_goal_subtasks".into(),
            description: "Get all subtasks for a goal with their completion status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal"}
                },
                "required": ["goal_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_goal_subtask".into(),
            description: "Add a subtask to a goal.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal"},
                    "title": {"type": "string", "description": "Subtask title (required)"}
                },
                "required": ["goal_id", "title"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "toggle_goal_subtask".into(),
            description: "Toggle a goal subtask's completed state.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "subtask_id": {"type": "string", "description": "The unique ID of the subtask"}
                },
                "required": ["subtask_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_goal_review".into(),
            description: "Add a reflection review entry for a goal.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string", "description": "The unique ID of the goal"},
                    "content": {"type": "string", "description": "Review/reflection content (required)"}
                },
                "required": ["goal_id", "content"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_focus_areas".into(),
            description: "List all life focus areas used for categorizing goals.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_big_3".into(),
            description: "Get the current Big 3 goals — the top 3 most important goals you're focusing on.".into(),
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
        "list_goals" => Ok(Some(list_goals(args, pool).await?)),
        "get_goal" => Ok(Some(get_goal(args, pool).await?)),
        "create_goal" => Ok(Some(create_goal(args, pool).await?)),
        "update_goal" => Ok(Some(update_goal(args, pool).await?)),
        "delete_goal" => Ok(Some(delete_goal(args, pool).await?)),
        "get_goal_subtasks" => Ok(Some(get_goal_subtasks(args, pool).await?)),
        "add_goal_subtask" => Ok(Some(add_goal_subtask(args, pool).await?)),
        "toggle_goal_subtask" => Ok(Some(toggle_goal_subtask(args, pool).await?)),
        "add_goal_review" => Ok(Some(add_goal_review(args, pool).await?)),
        "list_focus_areas" => Ok(Some(list_focus_areas(pool).await?)),
        "get_big_3" => Ok(Some(get_big_3(pool).await?)),
        _ => Ok(None),
    }
}

async fn list_goals(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let horizon = args["horizon"].as_str();

    let rows = if let Some(h) = horizon {
        sqlx::query_as::<_, (String, String, Option<String>, i64, Option<String>, Option<i64>)>(
            "SELECT id, title, horizon, progress, success_criteria, focus_area_id FROM goals WHERE horizon = ? ORDER BY created_at DESC"
        )
        .bind(h)
        .fetch_all(pool).await
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, i64, Option<String>, Option<i64>)>(
            "SELECT id, title, horizon, progress, success_criteria, focus_area_id FROM goals ORDER BY CASE horizon WHEN 'weekly' THEN 0 WHEN 'monthly' THEN 1 WHEN 'yearly' THEN 2 ELSE 3 END, created_at DESC"
        )
        .fetch_all(pool).await
    }.map_err(|e| format!("DB error: {e}"))?;

    let goals: Vec<Value> = rows.into_iter().map(|(id, title, hzn, progress, criteria, focus)| {
        json!({"id": id, "title": title, "horizon": hzn, "progress": progress, "successCriteria": criteria, "focusAreaId": focus})
    }).collect();

    Ok(json!({ "goals": goals, "count": goals.len() }))
}

async fn get_goal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;

    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, i64, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>)>(
        "SELECT id, title, description, horizon, progress, target_date, success_criteria, notes, is_big_3, focus_area_id FROM goals WHERE id = ?"
    )
    .bind(goal_id)
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?
    .ok_or_else(|| format!("Goal \"{goal_id}\" not found."))?;

    let (id, title, description, horizon, progress, target_date, criteria, notes, is_big_3, focus_id) = row;

    let subtasks = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, title, completed FROM goal_subtasks WHERE goal_id = ? ORDER BY position ASC"
    )
    .bind(goal_id)
    .fetch_all(pool).await.unwrap_or_default();

    let reviews = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, content, created_at FROM goal_reviews WHERE goal_id = ? ORDER BY created_at DESC"
    )
    .bind(goal_id)
    .fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "id": id, "title": title, "description": description,
        "horizon": horizon, "progress": progress,
        "targetDate": target_date, "successCriteria": criteria,
        "notes": notes, "isBig3": is_big_3.unwrap_or(0) == 1,
        "focusAreaId": focus_id,
        "subtasks": subtasks.into_iter().map(|(sid, stitle, done)| json!({"id": sid, "title": stitle, "completed": done == 1})).collect::<Vec<_>>(),
        "reviews": reviews.into_iter().map(|(rid, content, ts)| json!({"id": rid, "content": content, "createdAt": ts})).collect::<Vec<_>>(),
        "data_coverage": 1.0
    }))
}

async fn create_goal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let title = args["title"].as_str().ok_or("title is required")?.trim().to_string();
    if title.is_empty() { return Err("Goal title cannot be empty.".to_string()); }

    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let description = args["description"].as_str().unwrap_or("");
    let horizon = args["horizon"].as_str().unwrap_or("monthly");
    let target_date = args["target_date"].as_str().and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok().map(|dt| dt.timestamp_millis()));
    let criteria = args["success_criteria"].as_str().unwrap_or("");
    let focus_area_id = args["focus_area_id"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO goals (id, title, description, horizon, progress, target_date, success_criteria, focus_area_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&title).bind(description).bind(horizon)
    .bind(target_date).bind(criteria).bind(focus_area_id)
    .bind(now_ms).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create goal: {e}"))?;

    Ok(json!({ "id": id, "title": title, "horizon": horizon, "data_coverage": 1.0, "message": format!("Goal \"{title}\" created.") }))
}

async fn update_goal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;
    let now_ms = time::now_ms();
    let mut cols: Vec<&str> = Vec::new();

    if args.get("title").is_some() { cols.push("title = ?"); }
    if args.get("description").is_some() { cols.push("description = ?"); }
    if args.get("horizon").is_some() { cols.push("horizon = ?"); }
    if args.get("progress").is_some() { cols.push("progress = ?"); }
    if args.get("success_criteria").is_some() { cols.push("success_criteria = ?"); }
    if args.get("notes").is_some() { cols.push("notes = ?"); }
    if cols.is_empty() { return Err("No fields to update.".to_string()); }

    cols.push("updated_at = ?");
    let sql = format!("UPDATE goals SET {} WHERE id = ?", cols.join(", "));
    let mut query = sqlx::query(&sql);

    if let Some(v) = args["title"].as_str() { query = query.bind(v); }
    if let Some(v) = args["description"].as_str() { query = query.bind(v); }
    if let Some(v) = args["horizon"].as_str() { query = query.bind(v); }
    if let Some(v) = args["progress"].as_i64() { query = query.bind(v.max(0).min(100)); }
    if let Some(v) = args["success_criteria"].as_str() { query = query.bind(v); }
    if let Some(v) = args["notes"].as_str() { query = query.bind(v); }
    query = query.bind(now_ms).bind(goal_id);

    let result = query.execute(pool).await.map_err(|e| format!("Failed to update goal: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Goal \"{goal_id}\" not found.")); }

    Ok(json!({ "id": goal_id, "data_coverage": 1.0, "message": "Goal updated." }))
}

async fn delete_goal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;
    sqlx::query("DELETE FROM goal_subtasks WHERE goal_id = ?").bind(goal_id).execute(pool).await.ok();
    sqlx::query("DELETE FROM goal_reviews WHERE goal_id = ?").bind(goal_id).execute(pool).await.ok();
    let result = sqlx::query("DELETE FROM goals WHERE id = ?").bind(goal_id)
        .execute(pool).await.map_err(|e| format!("Failed to delete goal: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Goal \"{goal_id}\" not found.")); }
    Ok(json!({ "id": goal_id, "data_coverage": 1.0, "message": "Goal deleted." }))
}

async fn get_goal_subtasks(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;
    let rows = sqlx::query_as::<_, (String, String, i64, Option<i64>)>(
        "SELECT id, title, completed, position FROM goal_subtasks WHERE goal_id = ? ORDER BY position ASC"
    )
    .bind(goal_id)
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let subtasks: Vec<Value> = rows.into_iter().map(|(id, title, done, pos)| {
        json!({"id": id, "title": title, "completed": done == 1, "position": pos})
    }).collect();

    Ok(json!({ "goalId": goal_id, "subtasks": subtasks, "count": subtasks.len() }))
}

async fn add_goal_subtask(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;
    let title = args["title"].as_str().ok_or("title is required")?;
    let id = Uuid::new_v4().to_string();

    let position: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM goal_subtasks WHERE goal_id = ?")
        .bind(goal_id).fetch_one(pool).await.unwrap_or(-1) + 1;

    sqlx::query("INSERT INTO goal_subtasks (id, goal_id, title, completed, position) VALUES (?, ?, ?, 0, ?)")
        .bind(&id).bind(goal_id).bind(title).bind(position)
        .execute(pool).await
        .map_err(|e| format!("Failed to add subtask: {e}"))?;

    Ok(json!({ "id": id, "goalId": goal_id, "title": title, "data_coverage": 1.0, "message": "Subtask added." }))
}

async fn toggle_goal_subtask(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let subtask_id = args["subtask_id"].as_str().ok_or("subtask_id is required")?;
    let row = sqlx::query_as::<_, (String, i64)>(
        "SELECT goal_id, completed FROM goal_subtasks WHERE id = ?"
    )
    .bind(subtask_id)
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?
    .ok_or_else(|| format!("Subtask \"{subtask_id}\" not found."))?;

    let (goal_id, completed) = row;
    let new_val = if completed == 1 { 0 } else { 1 };
    sqlx::query("UPDATE goal_subtasks SET completed = ? WHERE id = ?")
        .bind(new_val).bind(subtask_id)
        .execute(pool).await.ok();

    let now_ms = time::now_ms();
    sqlx::query("UPDATE goals SET updated_at = ? WHERE id = ?")
        .bind(now_ms).bind(&goal_id).execute(pool).await.ok();

    Ok(json!({ "id": subtask_id, "completed": new_val == 1, "data_coverage": 1.0 }))
}

async fn add_goal_review(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let goal_id = args["goal_id"].as_str().ok_or("goal_id is required")?;
    let content = args["content"].as_str().ok_or("content is required")?;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();

    sqlx::query("INSERT INTO goal_reviews (id, goal_id, content, created_at) VALUES (?, ?, ?, ?)")
        .bind(&id).bind(goal_id).bind(content).bind(now_ms)
        .execute(pool).await
        .map_err(|e| format!("Failed to add review: {e}"))?;

    sqlx::query("UPDATE goals SET updated_at = ? WHERE id = ?")
        .bind(now_ms).bind(goal_id).execute(pool).await.ok();

    Ok(json!({ "id": id, "goalId": goal_id, "data_coverage": 1.0, "message": "Review added." }))
}

async fn list_focus_areas(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT id, name, position FROM focus_areas ORDER BY position ASC, name ASC"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let areas: Vec<Value> = rows.into_iter().map(|(id, name, pos)| {
        json!({"id": id, "name": name, "position": pos})
    }).collect();

    Ok(json!({ "focusAreas": areas, "count": areas.len() }))
}

async fn get_big_3(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, title, progress FROM goals WHERE is_big_3 = 1 ORDER BY updated_at DESC LIMIT 3"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let goals: Vec<Value> = rows.into_iter().map(|(id, title, progress)| {
        json!({"id": id, "title": title, "progress": progress})
    }).collect();

    Ok(json!({ "goals": goals, "count": goals.len() }))
}
