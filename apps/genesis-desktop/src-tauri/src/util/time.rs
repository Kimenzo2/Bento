//! Bento Time Infrastructure (Rust backend)
//!
//! Single source of truth for ALL time-related operations in the Rust codebase.
//! Consolidates duplicated `now_ms()` definitions from dashboard.rs, journal.rs,
//! sync.rs and standardizes on `chrono` throughout.
//!
//! Usage:
//!   use crate::util::time;
//!   let now = time::now_ms();
//!   let today = time::date_key(time::now_ms());
//!   let rfc = time::format_rfc3339(now);

use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, Utc};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ── Core ──────────────────────────────────────────────────────────────────────

/// Current time in milliseconds since Unix epoch.
/// Replaces duplicated `now_ms()` in dashboard.rs, journal.rs, sync.rs.
#[must_use]
pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// Current time in seconds since Unix epoch.
#[must_use]
pub fn now_secs() -> i64 {
    Utc::now().timestamp()
}

/// Current time as `std::time::SystemTime`.
#[must_use]
pub fn now_system() -> SystemTime {
    SystemTime::now()
}

/// Convert `SystemTime` to milliseconds since Unix epoch.
#[must_use]
pub fn system_time_to_ms(t: SystemTime) -> i64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Current time in milliseconds from `SystemTime` (alternative to chrono).
#[must_use]
pub fn now_ms_system() -> i64 {
    system_time_to_ms(SystemTime::now())
}

// ── Date keys ────────────────────────────────────────────────────────────────

/// Format a millisecond timestamp as "YYYY-MM-DD" date key.
/// Replaces inline `NaiveDate::parse_from_str` + format patterns.
#[must_use]
pub fn date_key(ts_ms: i64) -> String {
    let secs = ts_ms / 1000;
    let nanos = ((ts_ms % 1000) * 1_000_000) as u32;
    match DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.format("%Y-%m-%d").to_string(),
        None => {
            // Fallback: try to create from seconds only
            match DateTime::from_timestamp(secs, 0) {
                Some(dt) => dt.format("%Y-%m-%d").to_string(),
                None => "1970-01-01".to_string(),
            }
        }
    }
}

/// Format a millisecond timestamp as "HH:MM:SS" time key.
#[must_use]
pub fn time_key(ts_ms: i64) -> String {
    let secs = ts_ms / 1000;
    let nanos = ((ts_ms % 1000) * 1_000_000) as u32;
    match DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.format("%H:%M:%S").to_string(),
        None => match DateTime::from_timestamp(secs, 0) {
            Some(dt) => dt.format("%H:%M:%S").to_string(),
            None => "00:00:00".to_string(),
        },
    }
}

/// Format a millisecond timestamp as "YYYY-MM-DD HH:MM:SS" full key.
#[must_use]
pub fn datetime_key(ts_ms: i64) -> String {
    let secs = ts_ms / 1000;
    let nanos = ((ts_ms % 1000) * 1_000_000) as u32;
    match DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        None => match DateTime::from_timestamp(secs, 0) {
            Some(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
            None => "1970-01-01 00:00:00".to_string(),
        },
    }
}

// ── RFC 3339 / ISO 8601 ──────────────────────────────────────────────────────

/// Format a millisecond timestamp as RFC 3339 string ("2024-07-15T14:30:00+00:00").
#[must_use]
pub fn format_rfc3339(ts_ms: i64) -> String {
    let secs = ts_ms / 1000;
    let nanos = ((ts_ms % 1000) * 1_000_000) as u32;
    match DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.to_rfc3339(),
        None => match DateTime::from_timestamp(secs, 0) {
            Some(dt) => dt.to_rfc3339(),
            None => "1970-01-01T00:00:00+00:00".to_string(),
        },
    }
}

/// Parse an RFC 3339 string to milliseconds since epoch.
/// Returns `None` if the string cannot be parsed.
#[must_use]
pub fn parse_rfc3339(s: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

/// Parse a NaiveDateTime ("YYYY-MM-DD HH:MM:SS") to milliseconds.
/// Returns `None` if the string cannot be parsed.
#[must_use]
pub fn parse_naive_datetime(s: &str) -> Option<i64> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|ndt| ndt.and_utc().timestamp_millis())
}

/// Parse a date string ("YYYY-MM-DD") to milliseconds (start of day).
#[must_use]
pub fn parse_date(s: &str) -> Option<i64> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok().map(|nd| {
        nd.and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis()
    })
}

// ── Relative time helpers ────────────────────────────────────────────────────

/// Returns the timestamp in ms for N days ago (start of that day).
#[must_use]
pub fn days_ago(days: i64) -> i64 {
    now_ms() - (days * 24 * 60 * 60 * 1000)
}

/// Returns the timestamp in ms for N hours ago.
#[must_use]
pub fn hours_ago(hours: i64) -> i64 {
    now_ms() - (hours * 60 * 60 * 1000)
}

/// Returns the timestamp in ms for the start of today (local midnight).
/// Uses LOCAL time to match the frontend's `time.today()` which also uses local midnight.
/// BUG-FIX: was using Utc::now() causing a timezone mismatch in non-UTC timezones.
#[must_use]
pub fn start_of_today() -> i64 {
    let now = chrono::Local::now();
    let today = now.date_naive();
    today
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .unwrap()
        .timestamp_millis()
}

