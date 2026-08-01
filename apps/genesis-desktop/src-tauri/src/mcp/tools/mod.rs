// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! MCP tool implementations using rmcp's #[tool] macro with struct-based parameters.
//!
//! Each tool is a method on `BentoMcpServer` with typed parameters using
//! `serde::Deserialize` + `schemars::JsonSchema` for automatic schema derivation.
//!
//! Database queries match the actual Bento schema:
//!   - tasks, habits, habit_completions, health_events (for focus),
//!     mood_checkins, journal_entries, note_objects, blocks

use rmcp::{
    handler::server::wrapper::{Json, Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router, ServerHandler,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use crate::util::time;

// ---------------------------------------------------------------------------
// Parameter structs for each tool
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateTaskParams {
    #[schemars(description = "Task title (required, leading/trailing whitespace is trimmed)")]
    pub title: String,
    #[schemars(
        description = "Optional ISO 8601 due date/time string. Examples: '2025-12-31T23:59:00Z' or '2025-12-31'. Tasks without a due date appear in the 'no date' section."
    )]
    pub due_at: Option<String>,
    #[schemars(
        description = "Optional priority level. Allowed values: 'low', 'medium', 'high'. Defaults to 'medium' if not provided."
    )]
    pub priority: Option<String>,
    #[schemars(
        description = "Optional project/category name to organize the task. If not provided, defaults to 'inbox'."
    )]
    pub project: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetTasksParams {
    #[schemars(
        description = "Filter tasks by completion status. Allowed values: 'pending' (default, returns only incomplete tasks), 'completed' (returns only done tasks), 'all' (returns both)."
    )]
    pub status: Option<String>,
    #[schemars(
        description = "Optional ISO 8601 date/time — only return tasks with a due date before this timestamp. Example: '2025-12-31T23:59:00Z'. Useful for finding overdue tasks."
    )]
    pub due_before: Option<String>,
    #[schemars(
        description = "Optional project name to filter by. Only returns tasks belonging to this project (case-sensitive)."
    )]
    pub project: Option<String>,
    #[schemars(description = "Maximum number of tasks to return. Range: 1-100. Default: 20.")]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CompleteTaskParams {
    #[schemars(
        description = "The unique ID of the task to mark as completed. Get task IDs from get_tasks or create_task return values."
    )]
    pub task_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateTaskParams {
    #[schemars(
        description = "The unique ID of the task to update. Get from get_tasks or create_task."
    )]
    pub task_id: String,
    #[schemars(description = "New title for the task. If omitted, title stays unchanged.")]
    pub title: Option<String>,
    #[schemars(
        description = "New priority level: low, medium, or high. If omitted, stays unchanged."
    )]
    pub priority: Option<String>,
    #[schemars(description = "New project name. If omitted, stays unchanged.")]
    pub project: Option<String>,
    #[schemars(
        description = "ISO 8601 due date string (e.g. '2026-07-15T17:00:00Z'). Pass empty string to clear the due date."
    )]
    pub due_at: Option<String>,
    #[schemars(description = "New notes/description for the task.")]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct DeleteTaskParams {
    #[schemars(description = "The unique ID of the task to delete permanently.")]
    pub task_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UndoTaskParams {
    #[schemars(description = "The unique ID of the completed task to unmark.")]
    pub task_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateHabitParams {
    #[schemars(description = "Name of the habit (e.g. 'Exercise', 'Read', 'Meditate'). Required.")]
    pub name: String,
    #[schemars(description = "Emoji icon for the habit. Default: '⭐'.")]
    pub emoji: Option<String>,
    #[schemars(
        description = "Frequency: 'daily', 'weekly', 'weekdays', or 'weekends'. Default: 'daily'."
    )]
    pub frequency: Option<String>,
    #[schemars(
        description = "Habit kind: 'build' (add good habit) or 'quit' (break bad habit). Default: 'build'."
    )]
    pub kind: Option<String>,
    #[schemars(description = "Why this habit matters. Optional motivation note.")]
    pub why: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateHabitParams {
    #[schemars(description = "The unique ID of the habit to update.")]
    pub habit_id: String,
    #[schemars(description = "New name for the habit.")]
    pub name: Option<String>,
    #[schemars(description = "New emoji icon.")]
    pub emoji: Option<String>,
    #[schemars(description = "New frequency: 'daily', 'weekly', 'weekdays', 'weekends'.")]
    pub frequency: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct DeleteHabitParams {
    #[schemars(
        description = "The unique ID of the habit to delete permanently. This also removes all its completion history."
    )]
    pub habit_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LogSleepParams {
    #[schemars(
        description = "Date string in YYYY-MM-DD format for the sleep log entry. Defaults to today."
    )]
    pub date: Option<String>,
    #[schemars(description = "Hours of sleep (e.g. 7.5 for 7 hours 30 minutes). Required.")]
    pub hours: f64,
    #[schemars(description = "Sleep quality score 1-5 (1=poor, 5=great). Optional.")]
    pub quality: Option<i64>,
    #[schemars(description = "Optional notes about the sleep.")]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateNoteParams {
    #[schemars(description = "The unique ID of the note to update.")]
    pub note_id: String,
    #[schemars(description = "New title for the note. If omitted, title stays unchanged.")]
    pub title: Option<String>,
    #[schemars(
        description = "New content body (plain text or markdown). If omitted, content stays unchanged."
    )]
    pub content: Option<String>,
    #[schemars(
        description = "New tags array to replace existing tags. If omitted, tags stay unchanged."
    )]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct DeleteNoteParams {
    #[schemars(description = "The unique ID of the note to delete permanently.")]
    pub note_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LogMealParams {
    #[schemars(description = "Name of the meal (e.g. 'Chicken Salad', 'Oatmeal'). Required.")]
    pub name: String,
    #[schemars(
        description = "Meal type: 'breakfast', 'lunch', 'dinner', 'snack'. Default: 'meal'."
    )]
    pub meal_type: Option<String>,
    #[schemars(description = "Total calorie count for the meal. Optional.")]
    pub calories: Option<i64>,
    #[schemars(description = "Optional notes about the meal.")]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SaveNoteParams {
    #[schemars(description = "Note title (required, leading/trailing whitespace is trimmed)")]
    pub title: String,
    #[schemars(
        description = "Note body content. Can be plain text or markdown. Required, must not be empty."
    )]
    pub content: String,
    #[schemars(
        description = "Optional array of tag strings to organize the note. Example: ['work', 'project-alpha', 'meeting']"
    )]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SearchNotesParams {
    #[schemars(
        description = "Search keyword to match against note titles and body content. Performs a LIKE '%keyword%' search. Required, must not be empty."
    )]
    pub query: String,
    #[schemars(
        description = "Maximum number of search results to return. Range: 1-100. Default: 10."
    )]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LogFocusSessionParams {
    #[schemars(
        description = "Duration of the focus session in minutes. Must be between 1 and 1440 (24 hours). Example: 25 for a standard Pomodoro session."
    )]
    pub duration_minutes: i64,
    #[schemars(
        description = "Optional description of what you worked on during the session. Helps with later review."
    )]
    pub task_description: Option<String>,
    #[schemars(
        description = "Type of focus session. Allowed values: 'pomodoro' (25 min), 'deep' (longer focused work), 'custom' (any duration). Default: 'custom'."
    )]
    pub session_type: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LogMoodParams {
    #[schemars(
        description = "Mood rating on a 1-5 scale: 1='very bad', 2='low', 3='steady', 4='good', 5='bright'. Required."
    )]
    pub mood: i64,
    #[schemars(
        description = "Optional note or context about your mood. Helps identify patterns over time."
    )]
    pub note: Option<String>,
    #[schemars(
        description = "Optional array of activity strings you engaged in today. Example: ['exercise', 'reading', 'meditation']. Helps correlate mood with activities."
    )]
    pub activities: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateJournalEntryParams {
    #[schemars(
        description = "Journal entry content (plain text or markdown). Required, must not be empty."
    )]
    pub content: String,
    #[schemars(
        description = "Optional mood rating 1-5 to log alongside the journal entry. Same scale as log_mood: 1='very bad', 5='bright'."
    )]
    pub mood: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LogHabitParams {
    #[schemars(
        description = "Name of the habit to mark as completed. Case-insensitive match with fuzzy fallback (LIKE %search%). Examples: 'Morning Run', 'Meditate', 'Read'. Get available habit names from the habits module."
    )]
    pub habit_name: String,
}

/// No params needed for get_today_summary.
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct EmptyParams;

