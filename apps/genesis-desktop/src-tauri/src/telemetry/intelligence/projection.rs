use std::collections::HashMap;

use crate::telemetry::{PredictionRecord, registry::ModuleSlot};

use super::rate::RateSignal;

const RAM_THRESHOLD_RATIO: f32 = 0.15;

#[derive(Clone, Debug, Default)]
pub struct ProjectionSignal {
    pub projected_heap_60s: f32,
    pub projected_heap_300s: f32,
    pub time_to_threshold_secs: Option<u32>,
    pub status: String,
}

#[derive(Default)]
pub struct ProjectionEngine {
    last_prediction_at: HashMap<String, i64>,
}

impl ProjectionEngine {
    pub fn evaluate(
        &mut self,
        slot: &ModuleSlot,
        rate: &RateSignal,
        total_ram_mb: f32,
        now_ms: i64,
    ) -> (ProjectionSignal, Option<PredictionRecord>) {
        let current_heap = slot
            .last_report
            .as_ref()
            .map(|report| report.heap_mb)
            .unwrap_or(0.0);
        let projected_heap_60s = current_heap + rate.mb_per_min.max(0.0);
        let projected_heap_300s = current_heap + (rate.mb_per_min.max(0.0) * 5.0);
        let threshold = total_ram_mb * RAM_THRESHOLD_RATIO;

        let time_to_threshold_secs = if rate.mb_per_min > 0.0 && current_heap < threshold {
            let delta = threshold - current_heap;
            let minutes = delta / rate.mb_per_min;
            Some((minutes.max(0.0) * 60.0).round() as u32)
        } else {
            None
        };

        let status = if projected_heap_300s > threshold && threshold > 0.0 {
            "warning".to_string()
        } else if rate.mb_per_min > 2.5 {
            "watch".to_string()
        } else {
            "stable".to_string()
        };

        let prediction = if projected_heap_300s > threshold && threshold > 0.0 {
            let last_emitted = self
                .last_prediction_at
                .get(&slot.manifest.module_id)
                .copied()
                .unwrap_or_default();
            if now_ms - last_emitted >= 5 * 60 * 1000 {
                self.last_prediction_at
                    .insert(slot.manifest.module_id.clone(), now_ms);
                Some(PredictionRecord {
                    id: 0,
                    ts: now_ms,
                    module_id: slot.manifest.module_id.clone(),
                    metric: "heap_mb".to_string(),
                    current_val: current_heap,
                    projected_5m: projected_heap_300s,
                    was_correct: None,
                })
            } else {
                None
            }
        } else {
            None
        };

        (
            ProjectionSignal {
                projected_heap_60s,
                projected_heap_300s,
                time_to_threshold_secs,
                status,
            },
            prediction,
        )
    }
}
