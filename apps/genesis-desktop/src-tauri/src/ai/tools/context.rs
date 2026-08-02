// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "get_current_time".into(),
            description: "Get the current date and time. Use this whenever you need to know what time it is or what today's date is.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_today_summary".into(),
            description: "Get a comprehensive summary of today including pending tasks, habits to complete, focus sessions, meals logged, mood check-ins, and health status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_day_summary".into(),
            description: "Get a summary for a specific date (YYYY-MM-DD): tasks due, mood, health, focus, meals, and journal.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format, defaults to today"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_upcoming_deadlines".into(),
            description: "Get upcoming task deadlines and goal target dates within a specified number of days.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of days to look ahead (default 7, max 90)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_overdue_items".into(),
            description: "Get all overdue tasks and past-due goal target dates.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_recent_activity".into(),
            description: "Get a timeline of recent activity across all modules: completed tasks, logged habits, mood check-ins, focus sessions, meals, and journal entries.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of days to look back (default 3, max 30)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_weekly_overview".into(),
            description: "Get a weekly overview of all modules: tasks completed, habits tracked, mood trends, focus time, sleep quality, and meals.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "search_everything".into(),
            description: "Cross-module search across tasks, notes, journal entries, and goals. Returns results grouped by module.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query (required)"},
                    "limit": {"type": "integer", "description": "Max results per module (default 5, max 20)"}
                },
                "required": ["query"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_module_status".into(),
            description: "Get a quick status overview: which modules have data today, streak information, and pending items.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_mood_energy_correlation".into(),
            description: "Analyze correlation between mood, energy levels, sleep, and other factors over the last 30 days.".into(),
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
        "get_current_time" => Ok(Some(get_current_time().await?)),
        "get_today_summary" => Ok(Some(get_today_summary(pool).await?)),
        "get_day_summary" => Ok(Some(get_day_summary(args, pool).await?)),
        "get_upcoming_deadlines" => Ok(Some(get_upcoming_deadlines(args, pool).await?)),
        "get_overdue_items" => Ok(Some(get_overdue_items(pool).await?)),
        "get_recent_activity" => Ok(Some(get_recent_activity(args, pool).await?)),
        "get_weekly_overview" => Ok(Some(get_weekly_overview(pool).await?)),
        "search_everything" => Ok(Some(search_everything(args, pool).await?)),
        "get_module_status" => Ok(Some(get_module_status(pool).await?)),
        "get_mood_energy_correlation" => Ok(Some(get_mood_energy_correlation(pool).await?)),
        _ => Ok(None),
    }
}

async fn get_current_time() -> Result<Value, String> {
    let now = time::now_ms();
    let formatted = time::format_rfc3339(now);
    Ok(json!({
        "datetime": formatted,
        "timestamp_ms": now,
        "timezone": "UTC",
        "date": time::date_key(now),
        "time": time::time_key(now),
    }))
}

async fn get_today_summary(pool: &SqlitePool) -> Result<Value, String> {
    let today = time::date_key(time::now_ms());
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let pending_tasks: Vec<Value> = sqlx::query_as::<_, (String, String, Option<i64>, String)>(
        "SELECT id, title, due_at, priority FROM tasks WHERE done = 0 AND (archived IS NULL OR archived = 0) AND (due_at IS NULL OR due_at <= ?) ORDER BY due_at ASC LIMIT 15"
    )
    .bind(tomorrow_start).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, due_at, priority)| json!({"id": id, "title": title, "dueAt": due_at, "priority": priority}))
    .collect();

    let habits_to_do: Vec<String> = sqlx::query_scalar(
        "SELECT h.name FROM habits h LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.date_key = ? WHERE hc.id IS NULL AND (h.archived IS NULL OR h.archived = 0)"
    )
    .bind(&today).fetch_all(pool).await.unwrap_or_default();

    let focus_minutes: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?"
    )
    .bind(today_start).bind(tomorrow_start).fetch_one(pool).await.unwrap_or(0);

    let meals: Vec<Value> = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT name, meal_type, total_kcal FROM meals WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at"
    )
    .bind(today_start).bind(tomorrow_start).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(name, meal_type, kcal)| json!({"name": name, "mealType": meal_type, "calories": kcal}))
    .collect();

    let mood_today: Vec<(String, i64)> = sqlx::query_as(
        "SELECT mood, intensity FROM mood_checkins WHERE date_key = ? ORDER BY logged_at ASC"
    )
    .bind(&today).fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "date": today,
        "pendingTasks": pending_tasks,
        "pendingTaskCount": pending_tasks.len(),
        "habitsToComplete": habits_to_do,
        "habitCount": habits_to_do.len(),
        "focusMinutes": focus_minutes,
        "mealsLogged": meals,
        "mealCount": meals.len(),
        "moodCheckins": mood_today.into_iter().map(|(m, i)| json!({"mood": m, "intensity": i})).collect::<Vec<_>>(),
        "data_coverage": 1.0
    }))
}