// ---------------------------------------------------------------------------
// Intelligence tool parameter structs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LifeContextParams {
    #[schemars(description = "Detail level: 'minimal', 'standard' (default), or 'full'")]
    pub depth: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CorrelationParams {
    #[schemars(
        description = "First metric to correlate. Options: sleep_hours, mood_score, focus_minutes, calories, spending_amount, tasks_completed, habit_completion_rate, energy_score"
    )]
    pub metric_a: String,
    #[schemars(description = "Second metric to correlate. Same options as metric_a.")]
    pub metric_b: String,
    #[schemars(description = "Time window in days: 7, 14, 30, 90, or 180. Default: 30.")]
    pub window_days: Option<i64>,
    #[schemars(description = "Granularity: 'day' (default) or 'week'")]
    pub granularity: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct DayReconstructionParams {
    #[schemars(description = "Date in YYYY-MM-DD format")]
    pub date: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LifeDeltaParams {
    #[schemars(description = "Start date for period A (YYYY-MM-DD)")]
    pub period_a_start: String,
    #[schemars(description = "End date for period A (YYYY-MM-DD)")]
    pub period_a_end: String,
    #[schemars(description = "Start date for period B (YYYY-MM-DD)")]
    pub period_b_start: String,
    #[schemars(description = "End date for period B (YYYY-MM-DD)")]
    pub period_b_end: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CognitiveScheduleParams {
    #[schemars(description = "Number of days of history to analyze: 30, 60, or 90. Default: 30.")]
    pub window_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateBondParams {
    #[schemars(description = "Title of the commitment bond")]
    pub title: String,
    #[schemars(description = "Optional goal ID to link this bond to")]
    pub goal_id: Option<String>,
    #[schemars(description = "Deadline date in YYYY-MM-DD format")]
    pub deadline: String,
    #[schemars(description = "Success metric description, e.g. 'complete all 5 tasks'")]
    pub success_metric: String,
    #[schemars(description = "Consequence if bond is broken, e.g. 'donate €50 to charity'")]
    pub consequence: String,
    #[schemars(
        description = "How often (in days) the agent should check in: 1, 3, or 7. Default: 7."
    )]
    pub check_in_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetBondsParams {
    #[schemars(description = "Optional status filter: 'active', 'kept', 'broken', 'extended'")]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateBondParams {
    #[schemars(description = "ID of the commitment bond to update")]
    pub bond_id: String,
    #[schemars(description = "New status: 'active', 'kept', 'broken', 'extended'")]
    pub status: String,
    #[schemars(description = "Optional check-in note to append to history")]
    pub check_in_note: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FailurePatternsParams {
    #[schemars(description = "Minimum data points required for pattern detection. Default: 3.")]
    pub min_data_points: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct WeeklyReportParams {
    #[schemars(description = "Week offset: 0 = last 7 days (default), -1 = week before, etc.")]
    pub week_offset: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SelfProjectionParams {
    #[schemars(description = "Number of days to project forward: 90, 180, or 365. Default: 90.")]
    pub projection_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AmbientJournalParams {
    #[schemars(description = "Date in YYYY-MM-DD format. Default: today.")]
    pub date: Option<String>,
    #[schemars(description = "Writing style: 'terse', 'narrative' (default), or 'analytical'")]
    pub style: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct MealMoodParams {
    #[schemars(description = "Number of days of history to analyze: 7, 30, 90. Default: 30.")]
    pub window_days: Option<i64>,
    #[schemars(
        description = "Hours after a meal to look for mood/focus effects: 1, 2, 4. Default: 4."
    )]
    pub lag_hours: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct IntegrityScoreParams {
    #[schemars(description = "Number of days of history to analyze: 30, 90, 180. Default: 30.")]
    pub window_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AttentionAllocationParams {
    #[schemars(description = "Number of days of history to analyze: 7, 30, 90. Default: 30.")]
    pub window_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SprintPlanParams {
    #[schemars(description = "Sprint length in days: 7, 14, 30. Default: 14.")]
    pub sprint_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AutoScheduleParams {}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SkillVelocityParams {
    #[schemars(
        description = "Number of days of history to analyze: 30, 90, 180, 365. Default: 90."
    )]
    pub window_days: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SaveAgentContextParams {
    #[schemars(description = "Preference key (e.g. 'coding_language', 'code_review_style')")]
    pub key: String,
    #[schemars(description = "Value to store (string, JSON-safe)")]
    pub value: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetAgentContextParams {
    #[schemars(description = "Optional specific key to retrieve. Returns all entries if omitted.")]
    pub key: Option<String>,
}

// ---------------------------------------------------------------------------
// Return types for tools (wrapped in Json<Value> for IntoCallToolResult compat)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskObject {
    pub id: String,
    pub title: String,
    pub due_at: Option<i64>,
    pub priority: String,
    pub status: String,
    pub project: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteObject {
    pub id: String,
    pub title: String,
    pub excerpt: String,
    pub updated_at: i64,
}

// ---------------------------------------------------------------------------
// The MCP server struct
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct BentoMcpServer {
    pub pool: SqlitePool,
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

#[tool_router]
impl BentoMcpServer {
    /// Create a task in Bento.
    #[tool(
        title = "Create Task",
        description = "Create a new task in Bento with a title (required), optional due date, priority level (low/medium/high, default: medium), and project assignment (default: inbox). Returns the created task ID and a confirmation message.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn create_task(
        &self,
        Parameters(params): Parameters<CreateTaskParams>,
    ) -> Result<Json<Value>, String> {
        let cleaned = params.title.trim().to_string();
        if cleaned.is_empty() {
            return Err("Task title is required.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let priority = params
            .priority
            .as_deref()
            .unwrap_or("medium")
            .to_lowercase();
        let due_at_ms = params.due_at.as_ref().and_then(|iso| {
            chrono::DateTime::parse_from_rfc3339(iso)
                .ok()
                .map(|dt| dt.timestamp_millis())
        });
        let project = params.project.unwrap_or_default();

        sqlx::query(
            r#"INSERT INTO tasks (id, title, done, priority, project, due_at, created_at, updated_at)
               VALUES (?, ?, 0, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&cleaned)
        .bind(&priority)
        .bind(&project)
        .bind(due_at_ms)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to create task: {e}"))?;

        Ok(Json(json!({
            "id": id,
            "title": cleaned,
            "data_coverage": 1.0,
            "message": format!("Task \"{cleaned}\" created.")
        })))
    }

    /// List tasks from Bento.
    #[tool(
        title = "List Tasks",
        description = "Retrieve tasks from Bento with optional filters. By default returns pending tasks sorted newest first. Can filter by status (pending/completed/all), due date cutoff, and project name. Use this to check what needs to be done.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_tasks(
        &self,
        Parameters(params): Parameters<GetTasksParams>,
    ) -> Result<Json<Value>, String> {
        let status_filter = params.status.as_deref().unwrap_or("pending").to_lowercase();
        let max_results = params.limit.unwrap_or(20).min(100);
        let now_ms = time::now_ms();
        let due_before_ms = params.due_before.as_ref().and_then(|iso| {
            chrono::DateTime::parse_from_rfc3339(iso)
                .ok()
                .map(|dt| dt.timestamp_millis())
        });

        // Build SQL with parameterized bindings — no string interpolation for user data
        let mut sql =
            String::from("SELECT id, title, due_at, priority, done, project FROM tasks WHERE 1=1");

        match status_filter.as_str() {
            "pending" => {
                sql.push_str(" AND done = 0 AND (due_at IS NULL OR due_at > ?)");
            }
            "completed" => {
                sql.push_str(" AND done = 1");
            }
            _ => {}
        }

        if let Some(ref proj) = params.project {
            if !proj.is_empty() {
                sql.push_str(" AND project = ?");
            }
        }

        if due_before_ms.is_some() {
            sql.push_str(" AND due_at IS NOT NULL AND due_at <= ?");
        }

        sql.push_str(" ORDER BY created_at DESC LIMIT ?");

        // Build the query and conditionally bind each parameter
        let mut query =
            sqlx::query_as::<_, (String, String, Option<i64>, String, i64, Option<String>)>(&sql);

        // Bind in the same order as the ? placeholders appear in the SQL
        if status_filter == "pending" {
            query = query.bind(now_ms);
        }
        if let Some(ref proj) = params.project {
            if !proj.is_empty() {
                query = query.bind(proj);
            }
        }
        if let Some(ms) = due_before_ms {
            query = query.bind(ms);
        }
        query = query.bind(max_results);

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| format!("Failed to query tasks: {e}"))?;

        let tasks: Vec<Value> = rows
            .into_iter()
            .map(|(id, title, due_at, priority, done, project)| {
                json!({
                    "id": id,
                    "title": title,
                    "dueAt": due_at,
                    "priority": priority,
                    "status": if done == 1 { "completed" } else { "pending" },
                    "project": project,
                })
            })
            .collect();

        Ok(Json(json!({ "tasks": tasks, "count": tasks.len() })))
    }

    /// Mark a task as completed.
    #[tool(
        title = "Complete Task",
        description = "Mark an existing task as completed in Bento. The task must be currently incomplete — returns an error if already done or not found. Records the completion timestamp.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn complete_task(
        &self,
        Parameters(params): Parameters<CompleteTaskParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let result = sqlx::query(
            "UPDATE tasks SET done = 1, completed_at = ?, updated_at = ? WHERE id = ? AND done = 0",
        )
        .bind(now_ms)
        .bind(now_ms)
        .bind(&params.task_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to complete task: {e}"))?;

        if result.rows_affected() == 0 {
            return Err(format!(
                "Task \"{}\" not found or already completed.",
                params.task_id
            ));
        }

        let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
            .bind(&params.task_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("Failed to get task title: {e}"))?;

        Ok(Json(json!({
            "id": params.task_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Task \"{title}\" completed.")
        })))
    }

    /// Update an existing task's fields.
    #[tool(
        title = "Update Task",
        description = "Modify an existing task's title, priority, project, due date, or notes. Any field can be omitted to leave it unchanged. Pass an empty string for due_at to clear the due date. Returns the updated task data.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn update_task(
        &self,
        Parameters(params): Parameters<UpdateTaskParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let mut col_names: Vec<&str> = Vec::new();
        let cleaned_title = params
            .title
            .as_ref()
            .map(|t| {
                let c = t.trim().to_string();
                if c.is_empty() {
                    None
                } else {
                    Some(c)
                }
            })
            .flatten();
        let lowered_priority = params.priority.as_ref().map(|p| p.to_lowercase());
        if let Some(ref p) = lowered_priority {
            if !["low", "medium", "high"].contains(&p.as_str()) {
                return Err("Priority must be 'low', 'medium', or 'high'.".to_string());
            }
        }
        let parsed_due = params.due_at.as_ref().and_then(|d| {
            if d.is_empty() {
                None
            } else {
                chrono::DateTime::parse_from_rfc3339(d)
                    .ok()
                    .map(|dt| dt.timestamp_millis())
            }
        });

        let mut has_update = false;
        if cleaned_title.is_some() {
            col_names.push("title = ?");
            has_update = true;
        }
        if lowered_priority.is_some() {
            col_names.push("priority = ?");
            has_update = true;
        }
        if params.project.is_some() {
            col_names.push("project = ?");
            has_update = true;
        }
        if params.due_at.is_some() {
            col_names.push("due_at = ?");
            has_update = true;
        }
        if params.notes.is_some() {
            col_names.push("notes = ?");
            has_update = true;
        }

        if !has_update {
            return Err("At least one field must be provided to update.".to_string());
        }

        col_names.push("updated_at = ?");
        let sql = format!("UPDATE tasks SET {} WHERE id = ?", col_names.join(", "));
        let mut query = sqlx::query(&sql);

        if let Some(ref t) = cleaned_title {
            query = query.bind(t);
        }
        if let Some(ref p) = lowered_priority {
            query = query.bind(p);
        }
        if let Some(ref proj) = params.project {
            query = query.bind(proj);
        }
        if let Some(ms) = parsed_due {
            query = query.bind(ms);
        }
        if let Some(ref notes) = params.notes {
            query = query.bind(notes);
        }

        query = query.bind(now_ms).bind(&params.task_id);

        let result = query
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to update task: {e}"))?;

        if result.rows_affected() == 0 {
            return Err(format!("Task \"{}\" not found.", params.task_id));
        }

        let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
            .bind(&params.task_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("Failed to get task: {e}"))?;

        Ok(Json(json!({
            "id": params.task_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Task \"{title}\" updated.")
        })))
    }

    /// Delete a task permanently.
    #[tool(
        title = "Delete Task",
        description = "Permanently remove a task from Bento by its ID. Also removes subtasks and activity logs. This action cannot be undone. Returns a confirmation message.",
        annotations(
            read_only_hint = false,
            destructive_hint = true,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn delete_task(
        &self,
        Parameters(params): Parameters<DeleteTaskParams>,
    ) -> Result<Json<Value>, String> {
        sqlx::query("DELETE FROM tasks WHERE parent_id = ?")
            .bind(&params.task_id)
            .execute(&self.pool)
            .await
            .ok();

        let title: Option<String> = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
            .bind(&params.task_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("Failed to find task: {e}"))?;

        let title = match title {
            Some(t) => t,
            None => return Err(format!("Task \"{}\" not found.", params.task_id)),
        };

        sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(&params.task_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to delete task: {e}"))?;

        Ok(Json(json!({
            "id": params.task_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Task \"{title}\" deleted.")
        })))
    }

    /// Unmark a completed task, returning it to pending.
    #[tool(
        title = "Undo Task Completion",
        description = "Reopens a previously completed task by clearing its completion status. The task returns to the pending list with its original priority, project, and due date intact. Perfect for when a task was marked done prematurely.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn undo_task(
        &self,
        Parameters(params): Parameters<UndoTaskParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let result = sqlx::query(
            "UPDATE tasks SET done = 0, completed_at = NULL, updated_at = ? WHERE id = ? AND done = 1",
        )
        .bind(now_ms)
        .bind(&params.task_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to undo task: {e}"))?;

        if result.rows_affected() == 0 {
            return Err(format!(
                "Task \"{}\" not found or was not completed.",
                params.task_id
            ));
        }

        let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
            .bind(&params.task_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("Failed to get task title: {e}"))?;

        Ok(Json(json!({
            "id": params.task_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Task \"{title}\" returned to pending.")
        })))
    }

    /// Create a new habit to track.
    #[tool(
        title = "Create Habit",
        description = "Create a new habit tracker in Bento. Define the habit name, emoji, frequency (daily/weekly/weekdays/weekends), kind (build/quit), and optionally your motivation. Returns the habit ID for use with log_habit_completion.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn create_habit(
        &self,
        Parameters(params): Parameters<CreateHabitParams>,
    ) -> Result<Json<Value>, String> {
        let cleaned = params.name.trim().to_string();
        if cleaned.is_empty() {
            return Err("Habit name is required.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let emoji = params.emoji.unwrap_or_else(|| "⭐".to_string());
        let frequency = params.frequency.unwrap_or_else(|| "daily".to_string());
        let kind = params.kind.unwrap_or_else(|| "build".to_string());
        let why = params.why.unwrap_or_default();

        if !["daily", "weekly", "weekdays", "weekends"].contains(&frequency.as_str()) {
            return Err(
                "Frequency must be 'daily', 'weekly', 'weekdays', or 'weekends'.".to_string(),
            );
        }
        if !["build", "quit"].contains(&kind.as_str()) {
            return Err("Kind must be 'build' or 'quit'.".to_string());
        }

        sqlx::query(
            "INSERT INTO habits (id, name, emoji, color, kind, archived, completion_type, target_count, unit, frequency, why, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'var(--mod-accent)', ?, 0, 'binary', 1, '', ?, ?, 0, ?, ?)",
        )
        .bind(&id)
        .bind(&cleaned)
        .bind(&emoji)
        .bind(&kind)
        .bind(&frequency)
        .bind(&why)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to create habit: {e}"))?;

        Ok(Json(json!({
            "id": id,
            "name": cleaned,
            "emoji": emoji,
            "frequency": frequency,
            "kind": kind,
            "data_coverage": 1.0,
            "message": format!("Habit \"{cleaned}\" created.")
        })))
    }

    /// Update an existing habit's properties.
    #[tool(
        title = "Update Habit",
        description = "Edit an existing habit's name, emoji, or frequency. Only provided fields are changed. The habit ID must be valid. Returns a confirmation message.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn update_habit(
        &self,
        Parameters(params): Parameters<UpdateHabitParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let mut col_names: Vec<&str> = Vec::new();
        let cleaned_name = params
            .name
            .as_ref()
            .map(|n| {
                let c = n.trim().to_string();
                if c.is_empty() {
                    None
                } else {
                    Some(c)
                }
            })
            .flatten();
        if cleaned_name.is_none() && params.name.is_some() {
            return Err("Habit name cannot be empty.".to_string());
        }
        let lowered_freq = params.frequency.as_ref().map(|f| f.to_lowercase());
        if let Some(ref f) = lowered_freq {
            if !["daily", "weekly", "weekdays", "weekends"].contains(&f.as_str()) {
                return Err(
                    "Frequency must be 'daily', 'weekly', 'weekdays', or 'weekends'.".to_string(),
                );
            }
        }

        let mut has_update = false;
        if cleaned_name.is_some() {
            col_names.push("name = ?");
            has_update = true;
        }
        if params.emoji.is_some() {
            col_names.push("emoji = ?");
            has_update = true;
        }
        if lowered_freq.is_some() {
            col_names.push("frequency = ?");
            has_update = true;
        }

        if !has_update {
            return Err("At least one field must be provided to update.".to_string());
        }

        col_names.push("updated_at = ?");
        let sql = format!("UPDATE habits SET {} WHERE id = ?", col_names.join(", "));
        let mut query = sqlx::query(&sql);

        if let Some(ref n) = cleaned_name {
            query = query.bind(n);
        }
        if let Some(ref e) = params.emoji {
            query = query.bind(e);
        }
        if let Some(ref f) = lowered_freq {
            query = query.bind(f);
        }

        query = query.bind(now_ms).bind(&params.habit_id);

        let result = query
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to update habit: {e}"))?;

        if result.rows_affected() == 0 {
            return Err(format!("Habit \"{}\" not found.", params.habit_id));
        }

        let name: String = sqlx::query_scalar("SELECT name FROM habits WHERE id = ?")
            .bind(&params.habit_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("Failed to get habit name: {e}"))?;

        Ok(Json(json!({
            "id": params.habit_id,
            "name": name,
            "data_coverage": 1.0,
            "message": format!("Habit \"{name}\" updated.")
        })))
    }

    /// Delete a habit and its completion history.
    #[tool(
        title = "Delete Habit",
        description = "Permanently remove a habit and all of its completion records from Bento. This action cannot be undone. Returns a confirmation message.",
        annotations(
            read_only_hint = false,
            destructive_hint = true,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn delete_habit(
        &self,
        Parameters(params): Parameters<DeleteHabitParams>,
    ) -> Result<Json<Value>, String> {
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ?")
            .bind(&params.habit_id)
            .execute(&self.pool)
            .await
            .ok();

        let name: Option<String> = sqlx::query_scalar("SELECT name FROM habits WHERE id = ?")
            .bind(&params.habit_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("Failed to find habit: {e}"))?;

        let name = match name {
            Some(n) => n,
            None => return Err(format!("Habit \"{}\" not found.", params.habit_id)),
        };

        sqlx::query("DELETE FROM habits WHERE id = ?")
            .bind(&params.habit_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to delete habit: {e}"))?;

        Ok(Json(json!({
            "id": params.habit_id,
            "name": name,
            "data_coverage": 1.0,
            "message": format!("Habit \"{name}\" deleted.")
        })))
    }

    /// Log sleep hours for a given date.
    #[tool(
        title = "Log Sleep",
        description = "Record a sleep entry in Bento's sleep tracker. Accepts a date (defaults to today), hours slept, optional quality score 1-5, and notes. Creates a new entry or updates an existing one for the same date.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn log_sleep(
        &self,
        Parameters(params): Parameters<LogSleepParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let date_key = params
            .date
            .as_ref()
            .filter(|d| !d.is_empty())
            .cloned()
            .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

        if params.hours <= 0.0 || params.hours > 24.0 {
            return Err("Sleep hours must be between 0 and 24.".to_string());
        }
        if let Some(q) = params.quality {
            if q < 1 || q > 5 {
                return Err("Quality score must be between 1 and 5.".to_string());
            }
        }

        let existing: Option<String> =
            sqlx::query_scalar("SELECT id FROM sleep_logs WHERE date_key = ?")
                .bind(&date_key)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| format!("sleep lookup: {e}"))?;

        if let Some(eid) = existing {
            sqlx::query("UPDATE sleep_logs SET hours = ?, quality = ?, notes = ?, updated_at = ? WHERE id = ?")
                .bind(params.hours)
                .bind(params.quality)
                .bind(&params.notes)
                .bind(now_ms)
                .bind(&eid)
                .execute(&self.pool)
                .await
                .map_err(|e| format!("Failed to update sleep: {e}"))?;

            Ok(Json(json!({
                "id": eid,
                "date": date_key,
                "hours": params.hours,
                "action": "updated",
                "data_coverage": 1.0,
                "message": format!("Sleep updated for {date_key}: {}h.", params.hours)
            })))
        } else {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO sleep_logs (id, date_key, hours, quality, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(&date_key)
            .bind(params.hours)
            .bind(params.quality)
            .bind(&params.notes)
            .bind(now_ms)
            .bind(now_ms)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to log sleep: {e}"))?;

            Ok(Json(json!({
                "id": id,
                "date": date_key,
                "hours": params.hours,
                "action": "created",
                "data_coverage": 1.0,
                "message": format!("Sleep logged for {date_key}: {}h.", params.hours)
            })))
        }
    }

    /// Update an existing note's title, content, or tags.
    #[tool(
        title = "Update Note",
        description = "Modify an existing note's title, content body, or tags. Any field can be omitted to leave it unchanged. The note ID is required. Returns the updated note ID.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn update_note(
        &self,
        Parameters(params): Parameters<UpdateNoteParams>,
    ) -> Result<Json<Value>, String> {
        let now_ms = time::now_ms();
        let cleaned_title = params.title.as_ref().map(|t| t.trim().to_string());
        let tags_str = params
            .tags
            .as_ref()
            .map(|tags| serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string()));

        let mut col_names: Vec<&str> = Vec::new();
        if let Some(ref t) = cleaned_title {
            if t.is_empty() {
                return Err("Note title cannot be empty.".to_string());
            }
            col_names.push("title = ?");
        }
        if params.content.is_some() {
            col_names.push("content = ?");
        }
        if tags_str.is_some() {
            col_names.push("tags = ?");
        }

        if col_names.is_empty() {
            return Err("At least one field must be provided to update.".to_string());
        }

        col_names.push("updated_at = ?");
        let sql = format!(
            "UPDATE note_objects SET {} WHERE id = ?",
            col_names.join(", ")
        );
        let mut query = sqlx::query(&sql);

        if let Some(ref t) = cleaned_title {
            query = query.bind(t);
        }
        if let Some(ref c) = params.content {
            query = query.bind(c);
        }
        if let Some(ref s) = tags_str {
            query = query.bind(s);
        }
        query = query.bind(now_ms).bind(&params.note_id);

        let result = query
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to update note: {e}"))?;

        if result.rows_affected() == 0 {
            return Err(format!("Note \"{}\" not found.", params.note_id));
        }

        // Also update the first block content if provided
        if let Some(ref content) = params.content {
            sqlx::query("UPDATE blocks SET content = ?, updated_at = ? WHERE object_id = ? AND parent_id IS NULL LIMIT 1")
                .bind(content).bind(now_ms).bind(&params.note_id)
                .execute(&self.pool).await.ok();
        }

        let title: String = if let Some(ref t) = cleaned_title {
            t.clone()
        } else {
            sqlx::query_scalar("SELECT title FROM note_objects WHERE id = ?")
                .bind(&params.note_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| format!("Failed to get note title: {e}"))?
        };

        Ok(Json(json!({
            "id": params.note_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Note \"{title}\" updated.")
        })))
    }

    /// Delete a note permanently.
    #[tool(
        title = "Delete Note",
        description = "Permanently remove a note and all its blocks from Bento. This action cannot be undone. Returns a confirmation message.",
        annotations(
            read_only_hint = false,
            destructive_hint = true,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn delete_note(
        &self,
        Parameters(params): Parameters<DeleteNoteParams>,
    ) -> Result<Json<Value>, String> {
        sqlx::query("DELETE FROM blocks WHERE object_id = ?")
            .bind(&params.note_id)
            .execute(&self.pool)
            .await
            .ok();

        let title: Option<String> =
            sqlx::query_scalar("SELECT title FROM note_objects WHERE id = ?")
                .bind(&params.note_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| format!("Failed to find note: {e}"))?;

        let title = match title {
            Some(t) => t,
            None => return Err(format!("Note \"{}\" not found.", params.note_id)),
        };

        sqlx::query("DELETE FROM note_objects WHERE id = ?")
            .bind(&params.note_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to delete note: {e}"))?;

        Ok(Json(json!({
            "id": params.note_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Note \"{title}\" deleted.")
        })))
    }

    /// Log a meal entry.
    #[tool(
        title = "Log Meal",
        description = "Record a meal in Bento's nutrition tracker. Accepts meal name, type (breakfast/lunch/dinner/snack), optional calories, and notes. Perfect for food logging. Returns the meal ID.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn log_meal(
        &self,
        Parameters(params): Parameters<LogMealParams>,
    ) -> Result<Json<Value>, String> {
        let cleaned = params.name.trim().to_string();
        if cleaned.is_empty() {
            return Err("Meal name is required.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let meal_type = params.meal_type.unwrap_or_else(|| "meal".to_string());
        let allowed = ["breakfast", "lunch", "dinner", "snack", "meal"];
        if !allowed.contains(&meal_type.as_str()) {
            return Err(
                "meal_type must be 'breakfast', 'lunch', 'dinner', 'snack', or 'meal'.".to_string(),
            );
        }

        sqlx::query(
            "INSERT INTO meals (id, name, meal_type, notes, total_kcal, logged_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&cleaned)
        .bind(&meal_type)
        .bind(&params.notes)
        .bind(params.calories)
        .bind(now_ms)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to log meal: {e}"))?;

        Ok(Json(json!({
            "id": id,
            "name": cleaned,
            "meal_type": meal_type,
            "calories": params.calories,
            "data_coverage": 1.0,
            "message": format!("Meal \"{cleaned}\" logged.")
        })))
    }

    /// Save a note to Bento's Notes app.
    #[tool(
        title = "Save Note",
        description = "Save a new note to Bento's Notes app. Accepts a title, content (plain text or markdown), and optional tags. Creates both the note object and an initial text block. Tags enable organization and search.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn save_note(
        &self,
        Parameters(params): Parameters<SaveNoteParams>,
    ) -> Result<Json<Value>, String> {
        let title = params.title.trim().to_string();
        let content = params.content.trim().to_string();
        if title.is_empty() || content.is_empty() {
            return Err("Both title and content are required.".to_string());
        }

        let object_id = Uuid::new_v4().to_string();
        let block_id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let tags_json = serde_json::to_string(&params.tags.unwrap_or_default())
            .map_err(|e| format!("Failed to serialize tags: {e}"))?;

        let mut conn = self
            .pool
            .acquire()
            .await
            .map_err(|e| format!("Transaction error: {e}"))?;
        // BEGIN IMMEDIATE prevents the read->write upgrade trap where
        // SQLITE_BUSY ignores busy_timeout when a read tx tries to write.
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *conn)
            .await
            .map_err(|e| format!("Transaction error: {e}"))?;

        // Insert into objects table first (blocks FK references objects.id)
        sqlx::query(
            r#"INSERT OR IGNORE INTO objects (id, type, layout, name, icon, is_archived, is_deleted, created_at, updated_at)
               VALUES (?, 'note', 'note', ?, NULL, 0, 0, ?, ?)"#,
        )
        .bind(&object_id)
        .bind(&title)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create object: {e}"))?;

        sqlx::query(
            r#"INSERT INTO note_objects (id, title, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"#,
        )
        .bind(&object_id)
        .bind(&title)
        .bind(&tags_json)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create note object: {e}"))?;

        let block_content = json!({"text": content}).to_string();
        sqlx::query(
            r#"INSERT INTO blocks (id, object_id, type, content, position, created_at, updated_at)
               VALUES (?, ?, 'text', ?, 0, ?, ?)"#,
        )
        .bind(&block_id)
        .bind(&object_id)
        .bind(&block_content)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create note block: {e}"))?;

        sqlx::query("COMMIT")
            .execute(&mut *conn)
            .await
            .map_err(|e| format!("Commit error: {e}"))?;

        Ok(Json(json!({
            "id": object_id,
            "title": title,
            "data_coverage": 1.0,
            "message": format!("Note \"{title}\" saved.")
        })))
    }

    /// Search notes in Bento by keyword.
    #[tool(
        title = "Search Notes",
        description = "Search through all saved notes in Bento by keyword. Matches against both note titles and content body. Returns matching notes with a content excerpt, sorted by most recently updated.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn search_notes(
        &self,
        Parameters(params): Parameters<SearchNotesParams>,
    ) -> Result<Json<Value>, String> {
        let query = params.query.trim().to_string();
        if query.is_empty() {
            return Err("Search query is required.".to_string());
        }

        let max_results = params.limit.unwrap_or(10).max(1).min(100);
        let pattern = format!("%{}%", query);

        let rows = sqlx::query(
            r#"
            SELECT DISTINCT n.id, n.title, b.content, n.updated_at
            FROM note_objects n
            LEFT JOIN blocks b ON b.object_id = n.id
            WHERE n.title LIKE ? OR b.content LIKE ?
            ORDER BY n.updated_at DESC
            LIMIT ?
            "#,
        )
        .bind(&pattern)
        .bind(&pattern)
        .bind(max_results)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to search notes: {e}"))?;

        let notes: Vec<Value> = rows
            .into_iter()
            .map(|row| {
                let content: String = row.try_get("content").unwrap_or_default();
                let excerpt = if content.len() > 100 {
                    format!("{}...", &content[..100])
                } else {
                    content
                };
                let excerpt_clean = serde_json::from_str::<Value>(&excerpt)
                    .ok()
                    .and_then(|v| v["text"].as_str().map(String::from))
                    .unwrap_or(excerpt);

                json!({
                    "id": row.try_get::<String, _>("id").unwrap_or_default(),
                    "title": row.try_get::<String, _>("title").unwrap_or_default(),
                    "excerpt": excerpt_clean,
                    "updatedAt": row.try_get::<i64, _>("updated_at").unwrap_or(0),
                })
            })
            .collect();

        Ok(Json(json!({ "notes": notes, "count": notes.len() })))
    }

    /// Log a completed focus session in Bento.
    #[tool(
        title = "Log Focus Session",
        description = "Log a completed focus or productive session in Bento. Records duration (1-1440 minutes), optional description of what was worked on, and session type (pomodoro/deep/custom). Also returns the total focus minutes logged today so far.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn log_focus_session(
        &self,
        Parameters(params): Parameters<LogFocusSessionParams>,
    ) -> Result<Json<Value>, String> {
        if params.duration_minutes <= 0 || params.duration_minutes > 1440 {
            return Err("Duration must be between 1 and 1440 minutes.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let s_type = params.session_type.as_deref().unwrap_or("custom");
        let desc = params.task_description.as_deref().unwrap_or("");
        let metadata = json!({
            "label": s_type,
            "note": desc,
            "source": "mcp",
        })
        .to_string();

        sqlx::query(
            r#"INSERT INTO health_events (module_id, event_type, value, unit, metadata, started_at, ended_at, logged_at)
               VALUES ('focus', 'focus_session', ?, 'min', ?, ?, ?, ?)"#,
        )
        .bind(params.duration_minutes as f64)
        .bind(&metadata)
        .bind(Some(now_ms - params.duration_minutes * 60_000))
        .bind(Some(now_ms))
        .bind(now_ms)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to log focus session: {e}"))?;

        let start_of_today = time::start_of_today_ms();
        let total_today: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ?",
        )
        .bind(start_of_today)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get today total: {e}"))?;

        Ok(Json(json!({
            "id": id,
            "duration_minutes": params.duration_minutes,
            "session_type": s_type,
            "total_focus_minutes_today": total_today as i64,
            "data_coverage": 1.0,
            "message": format!("Focus session of {} min logged.", params.duration_minutes)
        })))
    }

    /// Log a mood entry in Bento.
    #[tool(
        title = "Log Mood",
        description = "Record a mood entry in Bento's mood tracker. Mood is rated 1-5 (1=very bad, 2=low, 3=steady, 4=good, 5=bright). Can include optional notes and a list of activities. Returns the mood level and human-readable label.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    pub async fn log_mood(
        &self,
        Parameters(params): Parameters<LogMoodParams>,
    ) -> Result<Json<Value>, String> {
        if params.mood < 1 || params.mood > 5 {
            return Err("Mood must be between 1 and 5.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let note = params.note.as_deref().unwrap_or("");
        let activities_json = serde_json::to_string(&params.activities.unwrap_or_default())
            .map_err(|e| format!("Failed to serialize activities: {e}"))?;
        let date_key = time::date_key(now_ms);

        let mood_names = ["", "very-bad", "low", "steady", "good", "bright"];
        let mood_name = if params.mood >= 1 && params.mood <= 5 {
            mood_names[params.mood as usize]
        } else {
            "steady"
        };
        let intensity = (params.mood as f64 / 5.0 * 100.0) as i64;

        sqlx::query(
            r#"INSERT INTO mood_checkins (id, mood, intensity, note, activities, logged_at, date_key)
               VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(mood_name)
        .bind(intensity)
        .bind(note)
        .bind(&activities_json)
        .bind(now_ms)
        .bind(&date_key)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to log mood: {e}"))?;

        Ok(Json(json!({
            "id": id,
            "mood": params.mood,
            "mood_name": mood_name,
            "data_coverage": 1.0,
            "message": format!("Mood level {} ({}) logged.", params.mood, mood_name)
        })))
    }

    /// Write a journal entry in Bento.
    #[tool(
        title = "Create Journal Entry",
        description = "Write or update a daily journal entry in Bento. Uses the current date as the key — calling this again on the same day overwrites the previous entry (upsert). An optional mood rating (1-5) can be logged alongside. Returns word count and date.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn create_journal_entry(
        &self,
        Parameters(params): Parameters<CreateJournalEntryParams>,
    ) -> Result<Json<Value>, String> {
        let content = params.content.trim().to_string();
        if content.is_empty() {
            return Err("Journal content is required.".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let now_ms = time::now_ms();
        let word_count = content.split_whitespace().count() as i64;

        let blocks = json!([{"text": content}]).to_string();

        let mut conn = self
            .pool
            .acquire()
            .await
            .map_err(|e| format!("Transaction error: {e}"))?;
        // BEGIN IMMEDIATE prevents the read->write upgrade trap where
        // SQLITE_BUSY ignores busy_timeout when a read tx tries to write.
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *conn)
            .await
            .map_err(|e| format!("Transaction error: {e}"))?;

        sqlx::query(
            r#"INSERT INTO journal_entries (id, date, blocks, word_count, mood, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(date) DO UPDATE SET
                   blocks = excluded.blocks, word_count = excluded.word_count,
                   mood = excluded.mood, updated_at = excluded.updated_at"#,
        )
        .bind(&id)
        .bind(&today)
        .bind(&blocks)
        .bind(word_count)
        .bind(params.mood.map(|m| m.to_string()))
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create journal entry: {e}"))?;

        if let Some(mood_val) = params.mood {
            let mood_id = Uuid::new_v4().to_string();
            let date_key = time::date_key(now_ms);
            let mood_names = ["", "very-bad", "low", "steady", "good", "bright"];
            let mood_name = if mood_val >= 1 && mood_val <= 5 {
                mood_names[mood_val as usize]
            } else {
                "steady"
            };
            let intensity = (mood_val as f64 / 5.0 * 100.0) as i64;

            sqlx::query(
                r#"INSERT INTO mood_checkins (id, mood, intensity, note, activities, logged_at, date_key)
                   VALUES (?, ?, ?, ?, '[]', ?, ?)"#,
            )
            .bind(&mood_id)
            .bind(mood_name)
            .bind(intensity)
            .bind(format!("Journal entry: {}", &today))
            .bind(now_ms)
            .bind(&date_key)
            .execute(&mut *conn)
            .await
            .map_err(|e| format!("Failed to log mood alongside journal: {e}"))?;
        }

        let tx_result: Result<Json<Value>, String> = async {
            Ok(Json(json!({
                "id": id,
                "date": today,
                "word_count": word_count,
                "data_coverage": 1.0,
                "message": format!("Journal entry written for {today}.")
            })))
        }
        .await;

        match tx_result {
            Ok(val) => {
                sqlx::query("COMMIT")
                    .execute(&mut *conn)
                    .await
                    .map_err(|e| format!("Commit error: {e}"))?;
                Ok(val)
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
                Err(e)
            }
        }
    }

    /// Mark a habit as completed for today.
    #[tool(
        title = "Log Habit Completion",
        description = "Mark a habit as completed for today in Bento. Finds the habit by name (case-insensitive, with fuzzy LIKE matching fallback). If already completed today, returns the current streak without duplicating. Returns the habit name and current streak length.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn log_habit(
        &self,
        Parameters(params): Parameters<LogHabitParams>,
    ) -> Result<Json<Value>, String> {
        let name = params.habit_name.trim().to_lowercase();
        if name.is_empty() {
            return Err("Habit name is required.".to_string());
        }

        let row = sqlx::query("SELECT id, name FROM habits WHERE LOWER(name) = ? LIMIT 1")
            .bind(&name)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("Failed to find habit: {e}"))?;

        let (habit_id, habit_name) = match row {
            Some(r) => (
                r.try_get::<String, _>("id").unwrap_or_default(),
                r.try_get::<String, _>("name")
                    .unwrap_or_else(|_| params.habit_name.clone()),
            ),
            None => {
                let pattern = format!("%{}%", name);
                let fuzzy =
                    sqlx::query("SELECT id, name FROM habits WHERE LOWER(name) LIKE ? LIMIT 1")
                        .bind(&pattern)
                        .fetch_optional(&self.pool)
                        .await
                        .map_err(|e| format!("Failed to search habits: {e}"))?;

                match fuzzy {
                    Some(r) => (
                        r.try_get::<String, _>("id").unwrap_or_default(),
                        r.try_get::<String, _>("name").unwrap_or_else(|_| params.habit_name.clone()),
                    ),
                    None => return Err(format!(
                        "Habit \"{}\" not found. Available habits can be listed with the habits module.",
                        params.habit_name
                    )),
                }
            }
        };

        let now_ms = time::now_ms();
        let start_of_today_ms = time::start_of_today_ms();

        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?",
        )
        .bind(&habit_id)
        .bind(start_of_today_ms)
        .bind(start_of_today_ms + 86_400_000)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to check completion: {e}"))?;

        if existing > 0 {
            let streak = calc_habit_streak(&self.pool, &habit_id, start_of_today_ms).await;
            return Ok(Json(json!({
                "habit_name": habit_name,
                "already_completed_today": true,
                "streak": streak,
                "data_coverage": 1.0,
                "message": format!("\"{habit_name}\" was already completed today. Streak: {streak} days.")
            })));
        }

        sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
            .bind(&habit_id)
            .bind(now_ms)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Failed to log habit completion: {e}"))?;

        let streak = calc_habit_streak(&self.pool, &habit_id, start_of_today_ms).await;

        Ok(Json(json!({
            "habit_name": habit_name,
            "streak": streak,
            "data_coverage": 1.0,
            "message": format!("\"{habit_name}\" completed today! Current streak: {streak} days.")
        })))
    }

    /// Get a summary of the user's day so far.
    #[tool(
        title = "Get Today's Summary",
        description = "Get a comprehensive daily summary from Bento: tasks due and completed today, focus minutes logged, habits completed and remaining, today's mood (if any), and whether a journal entry was written. Use this as a morning briefing or evening review.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_today_summary(
        &self,
        _params: Parameters<EmptyParams>,
    ) -> Result<Json<Value>, String> {
        let start_of_day = time::start_of_today_ms();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

        // Tasks due today
        let tasks_due_rows = sqlx::query(
            "SELECT id, title FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? ORDER BY due_at ASC",
        )
        .bind(start_of_day)
        .bind(start_of_day + 86_400_000)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to query tasks: {e}"))?;

        let tasks_due: Vec<Value> = tasks_due_rows
            .into_iter()
            .map(|row| {
                json!({
                    "id": row.try_get::<String, _>("id").unwrap_or_default(),
                    "title": row.try_get::<String, _>("title").unwrap_or_default(),
                })
            })
            .collect();

        let tasks_completed: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE completed_at >= ?")
                .bind(start_of_day)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| format!("Failed to count completed tasks: {e}"))?;

        let focus_minutes: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ?",
        )
        .bind(start_of_day)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to sum focus minutes: {e}"))?;

        let habit_rows = sqlx::query(
            r#"SELECT DISTINCT h.name FROM habits h
               INNER JOIN habit_completions hc ON hc.habit_id = h.id
               WHERE hc.completed_at >= ? AND hc.completed_at < ?"#,
        )
        .bind(start_of_day)
        .bind(start_of_day + 86_400_000)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to query habits: {e}"))?;

        let habits_completed_names: Vec<String> = habit_rows
            .into_iter()
            .map(|row| row.try_get::<String, _>("name").unwrap_or_default())
            .collect();

        let all_habits: Vec<(String, String)> = sqlx::query("SELECT id, name FROM habits")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| format!("Failed to list habits: {e}"))?
            .into_iter()
            .map(|row| {
                (
                    row.try_get::<String, _>("id").unwrap_or_default(),
                    row.try_get::<String, _>("name").unwrap_or_default(),
                )
            })
            .collect();

        let mut habits_remaining = Vec::new();
        for (hid, hname) in &all_habits {
            let done: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?",
            )
            .bind(hid)
            .bind(start_of_day)
            .bind(start_of_day + 86_400_000)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

            if done == 0 {
                habits_remaining.push(json!({"id": hid, "name": hname}));
            }
        }

        let date_key = time::date_key(start_of_day);
        let mood_today: Option<Value> = sqlx::query(
            "SELECT mood, intensity, note FROM mood_checkins WHERE date_key = ? ORDER BY logged_at DESC LIMIT 1",
        )
        .bind(&date_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("Failed to query mood: {e}"))?
        .map(|row| {
            json!({
                "mood": row.try_get::<String, _>("mood").unwrap_or_default(),
                "intensity": row.try_get::<i64, _>("intensity").unwrap_or(0),
                "note": row.try_get::<Option<String>, _>("note").ok().flatten().unwrap_or_default(),
            })
        });

        let journal_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE date = ?")
                .bind(&today)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| format!("Failed to check journal: {e}"))?;

        Ok(Json(json!({
            "tasksDueToday": { "count": tasks_due.len(), "tasks": tasks_due },
            "tasksCompletedToday": tasks_completed,
            "focusMinutesToday": focus_minutes as i64,
            "habitsCompletedToday": { "count": habits_completed_names.len(), "names": habits_completed_names },
            "habitsRemainingToday": { "count": habits_remaining.len(), "habits": habits_remaining },
            "moodToday": mood_today,
            "journalWrittenToday": journal_count > 0,
        })))
    }

    // ═════════════════════════════════════════════════════════════════════════
    // INTELLIGENCE TOOLS
    // ═════════════════════════════════════════════════════════════════════════

    /// Get a unified snapshot of the user right now across all modules.
    #[tool(
        title = "Get Life Context",
        description = "Returns a unified snapshot of the user RIGHT NOW across all Bento modules: mood, energy, focus, sleep, tasks, habits, nutrition, journal, goals, budget, and cognitive load. Used by external AI tools to personalize instantly. Depth options: minimal (quick pulse), standard (full context), full (everything).",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_life_context(
        &self,
        Parameters(params): Parameters<LifeContextParams>,
    ) -> Result<Json<Value>, String> {
        let depth = params.depth.as_deref().unwrap_or("standard");
        let result = crate::mcp::intelligence::get_life_context_impl(&self.pool, depth).await?;
        Ok(Json(result))
    }

    /// Run statistical correlation between any two module metrics.
    #[tool(
        title = "Get Cross-Module Correlations",
        description = "Runs Pearson correlation analysis across any two Bento module metrics (sleep_hours, mood_score, focus_minutes, calories, spending_amount, tasks_completed, habit_completion_rate, energy_score) over a configurable time window (7-180 days). Returns correlation coefficient, strength, direction, top correlated days, and anomalies where both metrics deviated significantly.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_cross_module_correlations(
        &self,
        Parameters(params): Parameters<CorrelationParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_cross_module_correlations_impl(
            &self.pool,
            &params.metric_a,
            &params.metric_b,
            params.window_days.unwrap_or(30),
            params.granularity.as_deref().unwrap_or("day"),
        )
        .await?;
        Ok(Json(result))
    }

    /// Full-resolution portrait of any past date.
    #[tool(
        title = "Get Day Reconstruction",
        description = "Returns a complete portrait of any past date (YYYY-MM-DD): mood, sleep, nutrition, focus sessions, tasks (completed/created/overdue), habits (done/missed), journal entry, budget transactions, notes created, goal events, and an auto-generated narrative summary of the day. Time Archaeology for Bento.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_day_reconstruction(
        &self,
        Parameters(params): Parameters<DayReconstructionParams>,
    ) -> Result<Json<Value>, String> {
        let result =
            crate::mcp::intelligence::get_day_reconstruction_impl(&self.pool, &params.date).await?;
        Ok(Json(result))
    }

    /// Compare the user across two time periods.
    #[tool(
        title = "Get Life Delta",
        description = "Compares the user across two time periods across every dimension: sleep quality, mood, focus, habit consistency, tasks completed per day, and average spending. Returns deltas, direction (improved/declined/unchanged), significance, biggest improvement, biggest decline, and overall trajectory. The 'who were you vs who are you' tool.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_life_delta(
        &self,
        Parameters(params): Parameters<LifeDeltaParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_life_delta_impl(
            &self.pool,
            &params.period_a_start,
            &params.period_a_end,
            &params.period_b_start,
            &params.period_b_end,
        )
        .await?;
        Ok(Json(result))
    }

    /// Find peak cognitive performance windows.
    #[tool(
        title = "Get Cognitive Schedule",
        description = "Analyzes historical focus session and mood data to find your actual peak performance windows by day-of-week and hour. Returns top 3 peak windows (schedule deep work here), bottom 3 avoid windows (routine tasks only), best/worst day of the week, and a personalized insight. The Anti-Calendar / Energy Arbitrage tool.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_cognitive_schedule(
        &self,
        Parameters(params): Parameters<CognitiveScheduleParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_cognitive_schedule_impl(
            &self.pool,
            params.window_days.unwrap_or(30),
        )
        .await?;
        Ok(Json(result))
    }

    /// Create a structured accountability contract.
    #[tool(
        title = "Create Commitment Bond",
        description = "Creates a structured accountability contract stored in Bento's database. Links to an optional goal. Contains a deadline, success metric, user-defined consequence, and check-in frequency. The agent can check in periodically and update the bond's status. Returns the bond ID and creation timestamp."
    )]
    pub async fn create_commitment_bond(
        &self,
        Parameters(params): Parameters<CreateBondParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::create_commitment_bond_impl(
            &self.pool,
            &params.title,
            params.goal_id.as_deref(),
            &params.deadline,
            &params.success_metric,
            &params.consequence,
            params.check_in_days.unwrap_or(7),
        )
        .await?;
        Ok(Json(result))
    }

    /// List commitment bonds.
    #[tool(
        title = "Get Commitment Bonds",
        description = "Retrieve commitment bonds from Bento, optionally filtered by status (active/kept/broken/extended). Returns bond details including title, linked goal ID, deadline, success metric, consequence, check-in history, and current status.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_commitment_bonds(
        &self,
        Parameters(params): Parameters<GetBondsParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_commitment_bonds_impl(
            &self.pool,
            params.status.as_deref(),
        )
        .await?;
        Ok(Json(result))
    }

    /// Update a commitment bond's status.
    #[tool(
        title = "Update Bond Status",
        description = "Update the status of a commitment bond (active/kept/broken/extended). Optionally append a check-in note to the bond's history log. The agent uses this to report on bond progress."
    )]
    pub async fn update_bond_status(
        &self,
        Parameters(params): Parameters<UpdateBondParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::update_bond_status_impl(
            &self.pool,
            &params.bond_id,
            &params.status,
            params.check_in_note.as_deref(),
        )
        .await?;
        Ok(Json(result))
    }

    /// Analyze failure patterns across modules.
    #[tool(
        title = "Get Failure Patterns",
        description = "Analyzes abandoned goals, broken habit streaks, and chronically overdue tasks to extract the user's personal failure signatures. Returns common patterns with trigger signals, average time to failure, early warning signs, and actionable recommendations. Statistical analysis — no ML required.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_failure_patterns(
        &self,
        Parameters(params): Parameters<FailurePatternsParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_failure_patterns_impl(
            &self.pool,
            params.min_data_points.unwrap_or(3),
        )
        .await?;
        Ok(Json(result))
    }

    /// Generate a weekly board report.
    #[tool(
        title = "Generate Weekly Board Report",
        description = "Assembles a formal board-meeting-style weekly review across every Bento module: tasks, habits, focus, budget, mood, sleep, and goals. Returns KPIs with green/yellow/red status (compared to prior week), wins, risks, decisions needed, next-week forecast, and detailed per-module data. The tool that entrepreneurs run every Sunday.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn generate_weekly_board_report(
        &self,
        Parameters(params): Parameters<WeeklyReportParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::generate_weekly_board_report_impl(
            &self.pool,
            params.week_offset.unwrap_or(0),
        )
        .await?;
        Ok(Json(result))
    }

    /// Project self trajectory using compound models.
    #[tool(
        title = "Get Compound Self Projection",
        description = "Projects the user's current trajectory forward using linear regression on focus minutes, mood, sleep, savings, and task completion rate over the last 30 days. Returns projected values at N days (90/180/365), inflection points, a headline, and the biggest leverage point. 'If you maintain your current habits, here's who you'll be.'",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_compound_self_projection(
        &self,
        Parameters(params): Parameters<SelfProjectionParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_compound_self_projection_impl(
            &self.pool,
            params.projection_days.unwrap_or(90),
        )
        .await?;
        Ok(Json(result))
    }

    /// Write an auto-generated ambient journal entry.
    #[tool(
        title = "Write Ambient Journal Entry",
        description = "Silently generates a narrative journal entry from the day's raw Bento data using a deterministic prose template engine (no LLM required). Stores the result in the journal table. Supports terse, narrative, and analytical styles. The ghost biographer — runs automatically at day's end if the user hasn't journaled."
    )]
    pub async fn write_ambient_journal_entry(
        &self,
        Parameters(params): Parameters<AmbientJournalParams>,
    ) -> Result<Json<Value>, String> {
        let date = params
            .date
            .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
        let style = params.style.as_deref().unwrap_or("narrative");
        let result =
            crate::mcp::intelligence::write_ambient_journal_entry_impl(&self.pool, &date, style)
                .await?;
        Ok(Json(result))
    }

    /// Correlate meals with subsequent mood and focus.
    #[tool(
        title = "Get Meal Mood Correlations",
        description = "Time-lagged correlation analysis: what you eat leads to how you feel and focus. Aligns each meal (by name and type) with mood and focus entries logged within the configurable hours after eating. Returns ranked foods by subsequent wellness impact. The 'breakfast determines your day' statistical validator.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_meal_mood_correlations(
        &self,
        Parameters(params): Parameters<MealMoodParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_meal_mood_correlations_impl(
            &self.pool,
            params.window_days.unwrap_or(30),
            params.lag_hours.unwrap_or(4),
        )
        .await?;
        Ok(Json(result))
    }

    /// Measure integrity alignment between stated values and actual actions.
    #[tool(
        title = "Get Integrity Score",
        description = "Scans journal entries for stated values (discipline, health, growth, financial, focus, connection), then cross-references against actual actions: tasks completed, habits done, focus minutes, savings rate. Returns per-domain alignment scores and an overall integrity percentage. The mirror you can't look away from.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_integrity_score(
        &self,
        Parameters(params): Parameters<IntegrityScoreParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_integrity_score_impl(
            &self.pool,
            params.window_days.unwrap_or(30),
        )
        .await?;
        Ok(Json(result))
    }

    /// Analyze cognitive portfolio — strategic vs reactive attention allocation.
    #[tool(
        title = "Get Attention Allocation",
        description = "Categorizes every task and focus session into strategic (long-term projects, goals, roadmaps) or reactive (inbox, bugs, fixes, admin, urgent). Returns the % breakdown and a rebalancing recommendation. Treats your attention like a financial portfolio — most people find they're 80% reactive.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_attention_allocation(
        &self,
        Parameters(params): Parameters<AttentionAllocationParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_attention_allocation_impl(
            &self.pool,
            params.window_days.unwrap_or(30),
        )
        .await?;
        Ok(Json(result))
    }

    /// Generate an optimized sprint plan from historical data.
    #[tool(
        title = "Generate Sprint Plan",
        description = "Uses your actual historical task velocity (tasks/day by day-of-week over the last N days), pending backlog size, and priority distribution to generate an evidence-based sprint commitment. Returns recommended capacity, best/worst days for deep work, and a plain-language recommendation. 'Your data says commit to 6, not 11.'",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn generate_sprint_plan(
        &self,
        Parameters(params): Parameters<SprintPlanParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::generate_sprint_plan_impl(
            &self.pool,
            params.sprint_days.unwrap_or(14),
        )
        .await?;
        Ok(Json(result))
    }

    /// Auto-schedule tasks into proven energy windows.
    #[tool(
        title = "Auto Schedule Tasks",
        description = "Maps every pending task (sorted by priority) to your historically proven peak energy windows. Hard tasks go to peak windows, easy tasks to avoid windows. Returns a day-by-day, hour-by-hour schedule. Replaces time-blocking apps entirely — your calendar, but calibrated to your actual biology.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn auto_schedule_tasks(
        &self,
        Parameters(_params): Parameters<AutoScheduleParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::auto_schedule_tasks_impl(&self.pool).await?;
        Ok(Json(result))
    }

    /// Measure learning velocity from tagged notes.
    #[tool(
        title = "Get Skill Velocity",
        description = "Analyzes every note tagged with learning keywords (learning, study, course, skill, book, tutorial) and measures your knowledge acquisition rate over time. Returns monthly note production, total words written, velocity trend (accelerating/steady/declining), and top skill domains. Knowledge compounding, made visible.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_skill_velocity(
        &self,
        Parameters(params): Parameters<SkillVelocityParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_skill_velocity_impl(
            &self.pool,
            params.window_days.unwrap_or(90),
        )
        .await?;
        Ok(Json(result))
    }

    /// Generate a standup summary from yesterday's data.
    #[tool(
        title = "Generate Standup",
        description = "Compiles yesterday's completed tasks, focus sessions (with count), notes, habits, and mood into a formatted daily standup summary. Also shows today's progress and high-priority tasks in progress. Returns human-readable prose plus structured data — perfect for standup automation.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn generate_standup(
        &self,
        Parameters(_params): Parameters<EmptyParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::generate_standup_impl(&self.pool).await?;
        Ok(Json(result))
    }

    /// Save a developer preference for persistent agent context.
    #[tool(
        title = "Save Agent Context",
        description = "Stores a key-value developer preference (e.g. 'preferred_language', 'code_review_style', 'project_convention') as persistent agent memory. Future tool calls can retrieve this context via get_agent_context. Data persists across sessions via tagged notes."
    )]
    pub async fn save_agent_context(
        &self,
        Parameters(params): Parameters<SaveAgentContextParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::save_agent_context_impl(
            &self.pool,
            &params.key,
            &params.value,
        )
        .await?;
        Ok(Json(result))
    }

    /// Retrieve stored developer preferences / agent context.
    #[tool(
        title = "Get Agent Context",
        description = "Retrieves all stored developer preferences (key-value pairs) previously saved via save_agent_context. Optionally filter by a specific key. Returns persistent agent memory about coding preferences, project context, and workflow conventions.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_agent_context(
        &self,
        Parameters(params): Parameters<GetAgentContextParams>,
    ) -> Result<Json<Value>, String> {
        let result =
            crate::mcp::intelligence::get_agent_context_impl(&self.pool, params.key.as_deref())
                .await?;
        Ok(Json(result))
    }

    /// Assess burnout risk from cognitive load, sleep, mood, and focus data.
    #[tool(
        title = "Get Burnout Risk",
        description = "Analyzes your cognitive load trend, sleep debt, mood trajectory, focus consistency, and task accumulation over the last 14 days. Returns a risk level (low/mild/moderate/high), risk score, list of detected signals, and an actionable alert message. Early warning for sustainable pacing.",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    pub async fn get_burnout_risk(
        &self,
        Parameters(_params): Parameters<EmptyParams>,
    ) -> Result<Json<Value>, String> {
        let result = crate::mcp::intelligence::get_burnout_risk_impl(&self.pool).await?;
        Ok(Json(result))
    }
}

