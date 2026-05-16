use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use crate::telemetry::{
    ActivityFeedItem, ActiveJsHeapInput, AnomalyHistoryEntry, AnomalyType, BackendTraceHistoryEntry,
    BrainEvent, BrainOverviewPayload, GraphPoint, HealAction, HealingFeedItem, InsightCard,
    InsightsPayload, MiniAppPickerItem, MiniAppTile, ModuleDetailPayload, ModuleState,
    OverviewCard, PredictionInsightCard, RangeSpec, Severity, StateHistoryEntry, StoredAnomaly,
    TickRecord, format_bytes, format_bytes_per_second, format_clock, format_relative, mean,
    module_label_map, now_ms, percentile, recent_activity_title, recent_backend_trace_title,
};

use super::{
    actuator::{executor::CommandExecutor, rules::HealingRules},
    collectors::{system::SystemCollector, watchdog::ModuleWatchdog},
    events::delta::DeltaTracker,
    intelligence::{
        correlation::CorrelationEngine,
        ewma::EwmaBaselineEngine,
        projection::{ProjectionEngine, ProjectionSignal},
        rate::RateOfChangeEngine,
        statemachine::ModuleStateMachine,
    },
    registry::{ModuleRegistry, ModuleSlot},
    storage::ringbuffer::RingBufferStore,
};

pub struct TelemetryCoordinator {
    active_mini_app: Arc<Mutex<String>>,
    registry: ModuleRegistry,
    collector: SystemCollector,
    watchdog: ModuleWatchdog,
    ewma: EwmaBaselineEngine,
    rate: RateOfChangeEngine,
    machine: ModuleStateMachine,
    correlation: CorrelationEngine,
    projection: ProjectionEngine,
    healing_rules: HealingRules,
    executor: CommandExecutor,
    delta: DeltaTracker,
    store: RingBufferStore,
    last_system_memory_mb: f32,
    last_system_snapshot: Option<crate::telemetry::SystemSnapshot>,
    immediate_events: Vec<BrainEvent>,
    latest_projection: HashMap<String, ProjectionSignal>,
    latest_baseline_heap: HashMap<String, f32>,
}

impl TelemetryCoordinator {
    pub fn new(active_mini_app: Arc<Mutex<String>>, store: RingBufferStore) -> Result<Self, String> {
        let db = store.db().clone();
        Ok(Self {
            active_mini_app,
            registry: ModuleRegistry::new(),
            collector: SystemCollector::new()?,
            watchdog: ModuleWatchdog,
            ewma: EwmaBaselineEngine::default(),
            rate: RateOfChangeEngine::default(),
            machine: ModuleStateMachine::default(),
            correlation: CorrelationEngine::default(),
            projection: ProjectionEngine::default(),
            healing_rules: HealingRules::new(store.clone()),
            executor: CommandExecutor::new(db),
            delta: DeltaTracker::default(),
            store,
            last_system_memory_mb: 0.0,
            last_system_snapshot: None,
            immediate_events: Vec::new(),
            latest_projection: HashMap::new(),
            latest_baseline_heap: HashMap::new(),
        })
    }

    pub fn record_active_js_heap(&mut self, input: ActiveJsHeapInput) {
        self.registry.apply_active_js_heap(input);
    }

    pub async fn tick(&mut self, _events: &super::events::channel::BrainEventChannel) -> Result<(), String> {
        let now = now_ms();
        let active_module = self
            .active_mini_app
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| "dashboard".to_string());
        let system = self.collector.collect();
        self.last_system_memory_mb = system.process_heap_mb + system.webview_process_mb;
        self.last_system_snapshot = Some(system.clone());
        self.registry.track_active_module(&active_module, now);

