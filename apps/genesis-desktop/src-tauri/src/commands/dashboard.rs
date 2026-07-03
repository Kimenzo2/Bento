use std::sync::Mutex;
use std::time::Instant;

use chrono::Timelike;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::Manager;

use crate::auth::{AuthBootstrapState, AuthManager};
use crate::commands::sync::sync_user_data;
use crate::db::read_runtime_state;
use crate::db::BentoAppState;
use crate::runtime::DesktopRuntime;
use crate::util::time;

// ---------------------------------------------------------------------------
// DashboardCache — 30-second TTL cache
// ---------------------------------------------------------------------------

pub struct DashboardCache {
    cached: Mutex<Option<(DashboardPayload, Instant)>>,
}

impl Default for DashboardCache {
    fn default() -> Self {
        Self::new()
    }
}

impl DashboardCache {
    pub fn new() -> Self {
        Self {
            cached: Mutex::new(None),
        }
    }

    pub fn get(&self) -> Option<DashboardPayload> {
        if let Ok(mut guard) = self.cached.lock() {
            if let Some((payload, time)) = guard.as_ref() {
                if time.elapsed() < std::time::Duration::from_secs(30) {
                    return Some(payload.clone());
                }
            }
            *guard = None;
        }
        None
    }

    pub fn set(&self, payload: DashboardPayload) {
        if let Ok(mut guard) = self.cached.lock() {
            *guard = Some((payload, Instant::now()));
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut guard) = self.cached.lock() {
            *guard = None;
        }
    }
}

