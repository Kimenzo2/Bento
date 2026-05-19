// ═══════════════════════════════════════════════════════════════════════
// Health-Core Service — Unified Health Event Models & Trend Calculations
// ═══════════════════════════════════════════════════════════════════════
// This module provides provider-agnostic health data models that can be
// populated by manual entry, passive inference, or future wearable adapters.
// All timestamps use UTC internally. Calculations are local-only.
// ═══════════════════════════════════════════════════════════════════════

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Health Event Types ───────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthEventType {
    SleepSession,
    Hydration,
    Meal,
    Mood,
    FocusSession,
    Weight,
    Energy,
    Symptom,
    Workout,
    Mindfulness,
}

impl HealthEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SleepSession => "sleep_session",
            Self::Hydration => "hydration",
            Self::Meal => "meal",
            Self::Mood => "mood",
            Self::FocusSession => "focus_session",
            Self::Weight => "weight",
            Self::Energy => "energy",
            Self::Symptom => "symptom",
            Self::Workout => "workout",
            Self::Mindfulness => "mindfulness",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "sleep_session" => Some(Self::SleepSession),
            "hydration" => Some(Self::Hydration),
            "meal" => Some(Self::Meal),
            "mood" => Some(Self::Mood),
            "focus_session" => Some(Self::FocusSession),
            "weight" => Some(Self::Weight),
            "energy" => Some(Self::Energy),
            "symptom" => Some(Self::Symptom),
            "workout" => Some(Self::Workout),
            "mindfulness" => Some(Self::Mindfulness),
            _ => None,
        }
    }
}

// ─── Health Event — Core Unified Record ───────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthEvent {
    pub id: Option<i64>,
    pub module_id: String,
    pub event_type: String,
    pub value: Option<f64>,
    pub unit: Option<String>,
    pub metadata: String,           // JSON blob
    pub started_at: Option<i64>,    // UTC ms
    pub ended_at: Option<i64>,      // UTC ms
    pub logged_at: i64,             // UTC ms
}

impl HealthEvent {
    pub fn new(module_id: &str, event_type: &str) -> Self {
        Self {
            id: None,
            module_id: module_id.to_string(),
            event_type: event_type.to_string(),
            value: None,
            unit: None,
            metadata: "{}".to_string(),
            started_at: None,
            ended_at: None,
            logged_at: now_ms(),
        }
    }

    pub fn with_value(mut self, value: f64, unit: &str) -> Self {
        self.value = Some(value);
        self.unit = Some(unit.to_string());
        self
    }

    pub fn with_range(mut self, start: i64, end: i64) -> Self {
        self.started_at = Some(start);
        self.ended_at = Some(end);
        self
    }

    pub fn duration_minutes(&self) -> Option<f64> {
        match (self.started_at, self.ended_at) {
            (Some(start), Some(end)) if end > start => {
                Some((end - start) as f64 / 60_000.0)
            }
            _ => None,
        }
    }
}

// ─── Sleep Event ──────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepEvent {
    pub bed_time: i64,          // UTC ms
    pub wake_time: i64,         // UTC ms
    pub quality: Option<u8>,    // 1-5
    pub naps: Vec<NapEntry>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NapEntry {
    pub start: i64,
    pub end: i64,
}

impl SleepEvent {
    pub fn duration_hours(&self) -> f64 {
        (self.wake_time - self.bed_time) as f64 / 3_600_000.0
    }

    pub fn nap_minutes(&self) -> f64 {
        self.naps
            .iter()
            .map(|nap| (nap.end - nap.start) as f64 / 60_000.0)
            .sum()
    }

    pub fn total_rest_hours(&self) -> f64 {
        self.duration_hours() + (self.nap_minutes() / 60.0)
    }
}

// ─── Hydration Entry ──────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydrationEntry {
    pub amount_ml: f64,
    pub logged_at: i64,
    pub source: Option<String>,  // "water", "tea", "coffee", etc.
}

// ─── Mood Entry ───────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodEntry {
    pub score: u8,               // 1-10
    pub label: Option<String>,   // "great", "neutral", "low", etc.
    pub activities: Vec<String>,
    pub notes: Option<String>,
    pub logged_at: i64,
}

