// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { browser } from "$app/environment";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { time } from "$lib/utils/time";

// ── Types matching Rust backend (session.rs) ─────────────────────────────

export interface TabInfo {
  id: string;
  moduleId: string;
  openedAt: number;
  isForeground: boolean;
  state: TabStateValue;
}

export type TabStateValue = "Idle" | "Loading" | "Active" | "Background" | { Error: string };

export interface TabSwitchPayload {
  fromTabId: string | null;
  fromModule: string | null;
  toTabId: string;
  toModule: string;
  context: ModuleContext | null;
  committed: boolean;
}

export interface ModuleContext {
  module: string;
  scrollPosition: number;
  lastOpenId: string | null;
  cursorPosition: number | null;
  extra: Record<string, unknown>;
}

// ── Reactive state ──────────────────────────────────────────────────────

export const tabState = $state({
  tabs: [] as TabInfo[],
  activeTabId: "",
  initialized: false,
});

/** Read-only getters for Svelte components (avoids direct mutation of $state). */
export function getTabs(): TabInfo[] {
  return tabState.tabs;
}
export function getActiveTabId(): string {
  return tabState.activeTabId;
}
export function isSessionInitialized(): boolean {
  return tabState.initialized;
}

let cleanupFns: UnlistenFn[] = [];

// ── Init / Teardown ─────────────────────────────────────────────────────

/**
 * Call once on mount to restore any existing tab session from the Rust
 * backend and start listening for sync‑update events.
 *
 * Safe to call multiple times (no‑op after first success).
 */
export async function initTabSession(): Promise<void> {
  if (tabState.initialized || !browser || !isTauri()) return;

  try {
    const [existingTabs, foregroundTab] = await Promise.all([
      invoke<TabInfo[]>("tab_list"),
      invoke<TabInfo | null>("tab_get_foreground"),
    ]);

    tabState.tabs = existingTabs;

    // If the in-memory session on the Rust side is empty (e.g. after a
    // full backend restart), try restoring from persisted tab IDs in SQLite.
    if (existingTabs.length === 0) {
      try {
        const restoredTabs = await invoke<TabInfo[]>("tab_restore");
        if (restoredTabs.length > 0) {
          tabState.tabs = restoredTabs;
          // Find the foreground tab from restored set (first by convention)
          const restoredForeground = restoredTabs.find((t) => t.isForeground) ?? restoredTabs[0];
          tabState.activeTabId = restoredForeground.id;
        }
      } catch (error) {
        console.warn("[TabSession] Could not restore tabs from database:", error);
      }
    } else if (foregroundTab) {
      tabState.activeTabId = foregroundTab.id;
    }

    const unlistenSync = await listen<{ moduleId: string }>("bento://tab:sync-update", (_event) => {
      // Actual refresh logic lives in per-module components
    });
    cleanupFns.push(unlistenSync);

    tabState.initialized = true;
  } catch (error) {
    console.warn("[TabSession] Could not sync with Rust backend:", error);
  }
}

/** Call during onMount teardown / onDestroy to clean up event listeners. */
export function destroyTabSession(): void {
  for (const fn of cleanupFns) {
    fn();
  }
  cleanupFns = [];
  tabState.initialized = false;
  tabState.tabs = [];
  tabState.activeTabId = "";
}

// ── Local ID generation ────────────────────────────────────────────────

let idCounter = 0;

function generateTabId(): string {
  return `tab_${time.now()}_${++idCounter}`;
}

// ── Tab CRUD ────────────────────────────────────────────────────────────

/**
 * Open a new tab for `moduleId` — works client‑side (no Rust backend required).
 * If the Tauri backend is available, it also syncs with the Rust side.
 *
 * Returns the created `TabInfo`, or `null` if the moduleId is empty.
 */
export function addTab(moduleId: string): TabInfo | null {
  if (!moduleId) return null;

  // If this module already has a tab, switch to it instead of creating a new one
  const existing = tabState.tabs.find((t) => t.moduleId === moduleId);
  if (existing) {
    tabState.activeTabId = existing.id;
    tabState.tabs = tabState.tabs.map((t) => ({
      ...t,
      isForeground: t.id === existing.id,
      state: t.id === existing.id ? ("Active" as const) : ("Background" as const),
    }));
    return existing;
  }

  // Deactivate all current tabs
  const updatedTabs = tabState.tabs.map((t) => ({
    ...t,
    isForeground: false,
    state: "Background" as const,
  }));

  const tab: TabInfo = {
    id: generateTabId(),
    moduleId,
    openedAt: time.now(),
    isForeground: true,
    state: "Active" as const,
  };

  tabState.tabs = [...updatedTabs, tab];
  tabState.activeTabId = tab.id;

  // Try backend if available (don't fail if not)
  if (browser && isTauri()) {
    invoke("tab_open", { moduleId }).catch(() => {});
  }

  return tab;
}