        if self.registry.get(&active_module).is_some() {
            let (
                report,
                anomalies,
                module_id,
                last_action,
                baseline_heap_mb,
                prediction,
                projection,
                prior_state,
                was_frozen,
                had_heal_started,
                had_report,
            ) = {
                let slot = self
                    .registry
                    .get_mut(&active_module)
                    .ok_or_else(|| "Active mini app registry slot disappeared.".to_string())?;

                let report = crate::telemetry::MiniReport {
                    slot_id: slot.manifest.slot_id,
                    timestamp_ms: now as u64,
                    heap_mb: self.last_system_memory_mb.max(0.1),
                    js_heap_mb: slot.last_js_heap_mb,
                    last_action: slot.last_action.clone(),
                    active_ms: slot
                        .active_since_ms
                        .map(|started| now.saturating_sub(started) as u64)
                        .unwrap_or_default(),
                    ipc_last_ms: slot
                        .last_report
                        .as_ref()
                        .map(|value| value.ipc_last_ms)
                        .unwrap_or(1.0),
                    db_last_ms: slot
                        .last_report
                        .as_ref()
                        .map(|value| value.db_last_ms)
                        .unwrap_or(0.8),
                };
                slot.push_report(report.clone());

                let baseline = self.ewma.update(&active_module, &report, now);
                self.latest_baseline_heap
                    .insert(active_module.clone(), baseline.heap_mb);

                let rate = self.rate.evaluate(slot);
                let (projection, prediction) =
                    self.projection
                        .evaluate(slot, &rate, system.total_ram_mb.max(1.0), now);
                self.latest_projection
                    .insert(active_module.clone(), projection.clone());

                let mut anomalies = Self::detect_anomalies(
                    slot,
                    &report,
                    baseline.heap_mb,
                    baseline.ipc_ms,
                    baseline.db_ms,
                    &rate,
                );
                anomalies.extend(self.watchdog.evaluate(slot, true));

                (
                    report,
                    anomalies,
                    slot.manifest.module_id.clone(),
                    slot.last_action.clone(),
                    baseline.heap_mb,
                    prediction,
                    projection,
                    slot.state.clone(),
                    matches!(slot.state, ModuleState::Frozen),
                    slot.last_heal_started_ms.is_some(),
                    slot.last_report.is_some(),
                )
            };

            let has_warn = anomalies.iter().any(|anomaly| matches!(anomaly.severity, Severity::Warn));
            let has_critical = anomalies
                .iter()
                .any(|anomaly| matches!(anomaly.severity, Severity::Critical));

            for anomaly in anomalies {
                self.handle_anomaly(anomaly).await?;
            }

            if let Some(insight) = self.correlation.observe(
                &module_id,
                &last_action,
                "heap_mb",
                1.0,
                report.heap_mb - baseline_heap_mb,
                now,
            ) {
                let insight_id = self.store.insert_insight(&insight).await?;
                self.immediate_events.push(BrainEvent::InsightDiscovered {
                    correlation: insight.description.clone(),
                    confidence: insight.pearson.abs().clamp(0.0, 1.0),
                    observed_n_times: insight.n_samples as u32,
                });
                let _ = insight_id;
            }

            if let Some(prediction) = prediction {
                let _ = self.store.insert_prediction(&prediction).await?;
                self.immediate_events.push(BrainEvent::PredictiveWarning {
                    module: prediction.module_id.clone(),
                    metric: prediction.metric.clone(),
                    current_value: prediction.current_val,
                    projected_value_in_5min: prediction.projected_5m,
                    time_to_threshold_secs: prediction.time_to_threshold_secs.unwrap_or_else(|| projection.time_to_threshold_secs.unwrap_or_default()),
                });
            }

            let next_state = self.machine.transition(
                prior_state,
                true,
                has_warn,
                has_critical,
                was_frozen,
                had_heal_started,
                had_report,
            );

            if let Some(slot) = self.registry.get_mut(&active_module) {
                slot.push_state(next_state.clone(), now);
            }

            let tick = TickRecord {
                id: 0,
                ts: now,
                module_id,
                heap_mb: report.heap_mb,
                state: next_state,
                ipc_ms: Some(report.ipc_last_ms),
                db_ms: Some(report.db_last_ms),
                last_action: Some(report.last_action.clone()),
            };
            let _ = self.store.insert_tick(&tick).await?;
        }

        for module_id in self.registry.order().to_vec() {
            if module_id == active_module {
                continue;
            }
            if let Some(slot) = self.registry.get_mut(&module_id) {
                let next_state = self.machine.transition(
                    slot.state.clone(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    slot.last_report.is_some(),
                );
                slot.push_state(next_state.clone(), now);

                if let Some(last_report) = slot.last_report.clone() {
                    let tick = TickRecord {
                        id: 0,
                        ts: now,
                        module_id: slot.manifest.module_id.clone(),
                        heap_mb: last_report.heap_mb,
                        state: next_state,
                        ipc_ms: Some(last_report.ipc_last_ms),
                        db_ms: Some(last_report.db_last_ms),
                        last_action: Some(slot.last_action.clone()),
                    };
                    let _ = self.store.insert_tick(&tick).await?;
                }
            }
        }

        self.immediate_events.push(BrainEvent::ClockTick {
            timestamp_ms: now,
            generated_at: format_clock(now),
        });

        Ok(())
    }

