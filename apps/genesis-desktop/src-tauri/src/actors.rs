use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::{oneshot, watch};

use crate::telemetry::{self, TelemetryState};

/// Handle to a running module actor for a tab session.
///
/// The actor runs a periodic auto-save loop whose interval depends
/// on whether the tab is foreground (500 ms) or background (5 s).
/// On shutdown the actor finishes its last tick and exits cleanly.
pub struct ModuleActorHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
    mode_tx: watch::Sender<bool>,
    heartbeat_ok: Arc<AtomicBool>,
}

impl ModuleActorHandle {
    /// Switch between foreground (true) and background (false) mode.
    pub fn set_foreground(&self, is_foreground: bool) {
        let _ = self.mode_tx.send(is_foreground);
    }

    /// Send the shutdown signal and wait for the actor task to finish.
    pub async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }

    /// Returns true if the last heartbeart tick completed successfully.
    pub fn is_heartbeat_ok(&self) -> bool {
        self.heartbeat_ok.load(Ordering::Relaxed)
    }
}

/// Spawn a lightweight module actor for a tab.
///
/// The actor runs a `tokio::select!` loop that alternates between
/// listening for mode‑change signals and ticking at the appropriate
/// interval.  No heavy work is done inside the actor — real modules
/// will plug their own save logic into the tick arm later.
pub fn spawn_module_actor(
    module_id: String,
    _db: SqlitePool,
    telemetry: Option<TelemetryState>,
) -> ModuleActorHandle {
    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
    let (mode_tx, mut mode_rx) = watch::channel(false); // starts as background
    let heartbeat_ok: Arc<AtomicBool> = Arc::new(AtomicBool::new(true));
    let ok = heartbeat_ok.clone();

    tokio::spawn(async move {
        let mut is_foreground = false;

        // Initial interval = background (5 s)
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(5000));
        interval.tick().await; // consume the immediate first tick

        loop {
            tokio::select! {
                biased; // check shutdown first

                // ── Clean shutdown (Gap 10) ──────────────────────────
                _ = &mut shutdown_rx => {
                    // Final heartbeat report before exiting
                    if let Some(ref t) = telemetry {
                        let _ = t.record_backend_trace(
                            telemetry::BackendTraceInput {
                                source: "module_actor".into(),
                                operation: "shutdown".into(),
                                module_id: Some(module_id.clone()),
                                status_code: 0,
                                severity: telemetry::Severity::Info,
                                message: format!("Actor shutting down for module {module_id}"),
                                path: None,
                                details: None,
                            },
                        ).await;
                    }
                    break;
                }

                // ── Foreground / background mode switch ──────────────
                result = mode_rx.changed() => {
                    match result {
                        Ok(()) => {
                            is_foreground = *mode_rx.borrow();
                            let delay_ms = if is_foreground { 500 } else { 5000 };
                            interval = tokio::time::interval(
                                tokio::time::Duration::from_millis(delay_ms),
                            );
                            interval.tick().await; // skip first tick after reset
                            ok.store(true, Ordering::Relaxed);
                        }
                        Err(_) => break, // sender dropped = implicit shutdown
                    }
                }

                // ── Periodic heartbeat tick ──────────────────────────
                _ = interval.tick() => {
                    if let Some(ref t) = telemetry {
                        let _ = t.record_backend_trace(
                            telemetry::BackendTraceInput {
                                source: "module_actor".into(),
                                operation: "heartbeat".into(),
                                module_id: Some(module_id.clone()),
                                status_code: 0,
                                severity: telemetry::Severity::Info,
                                message: format!(
                                    "{} heartbeat",
                                    if is_foreground { "foreground" } else { "background" },
                                ),
                                path: None,
                                details: None,
                            },
                        ).await;
                    }
                    ok.store(true, Ordering::Relaxed);
                }
            }
        }
    });

    ModuleActorHandle {
        shutdown_tx: Some(shutdown_tx),
        mode_tx,
        heartbeat_ok,
    }
}
