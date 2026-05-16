use std::collections::HashMap;

use crate::telemetry::MiniReport;

const ALPHA: f32 = 0.1;
const DEFAULT_HEAP_BASELINE_MB: f32 = 25.0;
const DEFAULT_IPC_BASELINE_MS: f32 = 2.0;
const DEFAULT_DB_BASELINE_MS: f32 = 1.5;
const WARMUP_MS: i64 = 5 * 60 * 1000;

#[derive(Clone, Debug)]
pub struct EwmaBaseline {
    pub heap_mb: f32,
    pub ipc_ms: f32,
    pub db_ms: f32,
    pub started_at_ms: i64,
}

#[derive(Default)]
pub struct EwmaBaselineEngine {
    baselines: HashMap<String, EwmaBaseline>,
}

impl EwmaBaselineEngine {
    pub fn baseline_for(&mut self, module_id: &str, now_ms: i64) -> EwmaBaseline {
        self.baselines
            .entry(module_id.to_string())
            .or_insert(EwmaBaseline {
                heap_mb: DEFAULT_HEAP_BASELINE_MB,
                ipc_ms: DEFAULT_IPC_BASELINE_MS,
                db_ms: DEFAULT_DB_BASELINE_MS,
                started_at_ms: now_ms,
            })
            .clone()
    }

    pub fn update(&mut self, module_id: &str, report: &MiniReport, now_ms: i64) -> EwmaBaseline {
        let entry = self.baselines.entry(module_id.to_string()).or_insert(EwmaBaseline {
            heap_mb: DEFAULT_HEAP_BASELINE_MB,
            ipc_ms: DEFAULT_IPC_BASELINE_MS,
            db_ms: DEFAULT_DB_BASELINE_MS,
            started_at_ms: now_ms,
        });

        if now_ms - entry.started_at_ms < WARMUP_MS {
            return entry.clone();
        }

        entry.heap_mb = ALPHA * report.heap_mb + (1.0 - ALPHA) * entry.heap_mb;
        entry.ipc_ms = ALPHA * report.ipc_last_ms + (1.0 - ALPHA) * entry.ipc_ms;
        entry.db_ms = ALPHA * report.db_last_ms + (1.0 - ALPHA) * entry.db_ms;
        entry.clone()
    }
}
