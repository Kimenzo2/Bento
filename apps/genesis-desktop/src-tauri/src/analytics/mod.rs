// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Analytics Engine — Streak Calculation, Trend Aggregation, Health Queries
// ═══════════════════════════════════════════════════════════════════════
// Local-only processing with efficient aggregation for fast dashboard queries.
// All timestamps in UTC ms.
// ═══════════════════════════════════════════════════════════════════════

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::health::{self, TrendResult};
use crate::util::time;

// ─── Streak ───────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Streak {
    pub id: Option<i64>,
    pub module_id: String,
    pub streak_type: String,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub last_activity_date: Option<String>, // "2026-05-09"
    pub started_at: Option<i64>,
    pub updated_at: i64,
}

// ─── Streak Calculator ────────────────────────────────────────────────

pub struct StreakCalculator {
    db: SqlitePool,
}

impl StreakCalculator {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Calculate or update a streak for a given module and type.
    /// `activity_dates` should be sorted ascending (oldest first).
    pub async fn calculate(
        &self,
        module_id: &str,
        streak_type: &str,
        activity_dates: &[String],
    ) -> Result<Streak, String> {
        let (current, longest, last_date) = Self::compute_streak(activity_dates);

        // Upsert into database
        let now = time::now_ms();
        let last_activity_date = last_date.clone();

        sqlx::query(
            r#"
            INSERT INTO streaks (module_id, streak_type, current_streak, longest_streak,
                last_activity_date, started_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(module_id, streak_type) DO UPDATE SET
                current_streak = excluded.current_streak,
                longest_streak = excluded.longest_streak,
                last_activity_date = excluded.last_activity_date,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(module_id)
        .bind(streak_type)
        .bind(current as i64)
        .bind(longest as i64)
        .bind(&last_activity_date)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(Streak {
            id: None,
            module_id: module_id.to_string(),
            streak_type: streak_type.to_string(),
            current_streak: current,
            longest_streak: longest,
            last_activity_date,
            started_at: None,
            updated_at: now,
        })
    }

    /// Compute streak from sorted date strings (ascending).
    /// Returns (current_streak, longest_streak, last_activity_date).
    pub fn compute_streak(dates: &[String]) -> (u32, u32, Option<String>) {
        if dates.is_empty() {
            return (0, 0, None);
        }

        let unique_dates: Vec<&str> = {
            let mut seen = std::collections::BTreeSet::new();
            for d in dates {
                seen.insert(d.as_str());
            }
            seen.into_iter().collect()
        };

        if unique_dates.is_empty() {
            return (0, 0, None);
        }

        let today = time::date_key(health::time::now_ms());
        let yesterday = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
            .ok()
            .and_then(|d| d.pred_opt())
            .map(|d| d.format("%Y-%m-%d").to_string());

        // Compute longest streak: count consecutive days in ascending order
        let mut longest = 0u32;
        let mut current_run = 0u32;
        let mut prev: Option<NaiveDate> = None;

        for date_str in &unique_dates {
            let current = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                Ok(d) => d,
                Err(_) => continue,
            };

            match prev {
                // Consecutive day (previous + 1 == current)
                Some(p) if current == p.succ_opt().unwrap_or(p) => {
                    current_run += 1;
                }
                // Same day, skip
                Some(p) if current == p => {
                    continue;
                }
                // Non-consecutive or first date
                _ => {
                    current_run = 1;
                }
            }

            if current_run > longest {
                longest = current_run;
            }
            prev = Some(current);
        }

        // Compute current streak: count backward from latest date, only if recent
        let last_date = unique_dates.last().copied();
        let current = if let Some(last) = last_date {
            let is_recent = last == today
                || yesterday
                    .as_ref()
                    .map(|y| last == y.as_str())
                    .unwrap_or(false);

            if is_recent {
                let mut count = 0u32;
                let mut expected = NaiveDate::parse_from_str(last, "%Y-%m-%d").ok();

                for date_str in unique_dates.iter().rev() {
                    let d = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Ok(d) => d,
                        Err(_) => continue,
                    };
                    if expected.map(|e| d == e).unwrap_or(false) {
                        count += 1;
                        expected = d.pred_opt();
                    }
                }
                count
            } else {
                0
            }
        } else {
            0
        };

        (current, longest, last_date.map(|s| s.to_string()))
    }

