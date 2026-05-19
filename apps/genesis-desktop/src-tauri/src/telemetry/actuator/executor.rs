use sqlx::SqlitePool;

use crate::telemetry::{HealAction, HealResult};

#[derive(Clone)]
pub struct CommandExecutor {
    db: SqlitePool,
}

impl CommandExecutor {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    pub async fn execute(&self, action: &HealAction, module_id: &str) -> HealResult {
        match action {
            HealAction::SuggestGc => HealResult {
                status: "suggested".to_string(),
                message: format!("Issued a garbage-collection hint to {module_id}."),
            },
            HealAction::ReloadModule => HealResult {
                status: "scheduled".to_string(),
                message: format!("Queued a module reload recommendation for {module_id}."),
            },
            HealAction::VacuumDb => {
                let result = sqlx::query("PRAGMA optimize").execute(&self.db).await;
                match result {
                    Ok(_) => HealResult {
                        status: "completed".to_string(),
                        message: "Executed SQLite optimize cycle.".to_string(),
                    },
                    Err(error) => HealResult {
                        status: "failed".to_string(),
                        message: format!("Database optimization failed: {error}"),
                    },
                }
            }
            HealAction::ClearModuleCache => HealResult {
                status: "scheduled".to_string(),
                message: format!("Flagged {module_id} for cache cleanup on next activation."),
            },
            HealAction::ThrottleIpcRate => HealResult {
                status: "logged".to_string(),
                message: format!("Recorded IPC throttling recommendation for {module_id}."),
            },
            HealAction::LogOnly => HealResult {
                status: "logged".to_string(),
                message: "Anomaly recorded without an actuator step.".to_string(),
            },
        }
    }
}
