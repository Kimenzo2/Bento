// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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
