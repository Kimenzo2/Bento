pub mod action_gate;
pub mod state_channel;
pub mod ui_schema;

use tauri::{AppHandle, Manager};
use state_channel::StateChannel;
use action_gate::ConfirmationStore;

/// Initialise the agent‑core layer during app startup.
///
/// Creates the live state channel and registers it as Tauri‑managed state
/// so other commands can publish events through it.
///
/// **Additive** — failure or absence does not degrade the app.
pub fn setup(app: &AppHandle) {
    let channel = StateChannel::new(app.clone());
    app.manage(channel);
    app.manage(ConfirmationStore::new());
}