    /// Fetch stored streak for a module
    pub async fn get_streak(
        &self,
        module_id: &str,
        streak_type: &str,
    ) -> Result<Option<Streak>, String> {
        let row = sqlx::query(
            "SELECT * FROM streaks WHERE module_id = ? AND streak_type = ?",
        )
        .bind(module_id)
        .bind(streak_type)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(row.map(|r| Streak {
            id: Some(r.try_get("id").unwrap_or_default()),
            module_id: r.try_get("module_id").unwrap_or_default(),
            streak_type: r.try_get("streak_type").unwrap_or_default(),
            current_streak: r.try_get::<i64, _>("current_streak").unwrap_or(0) as u32,
            longest_streak: r.try_get::<i64, _>("longest_streak").unwrap_or(0) as u32,
            last_activity_date: r.try_get("last_activity_date").ok(),
            started_at: r.try_get("started_at").ok().flatten(),
            updated_at: r.try_get("updated_at").unwrap_or_default(),
        }))
    }

    /// Get all streaks for display
    pub async fn get_all_streaks(&self) -> Result<Vec<Streak>, String> {
        let rows = sqlx::query("SELECT * FROM streaks ORDER BY current_streak DESC")
            .fetch_all(&self.db)
            .await
            .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|r| Streak {
                id: Some(r.try_get("id").unwrap_or_default()),
                module_id: r.try_get("module_id").unwrap_or_default(),
                streak_type: r.try_get("streak_type").unwrap_or_default(),
                current_streak: r.try_get::<i64, _>("current_streak").unwrap_or(0) as u32,
                longest_streak: r.try_get::<i64, _>("longest_streak").unwrap_or(0) as u32,
                last_activity_date: r.try_get("last_activity_date").ok(),
                started_at: r.try_get("started_at").ok().flatten(),
                updated_at: r.try_get("updated_at").unwrap_or_default(),
            })
            .collect())
    }
}

// ─── Health Metrics Aggregator ────────────────────────────────────────

pub struct HealthAggregator {
    db: SqlitePool,
}

impl HealthAggregator {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Get daily sleep hours for the last N days
    pub async fn daily_sleep_hours(&self, days: i64) -> Result<TrendResult, String> {
        let since = time::now_ms() - (days * 24 * 60 * 60 * 1000);
        let rows = sqlx::query(
            r#"
            SELECT started_at, ended_at, metadata
            FROM health_events
            WHERE module_id = 'sleep' AND event_type = 'sleep_session'
                AND started_at IS NOT NULL AND ended_at IS NOT NULL
                AND logged_at >= ?
            ORDER BY started_at ASC
            "#,
        )
        .bind(since)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        let mut by_date: std::collections::BTreeMap<String, f64> = std::collections::BTreeMap::new();

        for row in rows {
            let start: i64 = row.try_get("started_at").unwrap_or(0);
            let end: i64 = row.try_get("ended_at").unwrap_or(0);
            if end > start {
                let hours = (end - start) as f64 / 3_600_000.0;
                let date = time::date_key(start);
                *by_date.entry(date).or_insert(0.0) += hours;
            }
        }

        let values: Vec<(String, f64)> = by_date.into_iter().collect();
        Ok(TrendResult::calculate(&values))
    }

