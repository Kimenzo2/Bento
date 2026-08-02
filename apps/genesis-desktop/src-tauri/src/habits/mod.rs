// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ─────────────────────────────────────────────────────────────────────────────
// Habits Tauri Commands — SQLite-backed
//
// Full CRUD for habits with completion tracking, streaks, and CSV export.
// ─────────────────────────────────────────────────────────────────────────────

use chrono::{Datelike, Local, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::realtime::RealtimeHub;
use crate::settings;
use crate::util::time;

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitRow {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub color: String,
    pub kind: String, // 'build' | 'quit'
    pub archived: bool,
    pub completion_type: String, // 'binary' | 'count' | 'duration'
    pub target_count: i32,
    pub unit: String,
    pub frequency: String, // 'daily' | 'weekdays' | 'weekends'
    pub time_of_day: String, // 'morning' | 'afternoon' | 'evening' | 'anytime'
    pub why: String,
    pub stack_after_id: Option<String>,
    pub stack_after_name: String,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitInput {
    pub id: Option<String>,
    pub name: String,
    pub emoji: String,
    pub color: String,
    pub kind: String,
    pub archived: Option<bool>,
    pub completion_type: String,
    pub target_count: i32,
    pub unit: String,
    pub frequency: String,
    pub time_of_day: Option<String>,
    pub why: String,
    pub stack_after_id: Option<String>,
    pub stack_after_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitWithCompletions {
    #[serde(flatten)]
    pub habit: HabitRow,
    pub streak: i32,
    pub longest_streak: i32,
    pub completed_today: bool,
    pub current_count: i32,
    pub skipped_today: bool,
    pub frozen_streak: bool,
    pub completion_history: Vec<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitStats {
    pub total_habits: i32,
    pub completed_today: i32,
    pub top_streak: i32,
    pub avg_completion_rate: f64,
    pub this_week_total: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakFreezeState {
    pub freeze_tokens: i32,
    pub used_freeze_tokens: i32,
    pub vacation_active: bool,
    pub vacation_until: Option<i64>,
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

/// List all habits with their completion history (last 90 days) and computed
/// streak/state for today.
#[tauri::command]
pub async fn habits_list(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<HabitWithCompletions>, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let habits = sqlx::query(
        "SELECT id, name, emoji, color, kind, archived, completion_type, target_count, unit, frequency, time_of_day, why, stack_after_id, stack_after_name, sort_order, created_at, updated_at
         FROM habits ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let today_start = time::start_of_today();
    let tomorrow_start = today_start + 86_400_000;
    let ninety_days_ago = today_start - 89 * 86_400_000;

    let mut result = Vec::new();
    for row in habits {
        let id: String = row.get("id");

        // Fetch completions (last 90 days + sentinels)
        let recent_bound = ninety_days_ago;
        let completions: Vec<i64> = sqlx::query_scalar(
            "SELECT completed_at FROM habit_completions WHERE habit_id = ? AND completed_at >= ? ORDER BY completed_at ASC",
        )
        .bind(&id)
        .bind(recent_bound)
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        // Detect sentinels: -1 = skip, -2 = freeze
        let has_skip_sentinel = completions.contains(&-1);
        let has_freeze_sentinel = completions.contains(&-2);

        // Filter sentinels out for history calculation
        let real_completions: Vec<&i64> = completions.iter().filter(|ts| **ts > 0).collect();

        // Build completion_history as 90-element boolean array (oldest → newest)
        let mut history = vec![false; 90];
        for ts in &real_completions {
            let idx = ((*ts - ninety_days_ago) / 86_400_000) as usize;
            if idx < 90 {
                history[idx] = true;
            }
        }

        // Determine today's completion status
        let today_completed = real_completions
            .iter()
            .any(|ts| **ts >= today_start && **ts < tomorrow_start);

        // Compute frequency-aware streak (consecutive trailing true, skipping days the habit doesn't require)
        let freq: String = row.get("frequency");
        let freq_streak = |end_idx: usize| -> i32 {
            let mut s = 0i32;
            for i in (0..=end_idx).rev() {
                let day_start = today_start - ((89 - i) as i64 * 86_400_000);
                let dow = Local
                    .timestamp_millis_opt(day_start)
                    .single()
                    .map(|dt| dt.weekday().num_days_from_monday())
                    .unwrap_or(0);
                let required = match freq.as_str() {
                    "weekdays" => dow < 5,
                    "weekends" => dow >= 5,
                    _ => true,
                };
                if !required {
                    continue;
                }
                if history[i] {
                    s += 1;
                } else {
                    break;
                }
            }
            s
        };
        let mut streak = freq_streak(89);
        // If today not done but freeze sentinel active, use yesterday's streak
        if !today_completed && has_freeze_sentinel && streak == 0 {
            streak = freq_streak(88);
        }

        // Longest streak
        let mut longest = 0i32;
        let mut run = 0i32;
        for &done in &history {
            if done {
                run += 1;
                if run > longest {
                    longest = run;
                }
            } else {
                run = 0;
            }
        }

        // Current count for today (for count/duration habits)
        let current_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?",
        )
        .bind(&id)
        .bind(today_start)
        .bind(tomorrow_start)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        result.push(HabitWithCompletions {
            habit: HabitRow {
                id: id.clone(),
                name: row.get("name"),
                emoji: row.get("emoji"),
                color: row.get("color"),
                kind: row.get::<Option<String>, _>("kind").unwrap_or_default(),
                archived: row.get::<i64, _>("archived") != 0,
                completion_type: row.get("completion_type"),
                target_count: row.get::<i64, _>("target_count") as i32,
                unit: row.get("unit"),
                frequency: row.get("frequency"),
                time_of_day: row.get::<Option<String>, _>("time_of_day").unwrap_or_default(),
                why: row.get("why"),
                stack_after_id: row.get::<Option<String>, _>("stack_after_id"),
                stack_after_name: row.get::<Option<String>, _>("stack_after_name").unwrap_or_default(),
                sort_order: row.get::<i64, _>("sort_order") as i32,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            },
            streak,
            longest_streak: longest,
            completed_today: today_completed,
            current_count: current_count as i32,
            skipped_today: has_skip_sentinel,
            frozen_streak: has_freeze_sentinel,
            completion_history: history,
        });
    }

    Ok(result)
}

/// Save (create or update) a habit. If id is provided, update; otherwise insert.
#[tauri::command]
pub async fn habits_save(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    input: HabitInput,
) -> Result<HabitRow, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let now = time::now_ms();
    let trimmed_name = input.name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Habit name is required.".to_string());
    }

    if let Some(id) = input.id {
        // Update existing
        let time_of_day = input.time_of_day.as_deref().unwrap_or("anytime");
        let stack_after_name = input.stack_after_name.as_deref().unwrap_or("");
        sqlx::query(
            "UPDATE habits SET name=?, emoji=?, color=?, kind=?, archived=?, completion_type=?, target_count=?, unit=?, frequency=?, time_of_day=?, why=?, stack_after_id=?, stack_after_name=?, updated_at=? WHERE id=?",
        )
        .bind(&trimmed_name)
        .bind(&input.emoji)
        .bind(&input.color)
        .bind(&input.kind)
        .bind(input.archived.unwrap_or(false) as i64)
        .bind(&input.completion_type)
        .bind(input.target_count as i64)
        .bind(&input.unit)
        .bind(&input.frequency)
        .bind(time_of_day)
        .bind(&input.why)
        .bind(&input.stack_after_id)
        .bind(stack_after_name)
        .bind(now)
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        // Return updated row
        let row = sqlx::query(
            "SELECT id, name, emoji, color, kind, archived, completion_type, target_count, unit, frequency, time_of_day, why, stack_after_id, stack_after_name, sort_order, created_at, updated_at FROM habits WHERE id=?",
        )
        .bind(&id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        let habit = HabitRow {
            id: row.get("id"),
            name: row.get("name"),
            emoji: row.get("emoji"),
            color: row.get("color"),
            kind: row.get::<Option<String>, _>("kind").unwrap_or_default(),
            archived: row.get::<i64, _>("archived") != 0,
            completion_type: row.get("completion_type"),
            target_count: row.get::<i64, _>("target_count") as i32,
            unit: row.get("unit"),
            frequency: row.get("frequency"),
            time_of_day: row.get::<Option<String>, _>("time_of_day").unwrap_or_default(),
            why: row.get("why"),
            stack_after_id: row.get::<Option<String>, _>("stack_after_id"),
            stack_after_name: row.get::<Option<String>, _>("stack_after_name").unwrap_or_default(),
            sort_order: row.get::<i64, _>("sort_order") as i32,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        };
        hub.emit_change("habits/list", "updated", json!(&habit)).await;
        Ok(habit)
    } else {
        // Insert new
        let id = Uuid::new_v4().to_string();

        // Get next sort order
        let max_order: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) FROM habits")
            .fetch_one(&state.db())
            .await
            .map_err(|e| e.to_string())?;

        let time_of_day = input.time_of_day.as_deref().unwrap_or("anytime");
        let stack_after_name = input.stack_after_name.as_deref().unwrap_or("");
        sqlx::query(
            "INSERT INTO habits (id, name, emoji, color, kind, archived, completion_type, target_count, unit, frequency, time_of_day, why, stack_after_id, stack_after_name, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&trimmed_name)
        .bind(&input.emoji)
        .bind(&input.color)
        .bind(&input.kind)
        .bind(false as i64)
        .bind(&input.completion_type)
        .bind(input.target_count as i64)
        .bind(&input.unit)
        .bind(&input.frequency)
        .bind(time_of_day)
        .bind(&input.why)
        .bind(&input.stack_after_id)
        .bind(stack_after_name)
        .bind(max_order + 1)
        .bind(now)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        let habit = HabitRow {
            id,
            name: trimmed_name,
            emoji: input.emoji,
            color: input.color,
            kind: input.kind,
            archived: false,
            completion_type: input.completion_type,
            target_count: input.target_count,
            unit: input.unit,
            frequency: input.frequency,
            time_of_day: input.time_of_day.unwrap_or_else(|| "anytime".to_string()),
            why: input.why,
            stack_after_id: input.stack_after_id,
            stack_after_name: input.stack_after_name.unwrap_or_default(),
            sort_order: (max_order + 1) as i32,
            created_at: now,
            updated_at: now,
        };
        hub.emit_change("habits/list", "created", json!(&habit)).await;
        Ok(habit)
    }
}

/// Delete a habit by id (cascades to completions).
#[tauri::command]
pub async fn habits_delete(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let result = sqlx::query("DELETE FROM habits WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    if result.rows_affected() > 0 {
        hub.emit_change("habits/list", "deleted", json!({ "id": &id })).await;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Fetch a habit row and publish an `updated` event for it. Used by
/// completion/streak mutations that change derived state, not the row itself.
async fn publish_habit_updated(db: &sqlx::SqlitePool, hub: &RealtimeHub, habit_id: &str) {
    if let Ok(Some(row)) = sqlx::query(
        "SELECT id, name, emoji, color, kind, archived, completion_type, target_count, unit, frequency, time_of_day, why, stack_after_id, stack_after_name, sort_order, created_at, updated_at FROM habits WHERE id = ?",
    )
    .bind(habit_id)
    .fetch_optional(db)
    .await
    {
        let habit = HabitRow {
            id: row.get("id"),
            name: row.get("name"),
            emoji: row.get("emoji"),
            color: row.get("color"),
            kind: row.get::<Option<String>, _>("kind").unwrap_or_default(),
            archived: row.get::<i64, _>("archived") != 0,
            completion_type: row.get("completion_type"),
            target_count: row.get::<i64, _>("target_count") as i32,
            unit: row.get("unit"),
            frequency: row.get("frequency"),
            time_of_day: row.get::<Option<String>, _>("time_of_day").unwrap_or_default(),
            why: row.get("why"),
            stack_after_id: row.get::<Option<String>, _>("stack_after_id"),
            stack_after_name: row.get::<Option<String>, _>("stack_after_name").unwrap_or_default(),
            sort_order: row.get::<i64, _>("sort_order") as i32,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        };
        hub.emit_change("habits/list", "updated", json!(&habit)).await;
    }
}

/// Toggle today's completion for a binary habit.
/// If already completed for today, remove the completion (uncheck).
/// If not completed, add a completion.
#[tauri::command]
pub async fn habits_toggle_complete(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let today_start = time::start_of_today();
    let tomorrow_start = today_start + 86_400_000;

    // Check if already completed today
    let existing: Option<i64> = sqlx::query_scalar(
        "SELECT completed_at FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ? LIMIT 1",
    )
    .bind(&habit_id)
    .bind(today_start)
    .bind(tomorrow_start)
    .fetch_optional(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    if existing.is_some() {
        // Remove today's completion (including skip sentinel)
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?")
            .bind(&habit_id)
            .bind(today_start)
            .bind(tomorrow_start)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        // Also clear skip sentinel
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at = -1")
            .bind(&habit_id)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        publish_habit_updated(&state.db(), &hub, &habit_id).await;
        Ok(false)
    } else {
        // Clear any existing skip sentinel
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at = -1")
            .bind(&habit_id)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        // Add completion
        let now = time::now_ms();
        sqlx::query(
            "INSERT OR IGNORE INTO habit_completions (habit_id, completed_at) VALUES (?, ?)",
        )
        .bind(&habit_id)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
        publish_habit_updated(&state.db(), &hub, &habit_id).await;
        Ok(true)
    }
}

/// Increment count for a count/duration habit. Returns new current_count.
#[tauri::command]
pub async fn habits_increment(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<i32, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let now = time::now_ms();
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + 86_400_000;

    sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
        .bind(&habit_id)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?",
    )
    .bind(&habit_id)
    .bind(today_start)
    .bind(tomorrow_start)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    publish_habit_updated(&state.db(), &hub, &habit_id).await;

    Ok(count as i32)
}

/// Get basic stats for the habits dashboard widget.
#[tauri::command]
pub async fn habits_get_stats(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<HabitStats, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let today_start = time::start_of_today();
    let tomorrow_start = today_start + 86_400_000;

    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT habit_id) FROM habit_completions WHERE completed_at >= ? AND completed_at < ?",
    )
    .bind(today_start)
    .bind(tomorrow_start)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Top streak: iterate all habits' completions
    let ninety_days_ago = today_start - 89 * 86_400_000;
    let habits = sqlx::query("SELECT id FROM habits")
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let mut top_streak = 0i32;
    let mut total_completions_90d = 0i64;
    let mut habit_count_90d = 0i64;

    for row in habits {
        let id: String = row.get("id");
        let comps: Vec<i64> = sqlx::query_scalar(
            "SELECT completed_at FROM habit_completions WHERE habit_id = ? AND completed_at >= ? ORDER BY completed_at ASC",
        )
        .bind(&id)
        .bind(ninety_days_ago)
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        total_completions_90d += comps.len() as i64;
        habit_count_90d += 1;

        let mut history = vec![false; 90];
        for ts in &comps {
            let idx = ((ts - ninety_days_ago) / 86_400_000) as usize;
            if idx < 90 {
                history[idx] = true;
            }
        }

        let mut longest = 0i32;
        let mut run = 0i32;
        for &done in &history {
            if done {
                run += 1;
                if run > longest {
                    longest = run;
                }
            } else {
                run = 0;
            }
        }
        if longest > top_streak {
            top_streak = longest;
        }
    }

    let avg_rate = if habit_count_90d > 0 {
        (total_completions_90d as f64 / (habit_count_90d as f64 * 90.0)) * 100.0
    } else {
        0.0
    };

    // This week total
    let week_start = today_start - 6 * 86_400_000;
    let week_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT habit_id || '-' || (completed_at / 86400000)) FROM habit_completions WHERE completed_at >= ? AND completed_at < ?",
    )
    .bind(week_start)
    .bind(tomorrow_start)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(HabitStats {
        total_habits: total as i32,
        completed_today: completed_today as i32,
        top_streak,
        avg_completion_rate: (avg_rate * 10.0).round() / 10.0,
        this_week_total: week_total as i32,
    })
}

/// Export habits data as CSV content. Returns the CSV string.
#[tauri::command]
pub async fn habits_export_csv(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<String, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    let habits = habits_list(auth, state).await?;

    let mut csv = String::from(
        "habit_id,name,emoji,frequency,streak,longest_streak,completion_rate_pct,completed_today\n",
    );

    for h in &habits {
        let rate = if h.completion_history.len() > 0 {
            let done = h.completion_history.iter().filter(|&&d| d).count();
            (done as f64 / h.completion_history.len() as f64 * 100.0) as i32
        } else {
            0
        };
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            csv_escape(&h.habit.id),
            csv_escape(&h.habit.name),
            csv_escape(&h.habit.emoji),
            csv_escape(&h.habit.frequency),
            h.streak,
            h.longest_streak,
            rate,
            h.completed_today as i32,
        ));
    }

    Ok(csv)
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// FREEZE STATE — persisted in DesktopSettings
// ═════════════════════════════════════════════════════════════════════════════

/// Get current freeze token state from settings.
#[tauri::command]
pub async fn habits_get_freeze_state(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
) -> Result<StreakFreezeState, String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    let s = settings::current_settings(&app);
    Ok(StreakFreezeState {
        freeze_tokens: s.habits.freeze_tokens,
        used_freeze_tokens: s.habits.used_freeze_tokens,
        vacation_active: false,
        vacation_until: None,
    })
}

/// Save freeze token state to settings.
#[tauri::command]
pub async fn habits_save_freeze_state(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    freeze_tokens: i32,
    used_freeze_tokens: i32,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    let tokens = freeze_tokens.max(1).min(10);
    let used = used_freeze_tokens.max(0).min(tokens);
    settings::update_desktop_settings(&app, |next| {
        next.habits.freeze_tokens = tokens;
        next.habits.used_freeze_tokens = used;
    })?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// SKIP / FREEZE sentinel commands
// Sentinels are stored in habit_completions:
//   completed_at = -1 → skip today
//   completed_at = -2 → freeze streak
// ═════════════════════════════════════════════════════════════════════════════

/// Mark a habit as skipped today (inserts sentinel).
#[tauri::command]
pub async fn habits_skip_today(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;
    sqlx::query("INSERT OR IGNORE INTO habit_completions (habit_id, completed_at) VALUES (?, -1)")
        .bind(&habit_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    publish_habit_updated(&state.db(), &hub, &habit_id).await;
    Ok(())
}

/// Remove the skip sentinel for a habit.
#[tauri::command]
pub async fn habits_unskip_today(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at = -1")
        .bind(&habit_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    publish_habit_updated(&state.db(), &hub, &habit_id).await;
    Ok(())
}

/// Freeze a habit's streak (inserts freeze sentinel + decrements token).
#[tauri::command]
pub async fn habits_freeze_streak(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    ensure_habits_tables(&state.db()).await?;
    sqlx::query("INSERT OR IGNORE INTO habit_completions (habit_id, completed_at) VALUES (?, -2)")
        .bind(&habit_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    // Decrement used_freeze_tokens
    settings::update_desktop_settings(&app, |next| {
        let max = next.habits.freeze_tokens;
        if next.habits.used_freeze_tokens < max {
            next.habits.used_freeze_tokens += 1;
        }
    })?;
    publish_habit_updated(&state.db(), &hub, &habit_id).await;
    Ok(())
}

/// Unfreeze a habit (removes sentinel + refunds token).
#[tauri::command]
pub async fn habits_unfreeze_streak(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    hub: State<'_, RealtimeHub>,
    habit_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "habits").await?;

    sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at = -2")
        .bind(&habit_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    // Refund token
    settings::update_desktop_settings(&app, |next| {
        if next.habits.used_freeze_tokens > 0 {
            next.habits.used_freeze_tokens -= 1;
        }
    })?;
    publish_habit_updated(&state.db(), &hub, &habit_id).await;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BOOTSTRAP
// ═════════════════════════════════════════════════════════════════════════════

pub async fn ensure_habits_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let migrations = [
        // Base tables (idempotent)
        r#"CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '⭐',
            color TEXT NOT NULL DEFAULT 'var(--mod-accent)',
            kind TEXT NOT NULL DEFAULT 'build',
            archived INTEGER NOT NULL DEFAULT 0,
            completion_type TEXT NOT NULL DEFAULT 'binary',
            target_count INTEGER NOT NULL DEFAULT 1,
            unit TEXT NOT NULL DEFAULT '',
            frequency TEXT NOT NULL DEFAULT 'daily',
            why TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS habit_completions (
            habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            completed_at INTEGER NOT NULL,
            PRIMARY KEY (habit_id, completed_at)
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(completed_at DESC)"#,
    ];

    for sql in migrations {
        let result = sqlx::query(sql).execute(pool).await;
        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("duplicate column name")
                || msg.contains("Cannot add a NOT NULL")
                || msg.starts_with("error returned from database: cannot add")
            {
                continue;
            }
            return Err(msg);
        }
    }

    // ── Additive column migrations for habits ──────────────────────────
    // The habits table was originally created by db.rs with only:
    //   id, name, frequency, created_at
    // These ADD COLUMN statements fill in the missing columns for databases
    // created before the full schema was introduced.
    let habit_alter_statements: &[&str] = &[
        "ALTER TABLE habits ADD COLUMN emoji TEXT NOT NULL DEFAULT '⭐'",
        "ALTER TABLE habits ADD COLUMN color TEXT NOT NULL DEFAULT 'var(--mod-accent)'",
        "ALTER TABLE habits ADD COLUMN kind TEXT NOT NULL DEFAULT 'build'",
        "ALTER TABLE habits ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE habits ADD COLUMN completion_type TEXT NOT NULL DEFAULT 'binary'",
        "ALTER TABLE habits ADD COLUMN target_count INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE habits ADD COLUMN unit TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE habits ADD COLUMN why TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE habits ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE habits ADD COLUMN time_of_day TEXT NOT NULL DEFAULT 'anytime'",
        "ALTER TABLE habits ADD COLUMN stack_after_id TEXT",
        "ALTER TABLE habits ADD COLUMN stack_after_name TEXT NOT NULL DEFAULT ''",
    ];

    for stmt in habit_alter_statements {
        let result = sqlx::query(stmt).execute(pool).await;
        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("duplicate column name")
                || msg.contains("Cannot add a NOT NULL")
                || msg.starts_with("error returned from database: cannot add")
            {
                continue;
            }
            return Err(msg);
        }
    }

    Ok(())
}
