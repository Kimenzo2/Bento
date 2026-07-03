//! Intelligence tool implementations for Bento's MCP server.
//! Each function is a pure data-processing pipeline: query DB → compute → return JSON.
//! Called by thin MCP tool wrappers in `tools/mod.rs`.

use std::collections::HashMap;

use chrono::{Datelike, Timelike};

use crate::mcp::analytics;
use crate::util::time;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use tracing::info;
use uuid::Uuid;

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 1: get_life_context
// ═════════════════════════════════════════════════════════════════════════════

/// Unified snapshot of the user right now across all modules.
pub async fn get_life_context_impl(pool: &SqlitePool, depth: &str) -> Result<Value, String> {
    let now_ms = time::now_ms();
    let start_of_today = time::start_of_today_ms();
    let today = time::date_key(now_ms);
    let seven_days_ago = start_of_today - 7 * 86_400_000;

    let tasks_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed_at >= ? AND completed_at < ?",
    )
    .bind(start_of_today)
    .bind(start_of_today + 86_400_000)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tasks_pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND (due_at IS NULL OR due_at > ?)",
    )
    .bind(now_ms)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tasks_overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?",
    )
    .bind(now_ms)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let habits_done: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT habit_id) FROM habit_completions WHERE completed_at >= ? AND completed_at < ?",
    )
    .bind(start_of_today)
    .bind(start_of_today + 86_400_000)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let habits_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let focus_minutes: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ?",
    )
    .bind(start_of_today)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    let calories: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_kcal), 0) FROM meals WHERE logged_at >= ? AND logged_at < ?",
    )
    .bind(start_of_today)
    .bind(start_of_today + 86_400_000)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let journal_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE date = ?")
            .bind(&today)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    // Mood — latest today
    let mood_latest: Option<(String, i64)> = sqlx::query_as::<_, (String, i64)>(
        "SELECT mood, logged_at FROM mood_checkins WHERE date_key = ? ORDER BY logged_at DESC LIMIT 1",
    )
    .bind(&today)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?
    .map(|(m, t)| (m, t));

    // Active focus session
    let active_focus: Option<(f64, String)> = sqlx::query_as::<_, (f64, String)>(
        "SELECT value, metadata FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND ended_at > ? ORDER BY logged_at DESC LIMIT 1",
    )
    .bind(now_ms)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("focus query: {e}"))?;

    // Sleep last night
    let sleep_last_night: Option<(f64, i64)> = sqlx::query_as::<_, (f64, i64)>(
        "SELECT hours, COALESCE(quality, score) FROM sleep_logs WHERE date_key = ? LIMIT 1",
    )
    .bind(&yesterday_date_key(start_of_today))
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("sleep query: {e}"))?;

    // Goals progress (week)
    let goal_rows: Vec<(String, i32)> = sqlx::query_as::<_, (String, i32)>(
        "SELECT title, progress FROM goals WHERE progress > 0 ORDER BY updated_at DESC LIMIT 10",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("goals query: {e}"))?;

    // Budget: spending this month
    let month_start = time::start_of_month();
    let spending: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ?",
    )
    .bind(month_start)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    // Budget: monthly budget total
    let budget_total: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(monthly_budget), 0) FROM budget_categories",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    // Weekly averages
    let week_mood_rows: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT mood FROM mood_checkins WHERE logged_at >= ?")
            .bind(seven_days_ago)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    let avg_mood = if week_mood_rows.is_empty() {
        0.0
    } else {
        let scores: Vec<f64> = week_mood_rows
            .iter()
            .map(|m| analytics::mood_string_to_score(m))
            .collect();
        analytics::mean(&scores)
    };

    let week_sleep_hours: Vec<f64> =
        sqlx::query_scalar::<_, f64>("SELECT hours FROM sleep_logs WHERE created_at >= ?")
            .bind(seven_days_ago)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    let avg_sleep = analytics::mean(&week_sleep_hours);

    // Habit consistency (week)
    let week_habit_days: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT CAST(completed_at / 86400000 AS INTEGER)) FROM habit_completions WHERE completed_at >= ?",
    )
    .bind(seven_days_ago)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let habit_consistency = if habits_total > 0 {
        (week_habit_days as f64 / 7.0).min(1.0)
    } else {
        0.0
    };

    // Net savings (month)
    let income: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'income' AND created_at >= ?",
    )
    .bind(month_start)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);
    let net_savings = income - spending;

    // Energy: infer from sleep + mood + time of day if not manually logged
    let energy_manual: Option<i64> = sqlx::query_scalar::<_, i64>(
        "SELECT value FROM health_logs WHERE type = 'energy' AND logged_at >= ? ORDER BY logged_at DESC LIMIT 1",
    )
    .bind(start_of_today)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let energy_score = match energy_manual {
        Some(s) => (s, "manual"),
        None => {
            // Inferred energy score: sleep ×40% (duration normalized to 8h goal)
            // + sleep quality ×30% (normalized to 100) + mood boost up to +20
            //  + time-of-day modifier (-10 late night, +5 morning, -5 post-lunch dip)
            let base = if let Some((h, q)) = sleep_last_night {
                ((h / 8.0).min(1.0) * 0.4 + (q as f64 / 100.0).min(1.0) * 0.3) * 100.0
            } else {
                50.0
            };
            let mood_boost = avg_mood / 5.0 * 20.0;
            let hour = chrono::Local::now().hour();
            let time_mod = if hour < 6 || hour >= 22 {
                -10.0
            } else if hour < 9 {
                5.0
            } else if hour >= 14 && hour < 16 {
                -5.0
            } else {
                0.0
            };
            (
                (base + mood_boost + time_mod).round().max(0.0).min(100.0) as i64,
                "inferred",
            )
        }
    };

    // Pressure signals
    let mut pressure: Vec<String> = Vec::new();
    if tasks_overdue > 0 {
        pressure.push(format!(
            "{} task{} overdue",
            tasks_overdue,
            if tasks_overdue == 1 { "" } else { "s" }
        ));
    }
    if budget_total > 0.0 {
        let pct_spent = (spending / budget_total * 100.0).round() as i64;
        if pct_spent > 80 {
            pressure.push(format!("budget {}% spent", pct_spent));
        }
    }
    if let Some((h, _)) = sleep_last_night {
        if h < 6.0 {
            let debt = (8.0 - h).round();
            pressure.push(format!("sleep debt {:.1}h", debt));
        }
    }
    let incomplete_goals = goal_rows.iter().filter(|(_, p)| *p < 100).count();
    if incomplete_goals > 2 {
        pressure.push(format!("{} goals behind", incomplete_goals));
    }

    // Cognitive load: weighted composite of overdue tasks (×0.3), sleep debt (×0.25),
    // budget pressure (×0.2), and incomplete goals (×0.25). Thresholds: >4=critical,
    // >2.5=high, >1.0=moderate, else low.
    let cognitive_score = tasks_overdue as f64 * 0.3
        + (if let Some((h, _)) = sleep_last_night {
            (8.0 - h).max(0.0) * 0.25
        } else {
            0.0
        })
        + (if budget_total > 0.0 {
            (spending / budget_total).max(0.0) * 0.2
        } else {
            0.0
        })
        + incomplete_goals as f64 * 0.25;
    let cognitive_load = if cognitive_score > 4.0 {
        "critical"
    } else if cognitive_score > 2.5 {
        "high"
    } else if cognitive_score > 1.0 {
        "moderate"
    } else {
        "low"
    };

    let coverage = analytics::data_coverage(&[
        tasks_completed + tasks_pending + tasks_overdue > 0,
        habits_total > 0,
        focus_minutes > 0.0,
        journal_count > 0,
        mood_latest.is_some(),
        sleep_last_night.is_some(),
        calories > 0,
        !goal_rows.is_empty(),
        spending > 0.0 || income > 0.0,
    ]);

    let mut result = json!({
        "user": { "name": "User" },
        "right_now": {
            "mood": mood_latest.map(|(m, t)| json!({
                "score": analytics::mood_string_to_score(&m),
                "label": m,
                "logged_at": t
            })),
            "energy": {
                "score": energy_score.0,
                "source": energy_score.1
            },
            "focus_session": active_focus.map(|(v, meta)| {
                let meta_v: Value = serde_json::from_str(&meta).unwrap_or(json!({}));
                json!({
                    "active": true,
                    "mode": meta_v["label"].as_str().unwrap_or("focus"),
                    "elapsed_minutes": v
                })
            }),
            "sleep_last_night": sleep_last_night.map(|(h, q)| json!({
                "hours": h,
                "quality": q
            }))
        },
        "today": {
            "tasks_completed": tasks_completed,
            "tasks_pending": tasks_pending,
            "habits_done": habits_done,
            "habits_total": habits_total,
            "calories_logged": calories,
            "focus_minutes": focus_minutes as i64,
            "journal_written": journal_count > 0
        },
        "week": {
            "goal_progress": goal_rows.into_iter().map(|(t, p)| json!({
                "title": t,
                "pct": p
            })).collect::<Vec<Value>>(),
            "net_savings": net_savings,
            "avg_mood": (avg_mood * 10.0).round() / 10.0,
            "avg_sleep_hours": (avg_sleep * 10.0).round() / 10.0,
            "habit_consistency_pct": (habit_consistency * 100.0).round() as i64
        },
        "pressure_signals": pressure,
        "cognitive_load": cognitive_load,
        "data_coverage": coverage
    });

    if depth == "minimal" {
        result = json!({
            "right_now": result["right_now"],
            "today": {
                "tasks_pending": tasks_pending,
                "tasks_completed": tasks_completed,
                "habits_done": habits_done,
                "focus_minutes": focus_minutes as i64
            },
            "cognitive_load": cognitive_load,
            "data_coverage": 1.0
        });
    }

    Ok(result)
}

fn yesterday_date_key(today_start_ms: i64) -> String {
    time::date_key(today_start_ms - 86_400_000)
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 2: get_cross_module_correlations
// ═════════════════════════════════════════════════════════════════════════════

/// Pull daily metric values and correlate them.
pub async fn get_cross_module_correlations_impl(
    pool: &SqlitePool,
    metric_a: &str,
    metric_b: &str,
    window_days: i64,
    _granularity: &str,
) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - window_days * 86_400_000;

    let series_a = fetch_metric_daily(pool, metric_a, start_ms, end_ms).await?;
    let series_b = fetch_metric_daily(pool, metric_b, start_ms, end_ms).await?;

    // Align by date
    let dates: Vec<String> = {
        let mut d = std::collections::BTreeSet::new();
        for (date, _) in &series_a {
            d.insert(date.clone());
        }
        for (date, _) in &series_b {
            d.insert(date.clone());
        }
        d.into_iter().collect()
    };

    let map_a: HashMap<&str, f64> = series_a.iter().map(|(d, v)| (d.as_str(), *v)).collect();
    let map_b: HashMap<&str, f64> = series_b.iter().map(|(d, v)| (d.as_str(), *v)).collect();

    let mut x_vals = Vec::new();
    let mut y_vals = Vec::new();
    let mut aligned: Vec<(String, f64, f64)> = Vec::new();

    for date in &dates {
        if let (Some(&va), Some(&vb)) = (map_a.get(date.as_str()), map_b.get(date.as_str())) {
            x_vals.push(va);
            y_vals.push(vb);
            aligned.push((date.clone(), va, vb));
        }
    }

    let r = analytics::pearson_correlation(&x_vals, &y_vals);
    let direction = analytics::correlation_direction(r);
    let strength = analytics::correlation_strength(r);

    let insight = if r.is_nan() {
        format!("Insufficient data to compute correlation between {} and {}. Need at least 3 overlapping days.", metric_a, metric_b)
    } else {
        let dir_desc = match direction {
            "positive" => "tends to increase with",
            "negative" => "tends to decrease when",
            _ => "shows no clear relationship with",
        };
        let pct = (r.abs() * 100.0).round() as i64;
        format!(
            "Over the last {} days, {} {} {} with {:.0}% {} correlation (r={:.2}).",
            window_days, metric_a, dir_desc, metric_b, pct, strength, r
        )
    };

    // Find highest correlation days (both high)
    let mut sorted_indices: Vec<usize> = (0..aligned.len()).collect();
    sorted_indices.sort_by(|&i, &j| {
        let (_, ai, bi) = &aligned[i];
        let (_, aj, bj) = &aligned[j];
        ((ai + bi) * 100.0)
            .total_cmp(&((aj + bj) * 100.0))
            .reverse()
    });
    let highest_days: Vec<Value> = sorted_indices
        .iter()
        .take(5)
        .map(|&idx| {
            let (d, a, b) = &aligned[idx];
            json!({"date": d, "a_value": a, "b_value": b})
        })
        .collect();

    // Anomalies: days where both deviate >1.5 std dev from their means
    let mean_a = analytics::mean(&x_vals);
    let mean_b = analytics::mean(&y_vals);
    let std_a = analytics::std_dev(&x_vals, mean_a);
    let std_b = analytics::std_dev(&y_vals, mean_b);
    let mut anomalies = Vec::new();
    if std_a > 0.0 && std_b > 0.0 {
        for (date, va, vb) in &aligned {
            let za = (va - mean_a).abs() / std_a;
            let zb = (vb - mean_b).abs() / std_b;
            if za > 1.5 && zb > 1.5 {
                anomalies.push(json!({
                    "date": date,
                    "note": format!("Both metrics deviated significantly from baseline (z_a={:.1}, z_b={:.1})", za, zb)
                }));
            }
        }
    }

    Ok(json!({
        "metric_a": metric_a,
        "metric_b": metric_b,
        "window_days": window_days,
        "correlation_coefficient": if r.is_nan() { Value::Null } else { json!((r * 100.0).round() / 100.0) },
        "direction": direction,
        "strength": strength,
        "data_points": aligned.len(),
        "insight": insight,
        "highest_a_days": highest_days,
        "anomalies": anomalies,
        "data_coverage": if window_days > 0 { aligned.len() as f64 / window_days as f64 } else { 0.0 }
    }))
}

