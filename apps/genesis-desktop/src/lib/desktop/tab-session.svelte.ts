import { browser } from "$app/environment";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ── Types matching Rust backend (session.rs) ─────────────────────────────

export interface TabInfo {
  id: string;
  moduleId: string;
  openedAt: number;
  isForeground: boolean;
  state: TabStateValue;
}

export type TabStateValue =
  | "Idle"
  | "Loading"
  | "Active"
  | "Background"
  | { Error: string };

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

let tabs = $state<TabInfo[]>([]);
let activeTabId = $state<string>("");
let initialized = $state(false);

/** Read-only getters for Svelte components (avoids direct mutation of $state). */
export function getTabs(): TabInfo[] {
  return tabs;
}
export function getActiveTabId(): string {
  return activeTabId;
}
export function isSessionInitialized(): boolean {
  return initialized;
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
  if (initialized || !browser || !isTauri()) return;

  try {
    const [existingTabs, foregroundTab] = await Promise.all([
      invoke<TabInfo[]>("tab_list"),
      invoke<TabInfo | null>("tab_get_foreground"),
    ]);

    tabs = existingTabs;
    if (foregroundTab) {
      activeTabId = foregroundTab.id;
    }

    // Listen for sync events from the Rust telemetry / sync layer
    const unlistenSync = await listen<{ moduleId: string }>(
      "genesis://tab:sync-update",
      (_event) => {
        // The frontend should refresh data for the notified module.
        // Actual refresh logic lives in the per-module components.
        // Sync update received — actual refresh logic lives in per-module components
      },
    );
    cleanupFns.push(unlistenSync);

    initialized = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[TabSession] Could not sync with Rust backend:", error);
  }
}

/** Call during onMount teardown / onDestroy to clean up event listeners. */
export function destroyTabSession(): void {
  for (const fn of cleanupFns) {
    fn();
  }
  cleanupFns = [];
  initialized = false;
  tabs = [];
  activeTabId = "";
}

// ── Tab CRUD ────────────────────────────────────────────────────────────

/**
 * Open a new tab for `moduleId` on the Rust backend.
 *
 * Returns the `TabInfo` from the backend, or `null` if the operation failed
 * (e.g. module not installed — Gap 11).
 */
export async function openTab(moduleId: string): Promise<TabInfo | null> {
  if (!browser || !isTauri()) return null;

  try {
    const tabInfo = await invoke<TabInfo>("tab_open", { moduleId });

    // Merge into local state (Rust deduplicates, but we keep local sync)
    if (!tabs.some((t) => t.id === tabInfo.id)) {
      tabs = [...tabs, tabInfo];
    }
    return tabInfo;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[TabSession] Failed to open tab for "${moduleId}":`, error);
    return null;
  }
}

/**
 * Close a tab on the Rust backend (Gap 10: explicit actor shutdown).
 *
 * Returns `true` on success, `false` on failure.
 */
export async function closeTab(tabId: string): Promise<boolean> {
  if (!browser || !isTauri()) return false;

  try {
    await invoke("tab_close", { tabId });
    tabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      // Pick the last remaining tab as active, or clear
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1]?.id ?? "" : "";
    }
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[TabSession] Failed to close tab "${tabId}":`, error);
    return false;
  }
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
    activeTabId = tabId;

    // Mirror foreground/background state locally
    tabs = tabs.map((t) => ({
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
    activeTabId = tabId;

    tabs = tabs.map((t) => ({
      ...t,
      isForeground: t.id === tabId,
      state: t.id === tabId ? ("Active" as const) : ("Background" as const),
    }));

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[TabSession] Failed to set foreground tab "${tabId}":`,
      error,
    );
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

/** Re‑fetch the full tab list from the Rust backend. */
export async function refreshTabs(): Promise<void> {
  if (!browser || !isTauri()) return;

  try {
    tabs = await invoke<TabInfo[]>("tab_list");
  } catch {
    // Session may not be ready yet — silent no‑op
  }
}