    pub async fn flush_delta_events(&mut self) -> Vec<BrainEvent> {
        let mut events = self.delta.diff_registry(&self.registry);
        events.append(&mut self.immediate_events);
        events
    }

    pub async fn build_overview(&self, range: RangeSpec) -> Result<BrainOverviewPayload, String> {
        let since = now_ms() - range.range_ms;
        let recent_anomalies = self.store.recent_anomalies(None, since).await?;
        let recent_backend_traces = self.store.recent_backend_traces(None, since).await?;
        let labels = module_label_map();
        let system = self.last_system_snapshot.clone();

        let mini_apps = self
            .registry
            .order()
            .iter()
            .filter_map(|module_id| self.registry.get(module_id))
            .map(|slot| {
                let anomalies = recent_anomalies
                    .iter()
                    .filter(|row| row.module_id == slot.manifest.module_id && !row.healed)
                    .count() as u32;
                MiniAppTile {
                    mini_app_id: slot.manifest.module_id.clone(),
                    label: slot.manifest.label.clone(),
                    state: slot.state.clone(),
                    heap_mb: slot.last_report.as_ref().map(|report| report.heap_mb),
                    js_heap_mb: slot.last_js_heap_mb,
                    anomaly_count: anomalies,
                    last_action: slot.last_action.clone(),
                    last_seen_at: slot
                        .last_seen_ms
                        .map(format_relative)
                        .unwrap_or_else(|| "No snapshot yet".to_string()),
                    sparkline: slot.heap_history.iter().rev().take(12).map(|(_, value)| *value).collect::<Vec<_>>().into_iter().rev().collect(),
                }
            })
            .collect::<Vec<_>>();

        let overall_state = if mini_apps.iter().any(|item| matches!(item.state, ModuleState::Critical | ModuleState::Frozen)) {
            "critical".to_string()
        } else if mini_apps.iter().any(|item| matches!(item.state, ModuleState::Degraded)) {
            "watch".to_string()
        } else {
            "healthy".to_string()
        };

        let mut recent_activity = recent_anomalies
            .iter()
            .map(|anomaly| {
                (
                    anomaly.ts,
                    ActivityFeedItem {
                        at: format_clock(anomaly.ts),
                        title: recent_activity_title(anomaly),
                        detail: anomaly.message.clone(),
                        tone: anomaly.severity.as_str().to_lowercase(),
                    },
                )
            })
            .chain(recent_backend_traces.iter().map(|trace| {
                (
                    trace.ts,
                    ActivityFeedItem {
                        at: format_clock(trace.ts),
                        title: recent_backend_trace_title(trace),
                        detail: format!("{} · {} · {}", trace.source, trace.operation, trace.message),
                        tone: trace.severity.as_str().to_lowercase(),
                    },
                )
            }))
            .collect::<Vec<_>>();
        recent_activity.sort_by(|left, right| right.0.cmp(&left.0));
        let recent_activity = recent_activity
            .into_iter()
            .take(6)
            .map(|(_, item)| item)
            .collect::<Vec<_>>();

        let memory_values = mini_apps.iter().filter_map(|item| item.heap_mb).collect::<Vec<_>>();
        let ipc_values = self
            .registry
            .order()
            .iter()
            .filter_map(|id| self.registry.get(id).and_then(|slot| slot.last_report.as_ref().map(|report| report.ipc_last_ms)))
            .collect::<Vec<_>>();
        let db_values = self
            .registry
            .order()
            .iter()
            .filter_map(|id| self.registry.get(id).and_then(|slot| slot.last_report.as_ref().map(|report| report.db_last_ms)))
            .collect::<Vec<_>>();

        Ok(BrainOverviewPayload {
            generated_at: format_clock(now_ms()),
            overall_state,
            last_event: recent_activity.first().map(|item| item.title.clone()).unwrap_or_else(|| "No anomalies in range".to_string()),
            cards: vec![
                OverviewCard {
                    key: "memory".to_string(),
                    label: "App Memory".to_string(),
                    value: format!("{:.1} MB", self.last_system_memory_mb),
                    status: if self.last_system_memory_mb > 256.0 { "watch" } else { "good" }.to_string(),
                    sparkline: memory_values.iter().rev().take(12).copied().collect::<Vec<_>>().into_iter().rev().collect(),
                    note: "Process plus WebView memory from the live Rust collector.".to_string(),
                },
                OverviewCard {
                    key: "ipc".to_string(),
                    label: "IPC Speed".to_string(),
                    value: format!("{:.1} ms", mean(&ipc_values)),
                    status: if percentile(&ipc_values, 0.95) > 50.0 { "watch" } else { "fast" }.to_string(),
                    sparkline: ipc_values,
                    note: "Command roundtrip latency across recent active sessions.".to_string(),
                },
                OverviewCard {
                    key: "db".to_string(),
                    label: "DB Health".to_string(),
                    value: if percentile(&db_values, 0.95) > 25.0 { "Degraded" } else { "Healthy" }.to_string(),
                    status: if percentile(&db_values, 0.95) > 25.0 { "watch" } else { "good" }.to_string(),
                    sparkline: db_values,
                    note: "SQLite ring buffer and module persistence timings.".to_string(),
                },
                OverviewCard {
                    key: "network".to_string(),
                    label: "Network Throughput".to_string(),
                    value: system
                        .as_ref()
                        .map(|snapshot| {
                            format!(
                                "↓ {} · ↑ {}",
                                format_bytes_per_second(snapshot.network_rx_bytes),
                                format_bytes_per_second(snapshot.network_tx_bytes)
                            )
                        })
                        .unwrap_or_else(|| "Awaiting sample".to_string()),
                    status: if system
                        .as_ref()
                        .map(|snapshot| snapshot.network_rx_bytes + snapshot.network_tx_bytes > 0)
                        .unwrap_or(false)
                    {
                        "live"
                    } else {
                        "idle"
                    }
                    .to_string(),
                    sparkline: Vec::new(),
                    note: "Persistent network counters sampled by the Rust collector.".to_string(),
                },
                OverviewCard {
                    key: "storage".to_string(),
                    label: "Storage Headroom".to_string(),
                    value: system
                        .as_ref()
                        .map(|snapshot| format_bytes(snapshot.disk_free_bytes))
                        .unwrap_or_else(|| "Awaiting sample".to_string()),
                    status: if system
                        .as_ref()
                        .map(|snapshot| {
                            snapshot.disk_total_bytes > 0
                                && (snapshot.disk_free_bytes as f64 / snapshot.disk_total_bytes as f64) < 0.15
                        })
                        .unwrap_or(false)
                    {
                        "watch"
                    } else {
                        "good"
                    }
                    .to_string(),
                    sparkline: Vec::new(),
                    note: system
                        .as_ref()
                        .map(|snapshot| {
                            format!(
                                "{} used of {}",
                                format_bytes(snapshot.disk_used_bytes),
                                format_bytes(snapshot.disk_total_bytes)
                            )
                        })
                        .unwrap_or_else(|| "Persistent disk inventory from the collector.".to_string()),
                },
            ],
            mini_apps: mini_apps
                .into_iter()
                .map(|mut item| {
                    item.label = labels.get(&item.mini_app_id).cloned().unwrap_or(item.label);
                    item
                })
                .collect(),
            recent_activity,
        })
    }

