use crate::telemetry::registry::ModuleSlot;

#[derive(Clone, Debug, Default)]
pub struct RateSignal {
    pub mb_per_min: f32,
}

#[derive(Default)]
pub struct RateOfChangeEngine;

impl RateOfChangeEngine {
    pub fn evaluate(&self, slot: &ModuleSlot) -> RateSignal {
        let Some((current_ts, current_value)) = slot.heap_history.back().copied() else {
            return RateSignal::default();
        };

        let reference = slot
            .heap_history
            .iter()
            .rev()
            .find(|(ts, _)| current_ts - *ts >= 60_000)
            .copied()
            .or_else(|| slot.heap_history.front().copied());

        let Some((reference_ts, reference_value)) = reference else {
            return RateSignal::default();
        };

        let minutes = ((current_ts - reference_ts) as f32 / 60_000.0).max(1.0);
        RateSignal {
            mb_per_min: (current_value - reference_value) / minutes,
        }
    }
}
