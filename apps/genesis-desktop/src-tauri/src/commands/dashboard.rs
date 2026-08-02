// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use std::sync::Mutex;
use std::time::Instant;

use chrono::{Datelike, Timelike};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::Manager;

use crate::auth::{AuthBootstrapState, AuthManager};
use crate::commands::sync::sync_user_data;
use crate::db::read_runtime_state;
use crate::db::BentoAppState;
use crate::runtime::DesktopRuntime;
use crate::util::time;
use tracing::{info, warn, error};

// ---------------------------------------------------------------------------
// DashboardCache — stale-while-revalidate cache
// ---------------------------------------------------------------------------
//
// Architecture:
//   - Fresh TTL: 30 seconds (same as before). Cache returns fresh data.
//   - Stale TTL: 5 minutes. After fresh expires, the cache still holds the
//     previous payload for a "stale-while-revalidate" pattern. If a new query
//     fails or times out, the stale data is returned instead of an empty
//     fallback. This ensures the dashboard ALWAYS has SOMETHING to show,
//     even during transient DB contention or network interruptions.
//   - The stale data is only served when a REQUEST fails. On a healthy path,
//     fresh data replaces the stale entry as usual.
//
// This prevents the "Loading..." fallback that currently appears every time
// the DB pool is briefly congested.

