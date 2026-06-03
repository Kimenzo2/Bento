use std::collections::{HashMap, VecDeque};

use crate::telemetry::{
    ActiveJsHeapInput, MiniReport, ModuleManifest, ModuleState, TRACKED_MINI_APPS, now_ms,
};

#[derive(Clone, Debug)]
pub struct ModuleSlot {
    pub manifest: ModuleManifest,
    pub state: ModuleState,
    pub registered_at_ms: i64,
    pub last_seen_ms: Option<i64>,
    pub active_since_ms: Option<i64>,
    pub last_report: Option<MiniReport>,
    pub last_js_heap_mb: Option<f32>,
    pub last_js_heap_seen_ms: Option<i64>,
    pub heap_history: VecDeque<(i64, f32)>,
    pub ipc_history: VecDeque<(i64, f32)>,
    pub db_history: VecDeque<(i64, f32)>,
    pub state_history: VecDeque<(i64, ModuleState)>,
    pub last_action: String,
    pub last_heal_started_ms: Option<i64>,
}

impl ModuleSlot {
    pub fn new(slot_id: u32, module_id: &str, label: &str) -> Self {
        let registered_at_ms = now_ms();
        Self {
            manifest: ModuleManifest {
                slot_id,
                module_id: module_id.to_string(),
                label: label.to_string(),
            },
            state: ModuleState::Offline,
            registered_at_ms,
            last_seen_ms: None,
            active_since_ms: None,
            last_report: None,
            last_js_heap_mb: None,
            last_js_heap_seen_ms: None,
            heap_history: VecDeque::with_capacity(256),
            ipc_history: VecDeque::with_capacity(256),
            db_history: VecDeque::with_capacity(256),
            state_history: VecDeque::with_capacity(128),
            last_action: "idle".to_string(),
            last_heal_started_ms: None,
        }
    }

    pub fn push_state(&mut self, state: ModuleState, at_ms: i64) {
        if self.state == state {
            return;
        }
        self.state = state.clone();
        self.state_history.push_back((at_ms, state));
        while self.state_history.len() > 96 {
            self.state_history.pop_front();
        }
    }

    pub fn push_report(&mut self, report: MiniReport) {
        self.last_action = report.last_action.clone();
        self.last_seen_ms = Some(report.timestamp_ms as i64);
        self.heap_history
            .push_back((report.timestamp_ms as i64, report.heap_mb));
        self.ipc_history
            .push_back((report.timestamp_ms as i64, report.ipc_last_ms));
        self.db_history
            .push_back((report.timestamp_ms as i64, report.db_last_ms));
        while self.heap_history.len() > 256 {
            self.heap_history.pop_front();
        }
        while self.ipc_history.len() > 256 {
            self.ipc_history.pop_front();
        }
        while self.db_history.len() > 256 {
            self.db_history.pop_front();
        }
        self.last_report = Some(report);
    }
}

#[derive(Clone, Debug)]
pub struct ModuleRegistry {
    order: Vec<String>,
    slots: HashMap<String, ModuleSlot>,
}

impl Default for ModuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ModuleRegistry {
    pub fn new() -> Self {
        let mut order = Vec::with_capacity(TRACKED_MINI_APPS.len());
        let mut slots = HashMap::with_capacity(TRACKED_MINI_APPS.len());
        for (index, (module_id, label)) in TRACKED_MINI_APPS.iter().enumerate() {
            order.push((*module_id).to_string());
            slots.insert(
                (*module_id).to_string(),
                ModuleSlot::new(index as u32 + 1, module_id, label),
            );
        }
        Self { order, slots }
    }

    pub fn order(&self) -> &[String] {
        &self.order
    }

    pub fn get(&self, module_id: &str) -> Option<&ModuleSlot> {
        self.slots.get(module_id)
    }

    pub fn get_mut(&mut self, module_id: &str) -> Option<&mut ModuleSlot> {
        self.slots.get_mut(module_id)
    }

    pub fn current_selection(&self, requested: Option<String>) -> Option<&ModuleSlot> {
        if let Some(requested) = requested {
            return self
                .slots
                .get(&requested)
                .or_else(|| self.order.first().and_then(|id| self.slots.get(id)));
        }

        self.order.first().and_then(|id| self.slots.get(id))
    }

    pub fn track_active_module(&mut self, module_id: &str, now_ms: i64) {
        for slot_id in &self.order {
            if let Some(slot) = self.slots.get_mut(slot_id) {
                if slot.manifest.module_id == module_id {
                    if slot.active_since_ms.is_none() {
                        slot.active_since_ms = Some(now_ms);
                    }
                } else {
                    slot.active_since_ms = None;
                }
            }
        }
    }

    pub fn apply_active_js_heap(&mut self, input: ActiveJsHeapInput) {
        if let Some(slot) = self.slots.get_mut(&input.mini_app_id) {
            slot.last_js_heap_mb = input.js_heap_mb.or(slot.last_js_heap_mb);
            slot.last_js_heap_seen_ms = Some(now_ms());
            if let Some(last_action) = input.last_action {
                slot.last_action = last_action;
            }
        }
    }
}