    pub async fn build_module_detail(
        &self,
        range: RangeSpec,
        mini_app_id: Option<String>,
    ) -> Result<ModuleDetailPayload, String> {
        let selected = self
            .registry
            .current_selection(mini_app_id)
            .ok_or_else(|| "No tracked mini app available.".to_string())?;
        let since = now_ms() - range.range_ms;
        let ticks = self.store.recent_ticks(Some(&selected.manifest.module_id), since).await?;
        let anomalies = self
            .store
            .recent_anomalies(Some(&selected.manifest.module_id), since)
            .await?;
        let backend_traces = self
            .store
            .recent_backend_traces(Some(&selected.manifest.module_id), since)
            .await?;
        let insights = self.store.recent_insights(since).await?;
        let projection = self
            .latest_projection
            .get(&selected.manifest.module_id)
            .cloned()
            .unwrap_or_default();

        let memory_values = ticks.iter().map(|tick| tick.heap_mb).collect::<Vec<_>>();
        let ipc_values = ticks.iter().filter_map(|tick| tick.ipc_ms).collect::<Vec<_>>();
        let db_values = ticks.iter().filter_map(|tick| tick.db_ms).collect::<Vec<_>>();

        Ok(ModuleDetailPayload {
            generated_at: format_clock(now_ms()),
            selected_module_id: selected.manifest.module_id.clone(),
            selected_label: selected.manifest.label.clone(),
            selected_state: selected.state.clone(),
            active_since: selected
                .active_since_ms
                .map(format_relative)
                .unwrap_or_else(|| "Not active".to_string()),
            memory_points: ticks
                .iter()
                .map(|tick| GraphPoint {
                    label: format_clock(tick.ts),
                    value: tick.heap_mb,
                })
                .collect(),
            baseline_heap_mb: self
                .latest_baseline_heap
                .get(&selected.manifest.module_id)
                .copied()
                .unwrap_or(25.0),
            peak_heap_mb: memory_values.iter().copied().fold(0.0, f32::max),
            rate_mb_per_min: self.rate.evaluate(selected).mb_per_min,
            projected_heap_5m: projection.projected_heap_300s,
            projection_status: projection.status,
            ipc_avg_ms: mean(&ipc_values),
            ipc_p95_ms: percentile(&ipc_values, 0.95),
            db_avg_ms: mean(&db_values),
            db_p95_ms: percentile(&db_values, 0.95),
            state_history: selected
                .state_history
                .iter()
                .rev()
                .take(8)
                .map(|(at, state)| StateHistoryEntry {
                    at: format_clock(*at),
                    state: state.clone(),
                })
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            insights: insights
                .into_iter()
                .filter(|insight| insight.action.starts_with(&selected.manifest.module_id))
                .take(4)
                .map(|insight| InsightCard {
                    title: insight.action.replace(':', " · "),
                    confidence: insight.pearson.abs(),
                    observations: insight.n_samples,
                    description: insight.description,
                })
                .collect(),
            anomaly_history: anomalies
                .into_iter()
                .take(8)
                .map(|anomaly| AnomalyHistoryEntry {
                    at: format_clock(anomaly.ts),
                    severity: anomaly.severity,
                    kind: anomaly.kind,
                    message: anomaly.message,
                    heal_action: anomaly.heal_action,
                    resolved_in_ms: anomaly.heal_ms,
                })
                .collect(),
            backend_trace_history: backend_traces
                .into_iter()
                .take(8)
                .map(|trace| BackendTraceHistoryEntry {
                    at: format_clock(trace.ts),
                    source: trace.source,
                    operation: trace.operation,
                    module_id: trace.module_id,
                    status_code: trace.status_code,
                    severity: trace.severity,
                    message: trace.message,
                    path: trace.path,
                    details: trace.details,
                })
                .collect(),
            available_modules: self
                .registry
                .order()
                .iter()
                .filter_map(|module_id| self.registry.get(module_id))
                .map(|slot| MiniAppPickerItem {
                    mini_app_id: slot.manifest.module_id.clone(),
                    label: slot.manifest.label.clone(),
                    state: slot.state.clone(),
                })
                .collect(),
        })
    }

