use crate::telemetry::registry::ModuleSlot;
use crate::telemetry::{AnomalyType, ModuleState, Severity, StoredAnomaly, now_ms};

const FROZEN_AFTER_MS: i64 = 15_000;

#[derive(Default)]
pub struct ModuleWatchdog;

impl ModuleWatchdog {
    pub fn evaluate(&self, slot: &ModuleSlot, is_active: bool) -> Option<StoredAnomaly> {
        if !is_active {
            return None;
        }

        let now = now_ms();
        let last_seen = slot.last_js_heap_seen_ms.or(slot.last_seen_ms)?;
        if now - last_seen <= FROZEN_AFTER_MS {
            return None;
        }

        Some(StoredAnomaly {
            id: 0,
            ts: now,
            module_id: slot.manifest.module_id.clone(),
            kind: AnomalyType::Frozen,
            severity: Severity::Critical,
            message: format!(
                "{} stopped sending active heap reports and is considered frozen.",
                slot.manifest.label
            ),
            healed: false,
            heal_action: None,
            heal_ms: None,
        })
    }

    pub fn state_for(slot: &ModuleSlot, is_active: bool) -> ModuleState {
        if is_active {
            return ModuleState::Active;
        }
        if slot.last_seen_ms.is_some() {
            ModuleState::Idle
        } else {
            ModuleState::Offline
        }
    }
}