// ---------------------------------------------------------------------------
// ServerHandler implementation
// ---------------------------------------------------------------------------

#[tool_handler(
    name = "bento",
    instructions = "MCP tools for the user's personal life-OS. Fully bidirectional — read AND write across all modules.

START → get_life_context (unified snapshot).

TASKS → create_task, update_task, complete_task, undo_task, delete_task, get_tasks.

NOTES → save_note, update_note, delete_note, search_notes.

HABITS → create_habit, update_habit, delete_habit, log_habit_completion.

MOOD → log_mood. FOCUS → log_focus_session. SLEEP → log_sleep (upserts). MEALS → log_meal.

JOURNAL → create_journal_entry, write_ambient_journal_entry (terse/narrative/analytical).

DAILY → get_today_summary.

COMMITMENTS → create_commitment_bond, get_commitment_bonds, update_bond_status.

LIFE INTELLIGENCE → get_day_reconstruction, get_life_delta, get_cross_module_correlations (Pearson r), generate_weekly_board_report (KPI green/yellow/red), get_failure_patterns, get_compound_self_projection, get_cognitive_schedule, get_meal_mood_correlations, get_integrity_score, get_attention_allocation, generate_sprint_plan, auto_schedule_tasks, get_skill_velocity.

CODING AGENT → generate_standup, save_agent_context / get_agent_context, get_burnout_risk.

