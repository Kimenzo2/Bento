use std::{
    collections::HashMap,
    str::FromStr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::actors::{self, ModuleActorHandle};
use crate::commands::{DashboardCache, emit_main_window_event};
use crate::db::{BentoAppState, ModuleContext, record_dashboard_event, read_runtime_state, write_runtime_state};
use crate::modules::is_installed;
use crate::telemetry::{BackendTraceInput, Severity, TelemetryState};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_tab_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    format!("tab-{:016x}", COUNTER.fetch_add(1, Ordering::Relaxed))
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Visible state a tab can be in.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TabState {
    Idle,
    Loading,
    Active,
    Background,
    Error(String),
}

/// Information about an open tab, serializable to the frontend.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabInfo {
    pub id: String,
    pub module_id: String,
    pub opened_at: i64,
    pub is_foreground: bool,
    pub state: TabState,
}

/// Payload returned after a successful tab switch (3‑phase result).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabSwitchPayload {
    pub from_tab_id: Option<String>,
    pub from_module: Option<String>,
    pub to_tab_id: String,
    pub to_module: String,
    pub context: Option<ModuleContext>,
    pub committed: bool,
}

// ---------------------------------------------------------------------------
// Internal session
// ---------------------------------------------------------------------------

struct InternalTab {
    info: TabInfo,
    actor: Option<ModuleActorHandle>,
}

// ---------------------------------------------------------------------------
// TabSessionManager — the core component
// ---------------------------------------------------------------------------

/// Owns the full session state for every open tab.
///
/// Lives permanently in Rust, managed as `Arc<tokio::sync::Mutex<Self>>` via
/// Tauri's `app.manage()`.  All tab lifecycle operations go through here.
pub struct TabSessionManager {
    tabs: HashMap<String, InternalTab>,
    foreground_tab_id: Option<String>,
}

impl Default for TabSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TabSessionManager {
    pub fn new() -> Self {
        Self {
            tabs: HashMap::new(),
            foreground_tab_id: None,
        }
    }

