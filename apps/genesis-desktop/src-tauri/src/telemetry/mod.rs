pub mod actuator;
pub mod collectors;
pub mod coordinator;
pub mod events;
pub mod intelligence;
pub mod registry;
pub mod storage;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, ipc::Channel};
use tokio::sync::Mutex as AsyncMutex;

use self::{
    coordinator::TelemetryCoordinator,
    events::channel::BrainEventChannel,
    storage::ringbuffer::RingBufferStore,
};

pub const COLLECT_INTERVAL: Duration = Duration::from_secs(5);
pub const DELTA_INTERVAL: Duration = Duration::from_millis(500);
pub const PRUNE_INTERVAL: Duration = Duration::from_secs(60 * 60);
pub const PREDICTION_AUDIT_INTERVAL: Duration = Duration::from_secs(60);
pub const RETENTION_WINDOW_MS: i64 = 72 * 60 * 60 * 1000;

pub const TRACKED_MINI_APPS: &[(&str, &str)] = &[
    ("journal", "Journal"),
    ("tasks", "Tasks"),
    ("habits", "Habits"),
    ("focus", "Focus"),
    ("passwords", "Vault"),
    ("health", "Health"),
    ("sleep", "Sleep"),
    ("nutrition", "Nutrition"),
    ("mood", "Mood"),
    ("budget", "Budget"),
    ("flashcards", "Flashcards"),
    ("reading", "Reading"),
    ("grocery", "Grocery"),
    ("recipes", "Recipes"),
    ("time", "Time"),
    ("goals", "Goals"),
    ("clipboard", "Clipboard"),
    ("breathing", "Calm"),
    ("voice-memos", "Voice Memos"),
    ("countdown", "Countdown"),
];