All timestamps in epoch ms. Empty states return partial data — never error."
)]
impl ServerHandler for BentoMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn calc_habit_streak(pool: &SqlitePool, habit_id: &str, start_of_today: i64) -> i64 {
    let day_nums: Vec<i64> = sqlx::query_scalar(
        "SELECT DISTINCT CAST(completed_at / 86400000 AS INTEGER) FROM habit_completions WHERE habit_id = ? AND completed_at > 0 ORDER BY completed_at DESC",
    )
    .bind(habit_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if day_nums.is_empty() {
        return 1;
    }

    let today_day = start_of_today / 86_400_000;
    let mut streak = 0i64;

    let latest = day_nums[0];
    if latest < today_day - 1 {
        return 0;
    }

    for (i, day) in day_nums.iter().enumerate() {
        if i == 0 {
            streak = 1;
            continue;
        }
        if day_nums[i - 1] - day == 1 {
            streak += 1;
        } else {
            break;
        }
    }

    streak
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};

    /// Extract a human-readable error message.
    /// Works for both `String` and `Json<Value>` (which lacks `Debug`).
    fn to_display(err: impl std::fmt::Display) -> String {
        err.to_string()
    }

    async fn create_test_pool() -> SqlitePool {
        let opts = SqliteConnectOptions::new()
            .filename(":memory:")
            .journal_mode(SqliteJournalMode::Memory)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .expect("Failed to create in-memory SQLite pool");

        let migrations = [
            r#"CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                project TEXT NOT NULL DEFAULT 'inbox',
                tags TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                due_at INTEGER,
                due_time TEXT,
                start_at INTEGER,
                estimated_minutes INTEGER,
                tracked_minutes INTEGER NOT NULL DEFAULT 0,
                recurrence_rule TEXT,
                archived INTEGER NOT NULL DEFAULT 0,
                sort_order REAL NOT NULL DEFAULT 0,
                parent_id TEXT,
                completed_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS note_objects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                icon TEXT,
                cover TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                layout TEXT NOT NULL DEFAULT 'note',
                is_archived INTEGER NOT NULL DEFAULT 0,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS blocks (
                id TEXT PRIMARY KEY,
                object_id TEXT NOT NULL,
                parent_id TEXT,
                type TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '{}',
                fields TEXT NOT NULL DEFAULT '{}',
                align INTEGER NOT NULL DEFAULT 0,
                bg_color TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS health_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                value REAL,
                unit TEXT,
                metadata TEXT NOT NULL DEFAULT '{}',
                started_at INTEGER,
                ended_at INTEGER,
                logged_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS mood_checkins (
                id TEXT PRIMARY KEY,
                mood TEXT NOT NULL,
                intensity INTEGER NOT NULL DEFAULT 0,
                note TEXT,
                activities TEXT NOT NULL DEFAULT '[]',
                logged_at INTEGER NOT NULL,
                date_key TEXT NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL UNIQUE,
                blocks TEXT NOT NULL DEFAULT '[]',
                word_count INTEGER DEFAULT 0,
                mood TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                frequency TEXT NOT NULL DEFAULT 'daily',
                created_at INTEGER NOT NULL
            )"#,
            r#"CREATE TABLE IF NOT EXISTS habit_completions (
                habit_id TEXT NOT NULL,
                completed_at INTEGER NOT NULL,
                PRIMARY KEY (habit_id, completed_at),
                FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
            )"#,
        ];

        for m in migrations {
            sqlx::query(m)
                .execute(&pool)
                .await
                .expect("Failed to run test migration");
        }

        pool
    }

