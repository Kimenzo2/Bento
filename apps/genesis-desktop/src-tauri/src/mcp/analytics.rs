//! Shared analytics helpers for the Bento Intelligence MCP tools.
//! Pure computation — no MCP dependency, no Tauri dependency.
//! Used by both the MCP tool wrappers and the implementation functions.

/// Convert a mood string label to a numeric score 1.0–5.0.
pub fn mood_string_to_score(mood: &str) -> f64 {
    match mood.to_lowercase().trim() {
        "bright" => 5.0,
        "good" => 4.0,
        "steady" => 3.0,
        "low" => 2.0,
        "very-bad" => 1.0,
        _ => {
            // Try parsing as a number if it's stored as a numeric string
            mood.parse::<f64>().ok().filter(|&n| (1.0..=5.0).contains(&n)).unwrap_or(3.0)
        }
    }
}

/// Arithmetic mean of a slice of f64 values.
pub fn mean(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f64>() / values.len() as f64
}

/// Population standard deviation.
pub fn std_dev(values: &[f64], mean_val: f64) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let variance = values.iter().map(|v| (v - mean_val).powi(2)).sum::<f64>() / values.len() as f64;
    variance.sqrt()
}

/// Pearson correlation coefficient between two equally-sized slices.
/// Returns NaN if there is insufficient data or no variance.
pub fn pearson_correlation(x: &[f64], y: &[f64]) -> f64 {
    if x.len() != y.len() || x.len() < 3 {
        return f64::NAN;
    }
    let _n = x.len() as f64;
    let mean_x = mean(x);
    let mean_y = mean(y);

    let mut cov = 0.0f64;
    let mut var_x = 0.0f64;
    let mut var_y = 0.0f64;

    for (xi, yi) in x.iter().zip(y.iter()) {
        let dx = xi - mean_x;
        let dy = yi - mean_y;
        cov += dx * dy;
        var_x += dx * dx;
        var_y += dy * dy;
    }

    if var_x == 0.0 || var_y == 0.0 {
        return f64::NAN;
    }

    cov / (var_x.sqrt() * var_y.sqrt())
}

/// Convert a "YYYY-MM-DD" date string to milliseconds since epoch (start of day UTC).
pub fn date_to_ms(date: &str) -> Option<i64> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .map(|nd| nd.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp_millis())
}

/// Get the start-of-day (ms) and end-of-day (ms) for the given date string.
/// Returns None if the date is invalid.
pub fn date_range_ms(date: &str) -> Option<(i64, i64)> {
    let start = date_to_ms(date)?;
    Some((start, start + 86_400_000))
}

/// Get the start-of-day (ms) and end-of-day (ms) for a range.
pub fn date_range(start_date: &str, end_date: &str) -> Option<(i64, i64)> {
    let start = date_to_ms(start_date)?;
    let end = date_to_ms(end_date)? + 86_400_000; // end is inclusive, so end of end_date day
    Some((start, end))
}

/// Get ms timestamp for N days before now (start of that day).
pub fn days_ago_ms(days: i64) -> i64 {
    let now = chrono::Utc::now().timestamp_millis();
    let day_ms = days * 86_400_000;
    let start = now - day_ms;
    // Align to start of day in UTC
    let secs = start / 1000;
    let remainder = secs % 86_400;
    (start - remainder * 1000) - if remainder > 0 { 86_400_000 } else { 0 }
}

/// Determine strength label for a Pearson correlation coefficient.
pub fn correlation_strength(r: f64) -> &'static str {
    let abs = r.abs();
    if abs >= 0.7 {
        "strong"
    } else if abs >= 0.4 {
        "moderate"
    } else if abs >= 0.1 {
        "weak"
    } else {
        "none"
    }
}

/// Determine direction label for a Pearson correlation coefficient.
pub fn correlation_direction(r: f64) -> &'static str {
    if r > 0.05 {
        "positive"
    } else if r < -0.05 {
        "negative"
    } else {
        "none"
    }
}

