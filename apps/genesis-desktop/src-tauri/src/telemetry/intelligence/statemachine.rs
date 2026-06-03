use crate::telemetry::ModuleState;

#[derive(Default)]
pub struct ModuleStateMachine;

impl ModuleStateMachine {
    #[allow(clippy::too_many_arguments)]
    pub fn transition(
        &self,
        previous: ModuleState,
        is_active: bool,
        has_warn: bool,
        has_critical: bool,
        is_frozen: bool,
        healing_active: bool,
        has_any_sample: bool,
    ) -> ModuleState {
        if is_frozen {
            return ModuleState::Frozen;
        }
        if healing_active {
            return ModuleState::Recovering;
        }
        if has_critical {
            return ModuleState::Critical;
        }
        if has_warn {
            return ModuleState::Degraded;
        }
        if is_active {
            return ModuleState::Active;
        }
        if has_any_sample {
            return ModuleState::Idle;
        }
        match previous {
            ModuleState::Recovering => ModuleState::Idle,
            _ => ModuleState::Offline,
        }
    }
}