/**
 * Open a new tab for `moduleId` on the Rust backend.
 *
 * Returns the `TabInfo` from the backend, or `null` if the operation failed.
 * Prefer `addTab()` for client‑first usage.
 */
export async function openTab(moduleId: string): Promise<TabInfo | null> {
  if (!browser || !isTauri()) {
    return addTab(moduleId);
  }

  try {
    const tabInfo = await invoke<TabInfo>("tab_open", { moduleId });
    if (!tabState.tabs.some((t) => t.id === tabInfo.id)) {
      tabState.tabs = [...tabState.tabs, tabInfo];
    }
    return tabInfo;
  } catch (error) {
    console.warn(`[TabSession] Backend tab_open failed, falling back to client‑side:`, error);
    return addTab(moduleId);
  }
}

/**
 * Close a tab — works client‑side first, syncs with the Rust backend if available.
 *
 * Returns `true` on success, `false` on failure.
 */
export async function closeTab(tabId: string): Promise<boolean> {
  if (!browser) return false;

  const tabToClose = tabState.tabs.find((t) => t.id === tabId);
  if (!tabToClose) return false;

  // Record the index BEFORE filtering — used to pick the fallback tab
  const closingIndex = tabState.tabs.indexOf(tabToClose);

  tabState.tabs = tabState.tabs.filter((t) => t.id !== tabId);

  if (tabState.activeTabId === tabId) {
    if (tabState.tabs.length === 0) {
      tabState.activeTabId = "";
    } else {
      // Prefer the tab to the left of the closed one;
      // if we closed the first tab, use the new first tab.
      const fallbackIndex = Math.min(closingIndex, tabState.tabs.length - 1);
      tabState.activeTabId = tabState.tabs[fallbackIndex]?.id ?? tabState.tabs[0]?.id ?? "";
    }
  }

  // Try backend if available
  if (browser && isTauri()) {
    try {
      await invoke("tab_close", { tabId });
    } catch (error) {
      console.warn(`[TabSession] Backend tab_close failed, tab closed client‑side:`, error);
    }
  }

  return true;
}

/**
 * Execute the 3‑phase tab switch on the Rust backend.
 *
 * **Phase 1** – flush current foreground module's context.
 * **Phase 2** – load incoming module's last UI context.
 * **Phase 3** – telemetry handover.
 *
 * Returns the `TabSwitchPayload` (including restored context), or `null`.
 */
export async function switchTab(tabId: string): Promise<TabSwitchPayload | null> {
  if (!browser || !isTauri()) return null;

  try {
    const payload = await invoke<TabSwitchPayload>("tab_switch", { tabId });
    tabState.activeTabId = tabId;
    tabState.tabs = tabState.tabs.map((t) => ({
      ...t,
      isForeground: t.id === tabId,
      state: t.id === tabId ? ("Active" as const) : ("Background" as const),
    }));
    return payload;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[TabSession] Failed to switch to tab "${tabId}":`, error);
    return null;
  }
}

/**
 * Update which tab is foreground without a full 3‑phase switch
 * (e.g. after a drag‑reorder).
 */
export async function setForegroundTab(tabId: string): Promise<boolean> {
  if (!browser || !isTauri()) return false;

  try {
    await invoke("tab_set_foreground", { tabId });
    tabState.activeTabId = tabId;
    tabState.tabs = tabState.tabs.map((t) => ({
      ...t,
      isForeground: t.id === tabId,
      state: t.id === tabId ? ("Active" as const) : ("Background" as const),
    }));
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[TabSession] Failed to set foreground tab "${tabId}":`, error);
    return false;
  }
}

// ── Queries ─────────────────────────────────────────────────────────────

/**
 * Check whether a module already has an open tab on the Rust backend.
 */
export async function isModuleOpen(moduleId: string): Promise<boolean> {
  if (!browser || !isTauri()) return false;

  try {
    return await invoke<boolean>("tab_is_module_open", { moduleId });
  } catch {
    return false;
  }
}

/**
 * Persist a reordered tab list to the Rust backend.
 *
 * Called after a drag‑reorder completes so the session order
 * survives app restart.
 */
export async function reorderTabs(tabIds: string[]): Promise<boolean> {
  if (!browser || !isTauri()) return false;

  try {
    await invoke("tab_reorder", { tabIds });
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[TabSession] tab_reorder not yet implemented in backend:", error);
    return false;
  }
}

/** Re‑fetch the full tab list from the Rust backend. */
export async function refreshTabs(): Promise<void> {
  if (!browser || !isTauri()) return;
  try {
    tabState.tabs = await invoke<TabInfo[]>("tab_list");
  } catch {
    // Session may not be ready yet — silent no‑op
  }
}