#[derive(Clone)]
pub struct TelemetryState {
    coordinator: Arc<AsyncMutex<TelemetryCoordinator>>,
    events: BrainEventChannel,
    store: RingBufferStore,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ModuleState {
    Offline,
    Idle,
    Active,
    Degraded,
    Critical,
    Recovering,
    Frozen,
}

impl ModuleState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Offline => "OFFLINE",
            Self::Idle => "IDLE",
            Self::Active => "ACTIVE",
            Self::Degraded => "DEGRADED",
            Self::Critical => "CRITICAL",
            Self::Recovering => "RECOVERING",
            Self::Frozen => "FROZEN",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Severity {
    Info,
    Warn,
    Critical,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Critical => "CRITICAL",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnomalyType {
    MemorySpike,
    SlowIpc,
    SlowDb,
    RapidGrowth,
    Frozen,
}

impl AnomalyType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::MemorySpike => "memory_spike",
            Self::SlowIpc => "slow_ipc",
            Self::SlowDb => "slow_db",
            Self::RapidGrowth => "rapid_growth",
            Self::Frozen => "frozen",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealAction {
    SuggestGc,
    ReloadModule,
    VacuumDb,
    ClearModuleCache,
    ThrottleIpcRate,
    LogOnly,
}

impl HealAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SuggestGc => "suggest_gc",
            Self::ReloadModule => "reload_module",
            Self::VacuumDb => "vacuum_db",
            Self::ClearModuleCache => "clear_module_cache",
            Self::ThrottleIpcRate => "throttle_ipc_rate",
            Self::LogOnly => "log_only",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealResult {
    pub status: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleManifest {
    pub slot_id: u32,
    pub module_id: String,
    pub label: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniReport {
    pub slot_id: u32,
    pub timestamp_ms: u64,
    pub heap_mb: f32,
    pub js_heap_mb: Option<f32>,
    pub last_action: String,
    pub active_ms: u64,
    pub ipc_last_ms: f32,
    pub db_last_ms: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub timestamp_ms: i64,
    pub total_ram_mb: f32,
    pub used_ram_mb: f32,
    pub process_heap_mb: f32,
    pub webview_process_mb: f32,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_free_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictionRecord {
    pub id: i64,
    pub ts: i64,
    pub module_id: String,
    pub metric: String,
    pub current_val: f32,
    pub projected_5m: f32,
    pub was_correct: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightRecord {
    pub id: i64,
    pub discovered_at: i64,
    pub action: String,
    pub metric: String,
    pub pearson: f32,
    pub n_samples: i64,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAnomaly {
    pub id: i64,
    pub ts: i64,
    pub module_id: String,
    pub kind: AnomalyType,
    pub severity: Severity,
    pub message: String,
    pub healed: bool,
    pub heal_action: Option<HealAction>,
    pub heal_ms: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRecord {
    pub id: i64,
    pub ts: i64,
    pub module_id: String,
    pub heap_mb: f32,
    pub state: ModuleState,
    pub ipc_ms: Option<f32>,
    pub db_ms: Option<f32>,
    pub last_action: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainOverviewPayload {
    pub generated_at: String,
    pub overall_state: String,
    pub last_event: String,
    pub cards: Vec<OverviewCard>,
    pub mini_apps: Vec<MiniAppTile>,
    pub recent_activity: Vec<ActivityFeedItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewCard {
    pub key: String,
    pub label: String,
    pub value: String,
    pub status: String,
    pub sparkline: Vec<f32>,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniAppTile {
    pub mini_app_id: String,
    pub label: String,
    pub state: ModuleState,
    pub heap_mb: Option<f32>,
    pub js_heap_mb: Option<f32>,
    pub anomaly_count: u32,
    pub last_action: String,
    pub last_seen_at: String,
    pub sparkline: Vec<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityFeedItem {
    pub at: String,
    pub title: String,
    pub detail: String,
    pub tone: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleDetailPayload {
    pub generated_at: String,
    pub selected_module_id: String,
    pub selected_label: String,
    pub selected_state: ModuleState,
    pub active_since: String,
    pub memory_points: Vec<GraphPoint>,
    pub baseline_heap_mb: f32,
    pub peak_heap_mb: f32,
    pub rate_mb_per_min: f32,
    pub projected_heap_5m: f32,
    pub projection_status: String,
    pub ipc_avg_ms: f32,
    pub ipc_p95_ms: f32,
    pub db_avg_ms: f32,
    pub db_p95_ms: f32,
    pub state_history: Vec<StateHistoryEntry>,
    pub insights: Vec<InsightCard>,
    pub anomaly_history: Vec<AnomalyHistoryEntry>,
    pub available_modules: Vec<MiniAppPickerItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphPoint {
    pub label: String,
    pub value: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateHistoryEntry {
    pub at: String,
    pub state: ModuleState,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightCard {
    pub title: String,
    pub confidence: f32,
    pub observations: i64,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnomalyHistoryEntry {
    pub at: String,
    pub severity: Severity,
    pub kind: AnomalyType,
    pub message: String,
    pub heal_action: Option<HealAction>,
    pub resolved_in_ms: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniAppPickerItem {
    pub mini_app_id: String,
    pub label: String,
    pub state: ModuleState,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsPayload {
    pub generated_at: String,
    pub new_this_week: u32,
    pub insights: Vec<InsightCard>,
    pub predictions: Vec<PredictionInsightCard>,
    pub healings: Vec<HealingFeedItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictionInsightCard {
    pub mini_app_id: String,
    pub metric: String,
    pub current_value: f32,
    pub projected_value_in_5min: f32,
    pub time_to_threshold_secs: u32,
    pub was_correct: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealingFeedItem {
    pub at: String,
    pub mini_app_id: String,
    pub action: HealAction,
    pub result: HealResult,
    pub resolved_in_ms: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveJsHeapInput {
    pub mini_app_id: String,
    pub js_heap_mb: Option<f32>,
    #[serde(default)]
    pub last_action: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BrainEvent {
    MetricsDelta {
        module: String,
        heap_mb: Option<f32>,
        state: Option<ModuleState>,
        ipc_ms: Option<f32>,
    },
    AnomalyDetected {
        module: String,
        anomaly_type: AnomalyType,
        severity: Severity,
        message: String,
        projected_if_ignored: String,
    },
    HealingApplied {
        module: String,
        action_taken: HealAction,
        result: HealResult,
        ms_to_resolve: u64,
    },
    InsightDiscovered {
        correlation: String,
        confidence: f32,
        observed_n_times: u32,
    },
    PredictiveWarning {
        module: String,
        metric: String,
        current_value: f32,
        projected_value_in_5min: f32,
        time_to_threshold_secs: u32,
    },
}

impl TelemetryState {
    pub fn new(db: SqlitePool, active_mini_app: Arc<Mutex<String>>) -> Result<Self, String> {
        let store = RingBufferStore::new(db)?;
        let coordinator = TelemetryCoordinator::new(active_mini_app, store.clone())?;
        Ok(Self {
            coordinator: Arc::new(AsyncMutex::new(coordinator)),
            events: BrainEventChannel::default(),
            store,
        })
    }

    pub async fn tick(&self) -> Result<(), String> {
        let mut coordinator = self.coordinator.lock().await;
        coordinator.tick(&self.events).await
    }

    pub async fn prune(&self) -> Result<(), String> {
        self.store.prune_old_ticks(now_ms() - RETENTION_WINDOW_MS).await
    }

    pub async fn validate_predictions(&self) -> Result<(), String> {
        self.store.validate_due_predictions(now_ms()).await
    }

    pub async fn record_active_js_heap(&self, input: ActiveJsHeapInput) -> Result<(), String> {
        let mut coordinator = self.coordinator.lock().await;
        coordinator.record_active_js_heap(input);
        Ok(())
    }

    pub async fn subscribe(&self, on_event: Channel<BrainEvent>) -> Result<(), String> {
        self.events.add_subscriber(on_event).await;
        Ok(())
    }

    pub async fn build_overview(&self, range: String) -> Result<BrainOverviewPayload, String> {
        let coordinator = self.coordinator.lock().await;
        coordinator.build_overview(parse_range(&range)?).await
    }

    pub async fn build_module_detail(
        &self,
        range: String,
        mini_app_id: Option<String>,
    ) -> Result<ModuleDetailPayload, String> {
        let coordinator = self.coordinator.lock().await;
        coordinator
            .build_module_detail(parse_range(&range)?, mini_app_id)
            .await
    }

    pub async fn build_insights(&self, range: String) -> Result<InsightsPayload, String> {
        let coordinator = self.coordinator.lock().await;
        coordinator.build_insights(parse_range(&range)?).await
    }
}

pub fn spawn_collector(_app: AppHandle, telemetry: TelemetryState) {
    let collector = telemetry.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(COLLECT_INTERVAL);
        loop {
            interval.tick().await;
            let _ = collector.tick().await;
        }
    });

    let deltas = telemetry.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(DELTA_INTERVAL);
        loop {
            interval.tick().await;
            let mut coordinator = deltas.coordinator.lock().await;
            let events = coordinator.flush_delta_events().await;
            drop(coordinator);
            for event in events {
                deltas.events.broadcast(event).await;
            }
        }
    });

    let pruner = telemetry.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(PRUNE_INTERVAL);
        loop {
            interval.tick().await;
            let _ = pruner.prune().await;
        }
    });

    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(PREDICTION_AUDIT_INTERVAL);
        loop {
            interval.tick().await;
            let _ = telemetry.validate_predictions().await;
        }
    });
}

#[tauri::command]
pub async fn record_active_js_heap(
    telemetry: tauri::State<'_, TelemetryState>,
    report: ActiveJsHeapInput,
) -> Result<(), String> {
    telemetry.record_active_js_heap(report).await
}

#[tauri::command]
pub async fn subscribe_brain_events(
    telemetry: tauri::State<'_, TelemetryState>,
    on_event: Channel<BrainEvent>,
) -> Result<(), String> {
    telemetry.subscribe(on_event).await
}

#[tauri::command]
pub async fn get_telemetry_brain_overview(
    telemetry: tauri::State<'_, TelemetryState>,
    range: String,
) -> Result<BrainOverviewPayload, String> {
    telemetry.build_overview(range).await
}

#[tauri::command]
pub async fn get_telemetry_module_detail(
    telemetry: tauri::State<'_, TelemetryState>,
    range: String,
    mini_app_id: Option<String>,
) -> Result<ModuleDetailPayload, String> {
    telemetry.build_module_detail(range, mini_app_id).await
}

#[tauri::command]
pub async fn get_telemetry_insights(
    telemetry: tauri::State<'_, TelemetryState>,
    range: String,
) -> Result<InsightsPayload, String> {
    telemetry.build_insights(range).await
}

#[derive(Clone, Copy)]
pub struct RangeSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub range_ms: i64,
}

pub fn parse_range(range: &str) -> Result<RangeSpec, String> {
    match range {
        "24h" => Ok(RangeSpec {
            id: "24h",
            label: "Last 24 hours",
            range_ms: 24 * 60 * 60 * 1000,
        }),
        "7d" => Ok(RangeSpec {
            id: "7d",
            label: "Last 7 days",
            range_ms: 7 * 24 * 60 * 60 * 1000,
        }),
        "30d" => Ok(RangeSpec {
            id: "30d",
            label: "Last 30 days",
            range_ms: 30 * 24 * 60 * 60 * 1000,
        }),
        other => Err(format!("Unsupported telemetry range: {other}")),
    }
}

pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

pub fn format_relative(ts: i64) -> String {
    let delta = (now_ms() - ts).max(0);
    if delta < 60_000 {
        format!("{}s ago", delta / 1000)
    } else if delta < 3_600_000 {
        format!("{}m ago", delta / 60_000)
    } else if delta < 86_400_000 {
        format!("{}h ago", delta / 3_600_000)
    } else {
        format!("{}d ago", delta / 86_400_000)
    }
}

pub fn format_clock(ts: i64) -> String {
    Utc.timestamp_millis_opt(ts)
        .single()
        .map(|value| value.format("%b %-d · %-I:%M %p").to_string())
        .unwrap_or_else(|| "Unknown time".to_string())
}

pub fn percentile(values: &[f32], fraction: f32) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|left, right| left.total_cmp(right));
    let index = ((sorted.len().saturating_sub(1)) as f32 * fraction).round() as usize;
    sorted[index.min(sorted.len().saturating_sub(1))]
}

pub fn mean(values: &[f32]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f32>() / values.len() as f32
}

pub fn sparkline_from_ticks(ticks: &[TickRecord]) -> Vec<f32> {
    let mut points = ticks.iter().rev().take(12).map(|row| row.heap_mb).collect::<Vec<_>>();
    points.reverse();
    points
}

pub fn recent_activity_title(anomaly: &StoredAnomaly) -> String {
    match anomaly.kind {
        AnomalyType::MemorySpike => format!("{} memory spike", anomaly.module_id),
        AnomalyType::SlowIpc => format!("{} IPC slowed", anomaly.module_id),
        AnomalyType::SlowDb => format!("{} database slowed", anomaly.module_id),
        AnomalyType::RapidGrowth => format!("{} memory growth detected", anomaly.module_id),
        AnomalyType::Frozen => format!("{} stopped responding", anomaly.module_id),
    }
}

pub fn format_bytes(value: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if value == 0 {
        return "0 B".to_string();
    }
    let mut size = value as f64;
    let mut unit_index = 0usize;
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    if unit_index == 0 {
        format!("{} {}", value, UNITS[unit_index])
    } else {
        format!("{size:.1} {}", UNITS[unit_index])
    }
}

pub fn format_bytes_per_second(value: u64) -> String {
    format!("{}/s", format_bytes(value))
}

pub fn module_label_map() -> HashMap<String, String> {
    TRACKED_MINI_APPS
        .iter()
        .map(|(id, label)| ((*id).to_string(), (*label).to_string()))
        .collect()
}