    pub async fn build_insights(&self, range: RangeSpec) -> Result<InsightsPayload, String> {
        let since = now_ms() - range.range_ms;
        let insights = self.store.recent_insights(since).await?;
        let predictions = self.store.recent_predictions(since).await?;
        let anomalies = self.store.recent_anomalies(None, since).await?;

        Ok(InsightsPayload {
            generated_at: format_clock(now_ms()),
            new_this_week: insights
                .iter()
                .filter(|insight| insight.discovered_at >= now_ms() - (7 * 24 * 60 * 60 * 1000))
                .count() as u32,
            insights: insights
                .into_iter()
                .map(|insight| InsightCard {
                    title: insight.action.replace(':', " · "),
                    confidence: insight.pearson.abs(),
                    observations: insight.n_samples,
                    description: insight.description,
                })
                .collect(),
            predictions: predictions
                .into_iter()
                .map(|prediction| PredictionInsightCard {
                    mini_app_id: prediction.module_id,
                    metric: prediction.metric,
                    current_value: prediction.current_val,
                    projected_value_in_5min: prediction.projected_5m,
                    time_to_threshold_secs: prediction.time_to_threshold_secs,
                    was_correct: prediction.was_correct,
                })
                .collect(),
            healings: anomalies
                .into_iter()
                .filter(|anomaly| anomaly.healed)
                .map(|anomaly| HealingFeedItem {
                    at: format_clock(anomaly.ts),
                    mini_app_id: anomaly.module_id,
                    action: anomaly.heal_action.unwrap_or(HealAction::LogOnly),
                    result: crate::telemetry::HealResult {
                        status: "completed".to_string(),
                        message: anomaly.message.clone(),
                    },
                    resolved_in_ms: anomaly.heal_ms.unwrap_or_default() as u64,
                })
                .collect(),
        })
    }

