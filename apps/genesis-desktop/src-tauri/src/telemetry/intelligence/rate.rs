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

        let Some(elapsed_ms) = current_ts.checked_sub(reference_ts) else {
            return RateSignal::default();
        };

        if elapsed_ms <= 0 {
            return RateSignal::default();
        }

        let minutes = elapsed_ms as f32 / 60_000.0;
        RateSignal {
            mb_per_min: (current_value - reference_value) / minutes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slot_with_history(samples: &[(i64, f32)]) -> ModuleSlot {
        let mut slot = ModuleSlot::new(1, "journal", "Journal");
        slot.heap_history = samples.iter().copied().collect::<VecDeque<_>>();
        slot
    }

    #[test]
    fn evaluates_short_windows_at_the_real_rate() {
        let engine = RateOfChangeEngine::default();
        let slot = slot_with_history(&[(0, 10.0), (30_000, 13.0)]);

        let signal = engine.evaluate(&slot);

        assert!((signal.mb_per_min - 6.0).abs() < 0.001);
    }

    #[test]
    fn returns_default_for_non_positive_elapsed_time() {
        let engine = RateOfChangeEngine::default();
        let slot = slot_with_history(&[(10_000, 12.0), (10_000, 13.5)]);

        let signal = engine.evaluate(&slot);

        assert_eq!(signal.mb_per_min, 0.0);
    }
}
