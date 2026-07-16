use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

/// Events broadcast from the app to the frontend (and agent) in real time.
///
/// Serialised with an untagged "event" discriminator so the frontend can
/// switch on `event.payload.event`:
/// ```json
/// { "event": "active_module", "payload": { "module_id": "tasks" } }
/// ```
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "event", content = "payload")]
pub enum StateEvent {
    #[serde(rename = "active_module")]
    ActiveModule { module_id: String },
    #[serde(rename = "user_event")]
    UserEvent {
        event_type: String,
        payload: serde_json::Value,
    },
    #[serde(rename = "view_content")]
    ViewContent {
        module_id: String,
        content: serde_json::Value,
    },
}

/// A one-way, always-on channel that streams live app state to listeners.
///
/// Created during `setup()` and managed as Tauri state.  Any part of the
/// app that holds an `AppHandle` can publish events via `publish()`.
///
/// **Graceful degradation** — if no listeners are connected events are
/// silently dropped and the app functions identically.
pub struct StateChannel {
    tx: broadcast::Sender<StateEvent>,
}

impl StateChannel {
    pub fn new(app: AppHandle) -> Self {
        let (tx, rx) = broadcast::channel(256);

        tauri::async_runtime::spawn(async move {
            let mut rx = rx;
            while let Ok(event) = rx.recv().await {
                let _ = app.emit("bento:state", &event);
            }
        });

        Self { tx }
    }

    /// Publish a state event.  Silently dropped when there are no listeners.
    pub fn publish(&self, event: StateEvent) {
        let _ = self.tx.send(event);
    }
}