/// Simple linear regression slope from (x, y) pairs.
pub fn linear_regression_slope(data: &[(f64, f64)]) -> Option<f64> {
    if data.len() < 2 {
        return None;
    }
    let n = data.len() as f64;
    let sum_x: f64 = data.iter().map(|(x, _)| x).sum();
    let sum_y: f64 = data.iter().map(|(_, y)| y).sum();
    let sum_xy: f64 = data.iter().map(|(x, y)| x * y).sum();
    let sum_x2: f64 = data.iter().map(|(x, _)| x * x).sum();
    let denom = n * sum_x2 - sum_x * sum_x;
    if denom.abs() < 1e-10 {
        return None;
    }
    Some((n * sum_xy - sum_x * sum_y) / denom)
}

/// Linear regression intercept.
pub fn linear_regression_intercept(data: &[(f64, f64)]) -> Option<f64> {
    if data.len() < 2 {
        return None;
    }
    let n = data.len() as f64;
    let sum_x: f64 = data.iter().map(|(x, _)| x).sum();
    let sum_y: f64 = data.iter().map(|(_, y)| y).sum();
    let slope = linear_regression_slope(data)?;
    Some((sum_y - slope * sum_x) / n)
}

/// Format a duration in minutes to a human-readable string.
pub fn format_minutes(mins: f64) -> String {
    if mins < 60.0 {
        format!("{:.0}m", mins)
    } else {
        let h = (mins / 60.0).floor();
        let m = (mins % 60.0).round();
        if m == 0.0 {
            format!("{:.0}h", h)
        } else {
            format!("{:.0}h {:.0}m", h, m)
        }
    }
}

/// Clamp a value between min and max.
pub fn clamp<T: PartialOrd>(val: T, min: T, max: T) -> T {
    if val < min {
        min
    } else if val > max {
        max
    } else {
        val
    }
}

/// Compute data coverage ratio across a set of non-null booleans.
pub fn data_coverage(present: &[bool]) -> f64 {
    if present.is_empty() {
        return 0.0;
    }
    let count = present.iter().filter(|&&p| p).count() as f64;
    count / present.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mood_mapping() {
        assert!((mood_string_to_score("bright") - 5.0).abs() < 0.01);
        assert!((mood_string_to_score("good") - 4.0).abs() < 0.01);
        assert!((mood_string_to_score("steady") - 3.0).abs() < 0.01);
        assert!((mood_string_to_score("low") - 2.0).abs() < 0.01);
        assert!((mood_string_to_score("very-bad") - 1.0).abs() < 0.01);
        assert!((mood_string_to_score("unknown") - 3.0).abs() < 0.01);
    }

    #[test]
    fn test_pearson_perfect_positive() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let y = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let r = pearson_correlation(&x, &y);
        assert!((r - 1.0).abs() < 0.001);
        assert_eq!(correlation_direction(r), "positive");
        assert_eq!(correlation_strength(r), "strong");
    }

    #[test]
    fn test_pearson_perfect_negative() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let y = vec![10.0, 8.0, 6.0, 4.0, 2.0];
        let r = pearson_correlation(&x, &y);
        assert!((r + 1.0).abs() < 0.001);
        assert_eq!(correlation_direction(r), "negative");
    }

    #[test]
    fn test_pearson_too_few_points() {
        let x = vec![1.0, 2.0];
        let y = vec![3.0, 4.0];
        assert!(pearson_correlation(&x, &y).is_nan());
    }

    #[test]
    fn test_linear_regression() {
        let data = vec![(0.0, 1.0), (1.0, 3.0), (2.0, 5.0), (3.0, 7.0)];
        let slope = linear_regression_slope(&data).unwrap();
        assert!((slope - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_date_to_ms() {
        let ms = date_to_ms("2025-01-15").unwrap();
        let back = chrono::DateTime::from_timestamp(ms / 1000, 0)
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();
        assert_eq!(back, "2025-01-15");
    }

    #[test]
    fn test_data_coverage() {
        assert!((data_coverage(&[true, true, false]) - 2.0 / 3.0).abs() < 0.01);
        assert!((data_coverage(&[]) - 0.0).abs() < 0.01);
        assert!((data_coverage(&[true]) - 1.0).abs() < 0.01);
    }
}
