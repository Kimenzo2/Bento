// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "create_task".into(),
            description: "Create a new task with a title (required), optional due date (ISO 8601), priority level (low/medium/high), project name, tags, and notes. Returns the created task ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title (required)"},
                    "due_at": {"type": "string", "description": "Optional ISO 8601 due date string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Priority level, defaults to medium"},
                    "project": {"type": "string", "description": "Optional project/category name"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags"},
                    "notes": {"type": "string", "description": "Optional notes or description"},
                    "estimated_minutes": {"type": "integer", "description": "Optional estimated time in minutes"}
                },
                "required": ["title"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_tasks".into(),
            description: "Retrieve tasks with optional filters: status (pending/completed/all), due_before (ISO 8601), project, priority, or tags. Returns task objects with id, title, priority, due date, project, and status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["pending", "completed", "all"], "description": "Filter by completion status, defaults to pending"},
                    "due_before": {"type": "string", "description": "Optional ISO 8601 cutoff — only tasks due before this"},
                    "due_after": {"type": "string", "description": "Optional ISO 8601 — only tasks due after this"},
                    "project": {"type": "string", "description": "Optional project name filter"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Optional priority filter"},
                    "search": {"type": "string", "description": "Optional text search in title"},
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 20"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "complete_task".into(),
            description: "Mark a task as completed by its ID. Returns a confirmation with the task title.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to complete"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_task".into(),
            description: "Modify an existing task's title, priority, project, due date, tags, or notes. Any field can be omitted to leave it unchanged.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to update"},
                    "title": {"type": "string", "description": "New title"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "project": {"type": "string", "description": "New project name"},
                    "due_at": {"type": "string", "description": "ISO 8601 due date, empty string to clear"},
                    "notes": {"type": "string", "description": "Notes or description"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "New tags"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_task".into(),
            description: "Permanently delete a task by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to delete"}
                },
                "required": ["task_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "get_task".into(),
            description: "Get a single task by its ID with all details including notes, tags, priority, due date, and project.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "archive_task".into(),
            description: "Archive or unarchive a task by its ID. Archived tasks are hidden from the default view.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task"},
                    "archived": {"type": "boolean", "description": "Set to true to archive, false to unarchive"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_task_activity_log".into(),
            description: "Get the activity log for a task — a timeline of events like status changes, edits, and notes.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_task_activity_log".into(),
            description: "Add a manual activity log entry to a task.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task"},
                    "text": {"type": "string", "description": "The activity log text"}
                },
                "required": ["task_id", "text"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_task_stats".into(),
            description: "Get task statistics: total tasks, completed today, overdue count, tasks by project, and tasks by priority.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_projects".into(),
            description: "Get a list of all unique project names used in tasks, with task counts per project.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "undo_task".into(),
            description: "Mark a completed task as pending again (undo completion).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to undo"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "create_task" => Ok(Some(create_task(args, pool).await?)),
        "get_tasks" => Ok(Some(get_tasks(args, pool).await?)),
        "get_task" => Ok(Some(get_task(args, pool).await?)),
        "complete_task" => Ok(Some(complete_task(args, pool).await?)),
        "undo_task" => Ok(Some(undo_task(args, pool).await?)),
        "update_task" => Ok(Some(update_task(args, pool).await?)),
        "delete_task" => Ok(Some(delete_task(args, pool).await?)),
        "archive_task" => Ok(Some(archive_task(args, pool).await?)),
        "get_task_activity_log" => Ok(Some(get_task_activity_log(args, pool).await?)),
        "add_task_activity_log" => Ok(Some(add_task_activity_log(args, pool).await?)),
        "get_task_stats" => Ok(Some(get_task_stats(pool).await?)),
        "get_projects" => Ok(Some(get_projects(pool).await?)),
        _ => Ok(None),
    }
}

async fn create_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let title = args["title"].as_str().ok_or("title is required")?;
    let cleaned = title.trim();
    if cleaned.is_empty() {
        return Err("Task title cannot be empty.".to_string());
    }
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let priority = args["priority"].as_str().unwrap_or("medium");
    let due_at_ms = args["due_at"].as_str()
        .and_then(|iso| chrono::DateTime::parse_from_rfc3339(iso).ok())
        .map(|dt| dt.timestamp_millis());
    let project = args["project"].as_str().unwrap_or("");
    let notes = args["notes"].as_str().unwrap_or("");
    let tags = args["tags"].as_array().map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string())).unwrap_or_else(|| "[]".to_string());
    let estimated_minutes = args["estimated_minutes"].as_i64();

    sqlx::query(
        "INSERT INTO tasks (id, title, done, priority, project, tags, notes, due_at, estimated_minutes, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(cleaned)
    .bind(priority)
    .bind(project)
    .bind(&tags)
    .bind(notes)
    .bind(due_at_ms)
    .bind(estimated_minutes)
    .bind(now_ms)
    .bind(now_ms)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create task: {e}"))?;

    Ok(json!({
        "id": id,
        "title": cleaned,
        "priority": priority,
        "project": project,
        "data_coverage": 1.0,
        "message": format!("Task \"{cleaned}\" created.")
    }))
}