async fn get_day_summary(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let date = args["date"].as_str().unwrap_or(&time::date_key(time::now_ms())).to_string();
    let start_ms = parse_date_start(&date);
    let end_ms = start_ms + time::DAY_MS;

    let tasks: Vec<Value> = sqlx::query_as::<_, (String, String, i64, Option<i64>)>(
        "SELECT id, title, done, due_at FROM tasks WHERE due_at >= ? AND due_at < ? ORDER BY due_at"
    )
    .bind(start_ms).bind(end_ms).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, done, due)| json!({"id": id, "title": title, "done": done == 1, "dueAt": due}))
    .collect();

    let moods: Vec<Value> = sqlx::query_as::<_, (String, i64, Option<String>)>(
        "SELECT mood, intensity, note FROM mood_checkins WHERE date_key = ? ORDER BY logged_at"
    )
    .bind(&date).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(m, i, n)| json!({"mood": m, "intensity": i, "note": n}))
    .collect();

    Ok(json!({
        "date": date,
        "tasks": tasks,
        "moods": moods,
        "data_coverage": 1.0
    }))
}

async fn get_upcoming_deadlines(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let days = args["days"].as_i64().unwrap_or(7).max(1).min(90);
    let now_ms = time::now_ms();
    let end_ms = now_ms + days * time::DAY_MS;

    let tasks: Vec<Value> = sqlx::query_as::<_, (String, String, i64, String)>(
        "SELECT id, title, due_at, priority FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at >= ? AND due_at <= ? ORDER BY due_at ASC LIMIT 30"
    )
    .bind(now_ms).bind(end_ms).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, due, prio)| json!({"id": id, "title": title, "dueAt": due, "priority": prio}))
    .collect();

    let goals: Vec<Value> = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT id, title, target_date FROM goals WHERE target_date IS NOT NULL AND target_date >= ? AND target_date <= ? ORDER BY target_date LIMIT 10"
    )
    .bind(now_ms).bind(end_ms).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, target)| json!({"id": id, "title": title, "targetDate": target}))
    .collect();

    Ok(json!({
        "upcomingTasks": tasks,
        "upcomingGoalTargets": goals,
        "data_coverage": 1.0
    }))
}

async fn get_overdue_items(pool: &SqlitePool) -> Result<Value, String> {
    let now_ms = time::now_ms();

    let tasks: Vec<Value> = sqlx::query_as::<_, (String, String, i64, String)>(
        "SELECT id, title, due_at, priority FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ? ORDER BY due_at ASC LIMIT 30"
    )
    .bind(now_ms).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, due, prio)| json!({"id": id, "title": title, "dueAt": due, "priority": prio}))
    .collect();

    Ok(json!({
        "overdueTasks": tasks,
        "overdueCount": tasks.len(),
        "data_coverage": 1.0
    }))
}

async fn get_recent_activity(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let days = args["days"].as_i64().unwrap_or(3).max(1).min(30);
    let cutoff = time::now_ms() - days * time::DAY_MS;

    let completed_tasks: Vec<Value> = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, title, completed_at FROM tasks WHERE done = 1 AND completed_at >= ? ORDER BY completed_at DESC LIMIT 10"
    )
    .bind(cutoff).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, ts)| json!({"type": "task_completed", "id": id, "title": title, "timestamp": ts}))
    .collect();

    let mood_entries: Vec<Value> = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, mood, logged_at FROM mood_checkins WHERE logged_at >= ? ORDER BY logged_at DESC LIMIT 10"
    )
    .bind(cutoff).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, mood, ts)| json!({"type": "mood", "id": id, "mood": mood, "timestamp": ts}))
    .collect();

    let mut activity = Vec::new();
    activity.extend(completed_tasks);
    activity.extend(mood_entries);
    activity.sort_by(|a, b| b["timestamp"].as_i64().unwrap_or(0).cmp(&a["timestamp"].as_i64().unwrap_or(0)));
    activity.truncate(30);

    Ok(json!({ "activity": activity, "count": activity.len() }))
}

async fn get_weekly_overview(pool: &SqlitePool) -> Result<Value, String> {
    let now = time::now_ms();
    let week_ago = now - 7 * time::DAY_MS;
    let today_start = time::start_of_today();
    let week_start = today_start - 6 * time::DAY_MS;

    let tasks_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at <= ?"
    )
    .bind(week_ago).bind(now).fetch_one(pool).await.unwrap_or(0);

    let tasks_created: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE created_at >= ? AND created_at <= ?"
    )
    .bind(week_ago).bind(now).fetch_one(pool).await.unwrap_or(0);

    let habits_logged: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date_key) FROM habit_completions WHERE created_at >= ? AND created_at <= ?"
    )
    .bind(week_ago).bind(now).fetch_one(pool).await.unwrap_or(0);

    let focus_total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at <= ?"
    )
    .bind(week_ago).bind(now).fetch_one(pool).await.unwrap_or(0);

    let mood_days: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date_key) FROM mood_checkins WHERE logged_at >= ? AND logged_at <= ?"
    )
    .bind(week_ago).bind(now).fetch_one(pool).await.unwrap_or(0);

    Ok(json!({
        "periodStart": week_start,
        "periodEnd": today_start + time::DAY_MS,
        "tasksCompleted": tasks_completed,
        "tasksCreated": tasks_created,
        "habitDaysLogged": habits_logged,
        "totalFocusMinutes": focus_total,
        "moodDaysLogged": mood_days,
        "data_coverage": 1.0
    }))
}

