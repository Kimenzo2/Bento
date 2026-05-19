use crate::telemetry::{AnomalyType, HealAction, StoredAnomaly, storage::ringbuffer::RingBufferStore};

#[derive(Clone)]
pub struct HealingRules {
    store: RingBufferStore,
}

impl HealingRules {
    pub fn new(store: RingBufferStore) -> Self {
        Self { store }
    }

    pub async fn decide_action(&self, anomaly: &StoredAnomaly) -> HealAction {
        match anomaly.kind {
            AnomalyType::MemorySpike => {
                let count = self
                    .store
                    .count_anomalies_today(&anomaly.module_id, anomaly.kind.as_str())
                    .await
                    .unwrap_or(0);
                if count >= 3 {
                    HealAction::ReloadModule
                } else {
                    HealAction::SuggestGc
                }
            }
            AnomalyType::SlowDb => HealAction::VacuumDb,
            AnomalyType::SlowIpc => HealAction::ThrottleIpcRate,
            AnomalyType::RapidGrowth => HealAction::SuggestGc,
            AnomalyType::Frozen => HealAction::ReloadModule,
        }
    }
}