    /// Get daily hydration total in ml
    pub async fn daily_hydration_ml(&self, days: i64) -> Result<TrendResult, String> {
        let since = time::now_ms() - (days * 24 * 60 * 60 * 1000);
        let rows = sqlx::query(
            r#"
            SELECT value, logged_at
            FROM health_events
            WHERE module_id = 'nutrition' AND event_type = 'hydration'
                AND value IS NOT NULL
                AND logged_at >= ?
            ORDER BY logged_at ASC
            "#,
        )
        .bind(since)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        let mut by_date: std::collections::BTreeMap<String, f64> = std::collections::BTreeMap::new();

        for row in rows {
            let value: f64 = row.try_get("value").unwrap_or(0.0);
            let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
            let date = time::date_key(logged_at);
            *by_date.entry(date).or_insert(0.0) += value;
        }

        let values: Vec<(String, f64)> = by_date.into_iter().collect();
        Ok(TrendResult::calculate(&values))
    }

    /// Get daily mood averages
    pub async fn daily_mood_score(&self, days: i64) -> Result<TrendResult, String> {
        let since = time::now_ms() - (days * 24 * 60 * 60 * 1000);
        let rows = sqlx::query(
            r#"
            SELECT value, logged_at
            FROM health_events
            WHERE module_id = 'mood' AND event_type = 'mood'
                AND value IS NOT NULL
                AND logged_at >= ?
            ORDER BY logged_at ASC
            "#,
        )
        .bind(since)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        let mut by_date: std::collections::BTreeMap<String, Vec<f64>> = std::collections::BTreeMap::new();

        for row in rows {
            let value: f64 = row.try_get("value").unwrap_or(0.0);
            let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
            let date = time::date_key(logged_at);
            by_date.entry(date).or_default().push(value);
        }

        let values: Vec<(String, f64)> = by_date
            .into_iter()
            .map(|(date, vals)| {
                let avg = vals.iter().sum::<f64>() / vals.len() as f64;
                (date, avg)
            })
            .collect();

        Ok(TrendResult::calculate(&values))
    }

    /// Get daily focus minutes total
    pub async fn daily_focus_minutes(&self, days: i64) -> Result<TrendResult, String> {
        let since = time::now_ms() - (days * 24 * 60 * 60 * 1000);
        let rows = sqlx::query(
            r#"
            SELECT started_at, ended_at, value, metadata
            FROM health_events
            WHERE module_id = 'focus' AND event_type = 'focus_session'
                AND logged_at >= ?
            ORDER BY started_at ASC
            "#,
        )
        .bind(since)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        let mut by_date: std::collections::BTreeMap<String, f64> = std::collections::BTreeMap::new();

        for row in rows {
            let start: Option<i64> = row.try_get("started_at").ok().flatten();
            let end: Option<i64> = row.try_get("ended_at").ok().flatten();
            let minutes = match (start, end) {
                (Some(s), Some(e)) if e > s => (e - s) as f64 / 60_000.0,
                _ => row.try_get::<f64, _>("value").unwrap_or(0.0), // fallback to stored value
            };
            let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
            let date = time::date_key(logged_at);
            *by_date.entry(date).or_insert(0.0) += minutes;
        }

        let values: Vec<(String, f64)> = by_date.into_iter().collect();
        Ok(TrendResult::calculate(&values))
    }

    /// Get daily energy score average
    pub async fn daily_energy_score(&self, days: i64) -> Result<TrendResult, String> {
        let since = time::now_ms() - (days * 24 * 60 * 60 * 1000);
        let rows = sqlx::query(
            r#"
            SELECT value, logged_at
            FROM health_events
            WHERE module_id IN ('health', 'mood') AND event_type = 'energy'
                AND value IS NOT NULL
                AND logged_at >= ?
            ORDER BY logged_at ASC
            "#,
        )
        .bind(since)
        .fetch_all(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        let mut by_date: std::collections::BTreeMap<String, Vec<f64>> = std::collections::BTreeMap::new();

        for row in rows {
            let val: f64 = row.try_get("value").unwrap_or(0.0);
            let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
            let date = time::date_key(logged_at);
            by_date.entry(date).or_default().push(val);
        }

        let values: Vec<(String, f64)> = by_date
            .into_iter()
            .map(|(date, vals)| {
                let avg = vals.iter().sum::<f64>() / vals.len() as f64;
                (date, avg)
            })
            .collect();

        Ok(TrendResult::calculate(&values))
    }

    /// Log a health event (generic)
    pub async fn log_event(&self, event: &health::HealthEvent) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO health_events (module_id, event_type, value, unit, metadata,
                started_at, ended_at, logged_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.module_id)
        .bind(&event.event_type)
        .bind(event.value)
        .bind(&event.unit)
        .bind(&event.metadata)
        .bind(event.started_at)
        .bind(event.ended_at)
        .bind(event.logged_at)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(result.last_insert_rowid())
    }