    /// Return the sorted list of module IDs for all open tabs (for persistence).
    pub fn open_module_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.tabs.values().map(|t| t.info.module_id.clone()).collect();
        ids.sort();
        ids.dedup();
        ids
    }

    /// Return whether the session has any open tabs.
    pub fn is_empty(&self) -> bool {
        self.tabs.is_empty()
    }

    // ── Tab CRUD ──────────────────────────────────────────────────────────

    /// Open a new tab for `module_id`.
    ///
    /// Checks **Gap 11** – returns an error if the module is not installed.
    /// Otherwise spawns the backend actor immediately and stores the session.
    pub async fn open_tab(
        &mut self,
        module_id: String,
        db: &SqlitePool,
        telemetry: Option<TelemetryState>,
        app: &AppHandle,
    ) -> Result<TabInfo, String> {
        // Gap 11: verify module is installed before creating anything
        let state = app.state::<BentoAppState>();
        if !crate::modules::is_installed(state.inner(), &module_id).await? {
            return Err(format!(
                "Cannot open tab: module \"{module_id}\" is not installed."
            ));
        }

        // If this module already has a tab, just return it (no duplicates)
        if let Some(existing) = self.tabs.values().find(|t| t.info.module_id == module_id) {
            return Ok(existing.info.clone());
        }

        let tab_id = generate_tab_id();
        let opened_at = unix_ms();

        // Spawn the backend actor immediately (the moment the tab is added)
        let actor = actors::spawn_module_actor(module_id.clone(), db.clone(), telemetry);

        let info = TabInfo {
            id: tab_id.clone(),
            module_id,
            opened_at,
            is_foreground: false,
            state: TabState::Idle,
        };

        self.tabs.insert(
            tab_id,
            InternalTab {
                info: info.clone(),
                actor: Some(actor),
            },
        );

        Ok(info)
    }

    /// Close a tab and shut down its actor.
    ///
    /// **Gap 10** – sends explicit shutdown signal before dropping the handle.
    pub async fn close_tab(&mut self, tab_id: &str) -> Result<(), String> {
        let mut session = self
            .tabs
            .remove(tab_id)
            .ok_or_else(|| format!("Cannot close tab: \"{tab_id}\" not found."))?;

        // Explicit actor shutdown (Gap 10)
        if let Some(actor) = session.actor.take() {
            actor.shutdown().await;
        }

        // Clear foreground if this was the active tab
        if self.foreground_tab_id.as_deref() == Some(tab_id) {
            self.foreground_tab_id = None;
        }

        Ok(())
    }

    // ── Tab switching (3 phases) ──────────────────────────────────────────

    /// Switch to a different tab.
    ///
    /// **Phase 1** – flush current foreground tab's context to SQLite.
    /// **Phase 2** – load incoming tab's last UI context from SQLite.
    /// **Phase 3** – telemetry handover.
    pub async fn switch_tab(
        &mut self,
        tab_id: &str,
        db: &SqlitePool,
        telemetry: Option<&TelemetryState>,
        _app: &AppHandle,
    ) -> Result<TabSwitchPayload, String> {
        // Resolve the module_id for the target tab
        let to_module = self
            .tabs
            .get(tab_id)
            .map(|t| t.info.module_id.clone())
            .ok_or_else(|| format!("Cannot switch: tab \"{tab_id}\" not found."))?;

        let from_tab_id = self.foreground_tab_id.clone();
        let from_module = from_tab_id
            .as_ref()
            .and_then(|id| self.tabs.get(id))
            .map(|t| t.info.module_id.clone());

        // ── Phase 1: flush departing module ──────────────────────────────
        if let Some(ref departing_id) = from_tab_id {
            if departing_id != tab_id {
                if let Some(departing) = self.tabs.get(departing_id) {
                    // The frontend should have already sent the latest context
                    // via `save_module_context` / `flush_module_state`.
                    // Here we just ensure the actor is throttled down.
                    if let Some(ref actor) = departing.actor {
                        actor.set_foreground(false);
                    }
                }

                // Mark departing tab as background
                if let Some(departing) = self.tabs.get_mut(departing_id) {
                    departing.info.is_foreground = false;
                    departing.info.state = TabState::Background;
                }
            }
        }

        // ── Phase 2: load incoming module's last UI context ──────────────
        // Try to parse as builtin ModuleId first; fall back gracefully
        // for non‑builtin (custom) modules that have no ModuleId variant.
        let context = match crate::db::ModuleId::from_str(&to_module) {
            Ok(m) => crate::db::read_module_context(db, &m).await?,
            Err(_) => None,
        };

        // Promote incoming tab to foreground
        if let Some(incoming) = self.tabs.get_mut(tab_id) {
            incoming.info.is_foreground = true;
            incoming.info.state = TabState::Active;
            if let Some(ref actor) = incoming.actor {
                actor.set_foreground(true);
            }
        }
        self.foreground_tab_id = Some(tab_id.to_string());

        // ── Phase 3: telemetry handover ──────────────────────────────────
        if let Some(telemetry) = telemetry {
            let _ = telemetry
                .record_backend_trace(BackendTraceInput {
                    source: "tab_session".into(),
                    operation: "switch_tab".into(),
                    module_id: Some(to_module.clone()),
                    status_code: 0,
                    severity: Severity::Info,
                    message: format!(
                        "Tab switch: {} → {}",
                        from_module.as_deref().unwrap_or("(none)"),
                        to_module,
                    ),
                    path: None,
                    details: None,
                })
                .await;
        }

        Ok(TabSwitchPayload {
            from_tab_id,
            from_module,
            to_tab_id: tab_id.to_string(),
            to_module,
            context,
            committed: true,
        })
    }

    /// Update which tab is foreground (without a full switch — e.g. reorder).
    pub fn set_foreground(&mut self, tab_id: &str) -> Result<(), String> {
        if !self.tabs.contains_key(tab_id) {
            return Err(format!("Tab \"{tab_id}\" not found."));
        }

        for (id, session) in self.tabs.iter_mut() {
            let is_fg = id == tab_id;
            session.info.is_foreground = is_fg;
            session.info.state = if is_fg {
                TabState::Active
            } else {
                TabState::Background
            };
            if let Some(ref actor) = session.actor {
                actor.set_foreground(is_fg);
            }
        }
        self.foreground_tab_id = Some(tab_id.to_string());
        Ok(())
    }

    /// Return info for all open tabs.
    pub fn list_tabs(&self) -> Vec<TabInfo> {
        let mut tabs: Vec<TabInfo> = self.tabs.values().map(|s| s.info.clone()).collect();
        tabs.sort_by(|a, b| a.opened_at.cmp(&b.opened_at).then_with(|| a.id.cmp(&b.id)));
        tabs
    }

    /// Return info for a single tab.
    pub fn get_tab(&self, tab_id: &str) -> Option<&TabInfo> {
        self.tabs.get(tab_id).map(|s| &s.info)
    }

    /// Return info for the currently foreground tab.
    pub fn get_foreground_tab(&self) -> Option<&TabInfo> {
        self.foreground_tab_id
            .as_ref()
            .and_then(|id| self.tabs.get(id))
            .map(|s| &s.info)
    }

    /// Check whether a module already has an open tab.
    pub fn is_module_open(&self, module_id: &str) -> bool {
        self.tabs.values().any(|s| s.info.module_id == module_id)
    }

    // ── Gap 9: sync event dispatch ────────────────────────────────────────

    /// Handle a sync event for a module.
    ///
    /// If the module is in a **foreground** tab → emit an event to the
    /// frontend so it can re‑render immediately.
    ///
    /// If the module is **background** or **not open** → the data has
    /// already been applied to SQLite by the sync layer.  This is a
    /// hook point for future sync integration.
    pub async fn handle_sync_event(
        &self,
        module_id: &str,
        _db: &SqlitePool,
        app: &AppHandle,
    ) -> Result<(), String> {
        if let Some(foreground) = self.get_foreground_tab() {
            if foreground.module_id == module_id {
                // Foreground — tell the frontend to refresh
                let _ = app.emit(
                    "bento://tab:sync-update",
                    serde_json::json!({ "moduleId": module_id }),
                );
                return Ok(());
            }
        }

        // Background / not open → data already in SQLite, no action needed.
        // This is the desired behaviour described in Gap 9.
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tauri‑managed state wrapper
// ---------------------------------------------------------------------------

/// Managed‑state wrapper for `TabSessionManager`.
///
/// Used as `State<'_, ManagedTabSession>` in Tauri commands.
#[derive(Clone)]
pub struct ManagedTabSession {
    pub inner: Arc<Mutex<TabSessionManager>>,
}

impl Default for ManagedTabSession {
    fn default() -> Self {
        Self::new()
    }
}

impl ManagedTabSession {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(TabSessionManager::new())),
        }
    }
}