/// Returns the timestamp in ms for the start of the current week (Monday).
#[must_use]
pub fn start_of_week() -> i64 {
    let now = Utc::now();
    let weekday = now.weekday().num_days_from_monday();
    let monday = now - chrono::Duration::days(weekday as i64);
    monday
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp_millis()
}

/// Returns the timestamp in ms for the start of the current month.
#[must_use]
pub fn start_of_month() -> i64 {
    let now = Utc::now();
    let first = now.date_naive().with_day(1).unwrap();
    first
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp_millis()
}

// ── Duration formatting ──────────────────────────────────────────────────────

/// Format a `Duration` as a human-readable string → "2h 30m", "5d", "3y"
#[must_use]
pub fn format_duration(d: &Duration) -> String {
    let secs = d.as_secs();
    if secs < 60 {
        return format!("{secs}s");
    }
    if secs < 3600 {
        return format!("{}m", secs / 60);
    }
    if secs < 86400 {
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        if m == 0 {
            return format!("{h}h");
        }
        return format!("{h}h {m}m");
    }
    let days = secs / 86400;
    if days < 365 {
        let h = (secs % 86400) / 3600;
        if h == 0 {
            return format!("{days}d");
        }
        return format!("{days}d {h}h");
    }
    let years = days / 365;
    let remaining_days = days % 365;
    if remaining_days == 0 {
        return format!("{years}y");
    }
    format!("{years}y {remaining_days}d")
}

/// Human-readable duration since a timestamp → "2h ago", "just now"
#[must_use]
pub fn duration_since(ts_ms: i64) -> String {
    let diff = now_ms() - ts_ms;
    if diff < 0 {
        return String::from("in the future");
    }
    if diff < 1000 {
        return String::from("just now");
    }
    if diff < 60_000 {
        return format!("{}s ago", diff / 1000);
    }
    if diff < 3_600_000 {
        return format!("{}m ago", diff / 60_000);
    }
    if diff < 86_400_000 {
        return format!("{}h ago", diff / 3_600_000);
    }
    format!("{}d ago", diff / 86_400_000)
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now_ms() {
        let now = now_ms();
        assert!(now > 1_700_000_000_000); // Should be well past 2023
    }

    #[test]
    fn test_date_key() {
        // 2024-07-15T12:00:00Z in ms
        let ts = 1_721_044_800_000;
        assert_eq!(date_key(ts), "2024-07-15");
    }

    #[test]
    fn test_time_key() {
        // 2024-07-15T14:30:00Z in ms
        let ts = 1_721_056_200_000;
        assert_eq!(time_key(ts), "14:30:00");
    }

    #[test]
    fn test_datetime_key() {
        let ts = 1_721_056_200_000;
        assert_eq!(datetime_key(ts), "2024-07-15 14:30:00");
    }

    #[test]
    fn test_format_rfc3339() {
        let ts = 1_721_044_800_000;
        let rfc = format_rfc3339(ts);
        assert!(rfc.starts_with("2024-07-15"));
        assert!(rfc.contains('T'));
    }

    #[test]
    fn test_parse_rfc3339() {
        let s = "2024-07-15T14:30:00Z";
        let parsed = parse_rfc3339(s);
        assert!(parsed.is_some());
        assert_eq!(parsed.unwrap(), 1_721_056_200_000);
    }

    #[test]
    fn test_days_ago() {
        let ts = days_ago(7);
        let seven_days_ms = 7 * 24 * 60 * 60 * 1000;
        assert!(now_ms() - ts >= seven_days_ms - 1000); // Allow 1s clock skew
        assert!(now_ms() - ts <= seven_days_ms + 1000);
    }

    #[test]
    fn test_start_of_today() {
        let sod = start_of_today();
        let date = date_key(sod);
        assert_eq!(date, date_key(now_ms()));
        // Should be midnight
        let time = time_key(sod);
        assert_eq!(time, "00:00:00");
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(&Duration::from_secs(30)), "30s");
        assert_eq!(format_duration(&Duration::from_secs(120)), "2m");
        assert_eq!(format_duration(&Duration::from_secs(3661)), "1h 1m");
        assert_eq!(format_duration(&Duration::from_secs(90061)), "1d 1h");
        assert_eq!(format_duration(&Duration::from_secs(31_536_000)), "1y");
    }

    #[test]
    fn test_duration_since() {
        let recent = now_ms() - 500;
        assert_eq!(duration_since(recent), "just now");
        let secs_ago = now_ms() - 5000;
        assert_eq!(duration_since(secs_ago), "5s ago");
    }

    #[test]
    fn test_parse_date() {
        let parsed = parse_date("2024-07-15");
        assert!(parsed.is_some());
        assert_eq!(date_key(parsed.unwrap()), "2024-07-15");
        let time = time_key(parsed.unwrap());
        assert_eq!(time, "00:00:00");
    }

    #[test]
    fn test_is_leap_year_via_get_month_days() {
        // February in non-leap year
        assert_eq!(get_month_days_helper(2023), 28);
        // February in leap year
        assert_eq!(get_month_days_helper(2024), 29);
    }

    fn get_month_days_helper(year: i32) -> i32 {
        // Just check if Feb has 28 or 29 days
        let feb_start = NaiveDate::from_ymd_opt(year, 2, 1).unwrap();
        let mar_start = NaiveDate::from_ymd_opt(year, 3, 1).unwrap();
        (mar_start - feb_start).num_days() as i32
    }
}