// ---------------------------------------------------------------------------
// Response structs (unchanged schema — frontend relies on these shapes)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardPayload {
    pub greeting: String,
    pub insight_line: String,
    pub featured_module: FeaturedModule,
    pub recent_activity: Vec<ActivityEntry>,
    pub streak: StreakInfo,
    pub featured_metric: MetricInfo,
    pub recent_modules: Vec<RecentModule>,
    pub gradient_colors: [String; 2],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeaturedModule {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub accent_hex: String,
    pub primary_count: i32,
    pub primary_label: String,
    pub descriptor_label: String,
    pub items: Vec<DashboardItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardItem {
    pub text: String,
    pub secondary: Option<String>,
    /// true = task is done — drives the progress indicator on the frontend.
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub module_id: String,
    pub module_name: String,
    pub module_icon: String,
    pub module_accent: String,
    pub action: String,
    pub timestamp_relative: String,
    pub timestamp_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfo {
    pub count: i32,
    pub module_id: String,
    pub module_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricInfo {
    pub label: String,
    pub value: String,
    pub module_id: String,
    pub trend: Option<TrendInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendInfo {
    pub direction: String,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentModule {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub accent_hex: String,
    pub last_used_ms: i64,
}

// ---------------------------------------------------------------------------
// Module metadata lookup (avoids cross-dependency on modules.rs constants)
// ---------------------------------------------------------------------------

fn module_meta(id: &str) -> (&'static str, &'static str, &'static str) {
    match id {
        "tasks" => ("Tasks", "layout-grid", "#52b788"),
        "notes" => ("Notes", "file-text", "#7c3aed"),
        "journal" => ("Journal / Diary", "book-heart", "#818cf8"),
        "habits" => ("Habits", "target", "#c8f535"),
        "focus" => ("Focus Timer", "timer", "#f5c400"),
        "passwords" => ("Password Vault", "shield-check", "#9eff57"),
        "health" => ("Health Tracker", "activity", "#c8f535"),
        "sleep" => ("Sleep Tracker", "moon", "#8cc8ff"),
        "nutrition" => ("Water & Nutrition", "droplets", "#1aa6a6"),
        "mood" => ("Mood Tracker", "smile-plus", "#d92b67"),
        "budget" => ("Budget Tracker", "wallet", "#e05a3a"),
        "flashcards" => ("Flashcards / Study", "brain", "#6d5ce7"),
        "reading" => ("Reading Tracker", "library", "#e11d48"),
        "grocery" => ("Grocery / Shopping", "shopping-cart", "#22c55e"),
        "recipes" => ("Recipe Manager", "utensils-crossed", "#d4a017"),
        "time" => ("Time Tracker", "clock-4", "#ffd95b"),
        "goals" => ("Goal Tracker", "trophy", "#ccff00"),
        "clipboard" => ("Clipboard Manager", "clipboard-list", "#e11d48"),
        "breathing" => ("Breathing / Calm", "wind", "#65d7c1"),
        "voice-memos" => ("Voice Memos", "mic", "#8b5cf6"),
        "countdown" => ("Countdown / Life Events", "hourglass", "#ec4899"),
        "telemetry" => ("Personal Telemetry", "gauge", "#38bdf8"),
        "dashboard" => ("Dashboard", "layout-dashboard", "#ff9f6e"),
        "ai" => ("AI Studio", "bot", "#ec4899"),
        "settings" => ("Settings", "settings", "#94a3b8"),
        _ => ("Unknown", "layout-grid", "#818cf8"),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_ms() -> i64 {
    time::now_ms()
}

fn today_start_ms() -> i64 {
    time::start_of_today()
}

fn today_end_ms() -> i64 {
    // Start of tomorrow minus 1ms = last ms of today (no boundary miss)
    time::start_of_today() + 86_400_000 - 1
}

fn compute_greeting(name: &str) -> String {
    let hour = chrono::Local::now().hour();
    let base = match hour {
        0..=11 => "Good morning",
        12..=17 => "Good afternoon",
        _ => "Good evening",
    };
    if name.is_empty() {
        base.to_string()
    } else {
        format!("{base}, {name}")
    }
}

fn relative_time(ts_ms: i64) -> String {
    time::duration_since(ts_ms)
}

// ---------------------------------------------------------------------------
// Query: tasks due today  → featured module card
// ---------------------------------------------------------------------------

async fn query_featured_module(
    db: &SqlitePool,
    today_start: i64,
    today_end: i64,
    insight: &mut String,
) -> Result<FeaturedModule, String> {
    // ── 24-hour task window ─────────────────────────────────────────────────
    // Show tasks that were CREATED today, ordered by creation time ascending
    // (the order the user added them). Completed tasks are included so the
    // progress indicator can show a checkmark. The list resets automatically
    // at day-start because today_start changes each day.
    //
    // Also pull in any undone tasks due today that may have been created
    // before today_start (older tasks with a today due-date).
    let rows = sqlx::query(
        r#"
        SELECT id, title, done, due_at, created_at FROM tasks
        WHERE archived = 0
          AND (
            -- Tasks the user added today (progress indicator items)
            created_at >= ?
            OR
            -- Older tasks that are due today and still pending
            (done = 0 AND due_at >= ? AND due_at <= ?)
          )
        ORDER BY created_at ASC
        LIMIT 6
        "#,
    )
    .bind(today_start) // tasks created today
    .bind(today_start) // due-today window start
    .bind(today_end) // due-today window end
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let pending_count = rows
        .iter()
        .filter(|r| r.try_get::<i64, _>("done").unwrap_or(0) == 0)
        .count() as i32;
    let total_count = rows.len() as i32;

    if total_count > 0 {
        let items: Vec<DashboardItem> = rows
            .iter()
            .map(|row| {
                let title: String = row.try_get("title").unwrap_or_default();
                let done: i64 = row.try_get("done").unwrap_or(0);
                let due_at: Option<i64> = row.try_get("due_at").ok().flatten();

                let secondary = due_at.map(|ts| {
                    let diff = ts - now_ms();
                    if diff <= 0 {
                        "Overdue".to_string()
                    } else if diff < 3_600_000 {
                        format!("{}m left", diff / 60_000)
                    } else if diff < 86_400_000 {
                        format!("{}h left", diff / 3_600_000)
                    } else {
                        chrono::DateTime::from_timestamp_millis(ts)
                            .map(|d| d.format("%I:%M %p").to_string())
                            .unwrap_or_default()
                    }
                });

                DashboardItem {
                    text: title,
                    secondary,
                    completed: done == 1,
                }
            })
            .collect();

        *insight = format!(
            "{pending_count} task{} remaining today",
            if pending_count == 1 { "" } else { "s" }
        );

        return Ok(FeaturedModule {
            id: "tasks".to_string(),
            name: "Tasks".to_string(),
            icon: "layout-grid".to_string(),
            accent_hex: "#52b788".to_string(),
            primary_count: pending_count,
            primary_label: if pending_count == 1 {
                "task remaining".to_string()
            } else {
                "tasks remaining".to_string()
            },
            descriptor_label: "Open Tasks →".to_string(),
            items,
        });
    }

    // ── Fallback: any pending tasks at all ───────────────────────────────────
    let rows = sqlx::query(
        "SELECT id, title, done, due_at, created_at FROM tasks WHERE done = 0 AND archived = 0 ORDER BY created_at ASC LIMIT 6",
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let pending_count = rows.len() as i32;

    if pending_count > 0 {
        *insight = format!(
            "{pending_count} pending task{}",
            if pending_count == 1 { "" } else { "s" }
        );

        let items: Vec<DashboardItem> = rows
            .into_iter()
            .map(|row| {
                let title: String = row.try_get("title").unwrap_or_default();
                let due_at: Option<i64> = row.try_get("due_at").ok().flatten();
                let secondary = due_at.map(|ts| {
                    let diff = ts - now_ms();
                    if ts < today_start_ms() {
                        "Overdue".to_string()
                    } else if diff < 86_400_000 {
                        "Today".to_string()
                    } else {
                        chrono::DateTime::from_timestamp_millis(ts)
                            .map(|d| d.format("%b %d").to_string())
                            .unwrap_or_default()
                    }
                });
                DashboardItem {
                    text: title,
                    secondary,
                    completed: false,
                }
            })
            .collect();

        return Ok(FeaturedModule {
            id: "tasks".to_string(),
            name: "Tasks".to_string(),
            icon: "layout-grid".to_string(),
            accent_hex: "#52b788".to_string(),
            primary_count: pending_count,
            primary_label: if pending_count == 1 {
                "pending task".to_string()
            } else {
                "pending tasks".to_string()
            },
            descriptor_label: "Open Tasks →".to_string(),
            items,
        });
    }

    // ── Empty state ──────────────────────────────────────────────────────────
    *insight = "No tasks yet — add your first one".to_string();
    Ok(FeaturedModule {
        id: "tasks".to_string(),
        name: "Tasks".to_string(),
        icon: "layout-grid".to_string(),
        accent_hex: "#52b788".to_string(),
        primary_count: 0,
        primary_label: "tasks".to_string(),
        descriptor_label: "Create your first task →".to_string(),
        items: vec![DashboardItem {
            text: "Add a task to get started".to_string(),
            secondary: None,
            completed: false,
        }],
    })
}

// ---------------------------------------------------------------------------
// Query: recent activity (UNION of tasks, notes, habits, health)
// ---------------------------------------------------------------------------

async fn query_recent_activity(
    db: &SqlitePool,
    insight: &mut String,
) -> Result<Vec<ActivityEntry>, String> {
    let rows = sqlx::query(
        r#"
        SELECT module_id, ts, action FROM (
            SELECT module_id, created_at AS ts, action FROM dashboard_events
            UNION ALL
            SELECT 'tasks' AS module_id, created_at AS ts, 'Created: ' || title AS action FROM tasks
            UNION ALL
            SELECT 'tasks', updated_at, 'Completed: ' || title FROM tasks WHERE done = 1
            UNION ALL
            SELECT 'notes', updated_at, 'Edited: ' || substr(title, 1, 60) FROM notes
            UNION ALL
            SELECT 'habits', completed_at, 'Completed a habit' FROM habit_completions
            UNION ALL
            SELECT 'health', logged_at, 'Logged ' || type || coalesce(': ' || CAST(round(value, 1) AS TEXT), '') FROM health_logs
        )
        ORDER BY ts DESC
        LIMIT 8
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        let ctx_rows = sqlx::query(
            "SELECT module, last_open_id FROM module_context WHERE last_open_id IS NOT NULL LIMIT 3",
        )
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        if ctx_rows.is_empty() {
            return Ok(Vec::new());
        }

        let now = now_ms();
        let activity: Vec<ActivityEntry> = ctx_rows
            .into_iter()
            .enumerate()
            .map(|(i, row)| {
                let module_id: String = row.try_get("module").unwrap_or_default();
                let last_id: Option<String> = row.try_get("last_open_id").ok().flatten();
                let (name, icon, accent) = module_meta(&module_id);
                let action = last_id
                    .map(|id| format!("Opened {id}"))
                    .unwrap_or_else(|| "Previously used".to_string());
                let ts = now - (i as i64 * 3_600_000);
                ActivityEntry {
                    module_id: module_id.clone(),
                    module_name: name.to_string(),
                    module_icon: icon.to_string(),
                    module_accent: accent.to_string(),
                    action,
                    timestamp_relative: relative_time(ts),
                    timestamp_ms: ts,
                }
            })
            .collect();

        return Ok(activity);
    }

    let mut activity: Vec<ActivityEntry> = Vec::new();
    let now = now_ms();
    for row in rows {
        let module_id: String = row.try_get("module_id").unwrap_or_default();
        let ts: i64 = row.try_get("ts").unwrap_or(now);
        let action: String = row.try_get("action").unwrap_or_default();
        let (name, icon, accent) = module_meta(&module_id);
        activity.push(ActivityEntry {
            module_id,
            module_name: name.to_string(),
            module_icon: icon.to_string(),
            module_accent: accent.to_string(),
            action,
            timestamp_relative: relative_time(ts),
            timestamp_ms: ts,
        });
        if activity.len() >= 5 {
            break;
        }
    }

    if !activity.is_empty() {
        let latest = &activity[0];
        if insight.is_empty() {
            *insight = format!("Just now: {}", latest.action);
        }
    }

    Ok(activity)
}

// ---------------------------------------------------------------------------
// Query: habit streak (consecutive days)
// ---------------------------------------------------------------------------

async fn query_streak(db: &SqlitePool, insight: &mut String) -> Result<StreakInfo, String> {
    let total: i64 = sqlx::query("SELECT COUNT(*) AS c FROM habit_completions")
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?
        .try_get("c")
        .unwrap_or(0);

    if total == 0 {
        return Ok(StreakInfo {
            count: 0,
            module_id: "habits".to_string(),
            module_name: "Habits".to_string(),
        });
    }

    let row = sqlx::query(
        r#"
        WITH daily AS (
            SELECT habit_id, DATE(completed_at / 1000, 'unixepoch') AS day
            FROM habit_completions
            GROUP BY habit_id, day
        ),
        ranked AS (
            SELECT habit_id, day,
                JULIANDAY(day) - ROW_NUMBER() OVER (PARTITION BY habit_id ORDER BY day) AS grp
            FROM daily
        ),
        streaks AS (
            SELECT habit_id, COUNT(*) AS streak
            FROM ranked
            GROUP BY habit_id, grp
        )
        SELECT habit_id, MAX(streak) AS max_streak
        FROM streaks
        GROUP BY habit_id
        ORDER BY max_streak DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(r) => {
            let habit_id: String = r.try_get("habit_id").unwrap_or_default();
            let streak: i64 = r.try_get("max_streak").unwrap_or(0);

            let habit_name: String = sqlx::query("SELECT name FROM habits WHERE id = ?")
                .bind(&habit_id)
                .fetch_optional(db)
                .await
                .map_err(|e| e.to_string())?
                .map(|r| r.try_get("name").unwrap_or_default())
                .unwrap_or_default();

            if streak > 0 && insight.is_empty() {
                *insight = format!("You're on a {streak}-day streak for {habit_name}");
            }

            Ok(StreakInfo {
                count: streak as i32,
                module_id: "habits".to_string(),
                module_name: "Habits".to_string(),
            })
        }
        None => Ok(StreakInfo {
            count: 0,
            module_id: "habits".to_string(),
            module_name: "Habits".to_string(),
        }),
    }
}

// ---------------------------------------------------------------------------
// Query: featured metric (tasks done today vs yesterday)
// ---------------------------------------------------------------------------

async fn query_featured_metric(
    db: &SqlitePool,
    today_start: i64,
    insight: &mut String,
) -> Result<MetricInfo, String> {
    let yesterday_start = today_start - 86_400_000;

    let done_today: i64 =
        sqlx::query("SELECT COUNT(*) AS c FROM tasks WHERE done = 1 AND updated_at >= ?")
            .bind(today_start)
            .fetch_one(db)
            .await
            .map_err(|e| e.to_string())?
            .try_get("c")
            .unwrap_or(0);

    let done_yesterday: i64 = sqlx::query(
        "SELECT COUNT(*) AS c FROM tasks WHERE done = 1 AND updated_at >= ? AND updated_at < ?",
    )
    .bind(yesterday_start)
    .bind(today_start)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?
    .try_get("c")
    .unwrap_or(0);

    let health_today: i64 =
        sqlx::query("SELECT COUNT(*) AS c FROM health_logs WHERE logged_at >= ?")
            .bind(today_start)
            .fetch_one(db)
            .await
            .map_err(|e| e.to_string())?
            .try_get("c")
            .unwrap_or(0);

    if done_today > 0 || done_yesterday > 0 {
        let trend = if done_yesterday > 0 {
            let pct = ((done_today as f32 - done_yesterday as f32) / done_yesterday as f32) * 100.0;
            Some(TrendInfo {
                direction: if pct >= 0.0 {
                    "up".to_string()
                } else {
                    "down".to_string()
                },
                percentage: pct.abs(),
            })
        } else {
            None
        };

        let value = if done_today > 60 {
            format!("{}h", done_today / 60)
        } else {
            format!("{done_today}")
        };
        let label = if done_today == 1 {
            "task done today".to_string()
        } else {
            "tasks done today".to_string()
        };

        if insight.is_empty() {
            *insight = format!(
                "{done_today} task{} done today",
                if done_today == 1 { "" } else { "s" }
            );
        }

        return Ok(MetricInfo {
            label,
            value,
            module_id: "tasks".to_string(),
            trend,
        });
    }

    if health_today > 0 {
        let value = format!("{health_today}");
        let label = if health_today == 1 {
            "health log today".to_string()
        } else {
            "health logs today".to_string()
        };

        if insight.is_empty() {
            *insight = format!(
                "{health_today} health {} today",
                if health_today == 1 { "log" } else { "logs" }
            );
        }

        return Ok(MetricInfo {
            label,
            value,
            module_id: "health".to_string(),
            trend: None,
        });
    }

    let total_tasks: i64 = sqlx::query("SELECT COUNT(*) AS c FROM tasks")
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?
        .try_get("c")
        .unwrap_or(0);

    Ok(MetricInfo {
        label: "total tasks".to_string(),
        value: format!("{total_tasks}"),
        module_id: "tasks".to_string(),
        trend: None,
    })
}

// ---------------------------------------------------------------------------
// Query: recent modules (ordered by latest activity)
// ---------------------------------------------------------------------------

async fn query_recent_modules(
    db: &SqlitePool,
    preferred_module: Option<&str>,
) -> Result<Vec<RecentModule>, String> {
    let now = now_ms();

    let timestamps = sqlx::query(
        r#"
        SELECT module_id, MAX(ts) AS ts FROM (
            SELECT module_id, MAX(created_at) AS ts FROM dashboard_events GROUP BY module_id
            UNION ALL
            SELECT 'tasks' AS module_id, MAX(updated_at) AS ts FROM tasks
            UNION ALL
            SELECT 'notes', MAX(updated_at) FROM notes
            UNION ALL
            SELECT 'habits', MAX(completed_at) FROM habit_completions
            UNION ALL
            SELECT 'health', MAX(logged_at) FROM health_logs
            UNION ALL
            SELECT module_id, updated_at FROM module_settings
        )
        GROUP BY module_id
        ORDER BY ts DESC
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let ctx_rows = sqlx::query("SELECT module FROM module_context")
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut module_scores: Vec<(String, i64)> = timestamps
        .into_iter()
        .filter_map(|row| {
            let mid: String = row.try_get("module_id").ok()?;
            if !is_valid_module_id(&mid) {
                return None;
            }
            let ts: Option<i64> = row.try_get("ts").ok().flatten();
            Some((mid, ts.unwrap_or(0)))
        })
        .collect();

    for row in ctx_rows {
        let mid: String = row.try_get("module").unwrap_or_default();
        if !is_valid_module_id(&mid) {
            continue;
        }
        if !module_scores.iter().any(|(id, _)| id == &mid) {
            module_scores.push((mid, now));
        }
    }

    if let Some(preferred_module) = preferred_module {
        if is_valid_module_id(preferred_module)
            && !matches!(preferred_module, "dashboard" | "ai" | "settings" | "notes")
        {
            if let Some(index) = module_scores
                .iter()
                .position(|(id, _)| id == preferred_module)
            {
                let preferred = module_scores.remove(index);
                module_scores.insert(0, (preferred.0, i64::MAX));
            } else {
                module_scores.insert(0, (preferred_module.to_string(), i64::MAX));
            }
        }
    }

    module_scores
        .retain(|(id, _)| !matches!(id.as_str(), "dashboard" | "ai" | "settings" | "notes"));

    module_scores.sort_by_key(|b| std::cmp::Reverse(b.1));
    let top = &module_scores[..module_scores.len().min(8)];

    let modules: Vec<RecentModule> = top
        .iter()
        .map(|(mid, ts)| {
            let (name, icon, accent) = module_meta(mid);
            RecentModule {
                id: mid.clone(),
                name: name.to_string(),
                icon: icon.to_string(),
                accent_hex: accent.to_string(),
                last_used_ms: *ts,
            }
        })
        .collect();

    if modules.is_empty() {
        let starter_ids = [
            "tasks", "journal", "habits", "focus", "health", "mood", "budget", "reading",
        ];
        Ok(starter_ids
            .iter()
            .enumerate()
            .map(|(i, id)| {
                let (name, icon, accent) = module_meta(id);
                RecentModule {
                    id: id.to_string(),
                    name: name.to_string(),
                    icon: icon.to_string(),
                    accent_hex: accent.to_string(),
                    last_used_ms: now - (i as i64 * 86_400_000),
                }
            })
            .collect())
    } else {
        Ok(modules)
    }
}

fn is_valid_module_id(id: &str) -> bool {
    matches!(
        id,
        "tasks"
            | "notes"
            | "journal"
            | "habits"
            | "focus"
            | "passwords"
            | "health"
            | "sleep"
            | "nutrition"
            | "mood"
            | "budget"
            | "flashcards"
            | "reading"
            | "grocery"
            | "recipes"
            | "time"
            | "goals"
            | "clipboard"
            | "breathing"
            | "voice-memos"
            | "countdown"
            | "telemetry"
    )
}

// ---------------------------------------------------------------------------
// Main dashboard command
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_dashboard_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, BentoAppState>,
    cache: tauri::State<'_, DashboardCache>,
) -> Result<DashboardPayload, String> {
    // Check cache first
    if let Some(cached) = cache.get() {
        return Ok(cached);
    }

    let db = state.db();

    // Pull live data from Supabase into local SQLite before running queries.
    // Keep this below the startup interaction budget; stale local data is safer
    // than blocking the dashboard on network or SQLite pool contention.
    if let Some(auth) = app.try_state::<AuthManager>() {
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            sync_user_data(&db, &auth),
        )
        .await;
    }

    let today_start = today_start_ms();
    let today_end = today_end_ms();

    // Read user's display name from Supabase auth (fallback to DesktopRuntime settings)
    let display_name = if let Some(auth) = app.try_state::<AuthManager>() {
        match auth.snapshot().await {
            AuthBootstrapState::Restored { user } if !user.name.trim().is_empty() => user.name,
            _ => app
                .try_state::<DesktopRuntime>()
                .map(|r| r.settings().display_name)
                .unwrap_or_default(),
        }
    } else {
        app.try_state::<DesktopRuntime>()
            .map(|r| r.settings().display_name)
            .unwrap_or_default()
    };

    let mut insight = String::new();

    let featured_module = query_featured_module(&db, today_start, today_end, &mut insight).await?;
    let recent_activity = query_recent_activity(&db, &mut insight).await?;
    let streak = query_streak(&db, &mut insight).await?;
    let featured_metric = query_featured_metric(&db, today_start, &mut insight).await?;
    let preferred_module = read_runtime_state(&db, "last_active_module").await?;
    let recent_modules = query_recent_modules(&db, preferred_module.as_deref()).await?;

    if insight.is_empty() {
        insight = String::from("Welcome back! Open a module to get started");
    }

    let accent_a = String::from("#4F6EF7");
    let accent_b = String::from("#5B7BFA");

    let payload = DashboardPayload {
        greeting: compute_greeting(&display_name),
        insight_line: insight,
        featured_module,
        recent_activity,
        streak,
        featured_metric,
        recent_modules,
        gradient_colors: [accent_a, accent_b],
    };

    // Store in cache
    cache.set(payload.clone());

    Ok(payload)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    /// Create an in-memory SQLite pool and run all table migrations.
    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory SQLite pool");

        // Create schema (subset of tables used by dashboard queries)
        let migrations = [
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                due_at INTEGER,
                archived INTEGER NOT NULL DEFAULT 0,
                parent_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                frequency TEXT NOT NULL DEFAULT 'daily',
                created_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS habit_completions (
                habit_id TEXT REFERENCES habits(id) ON DELETE CASCADE,
                completed_at INTEGER NOT NULL,
                PRIMARY KEY (habit_id, completed_at)
            )",
            "CREATE TABLE IF NOT EXISTS health_logs (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                value REAL,
                unit TEXT,
                metadata TEXT DEFAULT '{}',
                logged_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS module_settings (
                module_id TEXT PRIMARY KEY,
                data TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS module_context (
                module TEXT PRIMARY KEY,
                scroll_position REAL NOT NULL DEFAULT 0,
                last_open_id TEXT,
                cursor_position INTEGER,
                extra TEXT NOT NULL DEFAULT '{}'
            )",
            "CREATE TABLE IF NOT EXISTS runtime_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS dashboard_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                module_id TEXT NOT NULL,
                related_module_id TEXT,
                action TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL
            )",
        ];

        for migration in &migrations {
            sqlx::query(migration)
                .execute(&pool)
                .await
                .expect("Migration failed");
        }

        pool
    }

    /// Seed fixture data into the test database.
    async fn seed_fixtures(pool: &SqlitePool) {
        let now = chrono::Utc::now().timestamp_millis();
        let today_start = today_start_ms();

        // Tasks — 3 due today (not done), 2 done today, 1 done yesterday
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-1").bind("Buy groceries").bind(0).bind("high").bind(today_start + 3600_000).bind(now - 86400_000).bind(now - 3600_000)
            .execute(pool).await.unwrap();
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-2").bind("Write report").bind(0).bind("medium").bind(today_start + 7200_000).bind(now - 172800_000).bind(now - 7200_000)
            .execute(pool).await.unwrap();
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-3").bind("Call dentist").bind(0).bind("low").bind(today_start + 14400_000).bind(now - 259200_000).bind(now - 14400_000)
            .execute(pool).await.unwrap();
        // Completed today
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-4").bind("Morning jog").bind(1).bind("high").bind(now - 3600_000).bind(now - 86400_000).bind(now - 1800_000)
            .execute(pool).await.unwrap();
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-5").bind("Read chapter 5").bind(1).bind("medium").bind(now - 7200_000).bind(now - 172800_000).bind(now - 3600_000)
            .execute(pool).await.unwrap();
        // Completed yesterday
        sqlx::query("INSERT INTO tasks (id, title, done, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("task-6").bind("Clean desk").bind(1).bind("low").bind(now - 90000_000).bind(now - 259200_000).bind(now - 90000_000)
            .execute(pool).await.unwrap();

        // Notes — 2 recent edits
        sqlx::query("INSERT INTO notes (id, title, content, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("note-1").bind("Meeting notes").bind("Discussed Q2 roadmap").bind("[]").bind(0).bind(now - 86400_000).bind(now - 600_000)
            .execute(pool).await.unwrap();
        sqlx::query("INSERT INTO notes (id, title, content, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind("note-2").bind("Ideas for app").bind("New feature brainstorm").bind("[]").bind(0).bind(now - 172800_000).bind(now - 1200_000)
            .execute(pool).await.unwrap();

        // Habits — 2 habits
        sqlx::query("INSERT INTO habits (id, name, frequency, created_at) VALUES (?, ?, ?, ?)")
            .bind("habit-1")
            .bind("Exercise")
            .bind("daily")
            .bind(now - 604800_000)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO habits (id, name, frequency, created_at) VALUES (?, ?, ?, ?)")
            .bind("habit-2")
            .bind("Read")
            .bind("daily")
            .bind(now - 604800_000)
            .execute(pool)
            .await
            .unwrap();

        // Habit completions — 5-day streak for habit-1, 3-day for habit-2
        for day_offset in 0..5 {
            let ts = today_start - (day_offset as i64 * 86400_000);
            sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
                .bind("habit-1")
                .bind(ts)
                .execute(pool)
                .await
                .unwrap();
        }
        for day_offset in 0..3 {
            let ts = today_start - (day_offset as i64 * 86400_000);
            sqlx::query("INSERT INTO habit_completions (habit_id, completed_at) VALUES (?, ?)")
                .bind("habit-2")
                .bind(ts)
                .execute(pool)
                .await
                .unwrap();
        }

        // Health logs — 2 today
        sqlx::query("INSERT INTO health_logs (id, type, value, unit, metadata, logged_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind("health-1").bind("weight").bind(75.5).bind("kg").bind("{}").bind(now - 1800_000)
            .execute(pool).await.unwrap();
        sqlx::query("INSERT INTO health_logs (id, type, value, unit, metadata, logged_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind("health-2").bind("steps").bind(8432.0).bind("steps").bind("{}").bind(now - 600_000)
            .execute(pool).await.unwrap();

        // Module settings — tasks and health have recent updates
        sqlx::query("INSERT INTO module_settings (module_id, data, updated_at) VALUES (?, ?, ?)")
            .bind("tasks")
            .bind("{}")
            .bind(now - 300_000)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO module_settings (module_id, data, updated_at) VALUES (?, ?, ?)")
            .bind("health")
            .bind("{}")
            .bind(now - 600_000)
            .execute(pool)
            .await
            .unwrap();
    }

    // ── Tests ──────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_query_featured_module_tasks_due_today() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;
        let ts = today_start_ms();
        let te = today_end_ms();
        let mut insight = String::new();

        let result = query_featured_module(&pool, ts, te, &mut insight)
            .await
            .unwrap();

        assert_eq!(result.primary_count, 3, "should find 3 tasks due today");
        assert_eq!(result.items.len(), 3, "should return 3 items");
        assert!(result.items[0].text.contains("grocery") || result.items[0].text.contains("Buy"));
        assert!(!insight.is_empty());
    }

    #[tokio::test]
    async fn test_query_featured_module_no_tasks() {
        let pool = setup_test_db().await;
        let ts = today_start_ms();
        let te = today_end_ms();
        let mut insight = String::new();

        let result = query_featured_module(&pool, ts, te, &mut insight)
            .await
            .unwrap();

        assert_eq!(result.primary_count, 0, "should have 0 tasks");
        assert!(insight.contains("No tasks yet"));
    }

    #[tokio::test]
    async fn test_query_recent_activity() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;
        let mut insight = String::new();

        let result = query_recent_activity(&pool, &mut insight).await.unwrap();

        assert!(!result.is_empty(), "should have activity entries");
        assert!(result.len() <= 5, "should cap at 5 entries");
        // Most recent action should mention a task or note
        assert!(
            result[0].action.contains("Completed")
                || result[0].action.contains("Created")
                || result[0].action.contains("Edited")
        );
    }

    #[tokio::test]
    async fn test_query_recent_activity_empty_db() {
        let pool = setup_test_db().await;
        let mut insight = String::new();

        let result = query_recent_activity(&pool, &mut insight).await.unwrap();

        assert!(result.is_empty(), "should be empty with no data");
    }

    #[tokio::test]
    async fn test_query_streak() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;
        let mut insight = String::new();

        let result = query_streak(&pool, &mut insight).await.unwrap();

        assert!(result.count >= 5, "should detect 5-day streak");
        assert!(!result.module_id.is_empty());
    }

    #[tokio::test]
    async fn test_query_streak_no_habits() {
        let pool = setup_test_db().await;
        let mut insight = String::new();

        let result = query_streak(&pool, &mut insight).await.unwrap();

        assert_eq!(result.count, 0, "should return 0 with no habit data");
    }

    #[tokio::test]
    async fn test_query_featured_metric_trend() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;
        let ts = today_start_ms();
        let mut insight = String::new();

        let result = query_featured_metric(&pool, ts, &mut insight)
            .await
            .unwrap();

        assert_eq!(result.value, "2", "2 tasks done today");
        assert!(
            result.trend.is_some(),
            "should have trend since yesterday had tasks"
        );
        let trend = result.trend.unwrap();
        assert_eq!(trend.direction, "up");
    }

    #[tokio::test]
    async fn test_query_recent_modules() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;

        let result = query_recent_modules(&pool, None).await.unwrap();

        assert!(!result.is_empty(), "should return modules");
        // tasks and health should be in the list (have recent data)
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"tasks"), "tasks should be in recent modules");
        assert!(
            ids.contains(&"health"),
            "health should be in recent modules"
        );
    }

    #[tokio::test]
    async fn test_query_recent_modules_empty_db() {
        let pool = setup_test_db().await;

        let result = query_recent_modules(&pool, None).await.unwrap();

        assert!(!result.is_empty(), "should return fallback starter modules");
        assert_eq!(result.len(), 8, "should return 8 fallback modules");
    }

    #[tokio::test]
    async fn test_query_recent_modules_prioritizes_last_active_module() {
        let pool = setup_test_db().await;
        seed_fixtures(&pool).await;

        sqlx::query(
            "INSERT INTO runtime_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind("last_active_module")
        .bind("grocery")
        .execute(&pool)
        .await
        .unwrap();

        let result = query_recent_modules(&pool, Some("grocery")).await.unwrap();

        assert_eq!(
            result.first().map(|module| module.id.as_str()),
            Some("grocery"),
            "the dashboard should continue in the exact last active module",
        );
    }

    #[tokio::test]
    async fn test_compute_greeting_with_and_without_name() {
        let greeting_no_name = compute_greeting("");
        assert!(
            !greeting_no_name.contains(','),
            "no comma when name is empty"
        );

        let greeting_with_name = compute_greeting("Alex");
        assert!(greeting_with_name.contains("Alex"), "should include name");
        assert!(
            greeting_with_name.contains("Good "),
            "should start with Good"
        );
    }

    #[tokio::test]
    async fn test_relative_time() {
        let now = now_ms();

        let just_now = relative_time(now);
        assert_eq!(just_now, "just now");

        let five_mins_ago = relative_time(now - 300_000);
        assert_eq!(five_mins_ago, "5m ago");

        let two_hours_ago = relative_time(now - 7_200_000);
        assert_eq!(two_hours_ago, "2h ago");

        let three_days_ago = relative_time(now - 259_200_000);
        assert_eq!(three_days_ago, "3d ago");
    }
}
