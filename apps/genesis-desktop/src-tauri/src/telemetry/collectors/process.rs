use sysinfo::{Pid, System};

pub struct ProcessCollector;

impl ProcessCollector {
    pub fn collect_webview_mb(system: &System, current_pid: Pid) -> f32 {
        system
            .processes()
            .values()
            .filter(|process| process.parent() == Some(current_pid))
            .map(|process| process.memory() as f32 / 1_048_576.0)
            .sum()
    }
}
