use std::collections::HashMap;

use crate::telemetry::{BrainEvent, ModuleState, registry::ModuleRegistry};

#[derive(Clone, Debug, Default)]
struct ModuleDeltaSnapshot {
    heap_mb: Option<f32>,
    state: Option<ModuleState>,
    ipc_ms: Option<f32>,
}

#[derive(Default)]
pub struct DeltaTracker {
    last_emitted: HashMap<String, ModuleDeltaSnapshot>,
}

impl DeltaTracker {
    pub fn diff_registry(&mut self, registry: &ModuleRegistry) -> Vec<BrainEvent> {
        registry
            .order()
            .iter()
            .filter_map(|module_id| {
                let slot = registry.get(module_id)?;
                let current = ModuleDeltaSnapshot {
                    heap_mb: slot.last_report.as_ref().map(|report| report.heap_mb),
                    state: Some(slot.state.clone()),
                    ipc_ms: slot.last_report.as_ref().map(|report| report.ipc_last_ms),
                };
                let previous = self.last_emitted.get(module_id).cloned().unwrap_or_default();

                let heap_changed = values_changed(previous.heap_mb, current.heap_mb);
                let state_changed = previous.state != current.state;
                let ipc_changed = values_changed(previous.ipc_ms, current.ipc_ms);

                if !(heap_changed || state_changed || ipc_changed) {
                    return None;
                }

                self.last_emitted.insert(module_id.clone(), current.clone());

                Some(BrainEvent::MetricsDelta {
                    module: module_id.clone(),
                    heap_mb: heap_changed.then_some(current.heap_mb).flatten(),
                    state: state_changed.then_some(current.state).flatten(),
                    ipc_ms: ipc_changed.then_some(current.ipc_ms).flatten(),
                })
            })
            .collect()
    }
}

fn values_changed(previous: Option<f32>, current: Option<f32>) -> bool {
    match (previous, current) {
        (Some(left), Some(right)) => (left - right).abs() > 0.05,
        (None, None) => false,
        _ => true,
    }
}
