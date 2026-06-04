// ─────────────────────────────────────────────────────────────────────────────
// Sleep Tauri Commands — SQLite-backed
//
// TWO SYSTEMS coexist:
//   1. Legacy: sleep_logs, sleep_routines, sleep_alarms (manual log + checklist)
//   2. Sessions: sleep_sessions, sleep_goals (OS-detected + manual sessions)
//
// The OS sleep/wake detection runs as a background thread using sysinfo
// to poll system uptime. When the system resumes from sleep, a session
// is automatically recorded.
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::{
    atomic::{AtomicU64, Ordering},
};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ═════════════════════════════════════════════════════════════════════════════
// NEW: SLEEP SESSION (OS-detected or manual)
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepSession {
    pub id: String,
    pub date: String,               // YYYY-MM-DD (evening date)
    pub sleep_onset_ts: i64,         // unix ms: when sleep started
    pub wake_ts: i64,                // unix ms: when woke up
    pub last_active_ts: Option<i64>, // unix ms: last input before sleep
    pub duration_min: i32,           // computed minutes
    pub quality_score: Option<f64>,  // 0-100 computed
    pub notes: Option<String>,
    pub source: String,              // 'auto' | 'manual'
    pub confirmation_pending: bool,  // needs morning confirmation?
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSessionInput {
    pub date: String,           // YYYY-MM-DD
    pub sleep_time: String,     // HH:MM (local)
    pub wake_time: String,      // HH:MM (local)
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepGoal {
    pub target_bedtime: String,  // HH:MM
    pub target_waketime: String, // HH:MM
    pub target_duration_min: i32,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepStats {
    pub avg_duration_min: f64,
    pub avg_bedtime: String,
    pub avg_waketime: String,
    pub consistency_score: f64,
    pub sleep_debt_min: i64,
    pub longest_streak_days: i32,
    pub current_streak_days: i32,
    pub weekday_avg_min: f64,
    pub weekend_avg_min: f64,
    pub social_jet_lag_min: f64,
    pub total_sessions: i32,
}

// ═════════════════════════════════════════════════════════════════════════════
// LEGACY: types kept for backward compat
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepLogEntry {
    pub bedtime: Option<String>,
    pub wake_time: Option<String>,
    pub hours: f64,
    pub quality: Option<i32>,
    pub notes: Option<String>,
    pub stages: Option<SleepStages>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepStages {
    pub deep_minutes: i32,
    pub rem_minutes: i32,
    pub light_minutes: i32,
    pub awake_minutes: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepLogRow {
    pub id: String,
    pub date_key: String,
    pub bedtime: Option<String>,
    pub wake_time: Option<String>,
    pub hours: f64,
    pub score: i32,
    pub quality: Option<i32>,
    pub notes: Option<String>,
    pub stages: Option<SleepStages>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepRoutine {
    pub id: String,
    pub title: String,
    pub sort_order: i32,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepRoutineInput {
    pub title: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineTracking {
    pub routine_id: String,
    pub date_key: String,
    pub completed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepAlarm {
    pub id: String,
    pub label: String,
    pub time: String,
    pub wake_window: String,
    pub mode: String,
    pub active: bool,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepAlarmInput {
    pub label: String,
    pub time: String,
    pub wake_window: Option<String>,
    pub mode: Option<String>,
}

// ═════════════════════════════════════════════════════════════════════════════
// NEW: SLEEP SESSION COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

/// Returns the last N days of sleep sessions ordered by date desc.
#[tauri::command]
pub async fn get_sleep_sessions(
    state: State<'_, BentoAppState>,
    days: Option<i32>,
) -> Result<Vec<SleepSession>, String> {
    ensure_sleep_tables(&state.db()).await?;
    let n = days.unwrap_or(7).max(1).min(365);

    let rows = sqlx::query(
        "SELECT id, date, sleep_onset_ts, wake_ts, last_active_ts, duration_min, quality_score, notes, source, confirmation_pending, created_at
         FROM sleep_sessions ORDER BY date DESC LIMIT ?",
    )
    .bind(n as i64)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(session_from_row).collect())
}

/// Returns the most recent completed session (last night).
#[tauri::command]
pub async fn get_last_night(
    state: State<'_, BentoAppState>,
) -> Result<Option<SleepSession>, String> {
    ensure_sleep_tables(&state.db()).await?;

    let row = sqlx::query(
        "SELECT id, date, sleep_onset_ts, wake_ts, last_active_ts, duration_min, quality_score, notes, source, confirmation_pending, created_at
         FROM sleep_sessions WHERE wake_ts > 0 ORDER BY date DESC LIMIT 1",
    )
    .fetch_optional(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(session_from_row))
}

/// Get the current sleep goal (creates default if none exists).
#[tauri::command]
pub async fn get_sleep_goal(
    state: State<'_, BentoAppState>,
) -> Result<SleepGoal, String> {
    ensure_sleep_tables(&state.db()).await?;
    ensure_default_goal(&state.db()).await?;

    let row = sqlx::query(
        "SELECT target_bedtime, target_waketime, target_duration_min, updated_at
         FROM sleep_goals WHERE id = 'default'",
    )
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(SleepGoal {
        target_bedtime: row.get("target_bedtime"),
        target_waketime: row.get("target_waketime"),
        target_duration_min: row.get::<i64, _>("target_duration_min") as i32,
        updated_at: row.get("updated_at"),
    })
}

/// Update the sleep goal.
#[tauri::command]
pub async fn update_sleep_goal(
    state: State<'_, BentoAppState>,
    bedtime: String,
    waketime: String,
    duration: i32,
) -> Result<SleepGoal, String> {
    ensure_sleep_tables(&state.db()).await?;
    let now = time::now_ms();
    let clamped_dur = duration.clamp(360, 600); // 6h-10h

    sqlx::query(
        "INSERT INTO sleep_goals (id, target_bedtime, target_waketime, target_duration_min, updated_at)
         VALUES ('default', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            target_bedtime = excluded.target_bedtime,
            target_waketime = excluded.target_waketime,
            target_duration_min = excluded.target_duration_min,
            updated_at = excluded.updated_at",
    )
    .bind(&bedtime)
    .bind(&waketime)
    .bind(clamped_dur as i64)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(SleepGoal {
        target_bedtime: bedtime,
        target_waketime: waketime,
        target_duration_min: clamped_dur,
        updated_at: now,
    })
}

/// Add a manual sleep session (for days when user wants to log manually).
#[tauri::command]
pub async fn add_manual_sleep_session(
    state: State<'_, BentoAppState>,
    input: ManualSessionInput,
) -> Result<SleepSession, String> {
    ensure_sleep_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    // Parse local time strings to UTC ms for the given date
    // Use space separator to match parse_naive_datetime format "%Y-%m-%d %H:%M:%S"
    let sleep_dt = format!("{} {}:00", input.date, input.sleep_time);
    let wake_dt = format!("{} {}:00", input.date, input.wake_time);

    let sleep_ms = time::parse_naive_datetime(&sleep_dt)
        .or_else(|| {
            // Try next day for wake time (went to bed before midnight but after)
            let next = add_day(&input.date);
            let next_dt = format!("{}T{}:00", next, input.wake_time);
            time::parse_naive_datetime(&next_dt)
        })
        .unwrap_or(now);

    let wake_ms = time::parse_naive_datetime(&wake_dt)
        .or_else(|| {
            let next = add_day(&input.date);
            let next_dt = format!("{}T{}:00", next, input.wake_time);
            time::parse_naive_datetime(&next_dt)
        })
        .unwrap_or(now);

    let duration_min = ((wake_ms - sleep_ms) / 60_000) as i32;
    let capped = duration_min.clamp(20, 720);
    let quality = compute_quality(capped, &state.db()).await;

    sqlx::query(
        "INSERT INTO sleep_sessions (id, date, sleep_onset_ts, wake_ts, last_active_ts, duration_min, quality_score, notes, source, confirmation_pending, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?)",
    )
    .bind(&id)
    .bind(&input.date)
    .bind(sleep_ms)
    .bind(wake_ms)
    .bind(None::<i64>)
    .bind(capped as i64)
    .bind(quality)
    .bind(&input.notes)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(SleepSession {
        id,
        date: input.date,
        sleep_onset_ts: sleep_ms,
        wake_ts: wake_ms,
        last_active_ts: None,
        duration_min: capped,
        quality_score: Some(quality),
        notes: input.notes,
        source: "manual".into(),
        confirmation_pending: false,
        created_at: now,
    })
}

/// Delete a sleep session by id.
#[tauri::command]
pub async fn delete_sleep_session(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<bool, String> {
    ensure_sleep_tables(&state.db()).await?;

    let result = sqlx::query("DELETE FROM sleep_sessions WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected() > 0)
}

/// Confirm or discard a pending session (morning confirmation).
#[tauri::command]
pub async fn confirm_sleep_session(
    state: State<'_, BentoAppState>,
    id: String,
    accept: bool,
) -> Result<bool, String> {
    ensure_sleep_tables(&state.db()).await?;

    if accept {
        sqlx::query("UPDATE sleep_sessions SET confirmation_pending = 0 WHERE id = ?")
            .bind(&id)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        sqlx::query("DELETE FROM sleep_sessions WHERE id = ? AND source = 'auto'")
            .bind(&id)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(false)
    }
}

/// Get comprehensive sleep stats for a period.
#[tauri::command]
pub async fn get_sleep_stats(
    state: State<'_, BentoAppState>,
    days: Option<i32>,
) -> Result<SleepStats, String> {
    ensure_sleep_tables(&state.db()).await?;
    let n = days.unwrap_or(30).max(1).min(365);

    let sessions = sqlx::query(
        "SELECT id, date, sleep_onset_ts, wake_ts, last_active_ts, duration_min, quality_score, notes, source, confirmation_pending, created_at
         FROM sleep_sessions WHERE duration_min >= 20 AND wake_ts > 0 ORDER BY date DESC LIMIT ?",
    )
    .bind(n as i64)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let sessions: Vec<SleepSession> = sessions.into_iter().map(session_from_row).collect();
    let count = sessions.len() as i32;

    if count == 0 {
        return Ok(SleepStats {
            avg_duration_min: 0.0,
            avg_bedtime: "--:--".into(),
            avg_waketime: "--:--".into(),
            consistency_score: 0.0,
            sleep_debt_min: 0,
            longest_streak_days: 0,
            current_streak_days: 0,
            weekday_avg_min: 0.0,
            weekend_avg_min: 0.0,
            social_jet_lag_min: 0.0,
            total_sessions: 0,
        });
    }

    let goal = get_sleep_goal_inner(&state.db()).await;
    let target = goal.target_duration_min as f64;

    let avg_dur = sessions.iter().map(|s| s.duration_min as f64).sum::<f64>() / count as f64;

    // Average bedtime/waketime as "HH:MM"
    let avg_bed = average_time(&sessions, |s| s.sleep_onset_ts);
    let avg_wake = average_time(&sessions, |s| s.wake_ts);

    // Consistency: inverse of bedtime variance (0-100)
    let bedtime_minutes: Vec<f64> = sessions
        .iter()
        .map(|s| ts_to_local_minutes(s.sleep_onset_ts))
        .collect();
    let avg_bed_min = bedtime_minutes.iter().sum::<f64>() / count as f64;
    let variance = bedtime_minutes
        .iter()
        .map(|m| (m - avg_bed_min).powi(2))
        .sum::<f64>()
        / count as f64;
    let stddev = variance.sqrt();
    let consistency = (100.0 - (stddev * 2.0)).clamp(0.0, 100.0);

    // Sleep debt: cumulative deficit vs goal
    let debt: i64 = sessions
        .iter()
        .map(|s| (target - s.duration_min as f64).max(0.0) as i64)
        .sum();

    // Streak: consecutive days meeting >= 90% of goal duration
    let mut sorted: Vec<&SleepSession> = sessions.iter().collect();
    sorted.sort_by(|a, b| a.date.cmp(&b.date));

    let mut longest = 0i32;
    let mut run = 0i32;
    let min_ok = (target * 0.9) as i32;

    for s in &sorted {
        if s.duration_min >= min_ok {
            run += 1;
            if run > longest {
                longest = run;
            }
        } else {
            run = 0;
        }
    }
    let current = run; // most recent streak

    // Weekday vs weekend averages
    let mut wday_sum = 0.0_f64;
    let mut wday_n = 0i32;
    let mut wend_sum = 0.0_f64;
    let mut wend_n = 0i32;

    for s in &sessions {
        if is_weekend(&s.date) {
            wend_sum += s.duration_min as f64;
            wend_n += 1;
        } else {
            wday_sum += s.duration_min as f64;
            wday_n += 1;
        }
    }

    let wday_avg = if wday_n > 0 { wday_sum / wday_n as f64 } else { 0.0 };
    let wend_avg = if wend_n > 0 { wend_sum / wend_n as f64 } else { 0.0 };
    let jetlag = (wday_avg - wend_avg).abs();

    Ok(SleepStats {
        avg_duration_min: (avg_dur * 10.0).round() / 10.0,
        avg_bedtime: avg_bed,
        avg_waketime: avg_wake,
        consistency_score: (consistency * 10.0).round() / 10.0,
        sleep_debt_min: debt,
        longest_streak_days: longest,
        current_streak_days: current,
        weekday_avg_min: (wday_avg * 10.0).round() / 10.0,
        weekend_avg_min: (wend_avg * 10.0).round() / 10.0,
        social_jet_lag_min: (jetlag * 10.0).round() / 10.0,
        total_sessions: count,
    })
}

// ═════════════════════════════════════════════════════════════════════════════
// OS SLEEP DETECTION (background thread)
// ═════════════════════════════════════════════════════════════════════════════

/// Global shared: timestamp of last user activity (updated every 60s)
pub static LAST_ACTIVE_TS: AtomicU64 = AtomicU64::new(0);

/// Spawn the background thread that:
/// 1. Updates LAST_ACTIVE_TS every 60 seconds
/// 2. Monitors system uptime to detect sleep/wake cycles
/// 3. Records auto-detected sessions
pub fn spawn_sleep_monitor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut system = sysinfo::System::new();
        let mut last_uptime: u64 = 0;
        let mut sleep_onset: Option<i64> = None;

        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));

            // Update last active timestamp
            LAST_ACTIVE_TS.store(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
                Ordering::Relaxed,
            );

            system.refresh_cpu_all();
            let uptime = sysinfo::System::uptime();

            if last_uptime > 0 {
                let elapsed = uptime as i64 - last_uptime as i64;

                if elapsed > 120 {
                    // System was asleep (uptime jumped by >2min)
                    let now_ms = time::now_ms();
                    let _sleep_start = now_ms - (elapsed * 1000) as i64;

                    if let Some(onset) = sleep_onset {
                        // Complete the pending session
                        let app_clone = app.clone();
                        let handle = app_clone;
                        tauri::async_runtime::spawn(async move {
                            record_auto_session(&handle, onset, now_ms).await;
                        });
                        sleep_onset = None;
                    }
                }
            }

            last_uptime = uptime;
        }
    });
}

async fn record_auto_session(app: &AppHandle, onset_ms: i64, wake_ms: i64) {
    let state = app.state::<BentoAppState>();
    let pool = state.db();

    let _ = ensure_sleep_tables(&pool).await;

    let duration_min = ((wake_ms - onset_ms) / 60_000) as i32;
    if duration_min < 20 {
        return; // Ignore accidental lid close
    }
    let capped = duration_min.min(720);

    let date = time::date_key(onset_ms);
    let last_active = Some(LAST_ACTIVE_TS.load(Ordering::Relaxed) as i64);
    let quality = compute_quality(capped, &pool).await;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    let _ = sqlx::query(
        "INSERT INTO sleep_sessions (id, date, sleep_onset_ts, wake_ts, last_active_ts, duration_min, quality_score, source, confirmation_pending, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', 1, ?)",
    )
    .bind(&id)
    .bind(&date)
    .bind(onset_ms)
    .bind(wake_ms)
    .bind(last_active)
    .bind(capped as i64)
    .bind(quality)
    .bind(now)
    .execute(&pool)
    .await;
}

async fn ensure_default_goal(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sleep_goals WHERE id = 'default'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    if exists == 0 {
        let now = time::now_ms();
        sqlx::query(
            "INSERT INTO sleep_goals (id, target_bedtime, target_waketime, target_duration_min, updated_at)
             VALUES ('default', '23:00', '07:00', 480, ?)",
        )
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

async fn get_sleep_goal_inner(pool: &sqlx::SqlitePool) -> SleepGoal {
    let _ = ensure_default_goal(pool).await;
    sqlx::query_as::<_, (String, String, i64, i64)>(
        "SELECT target_bedtime, target_waketime, target_duration_min, updated_at FROM sleep_goals WHERE id = 'default'",
    )
    .fetch_one(pool)
    .await
    .map(|(b, w, d, u)| SleepGoal {
        target_bedtime: b,
        target_waketime: w,
        target_duration_min: d as i32,
        updated_at: u,
    })
    .unwrap_or(SleepGoal {
        target_bedtime: "23:00".into(),
        target_waketime: "07:00".into(),
        target_duration_min: 480,
        updated_at: time::now_ms(),
    })
}

async fn compute_quality(duration_min: i32, pool: &sqlx::SqlitePool) -> f64 {
    let goal = get_sleep_goal_inner(pool).await;
    let target = goal.target_duration_min as f64;
    let ratio = (duration_min as f64 / target).clamp(0.0, 1.0);
    let base = ratio * 60.0;

    // consistency penalty uses goal bedtime
    let penalty = 0.0; // simplified: we don't have the actual bedtime here

    (base + 40.0 - penalty).clamp(0.0, 100.0)
}

fn session_from_row(row: sqlx::sqlite::SqliteRow) -> SleepSession {
    SleepSession {
        id: row.get("id"),
        date: row.get("date"),
        sleep_onset_ts: row.get("sleep_onset_ts"),
        wake_ts: row.get("wake_ts"),
        last_active_ts: row.get("last_active_ts"),
        duration_min: row.get::<i64, _>("duration_min") as i32,
        quality_score: row.get("quality_score"),
        notes: row.get("notes"),
        source: row.get("source"),
        confirmation_pending: row.get::<i64, _>("confirmation_pending") == 1,
        created_at: row.get("created_at"),
    }
}

fn average_time(sessions: &[SleepSession], extract: fn(&SleepSession) -> i64) -> String {
    if sessions.is_empty() {
        return "--:--".into();
    }
    let total_min: f64 = sessions
        .iter()
        .map(|s| ts_to_local_minutes(extract(s)))
        .sum();
    let avg_min = (total_min / sessions.len() as f64).round() as i32;
    let h = (avg_min / 60) % 24;
    let m = avg_min % 60;
    format!("{:02}:{:02}", h, m)
}

fn ts_to_local_minutes(ts_ms: i64) -> f64 {
    // Convert unix ms to local time minutes since midnight
    let secs = ts_ms / 1000;
    let local = chrono::Local::now();
    let offset = local.offset().local_minus_utc();
    let local_secs = secs + offset as i64;
    let total_min = (local_secs % 86400) / 60;
    total_min as f64
}

fn is_weekend(date: &str) -> bool {
    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        let wd = d.format("%u").to_string(); // 1=Mon, 7=Sun
        wd == "6" || wd == "7"
    } else {
        false
    }
}

fn add_day(date: &str) -> String {
    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        let next = d + chrono::Duration::days(1);
        next.format("%Y-%m-%d").to_string()
    } else {
        date.to_string()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// LEGACY COMMANDS (unchanged, kept for compatibility)
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn sleep_log_save(
    state: State<'_, BentoAppState>,
    entry: SleepLogEntry,
) -> Result<SleepLogRow, String> {
    inner_sleep_log_save(state, entry, &today_key()).await
}

#[tauri::command]
pub async fn sleep_log_save_for_date(
    state: State<'_, BentoAppState>,
    date_key: String,
    entry: SleepLogEntry,
) -> Result<SleepLogRow, String> {
    inner_sleep_log_save(state, entry, &date_key).await
}

async fn inner_sleep_log_save(
    state: State<'_, BentoAppState>,
    entry: SleepLogEntry,
    date: &str,
) -> Result<SleepLogRow, String> {
    ensure_sleep_tables(&state.db()).await?;
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let score = compute_legacy_score(&entry);
    let stages_json = entry.stages.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default()).unwrap_or_default();

    sqlx::query(
        r#"INSERT INTO sleep_logs (id, date_key, bedtime, wake_time, hours, score, quality, notes, stages, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date_key) DO UPDATE SET
            bedtime=excluded.bedtime, wake_time=excluded.wake_time, hours=excluded.hours,
            score=excluded.score, quality=excluded.quality, notes=excluded.notes,
            stages=excluded.stages, updated_at=excluded.updated_at"#,
    )
    .bind(&id).bind(date).bind(&entry.bedtime).bind(&entry.wake_time)
    .bind(entry.hours).bind(score as i64).bind(entry.quality)
    .bind(&entry.notes).bind(&stages_json).bind(now).bind(now)
    .execute(&state.db()).await.map_err(|e| e.to_string())?;

    Ok(SleepLogRow {
        id, date_key: date.to_string(), bedtime: entry.bedtime, wake_time: entry.wake_time,
        hours: entry.hours, score, quality: entry.quality, notes: entry.notes,
        stages: entry.stages, created_at: now, updated_at: now,
    })
}

#[tauri::command]
pub async fn sleep_log_today(state: State<'_, BentoAppState>) -> Result<Option<SleepLogRow>, String> {
    ensure_sleep_tables(&state.db()).await?;
    legacy_row_from_date(&state.db(), &today_key()).await
}

#[tauri::command]
pub async fn sleep_log_get(state: State<'_, BentoAppState>, date_key: String) -> Result<Option<SleepLogRow>, String> {
    ensure_sleep_tables(&state.db()).await?;
    legacy_row_from_date(&state.db(), &date_key).await
}

#[tauri::command]
pub async fn sleep_logs_week(state: State<'_, BentoAppState>) -> Result<Vec<SleepLogRow>, String> {
    ensure_sleep_tables(&state.db()).await?;
    legacy_logs_since(&state.db(), 7).await
}

#[tauri::command]
pub async fn sleep_logs_recent(state: State<'_, BentoAppState>, days: Option<i32>) -> Result<Vec<SleepLogRow>, String> {
    ensure_sleep_tables(&state.db()).await?;
    let n = days.unwrap_or(5).max(1).min(365);
    legacy_logs_since(&state.db(), n).await
}

#[tauri::command]
pub async fn sleep_log_delete(state: State<'_, BentoAppState>, id: String) -> Result<(), String> {
    ensure_sleep_tables(&state.db()).await?;
    sqlx::query("DELETE FROM sleep_logs WHERE id = ?").bind(&id).execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sleep_routine_list(state: State<'_, BentoAppState>) -> Result<Vec<SleepRoutine>, String> {
    ensure_sleep_tables(&state.db()).await?;
    let rows = sqlx::query("SELECT id, title, sort_order, created_at FROM sleep_routines ORDER BY sort_order ASC")
        .fetch_all(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| SleepRoutine {
        id: r.get("id"), title: r.get("title"),
        sort_order: r.get::<i64, _>("sort_order") as i32, created_at: r.get("created_at"),
    }).collect())
}

#[tauri::command]
pub async fn sleep_routine_save(state: State<'_, BentoAppState>, input: SleepRoutineInput) -> Result<SleepRoutine, String> {
    ensure_sleep_tables(&state.db()).await?;
    if input.title.trim().is_empty() { return Err("Routine title is required.".into()); }
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let max_order: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) FROM sleep_routines")
        .fetch_one(&state.db()).await.map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO sleep_routines (id, title, sort_order, created_at) VALUES (?, ?, ?, ?)")
        .bind(&id).bind(input.title.trim()).bind(max_order + 1).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(SleepRoutine { id, title: input.title, sort_order: (max_order + 1) as i32, created_at: now })
}

#[tauri::command]
pub async fn sleep_routine_delete(state: State<'_, BentoAppState>, ids: Vec<String>) -> Result<(), String> {
    ensure_sleep_tables(&state.db()).await?;
    for id in &ids {
        sqlx::query("DELETE FROM sleep_routines WHERE id = ?").bind(id).execute(&state.db()).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn sleep_routine_reorder(state: State<'_, BentoAppState>, ids: Vec<String>) -> Result<(), String> {
    ensure_sleep_tables(&state.db()).await?;
    for (i, id) in ids.iter().enumerate() {
        sqlx::query("UPDATE sleep_routines SET sort_order = ? WHERE id = ?").bind(i as i64).bind(id)
            .execute(&state.db()).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn sleep_routine_status(state: State<'_, BentoAppState>, date_key: Option<String>) -> Result<Vec<RoutineTracking>, String> {
    ensure_sleep_tables(&state.db()).await?;
    let date = date_key.unwrap_or_else(today_key);
    let rows = sqlx::query("SELECT routine_id, date_key, completed FROM sleep_routine_tracking WHERE date_key = ?")
        .bind(&date).fetch_all(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| RoutineTracking {
        routine_id: r.get("routine_id"), date_key: r.get("date_key"),
        completed: r.get::<i64, _>("completed") == 1,
    }).collect())
}

#[tauri::command]
pub async fn sleep_routine_toggle(state: State<'_, BentoAppState>, routine_id: String, date_key: Option<String>) -> Result<bool, String> {
    ensure_sleep_tables(&state.db()).await?;
    let date = date_key.unwrap_or_else(today_key);
    let now = time::now_ms();
    let existing = sqlx::query("SELECT id FROM sleep_routine_tracking WHERE routine_id = ? AND date_key = ?")
        .bind(&routine_id).bind(&date).fetch_optional(&state.db()).await.map_err(|e| e.to_string())?;
    if existing.is_some() {
        sqlx::query("DELETE FROM sleep_routine_tracking WHERE routine_id = ? AND date_key = ?")
            .bind(&routine_id).bind(&date).execute(&state.db()).await.map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        let track_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO sleep_routine_tracking (id, routine_id, date_key, completed, completed_at) VALUES (?, ?, ?, 1, ?)")
            .bind(&track_id).bind(&routine_id).bind(&date).bind(now)
            .execute(&state.db()).await.map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn sleep_alarm_list(state: State<'_, BentoAppState>) -> Result<Vec<SleepAlarm>, String> {
    ensure_sleep_tables(&state.db()).await?;
    let rows = sqlx::query("SELECT id, label, time, wake_window, mode, active, created_at FROM sleep_alarms ORDER BY time ASC")
        .fetch_all(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| SleepAlarm {
        id: r.get("id"), label: r.get("label"), time: r.get("time"),
        wake_window: r.get("wake_window"), mode: r.get("mode"),
        active: r.get::<i64, _>("active") == 1, created_at: r.get("created_at"),
    }).collect())
}

#[tauri::command]
pub async fn sleep_alarm_save(state: State<'_, BentoAppState>, alarm: SleepAlarmInput) -> Result<SleepAlarm, String> {
    ensure_sleep_tables(&state.db()).await?;
    if alarm.label.trim().is_empty() { return Err("Alarm label is required.".into()); }
    if alarm.time.trim().is_empty() { return Err("Alarm time is required.".into()); }
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let window = alarm.wake_window.unwrap_or_else(|| "20 min".to_string());
    let mode = alarm.mode.unwrap_or_else(|| "Smart".to_string());
    sqlx::query("INSERT INTO sleep_alarms (id, label, time, wake_window, mode, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
        .bind(&id).bind(alarm.label.trim()).bind(alarm.time.trim()).bind(window.trim()).bind(mode.trim()).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(SleepAlarm { id, label: alarm.label, time: alarm.time, wake_window: window, mode, active: true, created_at: now })
}

#[tauri::command]
pub async fn sleep_alarm_delete(state: State<'_, BentoAppState>, alarm_id: String) -> Result<(), String> {
    ensure_sleep_tables(&state.db()).await?;
    sqlx::query("DELETE FROM sleep_alarms WHERE id = ?").bind(&alarm_id).execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sleep_alarm_toggle(state: State<'_, BentoAppState>, alarm_id: String) -> Result<bool, String> {
    ensure_sleep_tables(&state.db()).await?;
    let current: i64 = sqlx::query_scalar("SELECT active FROM sleep_alarms WHERE id = ?").bind(&alarm_id)
        .fetch_one(&state.db()).await.map_err(|e| e.to_string())?;
    let new = if current == 1 { 0 } else { 1 };
    sqlx::query("UPDATE sleep_alarms SET active = ? WHERE id = ?").bind(new).bind(&alarm_id)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(new == 1)
}

// ═════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (legacy)
// ═════════════════════════════════════════════════════════════════════════════

fn today_key() -> String { time::date_key(time::now_ms()) }

fn compute_legacy_score(entry: &SleepLogEntry) -> i32 {
    let mut score = 50i32;
    let hours = entry.hours;
    if hours >= 7.0 && hours <= 9.0 { score += 30; }
    else if hours >= 6.0 && hours < 7.0 { score += 20; }
    else if hours >= 9.0 && hours <= 10.0 { score += 20; }
    else if hours >= 5.0 && hours < 6.0 { score += 10; }
    else if hours > 10.0 { score += 10; }
    if let Some(q) = entry.quality { score += (q - 1) * 5; }
    score.clamp(0, 100)
}

async fn legacy_row_from_date(pool: &sqlx::SqlitePool, date: &str) -> Result<Option<SleepLogRow>, String> {
    let row = sqlx::query("SELECT id, date_key, bedtime, wake_time, hours, score, quality, notes, stages, created_at, updated_at FROM sleep_logs WHERE date_key = ?")
        .bind(date).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    Ok(row.map(legacy_map_row))
}

async fn legacy_logs_since(pool: &sqlx::SqlitePool, days: i32) -> Result<Vec<SleepLogRow>, String> {
    let rows = sqlx::query("SELECT id, date_key, bedtime, wake_time, hours, score, quality, notes, stages, created_at, updated_at FROM sleep_logs ORDER BY date_key DESC LIMIT ?")
        .bind(days as i64).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(legacy_map_row).collect())
}

fn legacy_map_row(row: sqlx::sqlite::SqliteRow) -> SleepLogRow {
    let stages_raw: String = row.get("stages");
    let stages = if stages_raw.is_empty() { None } else { serde_json::from_str(&stages_raw).ok() };
    SleepLogRow {
        id: row.get("id"), date_key: row.get("date_key"), bedtime: row.get("bedtime"),
        wake_time: row.get("wake_time"), hours: row.get("hours"),
        score: row.get::<i64, _>("score") as i32, quality: row.get("quality"),
        notes: row.get("notes"), stages,
        created_at: row.get("created_at"), updated_at: row.get("updated_at"),
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BOOTSTRAP (all tables)
// ═════════════════════════════════════════════════════════════════════════════

pub async fn ensure_sleep_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let migrations = [
        // Legacy
        r#"CREATE TABLE IF NOT EXISTS sleep_logs (
            id TEXT PRIMARY KEY, date_key TEXT NOT NULL UNIQUE, bedtime TEXT, wake_time TEXT,
            hours REAL NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, quality INTEGER,
            notes TEXT, stages TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS sleep_routines (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS sleep_routine_tracking (
            id TEXT PRIMARY KEY, routine_id TEXT NOT NULL REFERENCES sleep_routines(id) ON DELETE CASCADE,
            date_key TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 1, completed_at INTEGER NOT NULL,
            UNIQUE(routine_id, date_key))"#,
        r#"CREATE TABLE IF NOT EXISTS sleep_alarms (
            id TEXT PRIMARY KEY, label TEXT NOT NULL, time TEXT NOT NULL,
            wake_window TEXT NOT NULL DEFAULT '20 min', mode TEXT NOT NULL DEFAULT 'Smart',
            active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)"#,
        // NEW: sleep_sessions
        r#"CREATE TABLE IF NOT EXISTS sleep_sessions (
            id TEXT PRIMARY KEY, date TEXT NOT NULL, sleep_onset_ts INTEGER NOT NULL,
            wake_ts INTEGER NOT NULL, last_active_ts INTEGER, duration_min INTEGER NOT NULL,
            quality_score REAL, notes TEXT, source TEXT NOT NULL DEFAULT 'auto',
            confirmation_pending INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_sleep_sessions_date ON sleep_sessions(date DESC)"#,
        // NEW: sleep_goals
        r#"CREATE TABLE IF NOT EXISTS sleep_goals (
            id TEXT PRIMARY KEY, target_bedtime TEXT NOT NULL DEFAULT '23:00',
            target_waketime TEXT NOT NULL DEFAULT '07:00',
            target_duration_min INTEGER NOT NULL DEFAULT 480, updated_at INTEGER NOT NULL)"#,
    ];

    for sql in migrations {
        sqlx::query(sql).execute(pool).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