const CACHE_TTL_FRESH: std::time::Duration = std::time::Duration::from_secs(30);
const CACHE_TTL_STALE: std::time::Duration = std::time::Duration::from_secs(300); // 5 min

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

    /// Returns fresh cache data if within the 30s TTL.
    pub fn get(&self) -> Option<DashboardPayload> {
        if let Ok(guard) = self.cached.lock() {
            if let Some((payload, time)) = guard.as_ref() {
                if time.elapsed() < CACHE_TTL_FRESH {
                    return Some(payload.clone());
                }
            }
        }
        None
    }

    /// Returns stale data (up to 5 min old) even if the cache TTL has expired.
    /// Used as a fallback when a fresh query fails — never return empty data
    /// when stale data is available.
    pub fn get_stale(&self) -> Option<DashboardPayload> {
        if let Ok(guard) = self.cached.lock() {
            if let Some((payload, time)) = guard.as_ref() {
                if time.elapsed() < CACHE_TTL_STALE {
                    return Some(payload.clone());
                }
            }
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
        "goals" => ("Goal Tracker", "trophy", "#ccff00"),
        "clipboard" => ("Clipboard Manager", "clipboard-list", "#e11d48"),
        "voice-memos" => ("Voice Memos", "mic", "#8b5cf6"),
        "countdown" => ("Countdown / Life Events", "hourglass", "#ec4899"),
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
    use chrono::Local;
    let now = Local::now();
    let hour = now.hour();
    let day_of_year = now.ordinal();

    // Deterministic rotation: different greeting each day, cycles every ~60 days
    let idx = (day_of_year as usize) % 8;

    let base = match hour {
        // Night: 12am–5am
        0..=5 => {
            let greetings = [
                "Still up? Respect the grind",
                "The world is quiet — you should be too",
                "Late night sessions build empires",
                "Sleep is a power-up, not a timeout",
                "The night is yours — but so is tomorrow",
                "Burning midnight oil? Make it count",
                "Even the stars take turns resting",
                "Your best ideas come after rest",
            ];
            greetings[idx]
        }
        // Early morning: 6am–8am
        6..=8 => {
            let greetings = [
                "Rise and shine — today has plans for you",
                "The early light hits different, doesn't it?",
                "Another chance to make it happen",
                "Morning air is fresh — so is your perspective",
                "The sun showed up. So did you.",
                "A new day, a clean slate, a fresh start",
                "Dawn is nature's way of saying try again",
                "First light, first breath, first move",
            ];
            greetings[idx]
        }
        // Mid-morning: 9am–11am
        9..=11 => {
            let greetings = [
                "Good morning — the day is yours to shape",
                "You're up and the world is better for it",
                "Fresh eyes, sharp mind, let's go",
                "The morning is young and so are your ideas",
                "Coffee in hand, world on track",
                "Mornings like these are built, not found",
                "The best time to start was yesterday. The next best time is now",
                "You showed up — that's half the battle",
            ];
            greetings[idx]
        }
        // Afternoon: 12pm–5pm
        12..=17 => {
            let greetings = [
                "Good afternoon — still going strong",
                "The day is half done. How's the other half looking?",
                "Afternoon energy hits different when you're on track",
                "Keep the momentum — you're doing great",
                "Halfway through and still standing tall",
                "The afternoon stretch — where real work happens",
                "You've got the whole second half ahead of you",
                "Steady wins the race. Keep going.",
            ];
            greetings[idx]
        }
        // Evening: 6pm–9pm
        18..=21 => {
            let greetings = [
                "Good evening — you earned this moment",
                "The day is winding down. How'd it go?",
                "Evenings are for reflection and recharge",
                "You made it through another one. That counts.",
                "The golden hour — literally and figuratively",
                "Rest is productive too. Remember that.",
                "The sun sets, but your progress doesn't",
                "Evening calm is the reward for a day well spent",
            ];
            greetings[idx]
        }
        // Late night: 10pm–11pm
        _ => {
            let greetings = [
                "Winding down? Tomorrow is a fresh page",
                "Night mode activated — time to recharge",
                "The best rest comes after the best effort",
                "You did enough today. Let go and recharge.",
                "Sleep is the secret weapon. Use it.",
                "Close the tabs — mental and digital",
                "Tomorrow's wins start with tonight's rest",
                "The night is for restoration, not decoration",
            ];
            greetings[idx]
        }
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
            "tasks", "journal", "habits", "focus", "health", "mood", "budget",
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
            | "goals"
            | "clipboard"
            | "voice-memos"
            | "countdown"
    )
}

// ---------------------------------------------------------------------------
// Query runner — shared between reader and writer pool attempts
// ---------------------------------------------------------------------------

/// Run all dashboard queries against `db` and assemble the payload.
/// Does NOT check the cache — the caller does that.
async fn run_dashboard_queries(
    db: &SqlitePool,
    app: &tauri::AppHandle,
    cache: &DashboardCache,
) -> Result<DashboardPayload, String> {
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

    let featured_module = query_featured_module(db, today_start, today_end, &mut insight).await?;
    let recent_activity = query_recent_activity(db, &mut insight).await?;
    let streak = query_streak(db, &mut insight).await?;
    let featured_metric = query_featured_metric(db, today_start, &mut insight).await?;
    let preferred_module = read_runtime_state(db, "last_active_module").await?;
    let recent_modules = query_recent_modules(db, preferred_module.as_deref()).await?;

    if insight.is_empty() {
        insight = String::from("Welcome back! Open a module to get started");
    }

    let payload = DashboardPayload {
        greeting: compute_greeting(&display_name),
        insight_line: insight,
        featured_module,
        recent_activity,
        streak,
        featured_metric,
        recent_modules,
        gradient_colors: ["#4F6EF7".to_string(), "#5B7BFA".to_string()],
    };

    // Store in cache
    cache.set(payload.clone());

    Ok(payload)
}

// ---------------------------------------------------------------------------
// Main dashboard command
// ---------------------------------------------------------------------------

/// Fallback payload returned when the dashboard query times out.
/// Ensures the frontend never hangs forever waiting for data.
fn fallback_payload() -> DashboardPayload {
    DashboardPayload {
        greeting: compute_greeting(""),
        insight_line: "Loading...".to_string(),
        featured_module: FeaturedModule {
            id: "tasks".to_string(),
            name: "Tasks".to_string(),
            icon: "layout-grid".to_string(),
            accent_hex: "#52b788".to_string(),
            primary_count: 0,
            primary_label: "tasks".to_string(),
            descriptor_label: "Open Tasks →".to_string(),
            items: vec![DashboardItem {
                text: "Add a task to get started".to_string(),
                secondary: None,
                completed: false,
            }],
        },
        recent_activity: vec![],
        streak: StreakInfo {
            count: 0,
            module_id: "habits".to_string(),
            module_name: "Habits".to_string(),
        },
        featured_metric: MetricInfo {
            label: "tasks done today".to_string(),
            value: "0".to_string(),
            module_id: "tasks".to_string(),
            trend: None,
        },
        recent_modules: vec![],
        gradient_colors: ["#4F6EF7".to_string(), "#5B7BFA".to_string()],
    }
}

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

    // ── Reader pool (first attempt) ──────────────────────────────────────
    // Use the dedicated reader pool to avoid competing with user-facing IPC
    // writes for the single writer connection slot. If the reader pool times
    // out (e.g. pool contention or a dormant connection), we fall back to
    // the writer pool — the dashboard MUST always return data.
    let reader_db = state.db_reader();

    // ── Fire-and-forget: sync Supabase data in background ────────────────
    // DO NOT await sync in the dashboard hot path. reqwest uses blocking DNS
    // on Windows which can block the tokio worker thread, preventing the
    // timeout from firing and causing the dashboard to hang for 10+ seconds.
    // The local DB already has the user's data — sync is just a refresh.
    {
        let db_clone = reader_db.clone();
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            if let Some(auth) = app_clone.try_state::<AuthManager>() {
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(15),
                    sync_user_data(&db_clone, &auth),
                )
                .await;
            }
        });
    }

    // Reader pool: 4s timeout — if the reader pool is congested, fail fast
    // and fall back to the writer pool below.
    let reader_result = tokio::time::timeout(
        std::time::Duration::from_secs(4),
        run_dashboard_queries(&reader_db, &app, &*cache),
    )
    .await;

    match reader_result {
        Ok(Ok(payload)) => return Ok(payload),
        Ok(Err(db_err)) => {
            warn!(
                "[dashboard] reader pool query failed: {db_err} — falling back to writer pool"
            );
        }
        Err(_timeout) => {
            warn!("[dashboard] reader pool timed out after 4s — falling back to writer pool");
        }
    }

    // ── Writer pool (fallback) ───────────────────────────────────────────
    // The writer pool has `acquire_timeout(15s)` and one dedicated slot, so
    // it should never time out for a read-only workload. This fallback
    // ensures the dashboard ALWAYS returns data even if the reader pool is
    // temporarily congested or has a dormant connection issue.
    warn!("[dashboard] retrying on writer pool...");
    let writer_db = state.db();

    // Writer pool: 5s timeout — generous, but still protects the IPC thread.
    let writer_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        run_dashboard_queries(&writer_db, &app, &*cache),
    )
    .await;

    match writer_result {
        Ok(Ok(payload)) => {
            info!("[dashboard] writer pool fallback succeeded");
            Ok(payload)
        }
        Ok(Err(db_err)) => {
            error!("[dashboard] writer pool query also failed: {db_err}");
            if let Some(stale) = cache.get_stale() {
                warn!("[dashboard] returning stale cached data instead of fallback");
                Ok(stale)
            } else {
                warn!("[dashboard] no stale data — returning empty fallback");
                Ok(fallback_payload())
            }
        }
        Err(_timeout) => {
            warn!("[dashboard] writer pool also timed out — returning stale or fallback");
            if let Some(stale) = cache.get_stale() {
                warn!("[dashboard] returning stale cached data instead of fallback");
                Ok(stale)
            } else {
                warn!("[dashboard] no stale data — returning empty fallback");
                Ok(fallback_payload())
            }
        }
    }
}