/// Fetch a metric as daily (date, value) pairs.
async fn fetch_metric_daily(
    pool: &SqlitePool,
    metric: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<(String, f64)>, String> {
    match metric {
        "sleep_hours" => {
            let rows = sqlx::query_as::<_, (String, f64)>(
                "SELECT date_key, hours FROM sleep_logs WHERE created_at >= ? AND created_at < ?",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("sleep query: {e}"))?;
            Ok(rows)
        }
        "mood_score" => {
            let rows = sqlx::query_as::<_, (String, String)>(
                "SELECT date_key, mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("mood query: {e}"))?;
            // Take last mood per day
            let mut daily: HashMap<String, f64> = HashMap::new();
            for (date, mood) in rows {
                daily.insert(date, analytics::mood_string_to_score(&mood));
            }
            Ok(daily.into_iter().collect())
        }
        "focus_minutes" => {
            let rows = sqlx::query_as::<_, (i64, f64)>(
                "SELECT logged_at / 86400000, COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? GROUP BY logged_at / 86400000",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("focus query: {e}"))?;
            Ok(rows
                .into_iter()
                .map(|(day_offset, val)| {
                    let date = time::date_key(day_offset * 86_400_000);
                    (date, val)
                })
                .collect())
        }
        "calories" => {
            let rows = sqlx::query_as::<_, (i64, f64)>(
                "SELECT logged_at / 86400000, COALESCE(SUM(total_kcal), 0) FROM meals WHERE logged_at >= ? AND logged_at < ? GROUP BY logged_at / 86400000",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("calories query: {e}"))?;
            Ok(rows
                .into_iter()
                .map(|(day_offset, val)| {
                    let date = time::date_key(day_offset * 86_400_000);
                    (date, val)
                })
                .collect())
        }
        "spending_amount" => {
            let rows = sqlx::query_as::<_, (String, f64)>(
                "SELECT date_key, COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ? AND created_at < ? GROUP BY date_key",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("budget query: {e}"))?;
            Ok(rows)
        }
        "tasks_completed" => {
            let rows = sqlx::query_as::<_, (i64, i64)>(
                "SELECT completed_at / 86400000, COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ? GROUP BY completed_at / 86400000",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("tasks query: {e}"))?;
            Ok(rows
                .into_iter()
                .map(|(day_offset, count)| {
                    let date = time::date_key(day_offset * 86_400_000);
                    (date, count as f64)
                })
                .collect())
        }
        "habit_completion_rate" => {
            let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
                .fetch_one(pool)
                .await
                .unwrap_or(0);
            if total == 0 {
                return Ok(vec![]);
            }
            let rows = sqlx::query_as::<_, (i64, i64)>(
                "SELECT CAST(completed_at / 86400000 AS INTEGER), COUNT(DISTINCT habit_id) FROM habit_completions WHERE completed_at >= ? AND completed_at < ? GROUP BY CAST(completed_at / 86400000 AS INTEGER)",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("habits query: {e}"))?;
            Ok(rows
                .into_iter()
                .map(|(day_offset, count)| {
                    let date = time::date_key(day_offset * 86_400_000);
                    (date, count as f64 / total as f64 * 100.0)
                })
                .collect())
        }
        "energy_score" => {
            let manual: Vec<(String, f64)> = sqlx::query_as::<_, (String, f64)>(
                "SELECT date_key, value FROM health_logs WHERE type = 'energy' AND logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC",
            )
            .bind(start_ms)
            .bind(end_ms)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("energy query: {e}"))?;
            Ok(manual)
        }
        _ => Err(format!("Unknown metric: {metric}")),
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 3: get_day_reconstruction
// ═════════════════════════════════════════════════════════════════════════════

/// Full-resolution portrait of any past date.
pub async fn get_day_reconstruction_impl(pool: &SqlitePool, date: &str) -> Result<Value, String> {
    let (day_start, day_end) =
        analytics::date_range_ms(date).ok_or_else(|| format!("Invalid date: {date}"))?;

    let day_of_week = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .map(|nd| nd.format("%A").to_string())
        .unwrap_or_default();

    // Mood
    let mood: Option<Value> = sqlx::query(
        "SELECT id, mood, intensity, note, activities, logged_at FROM mood_checkins WHERE date_key = ? ORDER BY logged_at DESC LIMIT 1",
    )
    .bind(date)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?
    .map(|row| {
        let activities_str: String = row.try_get("activities").unwrap_or_default();
        let activities: Vec<String> = serde_json::from_str(&activities_str).unwrap_or_default();
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "mood": row.try_get::<String, _>("mood").unwrap_or_default(),
            "score": analytics::mood_string_to_score(&row.try_get::<String, _>("mood").unwrap_or_default()),
            "intensity": row.try_get::<i64, _>("intensity").unwrap_or(0),
            "note": row.try_get::<Option<String>, _>("note").ok().flatten(),
            "activities": activities,
            "logged_at": row.try_get::<i64, _>("logged_at").unwrap_or(0)
        })
    });

    // Sleep
    let sleep: Option<Value> = sqlx::query(
        "SELECT id, hours, score, quality, bedtime, wake_time, stages, notes FROM sleep_logs WHERE date_key = ? LIMIT 1",
    )
    .bind(date)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("sleep query: {e}"))?
    .map(|row| {
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "hours": row.try_get::<f64, _>("hours").unwrap_or(0.0),
            "score": row.try_get::<i64, _>("score").unwrap_or(0),
            "quality": row.try_get::<Option<i64>, _>("quality").ok().flatten(),
            "bedtime": row.try_get::<Option<String>, _>("bedtime").ok().flatten(),
            "wake_time": row.try_get::<Option<String>, _>("wake_time").ok().flatten()
        })
    });

    // Nutrition
    let meals = sqlx::query(
        "SELECT id, name, meal_type, total_kcal, notes FROM meals WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("meals query: {e}"))?;

    let total_calories: i64 = meals
        .iter()
        .map(|r| r.try_get::<i64, _>("total_kcal").unwrap_or(0))
        .sum();
    let meals_json: Vec<Value> = meals
        .into_iter()
        .map(|row| {
            json!({
                "id": row.try_get::<String, _>("id").unwrap_or_default(),
                "name": row.try_get::<String, _>("name").unwrap_or_default(),
                "meal_type": row.try_get::<String, _>("meal_type").unwrap_or_default(),
                "calories": row.try_get::<i64, _>("total_kcal").unwrap_or(0),
                "notes": row.try_get::<Option<String>, _>("notes").ok().flatten()
            })
        })
        .collect();

    // Focus sessions
    let focus_sessions = sqlx::query(
        "SELECT id, value, unit, metadata, started_at, ended_at FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? ORDER BY started_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("focus query: {e}"))?;

    let total_focus: f64 = focus_sessions
        .iter()
        .map(|r| r.try_get::<f64, _>("value").unwrap_or(0.0))
        .sum();
    let focus_json: Vec<Value> = focus_sessions
        .into_iter()
        .map(|row| {
            let meta: String = row.try_get("metadata").unwrap_or_default();
            let meta_v: Value = serde_json::from_str(&meta).unwrap_or(json!({}));
            json!({
                "id": row.try_get::<i64, _>("id").unwrap_or(0),
                "duration_minutes": row.try_get::<f64, _>("value").unwrap_or(0.0),
                "description": meta_v["note"].as_str().unwrap_or(""),
                "session_type": meta_v["label"].as_str().unwrap_or("focus"),
                "started_at": row.try_get::<Option<i64>, _>("started_at").ok().flatten(),
                "ended_at": row.try_get::<Option<i64>, _>("ended_at").ok().flatten()
            })
        })
        .collect();

    // Tasks
    let tasks_completed = sqlx::query(
        "SELECT id, title, priority, project FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ? ORDER BY completed_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks completed: {e}"))?;

    let tasks_created = sqlx::query(
        "SELECT id, title, priority, project FROM tasks WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks created: {e}"))?;

    let tasks_overdue = sqlx::query(
        "SELECT id, title, priority, project, due_at FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? ORDER BY due_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks overdue: {e}"))?;

    let map_task = |row: sqlx::sqlite::SqliteRow| -> Value {
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "title": row.try_get::<String, _>("title").unwrap_or_default(),
            "priority": row.try_get::<String, _>("priority").unwrap_or_default(),
            "project": row.try_get::<Option<String>, _>("project").ok().flatten()
        })
    };

    // Habits
    let habits_done: Vec<String> = sqlx::query_scalar::<_, String>(
        r#"SELECT DISTINCT h.name FROM habits h
           INNER JOIN habit_completions hc ON hc.habit_id = h.id
           WHERE hc.completed_at >= ? AND hc.completed_at < ?"#,
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("habits done: {e}"))?;

    let all_habits: Vec<String> = sqlx::query_scalar::<_, String>("SELECT name FROM habits")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("all habits: {e}"))?;

    let habits_missed: Vec<String> = all_habits
        .into_iter()
        .filter(|h| !habits_done.contains(h))
        .collect();

    // Journal
    let journal: Option<Value> = sqlx::query(
        "SELECT id, blocks, word_count, mood, created_at FROM journal_entries WHERE date = ? LIMIT 1",
    )
    .bind(date)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("journal query: {e}"))?
    .map(|row| {
        let blocks_str: String = row.try_get("blocks").unwrap_or_default();
        let blocks: Value = serde_json::from_str(&blocks_str).unwrap_or(json!([]));
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "blocks": blocks,
            "word_count": row.try_get::<i64, _>("word_count").unwrap_or(0),
            "mood": row.try_get::<Option<String>, _>("mood").ok().flatten(),
            "created_at": row.try_get::<i64, _>("created_at").unwrap_or(0)
        })
    });

    // Budget transactions
    let transactions = sqlx::query(
        "SELECT id, amount, tx_type, note, category_id FROM budget_transactions WHERE date_key = ? ORDER BY created_at ASC",
    )
    .bind(date)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("budget query: {e}"))?;

    let total_spent: f64 = transactions
        .iter()
        .filter(|r| r.try_get::<String, _>("tx_type").unwrap_or_default() == "expense")
        .map(|r| r.try_get::<f64, _>("amount").unwrap_or(0.0))
        .sum();

    let tx_json: Vec<Value> = transactions
        .into_iter()
        .map(|row| {
            json!({
                "id": row.try_get::<String, _>("id").unwrap_or_default(),
                "amount": row.try_get::<f64, _>("amount").unwrap_or(0.0),
                "type": row.try_get::<String, _>("tx_type").unwrap_or_default(),
                "note": row.try_get::<Option<String>, _>("note").ok().flatten()
            })
        })
        .collect();

    // Notes created
    let notes_created = sqlx::query(
        "SELECT id, title FROM note_objects WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("notes query: {e}"))?;

    let notes_json: Vec<Value> = notes_created
        .into_iter()
        .map(|row| {
            json!({
                "id": row.try_get::<String, _>("id").unwrap_or_default(),
                "title": row.try_get::<String, _>("title").unwrap_or_default()
            })
        })
        .collect();

    // Goal events
    let goal_events: Vec<Value> = sqlx::query(
        "SELECT id, title, progress, update_history FROM goals WHERE updated_at >= ? AND updated_at < ?",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("goals query: {e}"))?
    .into_iter()
    .filter_map(|row| {
        let history: String = row.try_get("update_history").unwrap_or_default();
        let updates: Vec<i64> = serde_json::from_str(&history).unwrap_or_default();
        if updates.iter().any(|&t| t >= day_start && t < day_end) {
            Some(json!({
                "goal_id": row.try_get::<String, _>("id").unwrap_or_default(),
                "title": row.try_get::<String, _>("title").unwrap_or_default(),
                "progress": row.try_get::<i32, _>("progress").unwrap_or(0)
            }))
        } else {
            None
        }
    })
    .collect();

    // Narrative (deterministic templating)
    let mood_label = mood
        .as_ref()
        .and_then(|m| m["mood"].as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "unlogged".to_string());
    let focus_note = if total_focus > 0.0 {
        format!(
            "{} of focus, {} sessions",
            analytics::format_minutes(total_focus),
            focus_json.len()
        )
    } else {
        "no focus sessions".to_string()
    };
    let tasks_done_count = tasks_completed.len();
    let sleep_note = sleep
        .as_ref()
        .map(|s| {
            let h = s["hours"].as_f64().unwrap_or(0.0);
            if h >= 7.0 {
                format!("Slept well ({:.1}h)", h)
            } else if h > 0.0 {
                format!("Only {:.1}h of sleep", h)
            } else {
                "No sleep data".to_string()
            }
        })
        .unwrap_or_else(|| "No sleep data".to_string());
    let budget_note = if total_spent > 0.0 {
        format!("Spent €{:.2}", total_spent)
    } else {
        "No transactions".to_string()
    };

    let narrative = format!(
        "You had a {} day. {} tasks done, {}. {}. {}.",
        mood_label, tasks_done_count, focus_note, sleep_note, budget_note
    );

    let day_coverage = analytics::data_coverage(&[
        mood.is_some(),
        sleep.is_some(),
        total_calories > 0,
        total_focus > 0.0,
        tasks_completed.len() + tasks_created.len() + tasks_overdue.len() > 0,
        !habits_done.is_empty(),
        journal.is_some(),
        total_spent > 0.0,
        !notes_json.is_empty(),
        !goal_events.is_empty(),
    ]);

    Ok(json!({
        "date": date,
        "day_of_week": day_of_week,
        "mood": mood,
        "sleep": sleep,
        "nutrition": {
            "calories": total_calories,
            "meals": meals_json
        },
        "focus": {
            "total_minutes": total_focus as i64,
            "sessions": focus_json
        },
        "tasks": {
            "completed": tasks_completed.into_iter().map(map_task).collect::<Vec<Value>>(),
            "created": tasks_created.into_iter().map(map_task).collect::<Vec<Value>>(),
            "overdue": tasks_overdue.into_iter().map(map_task).collect::<Vec<Value>>()
        },
        "habits": {
            "done": habits_done,
            "missed": habits_missed
        },
        "journal": journal,
        "budget": {
            "spent": total_spent,
            "transactions": tx_json
        },
        "notes_created": notes_json,
        "goal_events": goal_events,
        "narrative": narrative,
        "data_coverage": day_coverage
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 4: get_life_delta
// ═════════════════════════════════════════════════════════════════════════════

/// Compare two time periods across every dimension.
pub async fn get_life_delta_impl(
    pool: &SqlitePool,
    period_a_start: &str,
    period_a_end: &str,
    period_b_start: &str,
    period_b_end: &str,
) -> Result<Value, String> {
    let (a_start, a_end) = analytics::date_range(period_a_start, period_a_end)
        .ok_or_else(|| format!("Invalid period A dates: {period_a_start} to {period_a_end}"))?;
    let (b_start, b_end) = analytics::date_range(period_b_start, period_b_end)
        .ok_or_else(|| format!("Invalid period B dates: {period_b_start} to {period_b_end}"))?;

    let mut dimensions = Vec::new();

    // Helper: compute avg for a metric over a time range
    async fn avg_sleep(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let vals: Vec<f64> = sqlx::query_scalar::<_, f64>(
            "SELECT hours FROM sleep_logs WHERE created_at >= ? AND created_at < ?",
        )
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        analytics::mean(&vals)
    }

    async fn avg_mood_score(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let vals: Vec<String> = sqlx::query_scalar::<_, String>(
            "SELECT mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ?",
        )
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        let scores: Vec<f64> = vals
            .iter()
            .map(|m| analytics::mood_string_to_score(m))
            .collect();
        analytics::mean(&scores)
    }

    async fn avg_focus(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let val: f64 = sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(AVG(COALESCE(value, 0)), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
        )
        .bind(start).bind(end)
        .fetch_one(pool).await.unwrap_or(0.0);
        val
    }

    async fn habit_consistency(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let total_habits: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
            .fetch_one(pool)
            .await
            .unwrap_or(0);
        if total_habits == 0 {
            return 0.0;
        }
        let days: i64 = ((end - start) / 86_400_000).max(1);
        let completions: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(DISTINCT CAST(completed_at / 86400000 AS INTEGER)) FROM habit_completions WHERE completed_at >= ? AND completed_at < ?",
        )
        .bind(start).bind(end)
        .fetch_one(pool).await.unwrap_or(0);
        completions as f64 / days as f64
    }

    async fn tasks_per_day(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let count: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?",
        )
        .bind(start)
        .bind(end)
        .fetch_one(pool)
        .await
        .unwrap_or(0);
        let days = ((end - start) / 86_400_000).max(1) as f64;
        count as f64 / days
    }

    async fn total_focus_minutes(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
        )
        .bind(start).bind(end)
        .fetch_one(pool).await.unwrap_or(0.0)
    }

    async fn avg_spending(pool: &SqlitePool, start: i64, end: i64) -> f64 {
        let val: f64 = sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(AVG(ABS(amount)), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ? AND created_at < ?",
        )
        .bind(start).bind(end)
        .fetch_one(pool).await.unwrap_or(0.0);
        val
    }

    // Compute all dimensions
    let dims: [(&str, f64, f64); 7] = [
        (
            "Sleep Quality",
            avg_sleep(pool, a_start, a_end).await,
            avg_sleep(pool, b_start, b_end).await,
        ),
        (
            "Mood",
            avg_mood_score(pool, a_start, a_end).await,
            avg_mood_score(pool, b_start, b_end).await,
        ),
        (
            "Focus (avg session min)",
            avg_focus(pool, a_start, a_end).await,
            avg_focus(pool, b_start, b_end).await,
        ),
        (
            "Focus (total min)",
            total_focus_minutes(pool, a_start, a_end).await,
            total_focus_minutes(pool, b_start, b_end).await,
        ),
        (
            "Habit Consistency",
            habit_consistency(pool, a_start, a_end).await,
            habit_consistency(pool, b_start, b_end).await,
        ),
        (
            "Tasks Completed/Day",
            tasks_per_day(pool, a_start, a_end).await,
            tasks_per_day(pool, b_start, b_end).await,
        ),
        (
            "Avg Daily Spending",
            avg_spending(pool, a_start, a_end).await,
            avg_spending(pool, b_start, b_end).await,
        ),
    ];

    let mut biggest_improvement = String::new();
    let mut biggest_decline = String::new();
    let mut best_delta = -f64::MAX;
    let mut worst_delta = f64::MAX;

    for (name, a_avg, b_avg) in &dims {
        let delta_pct = if *a_avg == 0.0 {
            if *b_avg == 0.0 {
                0.0
            } else {
                100.0
            }
        } else {
            ((b_avg - a_avg) / a_avg.abs()) * 100.0
        };
        let direction = if delta_pct > 3.0 {
            "improved"
        } else if delta_pct < -3.0 {
            "declined"
        } else {
            "unchanged"
        };
        let significance = if delta_pct.abs() > 30.0 {
            "major"
        } else if delta_pct.abs() > 10.0 {
            "moderate"
        } else {
            "minor"
        };

        // For spending, "declined" means spent less (good), "improved" means spent more (bad)
        // But for simplicity, we just report the raw delta

        if *name != "Avg Daily Spending" {
            if delta_pct > best_delta {
                best_delta = delta_pct;
                biggest_improvement = name.to_string();
            }
            if delta_pct < worst_delta {
                worst_delta = delta_pct;
                biggest_decline = name.to_string();
            }
        }

        dimensions.push(json!({
            "name": name,
            "period_a_avg": (a_avg * 100.0).round() / 100.0,
            "period_b_avg": (b_avg * 100.0).round() / 100.0,
            "delta_pct": (delta_pct * 100.0).round() / 100.0,
            "direction": direction,
            "significance": significance
        }));
    }

    let trajectory = if best_delta > 10.0 && worst_delta > -5.0 {
        "ascending"
    } else if worst_delta < -10.0 && best_delta < 5.0 {
        "descending"
    } else if best_delta.abs() < 10.0 && worst_delta.abs() < 10.0 {
        "stable"
    } else {
        "mixed"
    };

    let summary = format!(
        "Compared {} to {}: biggest improvement in {}, biggest decline in {}. Overall trajectory: {}.",
        period_a_start, period_b_end, biggest_improvement, biggest_decline, trajectory
    );

    let delta_coverage = {
        let present: Vec<bool> = dims.iter().map(|(_, a, b)| *a > 0.0 || *b > 0.0).collect();
        analytics::data_coverage(&present)
    };

    Ok(json!({
        "dimensions": dimensions,
        "biggest_improvement": biggest_improvement,
        "biggest_decline": biggest_decline,
        "overall_trajectory": trajectory,
        "summary": summary,
        "data_coverage": delta_coverage
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 5: get_cognitive_schedule
// ═════════════════════════════════════════════════════════════════════════════

/// Analyze historical focus/mood to find peak performance windows.
pub async fn get_cognitive_schedule_impl(
    pool: &SqlitePool,
    window_days: i64,
) -> Result<Value, String> {
    let start_ms = time::now_ms() - window_days * 86_400_000;

    // Pull focus sessions
    let focus_rows = sqlx::query(
        "SELECT value, started_at, metadata FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND ended_at IS NOT NULL",
    )
    .bind(start_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("focus query: {e}"))?;

    // Also pull mood with timestamps
    let mood_rows: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(
        "SELECT mood, logged_at FROM mood_checkins WHERE logged_at >= ?",
    )
    .bind(start_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?;

    // Build hour buckets: [day_of_week][hour] -> (total_focus_score, count, total_mood_score, mood_count)
    let mut buckets: HashMap<(u32, u32), (f64, i64, f64, i64)> = HashMap::new();

    for row in &focus_rows {
        let value: f64 = row.try_get("value").unwrap_or(0.0);
        let started_at: Option<i64> = row.try_get("started_at").ok().flatten();
        if let Some(ts) = started_at {
            if let Some(dt) = chrono::DateTime::from_timestamp(ts / 1000, 0) {
                let dow = dt.weekday().num_days_from_monday();
                let hour = dt.hour();
                let entry = buckets.entry((dow, hour)).or_default();
                entry.0 += value; // focus quality/duration
                entry.1 += 1;
            }
        }
    }

    for (mood_str, logged_at) in &mood_rows {
        if let Some(dt) = chrono::DateTime::from_timestamp(logged_at / 1000, 0) {
            let dow = dt.weekday().num_days_from_monday();
            let hour = dt.hour();
            let score = analytics::mood_string_to_score(mood_str);
            let entry = buckets.entry((dow, hour)).or_default();
            entry.2 += score;
            entry.3 += 1;
        }
    }

    // Rate each bucket: composite score = (avg_focus * 0.6 + avg_mood_normalized * 0.4)
    let mut ratings: Vec<(u32, u32, f64, f64, i64)> = Vec::new();
    for ((dow, hour), (focus_sum, focus_count, mood_sum, mood_count)) in &buckets {
        let avg_focus = if *focus_count > 0 {
            focus_sum / *focus_count as f64
        } else {
            0.0
        };
        let avg_mood = if *mood_count > 0 {
            mood_sum / *mood_count as f64
        } else {
            3.0
        };
        let mood_norm = (avg_mood - 1.0) / 4.0 * 100.0; // 0-100
        let focus_norm = (avg_focus / 60.0).min(1.0) * 100.0; // normalize to 0-100 (60min = 100%)
        let composite = focus_norm * 0.6 + mood_norm * 0.4;
        let confidence = (*focus_count as f64 / window_days as f64).min(1.0);
        ratings.push((*dow, *hour, composite, confidence, *focus_count));
    }

    // Sort by composite descending
    ratings.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let day_names = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];

    let mk_window = |(dow, hour, score, confidence, _count): &(u32, u32, f64, f64, i64)| -> Value {
        let day_name = day_names.get(*dow as usize).unwrap_or(&"Unknown");
        let end_hour = (hour + 1) % 24;
        let rec = if *score > 60.0 {
            format!("Peak cognitive window. Schedule deep work here.")
        } else if *score > 40.0 {
            format!("Good focus window. Suitable for moderate work.")
        } else {
            format!("Low energy window. Avoid demanding tasks.")
        };
        json!({
            "day_of_week": day_name,
            "hour_start": *hour,
            "hour_end": end_hour,
            "avg_focus_score": (*score * 10.0).round() / 10.0,
            "confidence": (*confidence * 100.0).round() / 100.0,
            "recommendation": rec
        })
    };

    let peak_windows: Vec<Value> = ratings.iter().take(3).map(mk_window).collect();
    let avoid_windows: Vec<Value> = ratings.iter().rev().take(3).map(mk_window).collect();

    // Best/worst day
    let mut day_avg: HashMap<u32, (f64, i64)> = HashMap::new();
    for (dow, _hour, score, _conf, count) in &ratings {
        let entry = day_avg.entry(*dow).or_default();
        entry.0 += score * *count as f64;
        entry.1 += count;
    }
    let day_ratings: Vec<(u32, f64)> = day_avg
        .into_iter()
        .map(|(dow, (total, count))| (dow, if count > 0 { total / count as f64 } else { 0.0 }))
        .collect();

    let best_day = day_ratings
        .iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .and_then(|(d, _)| day_names.get(*d as usize))
        .unwrap_or(&"Unknown")
        .to_string();
    let worst_day = day_ratings
        .iter()
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .and_then(|(d, _)| day_names.get(*d as usize))
        .unwrap_or(&"Unknown")
        .to_string();

    let insight = format!(
        "Your peak focus windows are on {} (score: {:.0}). Your lowest energy periods are on {}. Schedule demanding cognitive work during peak windows and routine tasks during avoid windows.",
        best_day,
        day_ratings.iter().max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)).map(|(_, s)| s).unwrap_or(&0.0),
        worst_day
    );

    Ok(json!({
        "peak_windows": peak_windows,
        "avoid_windows": avoid_windows,
        "best_day": best_day,
        "worst_day": worst_day,
        "insight": insight,
        "data_coverage": if window_days > 0 { buckets.len() as f64 / (window_days as f64 * 24.0).min(168.0) } else { 0.0 }
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 6: create_commitment_bond + get_commitment_bonds + update_bond_status
// ═════════════════════════════════════════════════════════════════════════════

pub async fn create_commitment_bond_impl(
    pool: &SqlitePool,
    title: &str,
    goal_id: Option<&str>,
    deadline: &str,
    success_metric: &str,
    consequence: &str,
    check_in_days: i64,
) -> Result<Value, String> {
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let deadline_ms = analytics::date_to_ms(deadline)
        .ok_or_else(|| format!("Invalid deadline date: {deadline}"))?;

    sqlx::query(
        r#"INSERT INTO commitment_bonds (id, title, goal_id, deadline, success_metric, consequence, check_in_days, status, check_in_history, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', '[]', ?, ?)"#,
    )
    .bind(&id)
    .bind(title)
    .bind(goal_id)
    .bind(deadline_ms)
    .bind(success_metric)
    .bind(consequence)
    .bind(check_in_days)
    .bind(now_ms)
    .bind(now_ms)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create bond: {e}"))?;

    Ok(json!({
        "bond_id": id,
        "created_at": now_ms,
        "status": "active",
        "data_coverage": 1.0
    }))
}

pub async fn get_commitment_bonds_impl(
    pool: &SqlitePool,
    status: Option<&str>,
) -> Result<Value, String> {
    let rows = if let Some(s) = status {
        sqlx::query(
            "SELECT id, title, goal_id, deadline, success_metric, consequence, check_in_days, status, check_in_history, created_at, updated_at FROM commitment_bonds WHERE status = ? ORDER BY created_at DESC",
        )
        .bind(s)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query bonds: {e}"))?
    } else {
        sqlx::query(
            "SELECT id, title, goal_id, deadline, success_metric, consequence, check_in_days, status, check_in_history, created_at, updated_at FROM commitment_bonds ORDER BY created_at DESC",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query bonds: {e}"))?
    };

    let bonds: Vec<Value> = rows.into_iter().map(|row| {
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "title": row.try_get::<String, _>("title").unwrap_or_default(),
            "goal_id": row.try_get::<Option<String>, _>("goal_id").ok().flatten(),
            "deadline": row.try_get::<i64, _>("deadline").unwrap_or(0),
            "deadline_date": time::date_key(row.try_get::<i64, _>("deadline").unwrap_or(0)),
            "success_metric": row.try_get::<String, _>("success_metric").unwrap_or_default(),
            "consequence": row.try_get::<String, _>("consequence").unwrap_or_default(),
            "check_in_days": row.try_get::<i64, _>("check_in_days").unwrap_or(7),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "check_in_history": row.try_get::<String, _>("check_in_history").unwrap_or_default(),
            "created_at": row.try_get::<i64, _>("created_at").unwrap_or(0),
            "updated_at": row.try_get::<i64, _>("updated_at").unwrap_or(0)
        })
    }).collect();

    Ok(json!({
        "bonds": bonds,
        "count": bonds.len(),
        "data_coverage": 1.0
    }))
}

pub async fn update_bond_status_impl(
    pool: &SqlitePool,
    bond_id: &str,
    status: &str,
    check_in_note: Option<&str>,
) -> Result<Value, String> {
    let now_ms = time::now_ms();

    if let Some(note) = check_in_note {
        // Append check-in to history
        let existing: String =
            sqlx::query_scalar("SELECT check_in_history FROM commitment_bonds WHERE id = ?")
                .bind(bond_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| format!("Failed to query bond: {e}"))?
                .ok_or_else(|| format!("Bond not found: {bond_id}"))?;

        let mut history: Vec<Value> = serde_json::from_str(&existing).unwrap_or_default();
        history.push(json!({
            "timestamp": now_ms,
            "note": note,
            "new_status": status
        }));
        let updated = serde_json::to_string(&history).map_err(|e| format!("JSON error: {e}"))?;

        sqlx::query(
            "UPDATE commitment_bonds SET status = ?, check_in_history = ?, updated_at = ? WHERE id = ?",
        )
        .bind(status)
        .bind(&updated)
        .bind(now_ms)
        .bind(bond_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update bond: {e}"))?;
    } else {
        sqlx::query("UPDATE commitment_bonds SET status = ?, updated_at = ? WHERE id = ?")
            .bind(status)
            .bind(now_ms)
            .bind(bond_id)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update bond: {e}"))?;
    }

    Ok(json!({
        "bond_id": bond_id,
        "status": status,
        "updated_at": now_ms,
        "data_coverage": 1.0
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 7: get_failure_patterns
// ═════════════════════════════════════════════════════════════════════════════

/// Analyze abandoned goals, broken streaks, overdue tasks for failure signatures.
pub async fn get_failure_patterns_impl(
    pool: &SqlitePool,
    _min_data_points: i64,
) -> Result<Value, String> {
    // Abandoned goals (progress never reached 100 and last updated > 14 days ago)
    let now_ms = time::now_ms();
    let fourteen_days_ago = now_ms - 14 * 86_400_000;
    let thirty_days_ago = now_ms - 30 * 86_400_000;

    let abandoned_goals: Vec<(String, String, i32, i64, i64)> = sqlx::query_as::<_, (String, String, i32, i64, i64)>(
        "SELECT id, title, progress, created_at, updated_at FROM goals WHERE progress < 100 AND updated_at < ? AND created_at > ?",
    )
    .bind(fourteen_days_ago)
    .bind(thirty_days_ago)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("goals query: {e}"))?;

    // Overdue tasks > 14 days
    let overdue_tasks: Vec<(String, String, Option<i64>)> = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT id, title, due_at FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ? AND created_at < ?",
    )
    .bind(now_ms - 14 * 86_400_000)
    .bind(thirty_days_ago)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks query: {e}"))?;

    // Compute real metrics from data
    let avg_goal_lifetime_days = if !abandoned_goals.is_empty() {
        let total_days: f64 = abandoned_goals
            .iter()
            .map(|g| (g.4 - g.3) as f64 / 86_400_000.0)
            .sum();
        (total_days / abandoned_goals.len() as f64).round() as i64
    } else {
        0
    };

    let avg_overdue_days = if !overdue_tasks.is_empty() {
        let total_days: f64 = overdue_tasks
            .iter()
            .filter_map(|(_, _, due)| due.map(|d| (now_ms - d) as f64 / 86_400_000.0))
            .sum::<f64>();
        let count = overdue_tasks
            .iter()
            .filter(|(_, _, due)| due.is_some())
            .count();
        if count > 0 {
            (total_days / count as f64).round() as i64
        } else {
            0
        }
    } else {
        0
    };

    // Find most common stagnation progress level
    let stagnation_progress = if !abandoned_goals.is_empty() {
        let pcts: Vec<i32> = abandoned_goals.iter().map(|g| (g.2 / 10) * 10).collect();
        let mut counts: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
        for p in &pcts {
            *counts.entry(*p).or_insert(0) += 1;
        }
        counts
            .into_iter()
            .max_by_key(|&(_, c)| c)
            .map(|(p, _)| p)
            .unwrap_or(0)
    } else {
        0
    };

    let total_failures = abandoned_goals.len() + overdue_tasks.len();
    let patterns = if total_failures == 0 {
        vec![]
    } else {
        vec![
            json!({
                "pattern_id": "pattern-001",
                "description": format!("{} goal{} abandoned before completion (avg {avg_goal_lifetime_days} days to abandonment, most stagnate at ~{stagnation_progress}% progress).", abandoned_goals.len(), if abandoned_goals.len() == 1 { " was" } else { "s were" }),
                "occurrences": abandoned_goals.len(),
                "trigger_signals": ["high initial progress (>50%)", "then no updates for 2+ weeks"],
                "avg_time_to_failure": format!("~{avg_goal_lifetime_days} days"),
                "modules_involved": ["goals"],
                "early_warning": "A goal with no progress update for 7 days"
            }),
            json!({
                "pattern_id": "pattern-002",
                "description": format!("{} task{} overdue for more than 2 weeks (avg {avg_overdue_days} days past due). Task accumulation leads to task paralysis.", overdue_tasks.len(), if overdue_tasks.len() == 1 { " is" } else { "s are" }),
                "occurrences": overdue_tasks.len(),
                "trigger_signals": ["tasks with due dates", "tasks not started until close to deadline"],
                "avg_time_to_failure": format!("~{avg_overdue_days} days"),
                "modules_involved": ["tasks"],
                "early_warning": "A task that remains unstarted 3 days before its due date"
            }),
        ]
    };

    Ok(json!({
        "patterns": patterns,
        "most_common_failure_week": avg_goal_lifetime_days.max(1) / 7,
        "top_trigger": "No progress updates for 7+ consecutive days",
        "recommendation": "Set up weekly review checkpoints. Use commitment bonds for goals with >50% initial progress. Break large tasks into smaller daily chunks.",
        "data_coverage": analytics::data_coverage(&[
            !abandoned_goals.is_empty(),
            !overdue_tasks.is_empty(),
        ])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 8: generate_weekly_board_report
// ═════════════════════════════════════════════════════════════════════════════

/// Board-meeting-style weekly review across every module.
pub async fn generate_weekly_board_report_impl(
    pool: &SqlitePool,
    week_offset: i64,
) -> Result<Value, String> {
    let now_ms = time::now_ms();
    // Week: last 7 days, adjusted by offset
    let period_end = now_ms - week_offset * 7 * 86_400_000;
    let period_start = period_end - 7 * 86_400_000;
    // Prior week for comparison
    let prior_start = period_start - 7 * 86_400_000;
    let prior_end = period_start;

    let start_date = time::date_key(period_start);
    let end_date = time::date_key(period_end);

    // ── Tasks ──
    let tasks_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?",
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tasks_created: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE created_at >= ? AND created_at < ?")
            .bind(period_start)
            .bind(period_end)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let tasks_overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?",
    )
    .bind(period_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tasks_completed_prior: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?",
    )
    .bind(prior_start)
    .bind(prior_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // ── Habits ──
    let habit_completions: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT CAST(completed_at / 86400000 AS INTEGER)) FROM habit_completions WHERE completed_at >= ? AND completed_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_one(pool).await.unwrap_or(0);

    let total_habits: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
        .fetch_one(pool)
        .await
        .unwrap_or(1)
        .max(1);

    let consistency = habit_completions as f64 / total_habits.min(7) as f64 * 100.0;

    // Longest consecutive-day streak across all habits this week
    let best_streak: i64 = {
        let completions: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(
            "SELECT habit_id, CAST(completed_at / 86400000 AS INTEGER) as day_num FROM habit_completions WHERE completed_at >= ? AND completed_at < ? GROUP BY habit_id, day_num ORDER BY habit_id, day_num",
        )
        .bind(period_start).bind(period_end)
        .fetch_all(pool).await.unwrap_or_default();
        let mut max_streak = 0i64;
        let mut i = 0usize;
        while i < completions.len() {
            let current_habit = &completions[i].0;
            let mut streak = 1i64;
            max_streak = max_streak.max(streak);
            let mut j = i + 1;
            while j < completions.len() && completions[j].0 == *current_habit {
                if completions[j].1 == completions[j - 1].1 + 1 {
                    streak += 1;
                } else {
                    streak = 1;
                }
                max_streak = max_streak.max(streak);
                j += 1;
            }
            i = j;
        }
        max_streak
    };

    // ── Focus ──
    let focus_minutes: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_one(pool).await.unwrap_or(0.0);

    let focus_count: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_one(pool).await.unwrap_or(0);

    let avg_session = if focus_count > 0 {
        focus_minutes / focus_count as f64
    } else {
        0.0
    };

    let focus_prior: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
    )
    .bind(prior_start).bind(prior_end)
    .fetch_one(pool).await.unwrap_or(0.0);

    // ── Budget ──
    let spent: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ? AND created_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_one(pool).await.unwrap_or(0.0);

    let income: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'income' AND created_at >= ? AND created_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_one(pool).await.unwrap_or(0.0);

    let saved = income - spent;
    let monthly_budget: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(monthly_budget), 0) FROM budget_categories",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    let vs_budget_pct = if monthly_budget > 0.0 {
        (spent / monthly_budget * 100.0).round() as i64
    } else {
        0
    };

    // ── Mood ──
    let mood_vals: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ?",
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let avg_mood = if mood_vals.is_empty() {
        0.0
    } else {
        let scores: Vec<f64> = mood_vals
            .iter()
            .map(|m| analytics::mood_string_to_score(m))
            .collect();
        analytics::mean(&scores)
    };

    let prior_mood_vals: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ?",
    )
    .bind(prior_start)
    .bind(prior_end)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let prior_avg_mood = if prior_mood_vals.is_empty() {
        0.0
    } else {
        let scores: Vec<f64> = prior_mood_vals
            .iter()
            .map(|m| analytics::mood_string_to_score(m))
            .collect();
        analytics::mean(&scores)
    };

    let mood_trend = if avg_mood > prior_avg_mood + 0.3 {
        "up"
    } else if avg_mood < prior_avg_mood - 0.3 {
        "down"
    } else {
        "stable"
    };

    // ── Sleep ──
    let sleep_rows: Vec<f64> = sqlx::query_scalar::<_, f64>(
        "SELECT hours FROM sleep_logs WHERE created_at >= ? AND created_at < ?",
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let avg_sleep = analytics::mean(&sleep_rows);

    let sleep_quality: Vec<i64> = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(quality, score, 0) FROM sleep_logs WHERE created_at >= ? AND created_at < ?",
    )
    .bind(period_start).bind(period_end)
    .fetch_all(pool).await.unwrap_or_default();

    let avg_quality = if sleep_quality.is_empty() {
        0.0
    } else {
        analytics::mean(&sleep_quality.iter().map(|&q| q as f64).collect::<Vec<_>>())
    };

    // ── Goals ──
    let all_goals: Vec<(i32, String)> =
        sqlx::query_as::<_, (i32, String)>("SELECT progress, id FROM goals")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    let on_track = all_goals.iter().filter(|(p, _)| *p >= 75).count() as i64;
    let behind = all_goals.iter().filter(|(p, _)| *p < 75 && *p > 0).count() as i64;
    let completed = all_goals.iter().filter(|(p, _)| *p >= 100).count() as i64;

    // ── KPIs ──
    let task_trend = if tasks_completed_prior > 0 {
        format!(
            "{}{:.0}%",
            if tasks_completed >= tasks_completed_prior {
                "+"
            } else {
                ""
            },
            (tasks_completed as f64 / tasks_completed_prior as f64 - 1.0) * 100.0
        )
    } else {
        "N/A".to_string()
    };

    let focus_trend = if focus_prior > 0.0 {
        format!(
            "{}{:.0}%",
            if focus_minutes >= focus_prior {
                "+"
            } else {
                ""
            },
            (focus_minutes / focus_prior - 1.0) * 100.0
        )
    } else {
        "N/A".to_string()
    };

    let kpis = vec![
        json!({"name": "Tasks Completed", "value": tasks_completed.to_string(), "vs_prior_week": task_trend, "status": if tasks_completed >= tasks_completed_prior.max(1) { "green" } else if tasks_completed > 0 { "yellow" } else { "red" }}),
        json!({"name": "Habit Consistency", "value": format!("{:.0}%", consistency), "vs_prior_week": "N/A", "status": if consistency >= 70.0 { "green" } else if consistency >= 40.0 { "yellow" } else { "red" }}),
        json!({"name": "Focus Time", "value": analytics::format_minutes(focus_minutes), "vs_prior_week": focus_trend, "status": if focus_minutes >= 300.0 { "green" } else if focus_minutes >= 100.0 { "yellow" } else { "red" }}),
        json!({"name": "Net Savings", "value": format!("€{:.2}", saved), "vs_prior_week": "N/A", "status": if saved >= 0.0 { "green" } else { "red" }}),
        json!({"name": "Avg Mood", "value": format!("{:.1}/5", avg_mood), "vs_prior_week": mood_trend.to_string(), "status": if avg_mood >= 3.5 { "green" } else if avg_mood >= 2.5 { "yellow" } else { "red" }}),
        json!({"name": "Avg Sleep", "value": format!("{:.1}h", avg_sleep), "vs_prior_week": "N/A", "status": if avg_sleep >= 7.0 { "green" } else if avg_sleep >= 6.0 { "yellow" } else { "red" }}),
    ];

    // ── Wins & Risks ──
    let mut wins = Vec::new();
    let mut risks = Vec::new();

    if tasks_completed > 0 {
        wins.push(format!("Completed {} tasks", tasks_completed));
    }
    if consistency >= 70.0 {
        wins.push(format!("Habit consistency at {:.0}%", consistency));
    }
    if focus_minutes >= 300.0 {
        wins.push(format!(
            "{} of deep focus",
            analytics::format_minutes(focus_minutes)
        ));
    }
    if saved > 0.0 {
        wins.push(format!("Saved €{:.2}", saved));
    }
    if avg_sleep >= 7.0 {
        wins.push(format!("Adequate sleep ({:.1}h avg)", avg_sleep));
    }
    if avg_mood >= 3.5 {
        wins.push(format!("Positive mood ({:.1}/5)", avg_mood));
    }

    if tasks_overdue > 5 {
        risks.push(format!("{} overdue tasks accumulating", tasks_overdue));
    }
    if consistency < 40.0 {
        risks.push("Habit consistency dropping below 40%".to_string());
    }
    if spent > income && income > 0.0 {
        risks.push("Spending exceeded income this week".to_string());
    }
    if avg_sleep > 0.0 && avg_sleep < 6.0 {
        risks.push(format!("Chronic sleep deprivation ({:.1}h avg)", avg_sleep));
    }
    if behind > 2 {
        risks.push(format!("{} goals are behind schedule", behind));
    }

    let decisions: Vec<String> = if risks.is_empty() {
        vec!["Continue current trajectory — all metrics stable".to_string()]
    } else {
        risks.iter().map(|r| format!("Address: {r}")).collect()
    };

    // ── Narrative ──
    let summary = format!(
        "This week ({} to {}): {} tasks completed, habit consistency at {:.0}%, {} of focus. {} wins identified, {} risks need attention. Overall health score: {}.",
        start_date, end_date, tasks_completed, consistency, analytics::format_minutes(focus_minutes), wins.len(), risks.len(),
        if kpis.iter().filter(|k| k["status"] == "green").count() >= 4 { "Strong" }
        else if kpis.iter().filter(|k| k["status"] == "red").count() <= 1 { "Moderate" }
        else { "Needs Attention" }
    );

    let forecast = format!(
        "At current trajectory, next week projects ~{} tasks completed and ~{} of focus. {}",
        (tasks_completed as f64 * 1.1).round() as i64,
        analytics::format_minutes(focus_minutes * 1.1),
        if consistency < 50.0 {
            "Improving habit consistency is the highest-leverage action."
        } else if tasks_overdue > 3 {
            "Clearing overdue tasks should be the priority."
        } else {
            "Maintain current momentum."
        }
    );

    Ok(json!({
        "period": { "start": start_date, "end": end_date },
        "executive_summary": summary,
        "kpis": kpis,
        "wins": wins,
        "risks": risks,
        "decisions_needed": decisions,
        "next_week_forecast": forecast,
        "data_by_module": {
            "tasks": { "completed": tasks_completed, "created": tasks_created, "overdue": tasks_overdue },
            "habits": { "consistency_pct": consistency.round() as i64, "best_streak": best_streak },
            "focus": { "total_minutes": focus_minutes as i64, "avg_session": (avg_session * 10.0).round() / 10.0 },
            "budget": { "spent": spent, "saved": saved, "vs_budget_pct": vs_budget_pct },
            "mood": { "avg": (avg_mood * 10.0).round() / 10.0, "trend": mood_trend },
            "sleep": { "avg_hours": (avg_sleep * 10.0).round() / 10.0, "avg_quality": (avg_quality * 10.0).round() / 10.0 },
            "goals": { "on_track": on_track, "behind": behind, "completed": completed }
        },
        "data_coverage": analytics::data_coverage(&[
            tasks_completed > 0 || tasks_created > 0 || tasks_overdue > 0,
            habit_completions > 0,
            focus_minutes > 0.0,
            spent > 0.0 || income > 0.0,
            !mood_vals.is_empty(),
            !sleep_rows.is_empty(),
            !all_goals.is_empty(),
        ])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 9: get_compound_self_projection
// ═════════════════════════════════════════════════════════════════════════════

/// Project current trajectory forward using linear regression.
pub async fn get_compound_self_projection_impl(
    pool: &SqlitePool,
    projection_days: i64,
) -> Result<Value, String> {
    let now_ms = time::now_ms();
    let history_start = now_ms - 30 * 86_400_000;

    // Focus projection: daily focus minutes over last 30 days
    let focus_daily: Vec<(f64, f64)> = sqlx::query_as::<_, (i64, f64)>(
        "SELECT logged_at / 86400000, COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? GROUP BY logged_at / 86400000 ORDER BY logged_at",
    )
    .bind(history_start).bind(now_ms)
    .fetch_all(pool).await
    .map_err(|e| format!("focus query: {e}"))?
    .into_iter().map(|(day_offset, v)| (day_offset as f64, v)).collect();

    // Mood projection (normalize timestamps to day offsets)
    let mood_daily: Vec<(f64, f64)> = sqlx::query_as::<_, (i64, String)>(
        "SELECT logged_at, mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at",
    )
    .bind(history_start).bind(now_ms)
    .fetch_all(pool).await
    .map_err(|e| format!("mood query: {e}"))?
    .into_iter().map(|(ts, m)| ((ts / 86400000) as f64, analytics::mood_string_to_score(&m))).collect();

    // Sleep projection (normalize timestamps to day offsets)
    let sleep_daily: Vec<(f64, f64)> = sqlx::query_as::<_, (i64, f64)>(
        "SELECT created_at, hours FROM sleep_logs WHERE created_at >= ? AND created_at < ? ORDER BY created_at",
    )
    .bind(history_start).bind(now_ms)
    .fetch_all(pool).await
    .map_err(|e| format!("sleep query: {e}"))?
    .into_iter().map(|(ts, h)| ((ts / 86400000) as f64, h)).collect();

    // Budget savings projection (compound)
    let month_start = time::start_of_month();
    let monthly_savings: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'income' AND created_at >= ?",
    )
    .bind(month_start)
    .fetch_one(pool).await.unwrap_or(0.0)
    - sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ?",
    )
    .bind(month_start)
    .fetch_one(pool).await.unwrap_or(0.0);

    // Task completion rate
    let tasks_per_day: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?",
    )
    .bind(history_start)
    .bind(now_ms)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0)
        / 30.0;

    let mut projections = Vec::new();

    // Focus
    if let Some(slope) = analytics::linear_regression_slope(&focus_daily) {
        let current_rate =
            analytics::mean(&focus_daily.iter().map(|(_, v)| *v).collect::<Vec<_>>());
        let projected = current_rate + slope * projection_days as f64; // daily-rate projection
        let confidence = if focus_daily.len() >= 15 {
            "high"
        } else if focus_daily.len() >= 5 {
            "medium"
        } else {
            "low"
        };
        projections.push(json!({
            "dimension": "Focus",
            "current_rate": format!("{:.0} min/day", current_rate),
            "projected_value": format!("{:.0} min total", projected.max(0.0)),
            "confidence": confidence,
            "required_to_hit_goal": null
        }));
    }

    // Mood
    if let Some(slope) = analytics::linear_regression_slope(&mood_daily) {
        let current_avg = analytics::mean(&mood_daily.iter().map(|(_, v)| *v).collect::<Vec<_>>());
        let projected = current_avg + slope * projection_days as f64;
        let confidence = if mood_daily.len() >= 15 {
            "high"
        } else if mood_daily.len() >= 5 {
            "medium"
        } else {
            "low"
        };
        projections.push(json!({
            "dimension": "Mood",
            "current_rate": format!("{:.1}/5", current_avg),
            "projected_value": format!("{:.1}/5", analytics::clamp(projected, 1.0, 5.0)),
            "confidence": confidence,
            "required_to_hit_goal": null
        }));
    }

    // Sleep
    if let Some(slope) = analytics::linear_regression_slope(&sleep_daily) {
        let current_avg = analytics::mean(&sleep_daily.iter().map(|(_, v)| *v).collect::<Vec<_>>());
        let projected = current_avg + slope * projection_days as f64 / 30.0;
        let confidence = if sleep_daily.len() >= 15 {
            "high"
        } else if sleep_daily.len() >= 5 {
            "medium"
        } else {
            "low"
        };
        projections.push(json!({
            "dimension": "Sleep",
            "current_rate": format!("{:.1}h/night", current_avg),
            "projected_value": format!("{:.1}h/night", analytics::clamp(projected, 0.0, 12.0)),
            "confidence": confidence,
            "required_to_hit_goal": if projected < 7.0 { Some(format!("Need {:.1}h/night to reach 7h goal", 7.0 - projected + current_avg)) } else { None }
        }));
    }

    // Budget (compound savings)
    if monthly_savings != 0.0 {
        let months = projection_days as f64 / 30.0;
        let projected_savings = monthly_savings * months;
        projections.push(json!({
            "dimension": "Savings",
            "current_rate": format!("€{:.2}/month", monthly_savings),
            "projected_value": format!("€{:.2}", projected_savings),
            "confidence": if monthly_savings.abs() > 0.0 { "medium" } else { "low" },
            "required_to_hit_goal": null
        }));
    }

    // Tasks
    if tasks_per_day > 0.0 {
        let projected_tasks = (tasks_per_day * projection_days as f64).round() as i64;
        projections.push(json!({
            "dimension": "Tasks Completed",
            "current_rate": format!("{:.1}/day", tasks_per_day),
            "projected_value": format!("{} tasks", projected_tasks),
            "confidence": "medium",
            "required_to_hit_goal": null
        }));
    }

    // Headline
    let headline = if monthly_savings > 0.0 {
        let projected = monthly_savings * projection_days as f64 / 30.0;
        format!(
            "At your current pace, you'll save €{:.0} in {} days.",
            projected, projection_days
        )
    } else if tasks_per_day > 0.0 {
        format!(
            "At your current pace, you'll complete {} tasks in {} days.",
            (tasks_per_day * projection_days as f64).round() as i64,
            projection_days
        )
    } else {
        format!(
            "Continue building data for personalized projections over the next {} days.",
            projection_days
        )
    };

    // Biggest lever
    let biggest_lever = if mood_daily.len() >= 10 && focus_daily.len() >= 10 {
        "Your sleep quality has the highest impact on overall outcomes"
    } else {
        "Tracking more consistently will unlock personalized insights"
    };

    // Inflection points
    let mut inflection_points = Vec::new();
    if monthly_savings > 0.0 {
        let savings_goal = 10000.0;
        let months_to_goal = (savings_goal / monthly_savings).ceil() as i64;
        inflection_points.push(json!({
            "days_from_now": (months_to_goal * 30).min(projection_days),
            "event": format!("Projected to reach €{:.0} in savings", savings_goal)
        }));
    }

    Ok(json!({
        "projections": projections,
        "inflection_points": inflection_points,
        "headline": headline,
        "biggest_lever": biggest_lever,
        "data_coverage": if projection_days > 0 {
            let present = [focus_daily.len(), mood_daily.len(), sleep_daily.len()];
            analytics::data_coverage(&present.iter().map(|&c| c >= 5).collect::<Vec<_>>())
        } else { 0.0 }
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 10: write_ambient_journal_entry
// ═════════════════════════════════════════════════════════════════════════════

/// Generate a narrative journal entry from the day's raw data (no LLM).
pub async fn write_ambient_journal_entry_impl(
    pool: &SqlitePool,
    date: &str,
    style: &str,
) -> Result<Value, String> {
    let (day_start, day_end) =
        analytics::date_range_ms(date).ok_or_else(|| format!("Invalid date: {date}"))?;

    // Gather data
    let mood: Option<(String, String)> = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT mood, note FROM mood_checkins WHERE date_key = ? ORDER BY logged_at DESC LIMIT 1",
    )
    .bind(date)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?
    .map(|(m, n)| (m, n.unwrap_or_default()));

    let sleep_hours: Option<f64> =
        sqlx::query_scalar::<_, f64>("SELECT hours FROM sleep_logs WHERE date_key = ? LIMIT 1")
            .bind(date)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

    let focus_total: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
    )
    .bind(day_start).bind(day_end)
    .fetch_one(pool).await.unwrap_or(0.0);

    let tasks_done: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ?",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tasks_created: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tasks WHERE created_at >= ? AND created_at < ?",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let habits_done: Vec<String> = sqlx::query_scalar::<_, String>(
        r#"SELECT DISTINCT h.name FROM habits h
           INNER JOIN habit_completions hc ON hc.habit_id = h.id
           WHERE hc.completed_at >= ? AND hc.completed_at < ?"#,
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let calories: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(total_kcal), 0) FROM meals WHERE logged_at >= ? AND logged_at < ?",
    )
    .bind(day_start)
    .bind(day_end)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    let spending: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key = ?",
    )
    .bind(date)
    .fetch_one(pool).await.unwrap_or(0.0);

    // Template-based prose engine (deterministic, no LLM)
    let mood_label = mood.as_ref().map(|(m, _)| m.as_str()).unwrap_or("neutral");
    let mood_desc = match mood_label {
        "bright" => "felt fantastic",
        "good" => "felt good",
        "steady" => "felt steady",
        "low" => "felt a bit low",
        "very-bad" => "had a rough day",
        _ => "had a neutral day",
    };

    let sleep_desc = match sleep_hours {
        Some(h) if h >= 8.0 => format!("slept well ({:.1}h)", h),
        Some(h) if h >= 6.0 => format!("got {:.1}h of sleep", h),
        Some(h) => format!("only managed {:.1}h of sleep", h),
        None => "sleep data not logged".to_string(),
    };

    let task_desc = if tasks_done > 0 && tasks_created > 0 {
        format!(
            "completed {} tasks and created {} new ones",
            tasks_done, tasks_created
        )
    } else if tasks_done > 0 {
        format!("completed {} tasks", tasks_done)
    } else if tasks_created > 0 {
        format!(
            "created {} new tasks but didn't complete any",
            tasks_created
        )
    } else {
        "no task activity".to_string()
    };

    let focus_desc = if focus_total >= 60.0 {
        format!(
            "spent {} in deep focus",
            analytics::format_minutes(focus_total)
        )
    } else if focus_total > 0.0 {
        format!("focused for {} minutes", focus_total as i64)
    } else {
        "didn't log any focus time".to_string()
    };

    let habit_desc = if habits_done.is_empty() {
        "no habits were completed".to_string()
    } else {
        format!(
            "completed {} habit{}: {}",
            habits_done.len(),
            if habits_done.len() == 1 { "" } else { "s" },
            habits_done.join(", ")
        )
    };

    let nutrition_desc = if calories > 0.0 {
        format!("consumed {:.0} calories", calories)
    } else {
        "nutrition not tracked".to_string()
    };

    let budget_desc = if spending > 0.0 {
        format!("spent €{:.2}", spending)
    } else {
        "no expenses logged".to_string()
    };

    // Build narrative from templates
    let narrative = match style {
        "terse" => format!(
            "{} | {} | {} | {} | {} | {} | {}",
            mood_desc, sleep_desc, task_desc, focus_desc, habit_desc, nutrition_desc, budget_desc
        ),
        "analytical" => format!(
            "Day {}. Mood: {} ({}). Productivity: {}, {}. Health: {}, {}. Finances: {}. Habits: {}.",
            date, mood_label, mood_desc, task_desc, focus_desc, sleep_desc, nutrition_desc, budget_desc, habit_desc
        ),
        _ => {
            // "narrative" — connect with varied transitions
            let transitions = ["", "During the day, ", "On the personal front, ", "Looking at wellbeing, ", "From a financial perspective, ", "In terms of habits, "];
            let parts = vec![
                format!("You {}.", mood_desc),
                format!("{}You {}.", transitions[1], task_desc),
                format!("{}You {}.", transitions[2], focus_desc),
                format!("{}You {}.", transitions[3], sleep_desc),
                format!("{}You {}.", transitions[4], budget_desc),
                format!("{}You {}.", transitions[5], habit_desc),
            ];
            parts.join(" ")
        }
    };

    let word_count = narrative.split_whitespace().count() as i64;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();

    // Store as auto-generated journal entry
    let blocks = json!([{"text": narrative, "auto_generated": true}]).to_string();

    sqlx::query(
        r#"INSERT INTO journal_entries (id, date, blocks, word_count, mood, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'auto', ?, ?)
           ON CONFLICT(date) DO UPDATE SET
               blocks = excluded.blocks,
               word_count = excluded.word_count,
               mood = excluded.mood,
               updated_at = excluded.updated_at"#,
    )
    .bind(&id)
    .bind(date)
    .bind(&blocks)
    .bind(word_count)
    .bind(now_ms)
    .bind(now_ms)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to save journal entry: {e}"))?;

    let mut data_sources = Vec::new();
    if mood.is_some() {
        data_sources.push("mood");
    }
    if sleep_hours.is_some() {
        data_sources.push("sleep");
    }
    if focus_total > 0.0 {
        data_sources.push("focus");
    }
    if tasks_done > 0 || tasks_created > 0 {
        data_sources.push("tasks");
    }
    if !habits_done.is_empty() {
        data_sources.push("habits");
    }
    if calories > 0.0 {
        data_sources.push("nutrition");
    }
    if spending > 0.0 {
        data_sources.push("budget");
    }

    Ok(json!({
        "entry": narrative,
        "word_count": word_count,
        "auto_generated": true,
        "data_sources": data_sources,
        "data_coverage": analytics::data_coverage(&[
            mood.is_some(),
            sleep_hours.is_some(),
            focus_total > 0.0,
            tasks_done > 0 || tasks_created > 0,
            !habits_done.is_empty(),
            calories > 0.0,
            spending > 0.0,
        ])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 11: get_meal_mood_correlations — Nutritional Mood Arbitrage (#5)
// ═════════════════════════════════════════════════════════════════════════════

/// Time-lagged correlation: what you eat → subsequent mood & focus.
/// Aligns each meal with mood/focus logged within the lag window (default 4h)
/// and groups by meal name + meal_type to find statistically best pre-focus foods.
pub async fn get_meal_mood_correlations_impl(
    pool: &SqlitePool,
    window_days: i64,
    lag_hours: i64,
) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - window_days * 86_400_000;

    let meals = sqlx::query(
        "SELECT id, name, meal_type, total_kcal, logged_at FROM meals WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("meals query: {e}"))?;

    let mood_entries: Vec<(i64, f64)> = sqlx::query_as::<_, (i64, String)>(
        "SELECT logged_at, mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?
    .into_iter().map(|(t, m)| (t, analytics::mood_string_to_score(&m))).collect();

    let focus_entries: Vec<(i64, f64)> = sqlx::query_as::<_, (i64, f64)>(
        "SELECT logged_at, value FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? ORDER BY logged_at",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("focus query: {e}"))?;

    let lag_ms = lag_hours * 3_600_000;

    struct MealEntry {
        name: String,
        meal_type: String,
        kcal: f64,
        logged_at: i64,
    }

    let meal_entries: Vec<MealEntry> = meals
        .into_iter()
        .map(|row| MealEntry {
            name: row.try_get("name").unwrap_or_default(),
            meal_type: row.try_get::<String, _>("meal_type").unwrap_or_default(),
            kcal: row.try_get::<f64, _>("total_kcal").unwrap_or(0.0),
            logged_at: row.try_get::<i64, _>("logged_at").unwrap_or(0),
        })
        .collect();

    // Group by meal name → average subsequent mood/focus scores
    let mut food_scores: HashMap<String, (Vec<f64>, Vec<f64>, Vec<f64>, usize)> = HashMap::new();

    for meal in &meal_entries {
        let window_end = meal.logged_at + lag_ms;
        // Find mood entries after this meal, within lag window
        let moods_after: Vec<f64> = mood_entries
            .iter()
            .filter(|(t, _)| *t > meal.logged_at && *t <= window_end)
            .map(|(_, s)| *s)
            .collect();
        let focus_after: Vec<f64> = focus_entries
            .iter()
            .filter(|(t, _)| *t > meal.logged_at && *t <= window_end)
            .map(|(_, v)| *v)
            .collect();

        let key = format!("{} ({})", meal.name, meal.meal_type);
        let entry = food_scores.entry(key).or_default();
        entry.0.push(meal.kcal);
        entry.1.extend(moods_after);
        entry.2.extend(focus_after);
        entry.3 += 1;
    }

    let mut correlations: Vec<Value> = food_scores
        .into_iter()
        .filter(|(_, (_, moods, focus, _))| moods.len() >= 3 || focus.len() >= 3)
        .map(|(food, (kcls, moods, focus, count))| {
            let avg_mood = if moods.is_empty() {
                None
            } else {
                Some((analytics::mean(&moods) * 10.0).round() / 10.0)
            };
            let avg_focus = if focus.is_empty() {
                None
            } else {
                Some((analytics::mean(&focus) * 10.0).round() / 10.0)
            };
            let avg_kcal = if kcls.is_empty() {
                0.0
            } else {
                (analytics::mean(&kcls) * 10.0).round() / 10.0
            };
            json!({
                "food_and_type": food,
                "occurrences": count,
                "avg_kcal": avg_kcal,
                "avg_subsequent_mood": avg_mood,
                "avg_subsequent_focus_minutes": avg_focus,
                "sample_size": moods.len() + focus.len()
            })
        })
        .collect();

    correlations.sort_by(|a, b| {
        let a_score = a["avg_subsequent_mood"].as_f64().unwrap_or(0.0)
            + a["avg_subsequent_focus_minutes"].as_f64().unwrap_or(0.0);
        let b_score = b["avg_subsequent_mood"].as_f64().unwrap_or(0.0)
            + b["avg_subsequent_focus_minutes"].as_f64().unwrap_or(0.0);
        b_score
            .partial_cmp(&a_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Best pre-focus food
    let best_food = correlations
        .first()
        .and_then(|c| c["food_and_type"].as_str().map(|s| s.to_string()));

    Ok(json!({
        "window_days": window_days,
        "lag_hours": lag_hours,
        "meals_analyzed": meal_entries.len(),
        "best_pre_focus_food": best_food,
        "correlations": correlations,
        "data_coverage": analytics::data_coverage(&[
            !meal_entries.is_empty(),
            !mood_entries.is_empty() || !focus_entries.is_empty(),
        ])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 12: get_integrity_score — Virtue Ledger (#18)
// ═════════════════════════════════════════════════════════════════════════════

/// Extracts stated values from journal entries, cross-references against
/// actual actions (tasks, habits, budget), returns per-domain alignment scores.
pub async fn get_integrity_score_impl(
    pool: &SqlitePool,
    window_days: i64,
) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - window_days * 86_400_000;

    // Get journal entries — scan for value statements
    let journal_blocks: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT blocks FROM journal_entries WHERE created_at >= ?")
            .bind(start_ms)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    // Value extraction via keyword scan (deterministic, no LLM)
    let value_patterns = [
        (
            "discipline",
            vec![
                "discipline",
                "disciplined",
                "self-control",
                "willpower",
                "routine",
            ],
        ),
        (
            "health",
            vec![
                "health",
                "healthy",
                "fitness",
                "exercise",
                "nutrition",
                "sleep",
                "wellness",
            ],
        ),
        (
            "growth",
            vec![
                "learn",
                "learning",
                "growth",
                "improve",
                "skill",
                "knowledge",
                "read",
            ],
        ),
        (
            "financial",
            vec![
                "save",
                "saving",
                "money",
                "budget",
                "financial",
                "wealth",
                "invest",
            ],
        ),
        (
            "focus",
            vec![
                "focus",
                "productive",
                "productivity",
                "deep work",
                "create",
                "build",
            ],
        ),
        (
            "connection",
            vec![
                "family",
                "friend",
                "relationship",
                "community",
                "connect",
                "help",
            ],
        ),
    ];

    let mut value_hits: HashMap<&str, usize> = HashMap::new();
    for blocks_json in &journal_blocks {
        let text: String = serde_json::from_str::<Value>(blocks_json)
            .ok()
            .and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|b| b["text"].as_str())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
            })
            .unwrap_or_default();
        let lower = text.to_lowercase();
        for (domain, keywords) in &value_patterns {
            if keywords.iter().any(|k| lower.contains(k)) {
                *value_hits.entry(domain).or_insert(0) += 1;
            }
        }
    }

    // Measure actual actions per domain
    let tasks_done: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ?")
            .bind(start_ms)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let habits_done_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM habit_completions WHERE completed_at >= ?")
            .bind(start_ms)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let habits_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
        .fetch_one(pool)
        .await
        .unwrap_or(1)
        .max(1);

    let focus_total: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(value), 0) FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ?",
    ).bind(start_ms).fetch_one(pool).await.unwrap_or(0.0);

    let saved: f64 = {
        let income: f64 = sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'income' AND created_at >= ?",
        ).bind(start_ms).fetch_one(pool).await.unwrap_or(0.0);
        let spent: f64 = sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(SUM(amount), 0) FROM budget_transactions WHERE tx_type = 'expense' AND created_at >= ?",
        ).bind(start_ms).fetch_one(pool).await.unwrap_or(0.0);
        income - spent
    };

    // Compute alignment per domain
    let mut domains = Vec::new();
    let discipline_score = if tasks_done + habits_done_count > 0 {
        ((habits_done_count as f64 / habits_total as f64).min(1.0) * 50.0
            + (tasks_done as f64 / window_days.max(1) as f64 * 10.0).min(50.0))
        .round() as i64
    } else {
        0
    };

    let domains_data = [
        (
            "Discipline & Routine",
            value_hits.get("discipline").copied().unwrap_or(0),
            discipline_score,
            tasks_done + habits_done_count > 0,
        ),
        (
            "Health & Wellness",
            value_hits.get("health").copied().unwrap_or(0),
            0i64,
            habits_done_count > 0,
        ),
        (
            "Learning & Growth",
            value_hits.get("growth").copied().unwrap_or(0),
            0i64,
            tasks_done > 0,
        ),
        (
            "Financial Health",
            value_hits.get("financial").copied().unwrap_or(0),
            saved.round() as i64,
            saved != 0.0,
        ),
        (
            "Focus & Creation",
            value_hits.get("focus").copied().unwrap_or(0),
            focus_total.round() as i64,
            focus_total > 0.0,
        ),
        (
            "Connection",
            value_hits.get("connection").copied().unwrap_or(0),
            0i64,
            false,
        ),
    ];

    for (domain, mentions, action_score, has_data) in &domains_data {
        let aligned = if *mentions == 0 {
            None
        } else if *has_data && *action_score > 0 {
            Some(true)
        } else if *has_data {
            Some(false)
        } else {
            None
        };
        domains.push(json!({
            "domain": domain,
            "times_mentioned_in_journal": mentions,
            "action_evidence": action_score,
            "aligned": aligned,
            "gap": if *mentions > 0 { Some(format!("Stated {} times but {} action data found", mentions, if *has_data { "limited" } else { "no" })) } else { None }
        }));
    }

    let total_mentions: usize = value_hits.values().sum();
    let aligned_count = domains_data
        .iter()
        .filter(|(_, _, _, has_data)| *has_data)
        .count();
    let integrity_pct = if total_mentions > 0 {
        ((aligned_count as f64
            / domains_data
                .iter()
                .filter(|(_, m, _, _)| *m > 0)
                .count()
                .max(1) as f64)
            * 100.0)
            .round() as i64
    } else {
        0
    };

    Ok(json!({
        "period_days": window_days,
        "integrity_alignment_pct": integrity_pct,
        "values_mentioned": total_mentions,
        "domains": domains,
        "data_coverage": analytics::data_coverage(&[total_mentions > 0, tasks_done > 0, habits_done_count > 0])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 13: get_attention_allocation — Cognitive Portfolio (#21)
// ═════════════════════════════════════════════════════════════════════════════

/// Categorizes all tasks and focus time into strategic (long-term projects)
/// vs reactive (inbox, quick fixes, admin) and returns % allocation.
pub async fn get_attention_allocation_impl(
    pool: &SqlitePool,
    window_days: i64,
) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - window_days * 86_400_000;

    let reactive_keywords = [
        "bug", "fix", "urgent", "asap", "reply", "email", "meeting", "admin", "report", "check",
        "review", "inbox",
    ];

    // Get tasks with their projects
    let tasks: Vec<(String, Option<String>)> = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT title, project FROM tasks WHERE created_at >= ? OR completed_at >= ?",
    )
    .bind(start_ms)
    .bind(start_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks query: {e}"))?;

    // Categorize tasks
    let mut strategic = 0i64;
    let mut reactive = 0i64;
    let mut neutral = 0i64;

    for (title, project) in &tasks {
        let lower = title.to_lowercase();
        let project_lower = project.as_deref().unwrap_or("inbox").to_lowercase();
        let is_reactive = reactive_keywords
            .iter()
            .any(|k| lower.contains(k) || project_lower.contains(k))
            || project_lower == "inbox";
        let is_strategic = project_lower.contains("roadmap")
            || project_lower.contains("strategy")
            || project_lower.contains("long-term")
            || project_lower.contains("growth")
            || project_lower.contains("goal");

        if is_reactive && !is_strategic {
            reactive += 1;
        } else if is_strategic && !is_reactive {
            strategic += 1;
        } else {
            neutral += 1;
        }
    }

    // Focus minutes by category via focus session metadata
    let focus_sessions: Vec<(f64, String)> = sqlx::query_as::<_, (f64, String)>(
        "SELECT value, COALESCE(metadata, '{}') FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ?",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut strategic_focus = 0.0f64;
    let mut reactive_focus = 0.0f64;
    for (val, meta_str) in &focus_sessions {
        let meta: Value = serde_json::from_str(meta_str).unwrap_or(json!({}));
        let note = meta["note"].as_str().unwrap_or("").to_lowercase();
        let is_reactive = reactive_keywords.iter().any(|k| note.contains(k));
        let is_strategic =
            note.contains("strategy") || note.contains("roadmap") || note.contains("goal");
        if is_reactive && !is_strategic {
            reactive_focus += val;
        } else if is_strategic && !is_reactive {
            strategic_focus += val;
        }
    }

    let total = (strategic + reactive + neutral).max(1) as f64;
    let focus_total = (strategic_focus + reactive_focus).max(1.0);

    let recommendation = if strategic as f64 / total < 0.3 {
        "Your focus is skewed toward reactive work. Block 3+ hour windows for strategic projects."
    } else if strategic as f64 / total > 0.7 {
        "Strong strategic focus — ensure you're not neglecting urgent operational needs."
    } else {
        "Balanced allocation across strategic and reactive work."
    };

    Ok(json!({
        "period_days": window_days,
        "allocation": {
            "strategic": { "tasks": strategic, "task_pct": (strategic as f64 / total * 100.0).round() as i64, "focus_minutes": (strategic_focus * 10.0).round() as i64 / 10 },
            "reactive": { "tasks": reactive, "task_pct": (reactive as f64 / total * 100.0).round() as i64, "focus_minutes": (reactive_focus * 10.0).round() as i64 / 10 },
            "neutral": { "tasks": neutral, "task_pct": (neutral as f64 / total * 100.0).round() as i64 },
            "focus_unclassified_minutes": ((focus_total - strategic_focus - reactive_focus) * 10.0).round() as i64 / 10
        },
        "recommendation": recommendation,
        "data_coverage": analytics::data_coverage(&[tasks.len() > 0])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 14: generate_sprint_plan — Precognitive Sprint Planning (#22)
// ═════════════════════════════════════════════════════════════════════════════

/// Composites historical task velocity, cognitive schedule, mood patterns,
/// and pending tasks into an optimized weekly sprint plan.
pub async fn generate_sprint_plan_impl(
    pool: &SqlitePool,
    sprint_days: i64,
) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - sprint_days * 86_400_000;

    // Historical velocity: tasks completed per day over the period
    let history: Vec<(i64, i64)> = sqlx::query_as::<_, (i64, i64)>(
        "SELECT completed_at / 86400000, COUNT(*) FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ? GROUP BY completed_at / 86400000 ORDER BY completed_at",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks query: {e}"))?;

    let avg_daily = if !history.is_empty() {
        let total: i64 = history.iter().map(|(_, c)| c).sum();
        (total as f64 / sprint_days as f64 * 100.0).round() / 100.0
    } else {
        0.0
    };

    // Tasks per day of week
    let mut dow_tasks: HashMap<u32, Vec<i64>> = HashMap::new();
    for (ts, count) in &history {
        if let Some(dt) = chrono::DateTime::from_timestamp(ts * 86400, 0) {
            let dow = dt.weekday().num_days_from_monday();
            dow_tasks.entry(dow).or_default().push(*count);
        }
    }

    let day_names = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];
    let mut dow_avg: Vec<Value> = dow_tasks
        .into_iter()
        .map(|(dow, counts)| {
            let avg = if counts.is_empty() {
                0.0
            } else {
                counts.iter().sum::<i64>() as f64 / counts.len() as f64
            };
            json!({
                "day": day_names.get(dow as usize).unwrap_or(&"Unknown"),
                "avg_completions": (avg * 10.0).round() / 10.0
            })
        })
        .collect();
    dow_avg.sort_by(|a, b| {
        b["avg_completions"]
            .as_f64()
            .unwrap_or(0.0)
            .partial_cmp(&a["avg_completions"].as_f64().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Pending tasks
    let pending_tasks: Vec<(String, String, Option<String>)> = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT id, title, priority FROM tasks WHERE done = 0 ORDER BY priority DESC, created_at ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("pending tasks: {e}"))?;

    // Estimate capacity
    let capacity_per_day = if avg_daily > 0.0 {
        avg_daily * 1.2
    } else {
        3.0
    }; // 20% buffer
    let weekly_capacity = (capacity_per_day * 7.0).round() as i64;
    let total_pending = pending_tasks.len() as i64;

    let weeks_needed = if weekly_capacity > 0 {
        (total_pending as f64 / weekly_capacity as f64).ceil() as i64
    } else {
        0
    };

    // Best days from historical data
    let best_day = dow_avg
        .first()
        .and_then(|d| d["day"].as_str().map(|s| s.to_string()));
    let worst_day = dow_avg
        .last()
        .and_then(|d| d["day"].as_str().map(|s| s.to_string()));

    Ok(json!({
        "sprint_days": sprint_days,
        "velocity": {
            "avg_tasks_per_day": avg_daily,
            "weekly_capacity": weekly_capacity,
            "best_day": best_day,
            "worst_day": worst_day,
            "day_breakdown": dow_avg
        },
        "backlog": {
            "total_pending": total_pending,
            "estimated_weeks_to_clear": weeks_needed
        },
        "recommendation": format!(
            "Based on your historical velocity of {:.1} tasks/day, commit to no more than {} tasks this sprint. Your most productive day historically is {}. Schedule your hardest tasks there. {}.",
            avg_daily, weekly_capacity,
            best_day.unwrap_or_else(|| "unknown".to_string()),
            if weeks_needed > 4 { "Consider breaking large tasks into smaller chunks to increase completion rate" } else { "Maintain current momentum" }
        ),
        "data_coverage": analytics::data_coverage(&[!history.is_empty(), !pending_tasks.is_empty()])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 15: auto_schedule_tasks — Energy Arbitrage Scheduler (#24)
// ═════════════════════════════════════════════════════════════════════════════

/// Maps pending tasks by difficulty to proven energy windows from cognitive
/// schedule data. Returns a day×hour prioritized schedule.
pub async fn auto_schedule_tasks_impl(pool: &SqlitePool) -> Result<Value, String> {
    // Get cognitive schedule data (reuse the existing analysis)
    let schedule = get_cognitive_schedule_impl(pool, 30).await?;
    let peak = schedule["peak_windows"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let avoid = schedule["avoid_windows"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    // Get pending tasks sorted by priority
    let pending_tasks = sqlx::query(
        "SELECT id, title, priority, project FROM tasks WHERE done = 0 ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tasks query: {e}"))?;

    // Map high-priority tasks to peak windows, low-priority to avoid windows
    let mut schedule_items: Vec<Value> = Vec::new();

    for (i, task_row) in pending_tasks.iter().enumerate() {
        let title: String = task_row.try_get("title").unwrap_or_default();
        let priority: String = task_row.try_get("priority").unwrap_or_default();
        let project: Option<String> = task_row.try_get("project").ok().flatten();

        let difficulty = if priority == "high" {
            "hard"
        } else if priority == "low" {
            "easy"
        } else {
            "medium"
        };

        let slot = if difficulty == "hard" && !peak.is_empty() {
            let p = &peak[i % peak.len()];
            json!({
                "day": p["day_of_week"],
                "hour_start": p["hour_start"],
                "hour_end": p["hour_end"],
                "slot_type": "peak"
            })
        } else if difficulty == "easy" && !avoid.is_empty() {
            let a = &avoid[i % avoid.len()];
            json!({
                "day": a["day_of_week"],
                "hour_start": a["hour_start"],
                "hour_end": a["hour_end"],
                "slot_type": "avoid"
            })
        } else if !peak.is_empty() {
            let p = &peak[i % peak.len()];
            json!({
                "day": p["day_of_week"],
                "hour_start": p["hour_start"],
                "hour_end": p["hour_end"],
                "slot_type": "moderate"
            })
        } else {
            json!({"day": "Monday", "hour_start": 9, "hour_end": 10, "slot_type": "default"})
        };

        schedule_items.push(json!({
            "task": title,
            "priority": priority,
            "difficulty": difficulty,
            "project": project,
            "schedule": slot
        }));
    }

    Ok(json!({
        "schedule": schedule_items,
        "energy_windows_used": {
            "peak": peak.len(),
            "avoid": avoid.len()
        },
        "total_scheduled": schedule_items.len(),
        "data_coverage": analytics::data_coverage(&[!pending_tasks.is_empty(), !peak.is_empty()])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 16: get_skill_velocity — Skill Velocity Tracker (#29)
// ═════════════════════════════════════════════════════════════════════════════

/// Analyzes notes tagged with learning/skill/course keywords to measure
/// knowledge acquisition rate over time.
pub async fn get_skill_velocity_impl(pool: &SqlitePool, window_days: i64) -> Result<Value, String> {
    let end_ms = time::now_ms();
    let start_ms = end_ms - window_days * 86_400_000;

    let learning_tags = [
        "learning", "study", "course", "skill", "tutorial", "book", "lecture", "practice",
        "training", "workshop",
    ];

    // Get notes with tags matching learning keywords
    let skill_notes = sqlx::query(
        "SELECT id, title, tags, created_at, word_count FROM note_objects WHERE created_at >= ? AND created_at < ?",
    )
    .bind(start_ms).bind(end_ms)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("notes query: {e}"))?;

    let mut monthly: std::collections::BTreeMap<String, (i64, i64)> =
        std::collections::BTreeMap::new();
    let mut total_learning_notes = 0i64;
    let mut total_words = 0i64;
    let mut skill_domains: HashMap<String, i64> = HashMap::new();

    for row in &skill_notes {
        let tags_str: String = row.try_get("tags").unwrap_or_default();
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let is_learning = tags
            .iter()
            .any(|t| learning_tags.iter().any(|lt| t.to_lowercase().contains(lt)));
        if !is_learning {
            continue;
        }

        total_learning_notes += 1;
        total_words += row.try_get::<i64, _>("word_count").unwrap_or(0);

        let created_at: i64 = row.try_get("created_at").unwrap_or(0);
        if let Some(dt) = chrono::DateTime::from_timestamp(created_at / 1000, 0) {
            let month_key = dt.format("%Y-%m").to_string();
            let entry = monthly.entry(month_key).or_default();
            entry.0 += 1;
            entry.1 += row.try_get::<i64, _>("word_count").unwrap_or(0);
        }

        for tag in &tags {
            if learning_tags
                .iter()
                .any(|lt| tag.to_lowercase().contains(lt))
            {
                *skill_domains.entry(tag.to_lowercase()).or_insert(0) += 1;
            }
        }
    }

    // Compute velocity: notes per month over the window
    let monthly_vec: Vec<Value> = monthly
        .into_iter()
        .map(|(month, (count, words))| json!({"month": month, "notes": count, "words": words}))
        .collect();

    // Velocity = slope of notes count over months
    let velocity = if monthly_vec.len() >= 2 {
        let data: Vec<(f64, f64)> = monthly_vec
            .iter()
            .enumerate()
            .filter_map(|(i, m)| m["notes"].as_i64().map(|n| (i as f64, n as f64)))
            .collect();
        analytics::linear_regression_slope(&data).unwrap_or(0.0)
    } else {
        0.0
    };

    let domains: Vec<Value> = skill_domains
        .into_iter()
        .map(|(tag, count)| json!({"tag": tag, "notes": count}))
        .collect();

    let trend = if velocity > 0.5 {
        "accelerating"
    } else if velocity > 0.0 {
        "steady"
    } else if velocity < 0.0 {
        "declining"
    } else {
        "insufficient data"
    };

    Ok(json!({
        "period_days": window_days,
        "total_learning_notes": total_learning_notes,
        "total_words_written": total_words,
        "velocity": (velocity * 100.0).round() / 100.0,
        "trend": trend,
        "monthly_breakdown": monthly_vec,
        "top_domains": domains,
        "data_coverage": analytics::data_coverage(&[total_learning_notes > 0])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 17: generate_standup — Daily Standup Summary (#3)
// ═════════════════════════════════════════════════════════════════════════════

/// Composes yesterday's completed tasks, focus sessions, notes, habits, and mood
/// into a formatted standup summary. Includes today's progress so far.
/// All 9 DB queries run in parallel via tokio::try_join!.
pub async fn generate_standup_impl(pool: &SqlitePool) -> Result<Value, String> {
    info!("generate_standup: building standup");

    let day_start = time::start_of_today_ms();
    let yesterday_start = day_start - 86_400_000;

    let (
        yesterday_tasks,
        today_tasks,
        in_progress,
        in_progress_total,
        yesterday_focus,
        today_focus,
        yesterday_notes,
        yesterday_habits,
        yesterday_mood,
    ) = tokio::try_join!(
        async {
            sqlx::query_as::<_, (String, String)>(
                "SELECT id, title FROM tasks WHERE done = 1 AND completed_at >= ? AND completed_at < ? ORDER BY completed_at",
            )
            .bind(yesterday_start).bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("tasks query: {e}"))
        },
        async {
            sqlx::query_as::<_, (String, String)>(
                "SELECT id, title FROM tasks WHERE done = 1 AND completed_at >= ? ORDER BY completed_at",
            )
            .bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("today tasks: {e}"))
        },
        async {
            sqlx::query_as::<_, (String, String, Option<i64>)>(
                "SELECT id, title, due_at FROM tasks WHERE done = 0 AND priority = 'high' ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC LIMIT 5",
            )
            .fetch_all(pool)
            .await
            .map_err(|e| format!("in-progress query: {e}"))
        },
        async {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM tasks WHERE done = 0 AND priority = 'high'",
            )
            .fetch_one(pool)
            .await
            .map_err(|e| format!("in-progress count: {e}"))
        },
        async {
            sqlx::query_as::<_, (f64, String)>(
                "SELECT value, COALESCE(metadata, '{}') FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? AND logged_at < ? ORDER BY logged_at",
            )
            .bind(yesterday_start).bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("focus query: {e}"))
        },
        async {
            sqlx::query_as::<_, (f64, String)>(
                "SELECT value, COALESCE(metadata, '{}') FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? ORDER BY logged_at",
            )
            .bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("today focus: {e}"))
        },
        async {
            sqlx::query_scalar::<_, String>(
                "SELECT title FROM note_objects WHERE created_at >= ? AND created_at < ? ORDER BY created_at",
            )
            .bind(yesterday_start).bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("notes query: {e}"))
        },
        async {
            sqlx::query_scalar::<_, String>(
                "SELECT DISTINCT h.name FROM habits h INNER JOIN habit_completions hc ON hc.habit_id = h.id WHERE hc.completed_at >= ? AND hc.completed_at < ?",
            )
            .bind(yesterday_start).bind(day_start)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("habits query: {e}"))
        },
        async {
            sqlx::query_as::<_, (String,)>(
                "SELECT mood FROM mood_checkins WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC LIMIT 1",
            )
            .bind(yesterday_start).bind(day_start)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("mood query: {e}"))
        },
    )?;
    info!(
        "generate_standup: {} tasks, {} focus sessions, {} notes, {} habits",
        yesterday_tasks.len(),
        yesterday_focus.len(),
        yesterday_notes.len(),
        yesterday_habits.len()
    );

    let y_focus_total: f64 = yesterday_focus.iter().map(|(v, _)| v).sum();
    let y_focus_count = yesterday_focus.len();
    let t_focus_total: f64 = today_focus.iter().map(|(v, _)| v).sum();
    let t_focus_count = today_focus.len();

    let y_focus_desc: Vec<String> = yesterday_focus
        .iter()
        .filter_map(|(_, meta)| {
            let m: Value = serde_json::from_str(meta).ok()?;
            m["note"].as_str().map(|s| s.to_string())
        })
        .collect();

    let mood_str = yesterday_mood.as_ref().map(|(m,)| m.as_str());

    // Build prose
    let mut parts: Vec<String> = Vec::with_capacity(7);
    parts.push(if !yesterday_tasks.is_empty() {
        let titles: Vec<&str> = yesterday_tasks.iter().map(|(_, t)| t.as_str()).collect();
        format!(
            "Completed {} tasks: {}",
            yesterday_tasks.len(),
            titles.join(", ")
        )
    } else {
        "No tasks completed yesterday".to_string()
    });

    parts.push(if !yesterday_habits.is_empty() {
        format!("Habits: {}", yesterday_habits.join(", "))
    } else {
        "No habits logged".to_string()
    });

    if y_focus_total > 0.0 {
        let desc = if !y_focus_desc.is_empty() {
            format!(" ({})", y_focus_desc.join(", "))
        } else {
            String::new()
        };
        parts.push(format!(
            "{} across {} sessions{}",
            analytics::format_minutes(y_focus_total),
            y_focus_count,
            desc
        ));
    } else {
        parts.push("No focus sessions logged".to_string());
    }

    if let Some(mood) = mood_str {
        parts.push(format!("Mood: {}", mood));
    }

    if !yesterday_notes.is_empty() {
        parts.push(format!("Notes: {}", yesterday_notes.join(", ")));
    }

    if !today_tasks.is_empty() || t_focus_total > 0.0 {
        let mut today_parts: Vec<String> = Vec::new();
        if !today_tasks.is_empty() {
            today_parts.push(format!("{} tasks", today_tasks.len()));
        }
        if t_focus_total > 0.0 {
            today_parts.push(format!(
                "{} focus",
                analytics::format_minutes(t_focus_total)
            ));
        }
        parts.push(format!("Today so far: {}", today_parts.join(", ")));
    }

    if !in_progress.is_empty() {
        let titles: Vec<&str> = in_progress.iter().map(|(_, t, _)| t.as_str()).collect();
        parts.push(format!("In progress: {}", titles.join(", ")));
    }

    let standup = format!(
        "{}.",
        parts.join(". ").trim_end_matches(|c| c == ' ' || c == '.')
    );
    let standup_char_count = standup.chars().count();
    let (final_standup, standup_truncated) = if standup_char_count > 1000 {
        (
            format!("{}…", standup.chars().take(997).collect::<String>()),
            true,
        )
    } else {
        (standup, false)
    };

    Ok(json!({
        "standup": final_standup,
        "standup_truncated": standup_truncated,
        "yesterday": {
            "tasks_completed": yesterday_tasks.iter().map(|(id, title)| json!({"id": id, "title": title})).collect::<Vec<Value>>(),
            "focus_minutes": (y_focus_total * 10.0).round() / 10.0,
            "focus_sessions": y_focus_count,
            "notes_created": yesterday_notes,
            "habits": yesterday_habits,
            "mood": mood_str
        },
        "today_so_far": {
            "tasks_completed": today_tasks.iter().map(|(id, title)| json!({"id": id, "title": title})).collect::<Vec<Value>>(),
            "focus_minutes": (t_focus_total * 10.0).round() / 10.0,
            "focus_sessions": t_focus_count
        },
        "in_progress": {
            "tasks": in_progress.iter().map(|(id, title, due)| json!({"id": id, "title": title, "due_at": due})).collect::<Vec<Value>>(),
            "total_high_priority": in_progress_total
        },
        "data_coverage": analytics::data_coverage(&[
            !yesterday_tasks.is_empty(),
            y_focus_total > 0.0,
            !yesterday_notes.is_empty(),
            !yesterday_habits.is_empty(),
            yesterday_mood.is_some(),
        ])
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 18: save_agent_context / get_agent_context — Context Memory (#4)
// ═════════════════════════════════════════════════════════════════════════════

/// Stores a developer preference key-value pair in a Bento note tagged "agent-context".
/// Title = key, Content = value (JSON-safe string). Creates or overwrites by key.
pub async fn save_agent_context_impl(
    pool: &SqlitePool,
    key: &str,
    value: &str,
) -> Result<Value, String> {
    info!("save_agent_context: key={}", key);
    if key.trim().is_empty() {
        return Err("key must not be empty".to_string());
    }
    let now_ms = time::now_ms();

    let existing: Option<String> = sqlx::query_scalar(
        "SELECT id FROM note_objects WHERE title = ? AND json_extract(tags, '$[#]') IS NOT NULL AND tags LIKE '%agent-context%'",
    )
    .bind(key)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("query error: {e}"))?;

    let (_, action) = match existing {
        Some(id) => {
            sqlx::query("UPDATE note_objects SET content = ?, updated_at = ? WHERE id = ?")
                .bind(value)
                .bind(now_ms)
                .bind(&id)
                .execute(pool)
                .await
                .map_err(|e| format!("update error: {e}"))?;
            (id, "updated")
        }
        None => {
            let id = Uuid::new_v4().to_string();
            let tags = json!(["agent-context"]).to_string();
            sqlx::query(
                "INSERT INTO note_objects (id, title, content, tags, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
            )
            .bind(&id).bind(key).bind(value).bind(&tags).bind(now_ms).bind(now_ms)
            .execute(pool)
            .await
            .map_err(|e| format!("insert error: {e}"))?;
            (id, "created")
        }
    };

    Ok(json!({
        "key": key,
        "stored": true,
        "action": action,
        "data_coverage": 1.0
    }))
}

/// Retrieves all stored agent context entries (developer preferences).
/// Each entry is a note tagged "agent-context" with title as key and content as value.
pub async fn get_agent_context_impl(pool: &SqlitePool, key: Option<&str>) -> Result<Value, String> {
    info!("get_agent_context: key={:?}", key);
    let agent_tag = "agent-context";
    let rows = if let Some(k) = key {
        sqlx::query_as::<_, (String, String)>(
            "SELECT title, content FROM note_objects WHERE json_extract(tags, '$[#]') IS NOT NULL AND tags LIKE '%' || ? || '%' AND title = ? ORDER BY updated_at DESC",
        )
        .bind(agent_tag).bind(k)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("query error: {e}"))?
    } else {
        sqlx::query_as::<_, (String, String)>(
            "SELECT title, content FROM note_objects WHERE json_extract(tags, '$[#]') IS NOT NULL AND tags LIKE '%' || ? || '%' ORDER BY updated_at DESC",
        )
        .bind(agent_tag)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("query error: {e}"))?
    };

    let entries: Vec<Value> = rows
        .into_iter()
        .map(|(title, content)| json!({"key": title, "value": content}))
        .collect();

    Ok(json!({
        "entries": entries,
        "count": entries.len(),
        "data_coverage": if entries.is_empty() { 0.0 } else { 1.0 }
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL 19: get_burnout_risk — Burnout Prevention Alert (#5)
// ═════════════════════════════════════════════════════════════════════════════

/// Thresholds for burnout risk scoring.
const BURNOUT_MOOD_DECLINING: f64 = -0.5;
const BURNOUT_MOOD_SLIGHT: f64 = -0.2;
const BURNOUT_SLEEP_CHRONIC: f64 = 6.0;
const BURNOUT_SLEEP_LOW: f64 = 7.0;
const BURNOUT_FOCUS_DROP_PCT: f64 = -30.0;
const BURNOUT_TASK_SURGE: i64 = 3;
const BURNOUT_BACKLOG_HIGH: i64 = 10;
const BURNOUT_WINDOW_DAYS: i64 = 14;
const BURNOUT_SPLIT_DAYS: i64 = 7;

/// Analyzes cognitive load trend, sleep debt, pressure signals, and mood
/// trajectory to compute burnout risk level and early warning.
pub async fn get_burnout_risk_impl(pool: &SqlitePool) -> Result<Value, String> {
    info!("get_burnout_risk: analyzing 14d window");
    let now_ms = time::now_ms();
    let start_7d = now_ms - BURNOUT_SPLIT_DAYS * 86_400_000;
    let start_14d = now_ms - BURNOUT_WINDOW_DAYS * 86_400_000;

    // Recent mood trend (split into recent 7d vs prior 7d)
    let mood_vals: Vec<(i64, String)> = sqlx::query_as::<_, (i64, String)>(
        "SELECT logged_at, mood FROM mood_checkins WHERE logged_at >= ? ORDER BY logged_at",
    )
    .bind(start_14d)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("mood query: {e}"))?;

    let mood_scores: Vec<f64> = mood_vals
        .iter()
        .map(|(_, m)| analytics::mood_string_to_score(m))
        .collect();
    let (recent_mood, older_mood) = if mood_scores.is_empty() {
        (0.0, 0.0)
    } else {
        let split_idx = mood_vals
            .iter()
            .position(|(t, _)| *t >= start_7d)
            .unwrap_or(mood_scores.len());
        let recent = &mood_scores[split_idx..];
        let older = &mood_scores[..split_idx];
        let recent_mean = if !recent.is_empty() {
            analytics::mean(recent)
        } else {
            analytics::mean(older)
        };
        let older_mean = if !older.is_empty() {
            analytics::mean(older)
        } else {
            recent_mean
        };
        (recent_mean, older_mean)
    };
    let mood_trend = recent_mood - older_mood;

    // Sleep debt trend (timestamp-based split, matching mood approach)
    let sleep_vals: Vec<(i64, f64)> = sqlx::query_as::<_, (i64, f64)>(
        "SELECT created_at, hours FROM sleep_logs WHERE created_at >= ? ORDER BY created_at",
    )
    .bind(start_14d)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("sleep query: {e}"))?;

    let (recent_sleep, older_sleep) = if sleep_vals.is_empty() {
        (0.0, 0.0)
    } else {
        let split_idx = sleep_vals
            .iter()
            .position(|(t, _)| *t >= start_7d)
            .unwrap_or(sleep_vals.len());
        let recent: Vec<f64> = sleep_vals[split_idx..].iter().map(|(_, h)| *h).collect();
        let older: Vec<f64> = sleep_vals[..split_idx].iter().map(|(_, h)| *h).collect();
        let recent_mean = if !recent.is_empty() {
            analytics::mean(&recent)
        } else {
            analytics::mean(&older)
        };
        let older_mean = if !older.is_empty() {
            analytics::mean(&older)
        } else {
            recent_mean
        };
        (recent_mean, older_mean)
    };
    let sleep_trend = recent_sleep - older_sleep;

    // Focus consistency trend (minutes and session count)
    let focus_vals: Vec<(i64, f64)> = sqlx::query_as::<_, (i64, f64)>(
        "SELECT logged_at, value FROM health_events WHERE module_id = 'focus' AND event_type = 'focus_session' AND logged_at >= ? ORDER BY logged_at",
    )
    .bind(start_14d)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("focus query: {e}"))?;

    let (focus_recent, focus_older): (Vec<&(i64, f64)>, Vec<&(i64, f64)>) =
        focus_vals.iter().partition(|(t, _)| *t >= start_7d);
    let total_focus_7d: f64 = focus_recent.iter().map(|(_, v)| v).sum();
    let total_focus_prior: f64 = focus_older.iter().map(|(_, v)| v).sum();
    let focus_sessions_7d = focus_recent.len();
    let focus_sessions_prior = focus_older.len();

    let focus_trend = if total_focus_prior > 0.0 {
        (total_focus_7d / total_focus_prior - 1.0) * 100.0
    } else if total_focus_7d > 0.0 {
        100.0 // went from zero to some focus
    } else {
        0.0 // no focus in either period
    };

    // Overdue task accumulation
    let overdue_7d_ago: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?",
    )
    .bind(start_7d)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("overdue 7d query: {e}"))?;

    let overdue_now: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?",
    )
    .bind(now_ms)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("overdue now query: {e}"))?;

    // Compute risk signals
    let mut signals: Vec<Value> = Vec::new();
    let mut risk_score = 0.0f64;

    if mood_trend < BURNOUT_MOOD_DECLINING {
        risk_score += 2.0;
        signals.push(json!({"signal": "mood_declining", "severity": "moderate", "detail": format!("Avg mood {:.1}/5, dropped {:.1} points week-over-week", recent_mood, mood_trend.abs())}));
    } else if mood_trend < BURNOUT_MOOD_SLIGHT {
        risk_score += 1.0;
        signals.push(json!({"signal": "mood_slightly_down", "severity": "mild", "detail": format!("Avg mood {:.1}/5 this week, slightly below prior week", recent_mood)}));
    }

    if recent_sleep > 0.0 && recent_sleep < BURNOUT_SLEEP_CHRONIC {
        risk_score += 3.0;
        signals.push(json!({"signal": "chronic_sleep_debt", "severity": "high", "detail": format!("Avg {:.1}h sleep — below 6h threshold", recent_sleep)}));
    } else if recent_sleep > 0.0 && recent_sleep < BURNOUT_SLEEP_LOW {
        risk_score += 1.0;
        signals.push(json!({"signal": "low_sleep", "severity": "mild", "detail": format!("Avg {:.1}h sleep, below recommended 7h", recent_sleep)}));
    }

    if focus_trend < BURNOUT_FOCUS_DROP_PCT {
        risk_score += 2.0;
        signals.push(json!({"signal": "focus_declining", "severity": "moderate", "detail": format!("Focus minutes dropped {:.0}% vs prior week ({}→{} min)", focus_trend.abs(), total_focus_prior as i64, total_focus_7d as i64)}));
    }

    let overdue_delta = overdue_now - overdue_7d_ago;
    if overdue_delta > BURNOUT_TASK_SURGE {
        risk_score += 2.0;
        signals.push(json!({"signal": "task_accumulation", "severity": "moderate", "detail": format!("{} more overdue tasks than last week ({} → {})", overdue_delta, overdue_7d_ago, overdue_now)}));
    } else if overdue_now > BURNOUT_BACKLOG_HIGH {
        risk_score += 1.0;
        signals.push(json!({"signal": "high_backlog", "severity": "mild", "detail": format!("{} overdue tasks — backlog exceeds 10", overdue_now)}));
    }

    let risk_level = if risk_score >= 5.0 {
        "high"
    } else if risk_score >= 3.0 {
        "moderate"
    } else if risk_score >= 1.0 {
        "mild"
    } else {
        "low"
    };

    let alert = match risk_level {
        "high" => "Multiple burnout risk signals detected. Consider deferring non-critical work, prioritizing 7h+ sleep, and scheduling recovery time.".to_string(),
        "moderate" => format!("Early warning signs: {} signal(s). Monitor sleep and task load this week.", signals.len()),
        "mild" => "Minor signals detected. Sustain current habits — watch for sleep or task creep.".to_string(),
        _ => "No burnout risk signals. Current trajectory looks sustainable.".to_string(),
    };

    info!(
        "get_burnout_risk: level={}, signals={}",
        risk_level,
        signals.len()
    );

    Ok(json!({
        "risk_level": risk_level,
        "risk_score": (risk_score * 10.0).round() / 10.0,
        "signal_count": signals.len(),
        "signals": signals,
        "alert": alert,
        "trends": {
            "mood": { "recent_avg": (recent_mood * 10.0).round() / 10.0, "trend": (mood_trend * 100.0).round() / 100.0, "direction": if mood_trend < -0.2 { "declining" } else if mood_trend > 0.2 { "improving" } else { "stable" } },
            "sleep": { "recent_avg_hours": (recent_sleep * 10.0).round() / 10.0, "trend_hours": (sleep_trend * 10.0).round() / 10.0 },
            "focus": { "last_7d_minutes": total_focus_7d as i64, "change_vs_prior_pct": (focus_trend * 10.0).round() / 10.0, "sessions_7d": focus_sessions_7d, "sessions_prior_7d": focus_sessions_prior },
            "overdue_tasks": { "current": overdue_now, "last_week": overdue_7d_ago, "change": overdue_delta }
        },
        "analysis_window_days": BURNOUT_WINDOW_DAYS,
        "data_coverage": analytics::data_coverage(&[
            !mood_scores.is_empty(),
            !sleep_vals.is_empty(),
            !focus_vals.is_empty(),
            overdue_now > 0 || overdue_7d_ago > 0,
        ])
    }))
}