    async fn insert_task(
        pool: &SqlitePool,
        id: &str,
        title: &str,
        done: bool,
        priority: &str,
        project: &str,
        due_at: Option<i64>,
        completed_at: Option<i64>,
        created_at: i64,
    ) {
        sqlx::query(
            r#"INSERT INTO tasks (id, title, done, priority, project, due_at, completed_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(id)
        .bind(title)
        .bind(done as i64)
        .bind(priority)
        .bind(project)
        .bind(due_at)
        .bind(completed_at)
        .bind(created_at)
        .bind(created_at)
        .execute(pool)
        .await
        .expect("Failed to insert test task");
    }

    async fn insert_habit(pool: &SqlitePool, id: &str, name: &str) {
        let now = time::now_ms();
        sqlx::query("INSERT INTO habits (id, name, created_at) VALUES (?, ?, ?)")
            .bind(id)
            .bind(name)
            .bind(now)
            .execute(pool)
            .await
            .expect("Failed to insert test habit");
    }

    // ── create_task ────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_create_task_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .create_task(Parameters(CreateTaskParams {
                title: "Buy groceries".to_string(),
                due_at: None,
                priority: None,
                project: None,
            }))
            .await
            .expect("create_task should succeed");

        assert_eq!(result.0["title"], "Buy groceries");
        assert!(result.0["id"].as_str().unwrap().len() > 10);
        assert!(result.0["message"]
            .as_str()
            .unwrap()
            .contains("Buy groceries"));
    }

    #[tokio::test]
    async fn test_create_task_with_all_fields() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .create_task(Parameters(CreateTaskParams {
                title: "  Pay bills  ".to_string(),
                due_at: Some("2025-12-31T23:59:00Z".to_string()),
                priority: Some("high".to_string()),
                project: Some("Personal".to_string()),
            }))
            .await
            .expect("create_task should succeed");

        assert_eq!(result.0["title"], "Pay bills");
        assert!(result.0["message"].as_str().unwrap().contains("Pay bills"));
    }

    #[tokio::test]
    async fn test_create_task_empty_title() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .create_task(Parameters(CreateTaskParams {
                title: "   ".to_string(),
                due_at: None,
                priority: None,
                project: None,
            }))
            .await
            .err()
            .expect("empty title should fail");
        let err = to_display(err);
        assert!(err.contains("Task title is required"));
    }

    // ── get_tasks ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_tasks_default_pending() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool,
            "t1",
            "Task 1",
            false,
            "high",
            "work",
            Some(now + 86400_000),
            None,
            now,
        )
        .await;
        insert_task(
            &pool,
            "t2",
            "Task 2",
            true,
            "low",
            "personal",
            None,
            Some(now),
            now,
        )
        .await;
        insert_task(
            &pool, "t3", "Task 3", false, "medium", "inbox", None, None, now,
        )
        .await;

        let result = server
            .get_tasks(Parameters(GetTasksParams {
                status: None,
                due_before: None,
                project: None,
                limit: None,
            }))
            .await
            .expect("get_tasks should succeed");

        let tasks = result.0["tasks"].as_array().unwrap();
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0]["title"], "Task 3");
        assert_eq!(tasks[1]["title"], "Task 1");
        assert_eq!(tasks[0]["status"], "pending");
        assert_eq!(tasks[1]["status"], "pending");
    }

    #[tokio::test]
    async fn test_get_tasks_all() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool, "t1", "Task 1", false, "high", "work", None, None, now,
        )
        .await;
        insert_task(
            &pool,
            "t2",
            "Task 2",
            true,
            "low",
            "inbox",
            None,
            Some(now),
            now,
        )
        .await;

        let result = server
            .get_tasks(Parameters(GetTasksParams {
                status: Some("all".to_string()),
                due_before: None,
                project: None,
                limit: None,
            }))
            .await
            .expect("get_tasks should succeed");

        assert_eq!(result.0["tasks"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_get_tasks_completed() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool,
            "t1",
            "Done task",
            true,
            "medium",
            "inbox",
            None,
            Some(now),
            now,
        )
        .await;
        insert_task(
            &pool,
            "t2",
            "Pending task",
            false,
            "low",
            "inbox",
            None,
            None,
            now,
        )
        .await;

        let result = server
            .get_tasks(Parameters(GetTasksParams {
                status: Some("completed".to_string()),
                due_before: None,
                project: None,
                limit: None,
            }))
            .await
            .expect("get_tasks should succeed");

        let tasks = result.0["tasks"].as_array().unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0]["title"], "Done task");
        assert_eq!(tasks[0]["status"], "completed");
    }

    #[tokio::test]
    async fn test_get_tasks_filter_by_project() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool,
            "t1",
            "Work task",
            false,
            "high",
            "work",
            None,
            None,
            now,
        )
        .await;
        insert_task(
            &pool,
            "t2",
            "Personal task",
            false,
            "low",
            "personal",
            None,
            None,
            now,
        )
        .await;
        insert_task(
            &pool,
            "t3",
            "Another work",
            false,
            "medium",
            "work",
            None,
            None,
            now,
        )
        .await;

        let result = server
            .get_tasks(Parameters(GetTasksParams {
                status: Some("all".to_string()),
                due_before: None,
                project: Some("work".to_string()),
                limit: None,
            }))
            .await
            .expect("get_tasks should succeed");

        let tasks = result.0["tasks"].as_array().unwrap();
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t["project"] == "work"));
    }

    #[tokio::test]
    async fn test_get_tasks_filter_by_due_before() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        let early = now - 86400_000;
        let late = now + 86400_000;
        insert_task(
            &pool,
            "t1",
            "Early task",
            false,
            "medium",
            "inbox",
            Some(early),
            None,
            now,
        )
        .await;
        insert_task(
            &pool,
            "t2",
            "Late task",
            false,
            "medium",
            "inbox",
            Some(late),
            None,
            now,
        )
        .await;
        insert_task(
            &pool, "t3", "No due", false, "low", "inbox", None, None, now,
        )
        .await;

        let result = server
            .get_tasks(Parameters(GetTasksParams {
                status: Some("all".to_string()),
                due_before: Some(time::format_rfc3339(now)),
                project: None,
                limit: None,
            }))
            .await
            .expect("get_tasks should succeed");

        let tasks = result.0["tasks"].as_array().unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0]["title"], "Early task");
    }

    // ── complete_task ──────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_complete_task() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool,
            "t1",
            "Do laundry",
            false,
            "medium",
            "inbox",
            None,
            None,
            now,
        )
        .await;

        let result = server
            .complete_task(Parameters(CompleteTaskParams {
                task_id: "t1".to_string(),
            }))
            .await
            .expect("complete_task should succeed");

        assert_eq!(result.0["title"], "Do laundry");

        let done: i64 = sqlx::query_scalar("SELECT done FROM tasks WHERE id = ?")
            .bind("t1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(done, 1);
    }

    #[tokio::test]
    async fn test_complete_task_already_done() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        insert_task(
            &pool,
            "t1",
            "Done task",
            true,
            "low",
            "inbox",
            None,
            Some(now),
            now,
        )
        .await;

        let err = server
            .complete_task(Parameters(CompleteTaskParams {
                task_id: "t1".to_string(),
            }))
            .await
            .err()
            .expect("already completed should fail");
        let err = to_display(err);
        assert!(err.contains("not found or already completed"));
    }

    #[tokio::test]
    async fn test_complete_task_not_found() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .complete_task(Parameters(CompleteTaskParams {
                task_id: "nonexistent".to_string(),
            }))
            .await
            .err()
            .expect("not found should fail");
        let err = to_display(err);
        assert!(err.contains("not found or already completed"));
    }

    // ── save_note ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_save_note_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let result = server
            .save_note(Parameters(SaveNoteParams {
                title: "Meeting notes".to_string(),
                content: "Discussed Q1 goals and timeline.".to_string(),
                tags: None,
            }))
            .await
            .expect("save_note should succeed");

        assert_eq!(result.0["title"], "Meeting notes");

        let id = result.0["id"].as_str().unwrap();
        let title: String = sqlx::query_scalar("SELECT title FROM note_objects WHERE id = ?")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(title, "Meeting notes");
    }

    #[tokio::test]
    async fn test_save_note_with_tags() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let result = server
            .save_note(Parameters(SaveNoteParams {
                title: "Shopping list".to_string(),
                content: "Milk, eggs, bread".to_string(),
                tags: Some(vec!["shopping".to_string(), "urgent".to_string()]),
            }))
            .await
            .expect("save_note should succeed");

        assert_eq!(result.0["title"], "Shopping list");

        let id = result.0["id"].as_str().unwrap();
        let tags: String = sqlx::query_scalar("SELECT tags FROM note_objects WHERE id = ?")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        let parsed: Vec<String> = serde_json::from_str(&tags).unwrap();
        assert_eq!(parsed.len(), 2);
        assert!(parsed.contains(&"shopping".to_string()));
    }

    #[tokio::test]
    async fn test_save_note_empty_content() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .save_note(Parameters(SaveNoteParams {
                title: "Empty".to_string(),
                content: "   ".to_string(),
                tags: None,
            }))
            .await
            .err()
            .expect("empty content should fail");
        let err = to_display(err);
        assert!(err.contains("Both title and content"));
    }

    // ── search_notes ───────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_search_notes_by_title() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        server
            .save_note(Parameters(SaveNoteParams {
                title: "Project Alpha".to_string(),
                content: "Initial planning document for Project Alpha.".to_string(),
                tags: None,
            }))
            .await
            .unwrap();

        server
            .save_note(Parameters(SaveNoteParams {
                title: "Random ideas".to_string(),
                content: "Some random thoughts.".to_string(),
                tags: None,
            }))
            .await
            .unwrap();

        let result = server
            .search_notes(Parameters(SearchNotesParams {
                query: "Alpha".to_string(),
                limit: None,
            }))
            .await
            .expect("search_notes should succeed");

        let notes = result.0["notes"].as_array().unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0]["title"], "Project Alpha");
    }

    #[tokio::test]
    async fn test_search_notes_no_results() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .search_notes(Parameters(SearchNotesParams {
                query: "nonexistent".to_string(),
                limit: None,
            }))
            .await
            .expect("search_notes should succeed even with no matches");

        assert!(result.0["notes"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_search_notes_empty_query() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .search_notes(Parameters(SearchNotesParams {
                query: "   ".to_string(),
                limit: None,
            }))
            .await
            .err()
            .expect("empty query should fail");
        let err = to_display(err);
        assert!(err.contains("Search query is required"));
    }

    // ── log_focus_session ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_log_focus_session_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .log_focus_session(Parameters(LogFocusSessionParams {
                duration_minutes: 25,
                task_description: None,
                session_type: None,
            }))
            .await
            .expect("log_focus_session should succeed");

        assert_eq!(result.0["duration_minutes"], 25);
        assert_eq!(result.0["session_type"], "custom");
        assert!(result.0["total_focus_minutes_today"].as_i64().unwrap() >= 25);
    }

    #[tokio::test]
    async fn test_log_focus_session_pomodoro() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .log_focus_session(Parameters(LogFocusSessionParams {
                duration_minutes: 25,
                task_description: Some("Code review".to_string()),
                session_type: Some("pomodoro".to_string()),
            }))
            .await
            .expect("log_focus_session should succeed");

        assert_eq!(result.0["session_type"], "pomodoro");
    }

    #[tokio::test]
    async fn test_log_focus_session_invalid_duration() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .log_focus_session(Parameters(LogFocusSessionParams {
                duration_minutes: 0,
                task_description: None,
                session_type: None,
            }))
            .await
            .err()
            .expect("zero duration should fail");
        let err = to_display(err);
        assert!(err.contains("Duration must be between"));

        let err2 = server
            .log_focus_session(Parameters(LogFocusSessionParams {
                duration_minutes: 9999,
                task_description: None,
                session_type: None,
            }))
            .await
            .err()
            .expect("too-large duration should fail");
        let err2 = to_display(err2);
        assert!(err2.contains("Duration must be between"));
    }

    // ── log_mood ───────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_log_mood_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .log_mood(Parameters(LogMoodParams {
                mood: 4,
                note: None,
                activities: None,
            }))
            .await
            .expect("log_mood should succeed");

        assert_eq!(result.0["mood"], 4);
        assert_eq!(result.0["mood_name"], "good");
    }

    #[tokio::test]
    async fn test_log_mood_with_note_and_activities() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .log_mood(Parameters(LogMoodParams {
                mood: 5,
                note: Some("Great day!".to_string()),
                activities: Some(vec!["exercise".to_string(), "reading".to_string()]),
            }))
            .await
            .expect("log_mood should succeed");

        assert_eq!(result.0["mood"], 5);
        assert_eq!(result.0["mood_name"], "bright");
    }

    #[tokio::test]
    async fn test_log_mood_invalid() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .log_mood(Parameters(LogMoodParams {
                mood: 0,
                note: None,
                activities: None,
            }))
            .await
            .err()
            .expect("mood 0 should fail");
        let err = to_display(err);
        assert!(err.contains("Mood must be between"));

        let err2 = server
            .log_mood(Parameters(LogMoodParams {
                mood: 6,
                note: None,
                activities: None,
            }))
            .await
            .err()
            .expect("mood 6 should fail");
        let err2 = to_display(err2);
        assert!(err2.contains("Mood must be between"));
    }

    // ── create_journal_entry ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_create_journal_entry_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .create_journal_entry(Parameters(CreateJournalEntryParams {
                content: "Today was a productive day.".to_string(),
                mood: None,
            }))
            .await
            .expect("create_journal_entry should succeed");

        assert!(result.0["date"].as_str().unwrap().len() == 10);
        assert_eq!(result.0["word_count"], 5);
    }

    #[tokio::test]
    async fn test_create_journal_entry_with_mood() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let result = server
            .create_journal_entry(Parameters(CreateJournalEntryParams {
                content: "Had a great day at the park.".to_string(),
                mood: Some(5),
            }))
            .await
            .expect("create_journal_entry should succeed");

        assert!(result.0.get("mood").is_none());
        assert_eq!(result.0["word_count"], 6);

        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let mood_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM mood_checkins WHERE note LIKE ? AND date_key = ?",
        )
        .bind(format!("%Journal entry: {}", today))
        .bind(&today)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(mood_count, 1);
    }

    #[tokio::test]
    async fn test_create_journal_entry_empty_content() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .create_journal_entry(Parameters(CreateJournalEntryParams {
                content: "   ".to_string(),
                mood: None,
            }))
            .await
            .err()
            .expect("empty content should fail");
        let err = to_display(err);
        assert!(err.contains("Journal content is required"));
    }

    // ── log_habit ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_log_habit_basic() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        insert_habit(&pool, "h1", "Morning run").await;

        let result = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "Morning run".to_string(),
            }))
            .await
            .expect("log_habit should succeed");

        assert_eq!(result.0["habit_name"], "Morning run");
        assert!(result.0["streak"].as_i64().unwrap() >= 1);
    }

    #[tokio::test]
    async fn test_log_habit_case_insensitive() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        insert_habit(&pool, "h1", "Morning Run").await;

        let result = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "morning run".to_string(),
            }))
            .await
            .expect("log_habit should match case-insensitively");

        assert_eq!(result.0["habit_name"], "Morning Run");
    }

    #[tokio::test]
    async fn test_log_habit_already_completed() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        insert_habit(&pool, "h1", "Meditate").await;
        let now = time::now_ms();
        sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
            .bind("h1")
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();

        let result = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "Meditate".to_string(),
            }))
            .await
            .expect("log_habit should handle already completed");

        assert!(result.0["already_completed_today"].as_bool().unwrap());
    }

    #[tokio::test]
    async fn test_log_habit_not_found() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let err = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "Nonexistent habit".to_string(),
            }))
            .await
            .err()
            .expect("nonexistent habit should fail");
        let err = to_display(err);
        assert!(err.contains("not found"));
    }

    #[tokio::test]
    async fn test_log_habit_fuzzy_match() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        insert_habit(&pool, "h1", "Daily Reading").await;

        let err = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "Typing".to_string(),
            }))
            .await
            .err()
            .expect("non-matching name should fail");
        let err = to_display(err);
        assert!(err.contains("not found"));

        let result = server
            .log_habit(Parameters(LogHabitParams {
                habit_name: "Read".to_string(),
            }))
            .await
            .expect("Read should fuzzy-match Daily Reading");

        assert_eq!(result.0["habit_name"], "Daily Reading");
    }

    // ── get_today_summary ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_today_summary_empty() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool };

        let result = server
            .get_today_summary(Parameters(EmptyParams))
            .await
            .expect("get_today_summary should succeed");

        assert_eq!(result.0["tasksCompletedToday"], 0);
        assert_eq!(result.0["focusMinutesToday"], 0);
        assert_eq!(result.0["tasksDueToday"]["count"].as_i64().unwrap(), 0);
        assert_eq!(
            result.0["habitsCompletedToday"]["count"].as_i64().unwrap(),
            0
        );
        assert!(result.0["moodToday"].is_null());
        assert!(!result.0["journalWrittenToday"].as_bool().unwrap());
    }

    #[tokio::test]
    async fn test_get_today_summary_with_data() {
        let pool = create_test_pool().await;
        let server = BentoMcpServer { pool: pool.clone() };

        let now = time::now_ms();
        let start_of_day = time::start_of_today_ms();

        insert_task(
            &pool,
            "t1",
            "Today task",
            false,
            "high",
            "work",
            Some(start_of_day + 3600_000),
            None,
            now,
        )
        .await;

        insert_task(
            &pool,
            "t2",
            "Done today",
            true,
            "medium",
            "inbox",
            None,
            Some(start_of_day + 1800_000),
            now - 86400_000,
        )
        .await;

        sqlx::query(
            r#"INSERT INTO health_events (module_id, event_type, value, unit, metadata, started_at, ended_at, logged_at)
               VALUES ('focus', 'focus_session', 30.0, 'min', '{}', ?, ?, ?)"#,
        )
        .bind(Some(start_of_day + 1000))
        .bind(Some(start_of_day + 1000 + 30 * 60_000))
        .bind(start_of_day + 2000)
        .execute(&pool)
        .await
        .unwrap();

        insert_habit(&pool, "h1", "Exercise").await;
        sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
            .bind("h1")
            .bind(start_of_day + 3600_000)
            .execute(&pool)
            .await
            .unwrap();

        insert_habit(&pool, "h2", "Read books").await;

        let date_key = time::date_key(start_of_day);
        sqlx::query(
            r#"INSERT INTO mood_checkins (id, mood, intensity, note, activities, logged_at, date_key)
               VALUES ('m1', 'bright', 100, 'Feeling great', '["walk"]', ?, ?)"#,
        )
        .bind(start_of_day + 1000)
        .bind(&date_key)
        .execute(&pool)
        .await
        .unwrap();

        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        sqlx::query(
            r#"INSERT INTO journal_entries (id, date, blocks, word_count, created_at, updated_at)
               VALUES ('j1', ?, '[{"text":"Good day"}]', 2, ?, ?)"#,
        )
        .bind(&today)
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        let result = server
            .get_today_summary(Parameters(EmptyParams))
            .await
            .expect("get_today_summary should succeed");

        assert_eq!(result.0["tasksDueToday"]["count"].as_i64().unwrap(), 1);
        assert_eq!(result.0["tasksDueToday"]["tasks"][0]["title"], "Today task");
        assert_eq!(result.0["tasksCompletedToday"], 1);
        assert_eq!(result.0["focusMinutesToday"], 30);
        assert_eq!(
            result.0["habitsCompletedToday"]["count"].as_i64().unwrap(),
            1
        );
        assert_eq!(result.0["habitsCompletedToday"]["names"][0], "Exercise");
        assert_eq!(
            result.0["habitsRemainingToday"]["count"].as_i64().unwrap(),
            1
        );
        assert!(result.0["moodToday"].is_object());
        assert_eq!(result.0["moodToday"]["mood"], "bright");
        assert!(result.0["journalWrittenToday"].as_bool().unwrap());
    }
}
