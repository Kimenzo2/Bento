// ─────────────────────────────────────────────────────────────────────────────
// Habits Tauri Commands — SQLite-backed
//
// Full CRUD for habits with completion tracking, streaks, and CSV export.
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
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
    pub completion_type: String,  // 'binary' | 'count' | 'duration'
    pub target_count: i32,
    pub unit: String,
    pub frequency: String,        // 'daily' | 'weekdays' | 'weekends'
    pub why: String,
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
    pub completion_type: String,
    pub target_count: i32,
    pub unit: String,
    pub frequency: String,
    pub why: String,
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
    state: State<'_, BentoAppState>,
) -> Result<Vec<HabitWithCompletions>, String> {
    ensure_habits_tables(&state.db()).await?;

    let habits = sqlx::query(
        "SELECT id, name, emoji, color, completion_type, target_count, unit, frequency, why, sort_order, created_at, updated_at
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

        // Fetch last 90 days of completions
        let completions: Vec<i64> = sqlx::query_scalar(
            "SELECT completed_at FROM habit_completions WHERE habit_id = ? AND completed_at >= ? ORDER BY completed_at ASC",
        )
        .bind(&id)
        .bind(ninety_days_ago)
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        // Build completion_history as 90-element boolean array (oldest → newest)
        let mut history = vec![false; 90];
        for ts in &completions {
            let idx = ((ts - ninety_days_ago) / 86_400_000) as usize;
            if idx < 90 {
                history[idx] = true;
            }
        }

        // Compute streak (consecutive trailing true from yesterday backward)
        let mut streak = 0i32;
        for i in (0..90).rev() {
            if history[i] {
                streak += 1;
            } else {
                break;
            }
        }
        // Exclude today from streak if it's the last element (today hasn't ended yet)
        // Actually streak should count continuous completions up to yesterday.
        // Today's completion is tracked separately via completed_today.
        let today_completed = completions.iter().any(|ts| *ts >= today_start && *ts < tomorrow_start);

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

        // Current count for today (for count-based habits)
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
                completion_type: row.get("completion_type"),
                target_count: row.get::<i64, _>("target_count") as i32,
                unit: row.get("unit"),
                frequency: row.get("frequency"),
                why: row.get("why"),
                sort_order: row.get::<i64, _>("sort_order") as i32,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            },
            streak,
            longest_streak: longest,
            completed_today: today_completed,
            current_count: current_count as i32,
            skipped_today: false,   // tracked client-side for now
            frozen_streak: false,   // tracked client-side for now
            completion_history: history,
        });
    }

    Ok(result)
}

/// Save (create or update) a habit. If id is provided, update; otherwise insert.
#[tauri::command]
pub async fn habits_save(
    state: State<'_, BentoAppState>,
    input: HabitInput,
) -> Result<HabitRow, String> {
    ensure_habits_tables(&state.db()).await?;

    let now = time::now_ms();
    let trimmed_name = input.name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Habit name is required.".to_string());
    }

    if let Some(id) = input.id {
        // Update existing
        sqlx::query(
            "UPDATE habits SET name=?, emoji=?, color=?, completion_type=?, target_count=?, unit=?, frequency=?, why=?, updated_at=? WHERE id=?",
        )
        .bind(&trimmed_name)
        .bind(&input.emoji)
        .bind(&input.color)
        .bind(&input.completion_type)
        .bind(input.target_count as i64)
        .bind(&input.unit)
        .bind(&input.frequency)
        .bind(&input.why)
        .bind(now)
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        // Return updated row
        let row = sqlx::query(
            "SELECT id, name, emoji, color, completion_type, target_count, unit, frequency, why, sort_order, created_at, updated_at FROM habits WHERE id=?",
        )
        .bind(&id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        Ok(HabitRow {
            id: row.get("id"),
            name: row.get("name"),
            emoji: row.get("emoji"),
            color: row.get("color"),
            completion_type: row.get("completion_type"),
            target_count: row.get::<i64, _>("target_count") as i32,
            unit: row.get("unit"),
            frequency: row.get("frequency"),
            why: row.get("why"),
            sort_order: row.get::<i64, _>("sort_order") as i32,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    } else {
        // Insert new
        let id = Uuid::new_v4().to_string();

        // Get next sort order
        let max_order: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) FROM habits")
            .fetch_one(&state.db())
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO habits (id, name, emoji, color, completion_type, target_count, unit, frequency, why, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&trimmed_name)
        .bind(&input.emoji)
        .bind(&input.color)
        .bind(&input.completion_type)
        .bind(input.target_count as i64)
        .bind(&input.unit)
        .bind(&input.frequency)
        .bind(&input.why)
        .bind(max_order + 1)
        .bind(now)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        Ok(HabitRow {
            id,
            name: trimmed_name,
            emoji: input.emoji,
            color: input.color,
            completion_type: input.completion_type,
            target_count: input.target_count,
            unit: input.unit,
            frequency: input.frequency,
            why: input.why,
            sort_order: (max_order + 1) as i32,
            created_at: now,
            updated_at: now,
        })
    }
}

/// Delete a habit by id (cascades to completions).
#[tauri::command]
pub async fn habits_delete(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<bool, String> {
    ensure_habits_tables(&state.db()).await?;

    let result = sqlx::query("DELETE FROM habits WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected() > 0)
}

/// Toggle today's completion for a binary habit.
/// If already completed for today, remove the completion (uncheck).
/// If not completed, add a completion.
#[tauri::command]
pub async fn habits_toggle_complete(
    state: State<'_, BentoAppState>,
    habit_id: String,
) -> Result<bool, String> {
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
        // Remove today's completion
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?")
            .bind(&habit_id)
            .bind(today_start)
            .bind(tomorrow_start)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Add completion
        let now = time::now_ms();
        sqlx::query("INSERT OR IGNORE INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
            .bind(&habit_id)
            .bind(now)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

/// Increment count for a count/duration habit. Returns new current_count.
#[tauri::command]
pub async fn habits_increment(
    state: State<'_, BentoAppState>,
    habit_id: String,
) -> Result<i32, String> {
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

    Ok(count as i32)
}

/// Get basic stats for the habits dashboard widget.
#[tauri::command]
pub async fn habits_get_stats(
    state: State<'_, BentoAppState>,
) -> Result<HabitStats, String> {
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
            if done { run += 1; if run > longest { longest = run; } } else { run = 0; }
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
    state: State<'_, BentoAppState>,
) -> Result<String, String> {
    let habits = habits_list(state).await?;

    let mut csv = String::from("habit_id,name,emoji,frequency,streak,longest_streak,completion_rate_pct,completed_today\n");

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
        // Additive column migrations (harmless if columns already exist)
        r#"ALTER TABLE habits ADD COLUMN emoji TEXT NOT NULL DEFAULT '⭐'"#,
        r#"ALTER TABLE habits ADD COLUMN color TEXT NOT NULL DEFAULT 'var(--mod-accent)'"#,
        r#"ALTER TABLE habits ADD COLUMN completion_type TEXT NOT NULL DEFAULT 'binary'"#,
        r#"ALTER TABLE habits ADD COLUMN target_count INTEGER NOT NULL DEFAULT 1"#,
        r#"ALTER TABLE habits ADD COLUMN unit TEXT NOT NULL DEFAULT ''"#,
        r#"ALTER TABLE habits ADD COLUMN why TEXT NOT NULL DEFAULT ''"#,
        r#"ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"#,
        r#"ALTER TABLE habits ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0"#,
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

    Ok(())
}