// ── Persistence helpers ─────────────────────────────────────────────────

/// Persist the current list of open tab module IDs to `runtime_state`.
async fn persist_open_tab_ids(state: &BentoAppState, manager: &TabSessionManager) -> Result<(), String> {
    let ids = manager.open_module_ids();
    let json = serde_json::to_string(&ids).map_err(|e| e.to_string())?;
    write_runtime_state(&state.db(), "open_tab_ids", &json).await
}

/// Restore open tabs from persisted `runtime_state`.
/// Called when the in-memory session is empty after a restart/reload.
pub async fn restore_tabs_from_db(
    session: &mut TabSessionManager,
    state: &BentoAppState,
    app: &AppHandle,
) -> Result<Vec<TabInfo>, String> {
    let raw = read_runtime_state(&state.db(), "open_tab_ids").await?;
    let Some(raw) = raw else {
        return Ok(Vec::new());
    };

    let module_ids: Vec<String> = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if module_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut restored = Vec::new();
    for module_id in &module_ids {
        // Skip dashboard, ai, settings — they're not tabbed
        if matches!(module_id.as_str(), "dashboard" | "ai" | "settings") {
            continue;
        }

        // Skip uninstalled modules
        if !crate::modules::is_installed(state, module_id).await.unwrap_or(false) {
            continue;
        }

        let telemetry: Option<TelemetryState> = app.try_state::<TelemetryState>().as_deref().cloned();
        match session.open_tab(module_id.clone(), &state.db(), telemetry, app).await {
            Ok(info) => restored.push(info),
            Err(e) => {
                eprintln!("[TabSession] Failed to restore tab for module \"{module_id}\": {e}");
            }
        }
    }

    Ok(restored)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn tab_open(
    app: AppHandle,
    session: tauri::State<'_, ManagedTabSession>,
    cache: tauri::State<'_, DashboardCache>,
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
) -> Result<TabInfo, String> {
    // Validate module_id format
    crate::modules::validate_module_id(&module_id)?;

    // Gap 11: check installed
    if !is_installed(state.inner(), &module_id).await? {
        return Err(format!(
            "Cannot open tab: module \"{module_id}\" is not installed."
        ));
    }

    let telemetry: Option<TelemetryState> = app.try_state::<TelemetryState>().as_deref().cloned();
    let mut manager = session.inner.lock().await;
    let tab_info = manager
        .open_tab(module_id, &state.db(), telemetry, &app)
        .await?;
    let opened_module_id = tab_info.module_id.clone();
    let opened_tab_id = tab_info.id.clone();
    let opened_module_id_json = opened_module_id.clone();
    let opened_tab_id_json = opened_tab_id.clone();

    write_runtime_state(&state.db(), "last_active_module", opened_module_id.as_str()).await?;
    record_dashboard_event(
        &state.db(),
        "module-open",
        opened_module_id.as_str(),
        None,
        &format!("Opened {}", opened_module_id.as_str()),
        json!({
            "moduleId": opened_module_id_json,
            "tabId": opened_tab_id_json,
            "openedAt": tab_info.opened_at,
        }),
    )
    .await?;

    state.set_active_module(opened_module_id.as_str());
    cache.invalidate();
    let _ = emit_main_window_event(&app, "bento://dashboard-refresh", opened_module_id.clone());

    // Persist open tab IDs after successful open
    let _ = persist_open_tab_ids(&state, &manager).await;

    Ok(tab_info)
}

#[tauri::command]
pub async fn tab_close(
    state: tauri::State<'_, BentoAppState>,
    session: tauri::State<'_, ManagedTabSession>,
    tab_id: String,
) -> Result<(), String> {
    let mut manager = session.inner.lock().await;
    let result = manager.close_tab(&tab_id).await;
    // Persist after close
    if result.is_ok() {
        let _ = persist_open_tab_ids(&state, &manager).await;
    }
    result
}

#[tauri::command]
pub async fn tab_switch(
    app: AppHandle,
    session: tauri::State<'_, ManagedTabSession>,
    cache: tauri::State<'_, DashboardCache>,
    state: tauri::State<'_, BentoAppState>,
    tab_id: String,
) -> Result<TabSwitchPayload, String> {
    let telemetry = app.try_state::<TelemetryState>();
    let mut manager = session.inner.lock().await;
    // Persist active tab order after switch
    let _ = persist_open_tab_ids(&state, &manager).await;
    let payload = manager
        .switch_tab(&tab_id, &state.db(), telemetry.as_deref(), &app)
        .await?;
    let from_module = payload.from_module.clone();
    let from_tab_id = payload.from_tab_id.clone();
    let to_tab_id = payload.to_tab_id.clone();
    let to_module = payload.to_module.clone();
    let to_module_json = to_module.clone();
    let from_module_json = from_module.clone();
    let to_tab_id_json = to_tab_id.clone();
    let from_tab_id_json = from_tab_id.clone();

    write_runtime_state(&state.db(), "last_active_module", to_module.as_str()).await?;
    record_dashboard_event(
        &state.db(),
        "module-switch",
        to_module.as_str(),
        from_module.as_deref(),
        &format!("Switched to {}", to_module.as_str()),
        json!({
            "fromModule": from_module_json,
            "toModule": to_module_json,
            "tabId": to_tab_id_json,
            "fromTabId": from_tab_id_json,
            "committed": payload.committed,
            "source": "tabs",
        }),
    )
    .await?;

    state.set_active_module(to_module.as_str());
    cache.invalidate();
    let _ = emit_main_window_event(&app, "bento://dashboard-refresh", to_module.clone());

    Ok(payload)
}

#[tauri::command]
pub async fn tab_set_foreground(
    session: tauri::State<'_, ManagedTabSession>,
    tab_id: String,
) -> Result<(), String> {
    let mut manager = session.inner.lock().await;
    manager.set_foreground(&tab_id)
}

#[tauri::command]
pub async fn tab_list(
    session: tauri::State<'_, ManagedTabSession>,
) -> Result<Vec<TabInfo>, String> {
    let manager = session.inner.lock().await;
    Ok(manager.list_tabs())
}

#[tauri::command]
pub async fn tab_get_foreground(
    session: tauri::State<'_, ManagedTabSession>,
) -> Result<Option<TabInfo>, String> {
    let manager = session.inner.lock().await;
    Ok(manager.get_foreground_tab().cloned())
}

#[tauri::command]
pub async fn tab_get(
    session: tauri::State<'_, ManagedTabSession>,
    tab_id: String,
) -> Result<Option<TabInfo>, String> {
    let manager = session.inner.lock().await;
    Ok(manager.get_tab(&tab_id).cloned())
}

#[tauri::command]
pub async fn tab_is_module_open(
    session: tauri::State<'_, ManagedTabSession>,
    module_id: String,
) -> Result<bool, String> {
    let manager = session.inner.lock().await;
    Ok(manager.is_module_open(&module_id))
}

/// Restore previously saved tabs from the database (after sleep/webview reload).
/// Returns the restored tab infos, or an empty vec if no persisted tabs exist.
#[tauri::command]
pub async fn tab_restore(
    app: AppHandle,
    session: tauri::State<'_, ManagedTabSession>,
    state: tauri::State<'_, BentoAppState>,
) -> Result<Vec<TabInfo>, String> {
    let mut manager = session.inner.lock().await;
    // Only restore if the in-memory session is empty
    if !manager.is_empty() {
        return Ok(manager.list_tabs());
    }

    let restored = restore_tabs_from_db(&mut manager, &state, &app).await?;
    drop(manager);

    // Set last_active_module from the first restored tab
    if let Some(first) = restored.first() {
        write_runtime_state(&state.db(), "last_active_module", &first.module_id).await?;
        state.set_active_module(&first.module_id);
    }

    Ok(restored)
}

#[tauri::command]
pub async fn tab_handle_sync_event(
    app: AppHandle,
    session: tauri::State<'_, ManagedTabSession>,
    state: tauri::State<'_, BentoAppState>,
    module_id: String,
) -> Result<(), String> {
    let manager = session.inner.lock().await;
    manager
        .handle_sync_event(&module_id, &state.db(), &app)
        .await
}
