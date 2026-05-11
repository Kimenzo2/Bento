use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Mutex,
    },
};

use serde::{Deserialize, Serialize};
use tauri::{tray::TrayIcon, AppHandle, Emitter, Manager};

use crate::settings::DesktopSettings;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum LifecycleState {
    Idle,
    Busy,
    Backgrounded,
    Exiting,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CloseAction {
    Exit,
    HideToTray,
}

pub struct DesktopRuntime {
    settings: Mutex<DesktopSettings>,
    tray: Mutex<Option<TrayIcon>>,
    background_tasks: Mutex<HashSet<String>>,
    busy_tasks: AtomicUsize,
    next_task_id: AtomicUsize,
    backgrounded: AtomicBool,
    exiting: AtomicBool,
}

impl DesktopRuntime {
    pub fn new(settings: DesktopSettings) -> Self {
        Self {
            settings: Mutex::new(settings),
            tray: Mutex::new(None),
            background_tasks: Mutex::new(HashSet::new()),
            busy_tasks: AtomicUsize::new(0),
            next_task_id: AtomicUsize::new(1),
            backgrounded: AtomicBool::new(false),
            exiting: AtomicBool::new(false),
        }
    }

    pub fn settings(&self) -> DesktopSettings {
        self.settings
            .lock()
            .map(|settings| settings.clone())
            .unwrap_or_default()
    }

    pub fn replace_settings(&self, settings: DesktopSettings) {
        if let Ok(mut guard) = self.settings.lock() {
            *guard = settings;
        }
    }

    pub fn set_tray(&self, tray: TrayIcon) {
        if let Ok(mut guard) = self.tray.lock() {
            *guard = Some(tray);
        }
    }

    pub fn has_tray(&self) -> bool {
        if let Ok(tray) = self.tray.lock() {
            tray.is_some()
        } else {
            false
        }
    }

    pub fn clear_tray(&self) {
        if let Ok(mut guard) = self.tray.lock() {
            *guard = None;
        }
    }

    pub fn begin_busy_task(&self) -> LifecycleState {
        if self.exiting.load(Ordering::SeqCst) {
            return LifecycleState::Exiting;
        }

        self.busy_tasks.fetch_add(1, Ordering::SeqCst);
        self.lifecycle_state()
    }

    pub fn begin_scoped_busy_task(&self) -> BusyTaskGuard<'_> {
        self.begin_busy_task();
        BusyTaskGuard {
            runtime: self,
            finished: false,
        }
    }

    pub fn finish_busy_task(&self) -> LifecycleState {
        let _ = self
            .busy_tasks
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                Some(current.saturating_sub(1))
            });

        if self.busy_tasks.load(Ordering::SeqCst) == 0 && self.backgrounded.load(Ordering::SeqCst) {
            self.exiting.store(true, Ordering::SeqCst);
            return LifecycleState::Exiting;
        }

        self.lifecycle_state()
    }

    pub fn begin_background_task(&self, label: Option<String>) -> (String, LifecycleState) {
        let sequence = self.next_task_id.fetch_add(1, Ordering::SeqCst);
        let safe_label = label
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "task".to_string())
            .chars()
            .filter(|character| {
                character.is_ascii_alphanumeric() || *character == '-' || *character == '_'
            })
            .collect::<String>();
        let task_id = format!("{safe_label}-{sequence}");

        if let Ok(mut tasks) = self.background_tasks.lock() {
            tasks.insert(task_id.clone());
        }

        let state = self.begin_busy_task();
        (task_id, state)
    }

    pub fn finish_background_task(&self, task_id: &str) -> LifecycleState {
        let removed = self
            .background_tasks
            .lock()
            .map(|mut tasks| tasks.remove(task_id))
            .unwrap_or(false);

        if removed {
            self.finish_busy_task()
        } else {
            self.lifecycle_state()
        }
    }

    pub fn handle_close_request(&self) -> CloseAction {
        if self.exiting.load(Ordering::SeqCst) {
            return CloseAction::Exit;
        }

        if self.busy_tasks.load(Ordering::SeqCst) == 0 {
            self.request_exit();
            return CloseAction::Exit;
        }

        self.backgrounded.store(true, Ordering::SeqCst);
        CloseAction::HideToTray
    }

    pub fn mark_backgrounded(&self) -> LifecycleState {
        self.backgrounded.store(true, Ordering::SeqCst);
        self.lifecycle_state()
    }

    pub fn clear_backgrounded(&self) -> LifecycleState {
        self.backgrounded.store(false, Ordering::SeqCst);
        self.lifecycle_state()
    }

    pub fn request_exit(&self) -> LifecycleState {
        self.exiting.store(true, Ordering::SeqCst);
        LifecycleState::Exiting
    }

    pub fn lifecycle_state(&self) -> LifecycleState {
        if self.exiting.load(Ordering::SeqCst) {
            return LifecycleState::Exiting;
        }

        let busy_tasks = self.busy_tasks.load(Ordering::SeqCst);
        if busy_tasks == 0 {
            return LifecycleState::Idle;
        }

        if self.backgrounded.load(Ordering::SeqCst) {
            LifecycleState::Backgrounded
        } else {
            LifecycleState::Busy
        }
    }

    pub fn is_busy(&self) -> bool {
        self.busy_tasks.load(Ordering::SeqCst) > 0
    }

    pub fn emit_lifecycle_state(app: &AppHandle, state: LifecycleState) -> tauri::Result<()> {
        if let Some(window) = app.get_webview_window("main") {
            window.emit("genesis://lifecycle", state)?;
        }

        Ok(())
    }
}

pub struct BusyTaskGuard<'a> {
    runtime: &'a DesktopRuntime,
    finished: bool,
}

impl BusyTaskGuard<'_> {
    pub fn finish(mut self) -> LifecycleState {
        self.finished = true;
        self.runtime.finish_busy_task()
    }
}

impl Drop for BusyTaskGuard<'_> {
    fn drop(&mut self) {
        if !self.finished {
            let _ = self.runtime.finish_busy_task();
        }
    }
}

impl Default for DesktopRuntime {
    fn default() -> Self {
        Self::new(DesktopSettings::default())
    }
}

#[cfg(test)]
mod tests {
    use super::{CloseAction, DesktopRuntime, LifecycleState};

    #[test]
    fn idle_close_requests_full_exit() {
        let runtime = DesktopRuntime::default();

        assert_eq!(runtime.handle_close_request(), CloseAction::Exit);
        assert_eq!(runtime.lifecycle_state(), LifecycleState::Exiting);
    }

    #[test]
    fn busy_close_backgrounds_until_last_task_finishes() {
        let runtime = DesktopRuntime::default();

        {
            let _guard = runtime.begin_scoped_busy_task();

            assert_eq!(runtime.lifecycle_state(), LifecycleState::Busy);
            assert_eq!(runtime.handle_close_request(), CloseAction::HideToTray);
            assert_eq!(runtime.lifecycle_state(), LifecycleState::Backgrounded);
        }

        assert_eq!(runtime.lifecycle_state(), LifecycleState::Exiting);
    }
}