    /// Get health events with optional filtering
    pub async fn get_events(
        &self,
        module_id: Option<&str>,
        event_type: Option<&str>,
        since: Option<i64>,
        limit: i64,
    ) -> Result<Vec<health::HealthEvent>, String> {
        let since = since.unwrap_or_else(|| time::now_ms() - (30 * 24 * 60 * 60 * 1000));

        let rows = match (module_id, event_type) {
            (Some(mid), Some(et)) => {
                sqlx::query(
                    "SELECT * FROM health_events WHERE module_id = ? AND event_type = ? AND logged_at >= ? ORDER BY logged_at DESC LIMIT ?",
                )
                .bind(mid)
                .bind(et)
                .bind(since)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                    .map_err(|e| e.to_string())?
            }
            (Some(mid), None) => {
                sqlx::query(
                    "SELECT * FROM health_events WHERE module_id = ? AND logged_at >= ? ORDER BY logged_at DESC LIMIT ?",
                )
                .bind(mid)
                .bind(since)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                    .map_err(|e| e.to_string())?
            }
            (None, Some(et)) => {
                sqlx::query(
                    "SELECT * FROM health_events WHERE event_type = ? AND logged_at >= ? ORDER BY logged_at DESC LIMIT ?",
                )
                .bind(et)
                .bind(since)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                    .map_err(|e| e.to_string())?
            }
            (None, None) => {
                sqlx::query(
                    "SELECT * FROM health_events WHERE logged_at >= ? ORDER BY logged_at DESC LIMIT ?",
                )
                .bind(since)
                .bind(limit)
                .fetch_all(&self.db)
                .await
                    .map_err(|e| e.to_string())?
            }
        };

        Ok(rows
            .into_iter()
            .map(|r| health::HealthEvent {
                id: Some(r.try_get("id").unwrap_or_default()),
                module_id: r.try_get("module_id").unwrap_or_default(),
                event_type: r.try_get("event_type").unwrap_or_default(),
                value: r.try_get("value").ok().flatten(),
                unit: r.try_get("unit").ok().flatten(),
                metadata: r.try_get("metadata").unwrap_or_else(|_| "{}".to_string()),
                started_at: r.try_get("started_at").ok().flatten(),
                ended_at: r.try_get("ended_at").ok().flatten(),
                logged_at: r.try_get("logged_at").unwrap_or_default(),
            })
            .collect())
    }

    /// Compute a composite wellness score based on recent data
    pub async fn compute_wellness_score(&self, days: i64) -> Result<health::HealthScore, String> {
        let _since = time::now_ms() - (days * 24 * 60 * 60 * 1000);

        // Sleep score: 7-9 hours target
        let sleep_trend = self.daily_sleep_hours(days).await?;
        let sleep_score = if sleep_trend.average > 0.0 {
            let raw = (sleep_trend.average / 8.0 * 100.0).clamp(0.0, 100.0);
            Some(raw as u8)
        } else {
            None
        };

        // Hydration score: 2000ml target
        let hydration_trend = self.daily_hydration_ml(days).await?;
        let hydration_score = if hydration_trend.average > 0.0 {
            let raw = (hydration_trend.average / 2000.0 * 100.0).clamp(0.0, 100.0);
            Some(raw as u8)
        } else {
            None
        };

        // Mood score: scale from 0-10 to 0-100
        let mood_trend = self.daily_mood_score(days).await?;
        let mood_score = if mood_trend.average > 0.0 {
            Some((mood_trend.average / 10.0 * 100.0).clamp(0.0, 100.0) as u8)
        } else {
            None
        };

        // Focus score: 120 minutes target
        let focus_trend = self.daily_focus_minutes(days).await?;
        let focus_score = if focus_trend.average > 0.0 {
            let raw = (focus_trend.average / 120.0 * 100.0).clamp(0.0, 100.0);
            Some(raw as u8)
        } else {
            None
        };

        let scores: Vec<u8> = [sleep_score, hydration_score, mood_score, focus_score]
            .iter()
            .filter_map(|s| *s)
            .collect();

        let overall = if scores.is_empty() {
            0
        } else {
            (scores.iter().sum::<u8>() as f64 / scores.len() as f64) as u8
        };

        Ok(health::HealthScore {
            score: overall,
            sleep_score,
            hydration_score,
            mood_score,
            focus_score,
            activity_score: None,
            computed_at: time::now_ms(),
        })
    }