async fn get_tasks(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let status_filter = args["status"].as_str().unwrap_or("pending");
    let max_results = args["limit"].as_i64().unwrap_or(20).min(100);

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    match status_filter {
        "pending" => {
            conditions.push("(archived IS NULL OR archived = 0)".to_string());
        }
        "completed" => {
            conditions.push("done = 1".to_string());
        }
        _ => {}
    }

    if let Some(proj) = args["project"].as_str() {
        if !proj.is_empty() {
            conditions.push("project = ?".to_string());
            bind_values.push(proj.to_string());
        }
    }
    if let Some(prio) = args["priority"].as_str() {
        if !prio.is_empty() {
            conditions.push("priority = ?".to_string());
            bind_values.push(prio.to_string());
        }
    }
    if let Some(due_before) = args["due_before"].as_str() {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(due_before) {
            conditions.push("due_at <= ?".to_string());
            bind_values.push(dt.timestamp_millis().to_string());
        }
    }
    if let Some(due_after) = args["due_after"].as_str() {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(due_after) {
            conditions.push("due_at >= ?".to_string());
            bind_values.push(dt.timestamp_millis().to_string());
        }
    }
    if let Some(search) = args["search"].as_str() {
        if !search.is_empty() {
            conditions.push("title LIKE ?".to_string());
            bind_values.push(format!("%{}%", search));
        }
    }

    let where_clause = if conditions.is_empty() { String::new() } else { format!(" WHERE {}", conditions.join(" AND ")) };
    let sql = format!("SELECT id, title, due_at, priority, done, project, archived FROM tasks{where_clause} ORDER BY created_at DESC LIMIT ?");

    let mut query = sqlx::query_as::<_, (String, String, Option<i64>, String, i64, Option<String>, Option<i64>)>(&sql);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(max_results);

    let rows = query.fetch_all(pool).await.map_err(|e| format!("Failed to query tasks: {e}"))?;

    let tasks: Vec<Value> = rows.into_iter().map(|(id, title, due_at, priority, done, project, archived)| {
        json!({
            "id": id, "title": title, "dueAt": due_at,
            "priority": priority,
            "status": if done == 1 { "completed" } else { "pending" },
            "project": project,
            "archived": archived.unwrap_or(0) == 1,
        })
    }).collect();

    Ok(json!({ "tasks": tasks, "count": tasks.len() }))
}

async fn get_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let row = sqlx::query_as::<_, (String, String, Option<i64>, String, i64, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, title, due_at, priority, done, project, notes, tags FROM tasks WHERE id = ?"
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let (id, title, due_at, priority, done, project, notes, tags) = row.ok_or_else(|| format!("Task \"{task_id}\" not found."))?;

    Ok(json!({
        "id": id, "title": title, "dueAt": due_at,
        "priority": priority,
        "status": if done == 1 { "completed" } else { "pending" },
        "project": project,
        "notes": notes,
        "tags": tags,
        "data_coverage": 1.0
    }))
}

async fn complete_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let now_ms = time::now_ms();
    let result = sqlx::query("UPDATE tasks SET done = 1, completed_at = ?, updated_at = ? WHERE id = ? AND done = 0")
        .bind(now_ms).bind(now_ms).bind(task_id)
        .execute(pool).await.map_err(|e| format!("Failed to complete task: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("Task \"{task_id}\" not found or already completed."));
    }

    let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
        .bind(task_id).fetch_one(pool).await.map_err(|e| format!("Failed to get task: {e}"))?;

    Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" completed.") }))
}

async fn undo_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let now_ms = time::now_ms();
    let result = sqlx::query("UPDATE tasks SET done = 0, completed_at = NULL, updated_at = ? WHERE id = ? AND done = 1")
        .bind(now_ms).bind(task_id)
        .execute(pool).await.map_err(|e| format!("Failed to undo task: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("Task \"{task_id}\" not found or not completed."));
    }

    let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
        .bind(task_id).fetch_one(pool).await.map_err(|e| format!("Failed to get task: {e}"))?;

    Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" re-opened.") }))
}