// ─── Focus Session ────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSession {
    pub start: i64,
    pub end: Option<i64>,
    pub duration_minutes: Option<f64>,
    pub quality: Option<u8>,     // 1-5
    pub interruptions: u32,
    pub tags: Vec<String>,
}

// ─── Trend Calculation ────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendPoint {
    pub date: String,            // "2026-05-09"
    pub value: f64,
    pub count: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendResult {
    pub points: Vec<TrendPoint>,
    pub average: f64,
    pub min: f64,
    pub max: f64,
    pub variance: f64,
    pub direction: TrendDirection,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrendDirection {
    Improving,
    Declining,
    Stable,
    InsufficientData,
}

impl TrendResult {
    pub fn calculate(values: &[(String, f64)]) -> Self {
        if values.is_empty() {
            return Self {
                points: vec![],
                average: 0.0,
                min: 0.0,
                max: 0.0,
                variance: 0.0,
                direction: TrendDirection::InsufficientData,
            };
        }

        let points: Vec<TrendPoint> = values
            .iter()
            .map(|(date, value)| TrendPoint {
                date: date.clone(),
                value: *value,
                count: 1,
            })
            .collect();

        let sum: f64 = values.iter().map(|(_, v)| v).sum();
        let count = values.len() as f64;
        let average = sum / count;

        let min = values.iter().map(|(_, v)| *v).fold(f64::INFINITY, f64::min);
        let max = values.iter().map(|(_, v)| *v).fold(f64::NEG_INFINITY, f64::max);

        let variance = values
            .iter()
            .map(|(_, v)| {
                let diff = v - average;
                diff * diff
            })
            .sum::<f64>()
            / count;

        // Simple linear direction: compare first third to last third
        let direction = if count < 3.0 {
            TrendDirection::InsufficientData
        } else {
            let third = (count / 3.0).ceil() as usize;
            let first_avg = values.iter().take(third).map(|(_, v)| v).sum::<f64>() / third as f64;
            let last_avg = values
                .iter()
                .rev()
                .take(third)
                .map(|(_, v)| v)
                .sum::<f64>()
                / third as f64;

            let delta = last_avg - first_avg;
            let threshold = average * 0.05; // 5% change threshold

            if delta > threshold {
                TrendDirection::Improving
            } else if delta < -threshold {
                TrendDirection::Declining
            } else {
                TrendDirection::Stable
            }
        };

        Self {
            points,
            average,
            min,
            max,
            variance,
            direction,
        }
    }
}

// ─── Health Score ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthScore {
    pub score: u8,               // 0-100
    pub sleep_score: Option<u8>,
    pub hydration_score: Option<u8>,
    pub mood_score: Option<u8>,
    pub focus_score: Option<u8>,
    pub activity_score: Option<u8>,
    pub computed_at: i64,
}

// ─── Provider-Agnostic Adapter Interface ──────────────────────────────
// Future wearable integrations implement this trait.

pub trait HealthDataProvider: Send + Sync {
    fn provider_name(&self) -> &'static str;
    fn is_available(&self) -> bool;
    fn fetch_recent_sleep(&self, since_ms: i64) -> Vec<SleepEvent>;
    fn fetch_recent_steps(&self, since_ms: i64) -> Vec<f64>;
    fn fetch_recent_heart_rate(&self, since_ms: i64) -> Vec<(i64, u8)>;
}

// ─── UTC Helpers ──────────────────────────────────────────────────────

pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

pub fn date_key(ts_ms: i64) -> String {
    DateTime::from_timestamp_millis(ts_ms)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub fn days_ago(days: i64) -> i64 {
    now_ms() - (days * 24 * 60 * 60 * 1000)
}

pub fn hours_ago(hours: i64) -> i64 {
    now_ms() - (hours * 60 * 60 * 1000)
}

pub fn is_today(ts_ms: i64) -> bool {
    date_key(ts_ms) == date_key(now_ms())
}

pub fn start_of_day(ts_ms: i64) -> i64 {
    DateTime::from_timestamp_millis(ts_ms)
        .map(|dt| {
            dt.date_naive()
                .and_hms_opt(0, 0, 0)
                .and_then(|naive| naive.and_local_timezone(Utc).single())
                .map(|dt| dt.timestamp_millis())
                .unwrap_or(ts_ms)
        })
        .unwrap_or(ts_ms)
}