    /// Count health log entries in a date range
    pub async fn count_events(
        &self,
        module_id: &str,
        event_type: &str,
        since: i64,
    ) -> Result<i64, String> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS count FROM health_events WHERE module_id = ? AND event_type = ? AND logged_at >= ?",
        )
        .bind(module_id)
        .bind(event_type)
        .bind(since)
        .fetch_one(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(row.try_get("count").unwrap_or(0))
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn log_health_event(
    db: tauri::State<'_, crate::db::BentoAppState>,
    event: health::HealthEvent,
) -> Result<i64, String> {
    let agg = HealthAggregator::new(db.db().clone());
    agg.log_event(&event).await
}

#[tauri::command]
pub async fn get_health_events(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: Option<String>,
    event_type: Option<String>,
    days: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<health::HealthEvent>, String> {
    let since = days
        .map(|d| time::now_ms() - (d * 24 * 60 * 60 * 1000));
    let agg = HealthAggregator::new(db.db().clone());
    agg.get_events(module_id.as_deref(), event_type.as_deref(), since, limit.unwrap_or(100))
        .await
}

#[tauri::command]
pub async fn get_health_trends(
    db: tauri::State<'_, crate::db::BentoAppState>,
    metric: String,
    days: i64,
) -> Result<TrendResult, String> {
    let agg = HealthAggregator::new(db.db().clone());
    match metric.as_str() {
        "sleep" => agg.daily_sleep_hours(days).await,
        "hydration" => agg.daily_hydration_ml(days).await,
        "mood" => agg.daily_mood_score(days).await,
        "focus" => agg.daily_focus_minutes(days).await,
        "energy" => agg.daily_energy_score(days).await,
        _ => Err(format!("Unknown health metric: {metric}")),
    }
}

#[tauri::command]
pub async fn get_wellness_score(
    db: tauri::State<'_, crate::db::BentoAppState>,
    days: Option<i64>,
) -> Result<health::HealthScore, String> {
    let agg = HealthAggregator::new(db.db().clone());
    agg.compute_wellness_score(days.unwrap_or(7)).await
}

#[tauri::command]
pub async fn get_streak(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: String,
    streak_type: String,
) -> Result<Option<Streak>, String> {
    let calc = StreakCalculator::new(db.db().clone());
    calc.get_streak(&module_id, &streak_type).await
}

#[tauri::command]
pub async fn get_all_streaks(
    db: tauri::State<'_, crate::db::BentoAppState>,
) -> Result<Vec<Streak>, String> {
    let calc = StreakCalculator::new(db.db().clone());
    calc.get_all_streaks().await
}

#[tauri::command]
pub async fn update_streak(
    db: tauri::State<'_, crate::db::BentoAppState>,
    module_id: String,
    streak_type: String,
    activity_dates: Vec<String>,
) -> Result<Streak, String> {
    let calc = StreakCalculator::new(db.db().clone());
    calc.calculate(&module_id, &streak_type, &activity_dates).await
}