async fn update_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let now_ms = time::now_ms();
    let mut cols: Vec<&str> = Vec::new();

    if let Some(t) = args["title"].as_str() { if !t.trim().is_empty() { cols.push("title = ?"); } }
    if args.get("priority").is_some() { cols.push("priority = ?"); }
    if args.get("project").is_some() { cols.push("project = ?"); }
    if args.get("due_at").is_some() { cols.push("due_at = ?"); }
    if args.get("notes").is_some() { cols.push("notes = ?"); }
    if args.get("tags").is_some() { cols.push("tags = ?"); }
    if cols.is_empty() { return Err("No fields to update.".to_string()); }

    cols.push("updated_at = ?");
    let sql = format!("UPDATE tasks SET {} WHERE id = ?", cols.join(", "));
    let mut query = sqlx::query(&sql);

    if let Some(t) = args["title"].as_str() { if !t.trim().is_empty() { query = query.bind(t.trim()); } }
    if let Some(p) = args["priority"].as_str() { query = query.bind(p); }
    if let Some(p) = args["project"].as_str() { query = query.bind(p); }
    if let Some(d) = args["due_at"].as_str() {
        query = query.bind(if d.is_empty() { None } else { chrono::DateTime::parse_from_rfc3339(d).ok().map(|dt| dt.timestamp_millis()) });
    } else { query = query.bind(None::<i64>); }
    if let Some(n) = args["notes"].as_str() { query = query.bind(n); }
    if let Some(t) = args["tags"].as_array() { query = query.bind(serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string())); }

    query = query.bind(now_ms).bind(task_id);
    let result = query.execute(pool).await.map_err(|e| format!("Failed to update task: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Task \"{task_id}\" not found.")); }

    let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
        .bind(task_id).fetch_one(pool).await.map_err(|e| format!("Failed to get task: {e}"))?;

    Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" updated.") }))
}

async fn delete_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let title: Option<String> = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
        .bind(task_id).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;
    let title = title.ok_or_else(|| format!("Task \"{task_id}\" not found."))?;

    sqlx::query("DELETE FROM tasks WHERE parent_id = ?").bind(task_id).execute(pool).await.ok();
    sqlx::query("DELETE FROM tasks WHERE id = ?").bind(task_id).execute(pool).await.map_err(|e| format!("Failed to delete: {e}"))?;

    Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" deleted.") }))
}

async fn archive_task(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let archived = args["archived"].as_bool().unwrap_or(true);
    let val = if archived { 1i64 } else { 0 };
    let now_ms = time::now_ms();

    let result = sqlx::query("UPDATE tasks SET archived = ?, updated_at = ? WHERE id = ?")
        .bind(val).bind(now_ms).bind(task_id)
        .execute(pool).await.map_err(|e| format!("Failed to archive task: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Task \"{task_id}\" not found.")); }

    let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
        .bind(task_id).fetch_one(pool).await.map_err(|e| format!("DB error: {e}"))?;

    let action = if archived { "archived" } else { "unarchived" };
    Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" {action}.") }))
}

async fn get_task_activity_log(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let rows = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, text, timestamp FROM activity_logs WHERE task_id = ? ORDER BY timestamp DESC"
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get activity log: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(id, text, ts)| {
        json!({"id": id, "text": text, "timestamp": ts})
    }).collect();

    Ok(json!({ "taskId": task_id, "entries": entries, "count": entries.len() }))
}

async fn add_task_activity_log(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
    let text = args["text"].as_str().ok_or("text is required")?;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();

    sqlx::query("INSERT INTO activity_logs (id, task_id, text, timestamp) VALUES (?, ?, ?, ?)")
        .bind(&id).bind(task_id).bind(text).bind(now_ms)
        .execute(pool).await
        .map_err(|e| format!("Failed to add activity log: {e}"))?;

    Ok(json!({ "id": id, "taskId": task_id, "data_coverage": 1.0, "message": "Activity log entry added." }))
}

async fn get_task_stats(pool: &SqlitePool) -> Result<Value, String> {
    let _today = time::date_key(time::now_ms());
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(pool).await.unwrap_or(0);
    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?"
    )
    .bind(today_start).bind(tomorrow_start)
    .fetch_one(pool).await.unwrap_or(0);
    let overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?"
    )
    .bind(time::now_ms())
    .fetch_one(pool).await.unwrap_or(0);
    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND (archived IS NULL OR archived = 0)"
    )
    .fetch_one(pool).await.unwrap_or(0);

    let projects: Vec<(String, i64)> = sqlx::query_as(
        "SELECT project, COUNT(*) as count FROM tasks WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY count DESC"
    )
    .fetch_all(pool).await.unwrap_or_default();

    let by_priority: Vec<(String, i64)> = sqlx::query_as(
        "SELECT priority, COUNT(*) as count FROM tasks WHERE done = 0 GROUP BY priority ORDER BY count DESC"
    )
    .fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "total": total,
        "pending": pending,
        "completedToday": completed_today,
        "overdue": overdue,
        "byProject": projects.into_iter().map(|(p, c)| json!({"project": p, "count": c})).collect::<Vec<_>>(),
        "byPriority": by_priority.into_iter().map(|(p, c)| json!({"priority": p, "count": c})).collect::<Vec<_>>(),
        "data_coverage": 1.0
    }))
}

async fn get_projects(pool: &SqlitePool) -> Result<Value, String> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT project, COUNT(*) as count FROM tasks WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY project"
    )
    .fetch_all(pool).await.map_err(|e| format!("DB error: {e}"))?;

    let projects: Vec<Value> = rows.into_iter().map(|(name, count)| {
        json!({"name": name, "taskCount": count})
    }).collect();

    Ok(json!({ "projects": projects, "count": projects.len() }))
}