async fn search_everything(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let query = args["query"].as_str().ok_or("query is required")?;
    let limit = args["limit"].as_i64().unwrap_or(5).max(1).min(20);
    let pattern = format!("%{}%", query);

    let tasks: Vec<Value> = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, title, done FROM tasks WHERE title LIKE ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(&pattern).bind(limit).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title, done)| json!({"id": id, "title": title, "done": done == 1}))
    .collect();

    let notes: Vec<Value> = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM note_objects WHERE title LIKE ? ORDER BY updated_at DESC LIMIT ?"
    )
    .bind(&pattern).bind(limit).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title)| json!({"id": id, "title": title}))
    .collect();

    let goals: Vec<Value> = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM goals WHERE title LIKE ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(&pattern).bind(limit).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, title)| json!({"id": id, "title": title}))
    .collect();

    let journal: Vec<Value> = sqlx::query_as::<_, (String, String)>(
        "SELECT id, date FROM journal_entries WHERE date LIKE ? OR blocks LIKE ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(&pattern).bind(&pattern).bind(limit).fetch_all(pool).await.unwrap_or_default()
    .into_iter().map(|(id, date)| json!({"id": id, "date": date}))
    .collect();

    Ok(json!({
        "tasks": tasks,
        "notes": notes,
        "goals": goals,
        "journal": journal,
        "data_coverage": if tasks.is_empty() && notes.is_empty() && goals.is_empty() && journal.is_empty() { 0.0 } else { 1.0 }
    }))
}

async fn get_module_status(pool: &SqlitePool) -> Result<Value, String> {
    let today = time::date_key(time::now_ms());
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let pending_tasks: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND (archived IS NULL OR archived = 0)"
    )
    .fetch_one(pool).await.unwrap_or(0);

    let habits_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM habits h LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.date_key = ? WHERE hc.id IS NULL AND (h.archived IS NULL OR h.archived = 0)"
    )
    .bind(&today).fetch_one(pool).await.unwrap_or(0);

    let mood_today: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM mood_checkins WHERE date_key = ?"
    )
    .bind(&today).fetch_one(pool).await.unwrap_or(0) > 0;

    let focus_today: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?"
    )
    .bind(today_start).bind(tomorrow_start).fetch_one(pool).await.unwrap_or(0);

    let meal_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM meals WHERE logged_at >= ? AND logged_at < ?"
    )
    .bind(today_start).bind(tomorrow_start).fetch_one(pool).await.unwrap_or(0);

    Ok(json!({
        "pendingTasks": pending_tasks,
        "habitsRemainingToday": habits_today,
        "moodLoggedToday": mood_today,
        "focusMinutesToday": focus_today,
        "mealsLoggedToday": meal_today,
        "data_coverage": 1.0
    }))
}

async fn get_mood_energy_correlation(pool: &SqlitePool) -> Result<Value, String> {
    let cutoff = time::now_ms() - 30 * time::DAY_MS;

    let health_rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT date_key, mood, energy FROM health_daily_logs WHERE logged_at >= ? ORDER BY date_key"
    )
    .bind(cutoff).fetch_all(pool).await.unwrap_or_default();

    let mut correlations = Vec::new();
    for (date, mood, energy) in &health_rows {
        let sleep_row: Option<(f64, i64)> = sqlx::query_as(
            "SELECT duration_min, quality_score FROM sleep_sessions WHERE date = ? LIMIT 1"
        )
        .bind(date).fetch_optional(pool).await.unwrap_or(None);

        correlations.push(json!({
            "date": date, "mood": mood, "energy": energy,
            "sleepMinutes": sleep_row.map(|(d, _)| d),
            "sleepQuality": sleep_row.map(|(_, q)| q)
        }));
    }

    let avg_mood: f64 = if !health_rows.is_empty() {
        health_rows.iter().map(|(_, m, _)| *m as f64).sum::<f64>() / health_rows.len() as f64
    } else { 0.0 };

    let avg_energy: f64 = if !health_rows.is_empty() {
        health_rows.iter().map(|(_, _, e)| *e as f64).sum::<f64>() / health_rows.len() as f64
    } else { 0.0 };

    Ok(json!({
        "days": correlations.len(),
        "averageMood": (avg_mood * 10.0).round() / 10.0,
        "averageEnergy": (avg_energy * 10.0).round() / 10.0,
        "dailyData": correlations,
        "data_coverage": if correlations.is_empty() { 0.0 } else { 1.0 }
    }))
}

fn parse_date_start(date: &str) -> i64 {
    if let Ok(dt) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        dt.and_hms_opt(0, 0, 0)
            .map(|datetime| datetime.and_utc().timestamp_millis())
            .unwrap_or_else(time::start_of_today)
    } else {
        time::start_of_today()
    }
}