    fn detect_anomalies(
        slot: &ModuleSlot,
        report: &crate::telemetry::MiniReport,
        baseline_heap: f32,
        baseline_ipc: f32,
        baseline_db: f32,
        rate: &super::intelligence::rate::RateSignal,
    ) -> Vec<StoredAnomaly> {
        let mut anomalies = Vec::new();
        let now = now_ms();

        if report.heap_mb > baseline_heap * 4.0 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::MemorySpike,
                Severity::Critical,
                format!(
                    "{} memory is {:.1} MB against a {:.1} MB baseline.",
                    slot.manifest.label, report.heap_mb, baseline_heap
                ),
                now,
            ));
        } else if report.heap_mb > baseline_heap * 2.5 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::MemorySpike,
                Severity::Warn,
                format!(
                    "{} memory is {:.1} MB against a {:.1} MB baseline.",
                    slot.manifest.label, report.heap_mb, baseline_heap
                ),
                now,
            ));
        }

        if report.ipc_last_ms > baseline_ipc * 3.0 && report.ipc_last_ms > 10.0 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::SlowIpc,
                if report.ipc_last_ms > baseline_ipc * 6.0 { Severity::Critical } else { Severity::Warn },
                format!(
                    "{} IPC hit {:.1} ms against a {:.1} ms baseline.",
                    slot.manifest.label, report.ipc_last_ms, baseline_ipc
                ),
                now,
            ));
        }

        if report.db_last_ms > baseline_db * 3.0 && report.db_last_ms > 8.0 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::SlowDb,
                if report.db_last_ms > baseline_db * 6.0 { Severity::Critical } else { Severity::Warn },
                format!(
                    "{} database work hit {:.1} ms against a {:.1} ms baseline.",
                    slot.manifest.label, report.db_last_ms, baseline_db
                ),
                now,
            ));
        }

        if rate.mb_per_min > 5.0 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::RapidGrowth,
                Severity::Critical,
                format!(
                    "{} is growing at {:.1} MB/min and looks leak-like.",
                    slot.manifest.label, rate.mb_per_min
                ),
                now,
            ));
        } else if rate.mb_per_min > 2.5 {
            anomalies.push(make_anomaly(
                &slot.manifest.module_id,
                AnomalyType::RapidGrowth,
                Severity::Warn,
                format!(
                    "{} is growing at {:.1} MB/min and needs watching.",
                    slot.manifest.label, rate.mb_per_min
                ),
                now,
            ));
        }

        anomalies
    }

    async fn handle_anomaly(&mut self, anomaly: StoredAnomaly) -> Result<(), String> {
        let anomaly_id = self.store.insert_anomaly(&anomaly).await?;
        let action = self.healing_rules.decide_action(&anomaly).await;
        let started_at = now_ms();
        let result = self.executor.execute(&action, &anomaly.module_id).await;
        let heal_ms = (now_ms() - started_at).max(0);

        if !matches!(action, HealAction::LogOnly) {
            self.store
                .mark_anomaly_healed(anomaly_id, action.as_str(), heal_ms)
                .await?;
        }

        self.immediate_events.push(BrainEvent::AnomalyDetected {
            module: anomaly.module_id.clone(),
            anomaly_type: anomaly.kind.clone(),
            severity: anomaly.severity.clone(),
            message: anomaly.message.clone(),
            projected_if_ignored: "Condition likely worsens over the next five minutes.".to_string(),
        });
        self.immediate_events.push(BrainEvent::HealingApplied {
            module: anomaly.module_id,
            action_taken: action,
            result,
            ms_to_resolve: heal_ms as u64,
        });
        Ok(())
    }
}

fn make_anomaly(
    module_id: &str,
    kind: AnomalyType,
    severity: Severity,
    message: String,
    ts: i64,
) -> StoredAnomaly {
    StoredAnomaly {
        id: 0,
        ts,
        module_id: module_id.to_string(),
        kind,
        severity,
        message,
        healed: false,
        heal_action: None,
        heal_ms: None,
    }
}
