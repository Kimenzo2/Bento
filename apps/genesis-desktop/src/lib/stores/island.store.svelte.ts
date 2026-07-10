import { invokeWithTimeout } from "$lib/ipc";
import { islandItems, type IslandItem } from "$lib/data/island-catalog";

export type IslandMode = "compact" | "expanded";
export type IslandPage = "actions" | "widgets";

export type ActiveModuleState = {
  id: string;
  label: string;
  icon: string;
  status: string;
  /**
   * The type of activity — used by the compact view to pick the right
   * layout (e.g. "recording" shows a pulsing dot + timer).
   */
  activityType?: "recording" | "timer" | "active" | "playback";
} | null;

class IslandStore {
  #transitionStart = 0;

  mode = $state<IslandMode>("compact");
  page = $state<IslandPage>("widgets");
  selectedItemId = $state<string | null>(null);
  searchQuery = $state("");
  recentCache = $state<IslandItem[]>(this.loadRecent());

  /** When a module is actively running inside the island (e.g. recording). */
  activeModule = $state<ActiveModuleState>(null);

  /** Diagnostics: time since mode last changed (ms). */
  get msSinceModeChange(): number {
    return this.#transitionStart ? Date.now() - this.#transitionStart : 0;
  }

  /** Diagnostics: health check. Returns warnings if state appears stuck. */
  healthCheck(): string[] {
    const warnings: string[] = [];
    if (this.mode === "expanded" && this.msSinceModeChange > 30_000) {
      warnings.push(
        `[island-diag] EXPANDED for ${(this.msSinceModeChange / 1000).toFixed(1)}s without collapse`,
      );
    }
    if (this.mode === "compact" && this.msSinceModeChange > 300_000) {
      warnings.push(
        `[island-diag] COMPACT for ${(this.msSinceModeChange / 1000).toFixed(1)}s (possible leak)`,
      );
    }
    return warnings;
  }

  /** Diagnostics: force health check on window. Exposed for stress testing. */
  runHealthCheck() {
    const warnings = this.healthCheck();
    warnings.forEach((w) => console.warn(w));
    return warnings;
  }

  expand(page: IslandPage = "widgets") {
    const prevMode = this.mode;
    this.#transitionStart = Date.now();
    this.mode = "expanded";
    this.page = page;
    this.selectedItemId = null;
    const elapsed = Date.now() - this.#transitionStart;
    console.log(`[island-store] expand() ${prevMode} -> expanded (page=${page}) [${elapsed}ms]`);
    if (prevMode === "expanded") {
      console.warn(`[island-store] WARN: expand() called while already expanded`);
    }
    invokeWithTimeout("island_expand", undefined, 5_000).catch((e) => {
      console.error("[island] expand invoke failed:", e);
      // DESYNC WARNING: store says expanded, but Rust ISLAND_EXPANDED may still be false
      console.warn(
        `[island-store] DESYNC: mode=expanded but island_expand invoke failed — Rust flag may be out of sync`,
      );
    });
  }

  /**
   * Collapse the island to compact state.
   *
   * Preserves `activeModule` when there's a live activity (recording/playback/timer)
   * so the compact status indicator doesn't disappear mid-session.
   * Non-live module states (quick action triggers, one-shot status) are cleared.
   */
  collapse() {
    const prevMode = this.mode;
    this.#transitionStart = Date.now();
    this.mode = "compact";
    this.page = "widgets";
    this.selectedItemId = null;
    this.searchQuery = "";

    // Preserve activeModule for live activities — don't kill the compact indicator.
    // Non-live module states (quick-action triggers, one-shot statuses) are ephemeral
    // and should be cleared on collapse so the bar doesn't show stale info.
    const isLive =
      this.activeModule?.activityType === "recording" ||
      this.activeModule?.activityType === "playback" ||
      this.activeModule?.activityType === "timer";
    if (!isLive) {
      this.activeModule = null;
    }

    const elapsed = Date.now() - this.#transitionStart;
    console.log(
      `[island-store] collapse() ${prevMode} -> compact [${elapsed}ms]${isLive ? " (preserved activeModule)" : ""}`,
    );
    if (prevMode === "compact") {
      console.warn(`[island-store] WARN: collapse() called while already compact`);
    }
    invokeWithTimeout("island_compact", undefined, 5_000).catch((e) => {
      console.error("[island] collapse invoke failed:", e);
      // DESYNC WARNING: store says compact, but Rust ISLAND_EXPANDED may still be true
      console.warn(
        `[island-store] DESYNC: mode=compact but island_compact invoke failed — Rust flag may be out of sync`,
      );
    });
  }

  /**
   * Activate a module inside the island. The island switches to
   * expanded mode showing the module's status area, and the compact
   * state will display live status instead of the default dot.
   */
  activateModule(state: NonNullable<ActiveModuleState>) {
    const prevMode = this.mode;
    this.#transitionStart = Date.now();
    this.activeModule = state;
    this.mode = "expanded";
    this.selectedItemId = null;
    this.searchQuery = "";
    console.log(`[island-store] activateModule(${state.id}) ${prevMode} -> expanded`);
  }

  toggle() {
    console.log(`[island-store] toggle() current mode=${this.mode}`);
    if (this.mode === "compact") {
      this.expand();
    } else {
      this.collapse();
    }
  }

  selectItem(id: string) {
    const prev = this.selectedItemId;
    this.selectedItemId = this.selectedItemId === id ? null : id;
    console.log(`[island-store] selectItem(${id}) ${prev} -> ${this.selectedItemId}`);
  }

  setPage(page: IslandPage) {
    const prev = this.page;
    this.page = page;
    this.selectedItemId = null;
    console.log(`[island-store] setPage(${page}) ${prev} -> ${page}`);
  }

  setSearch(query: string) {
    this.searchQuery = query;
  }

  private loadRecent(): IslandItem[] {
    const stored =
      typeof localStorage !== "undefined" ? localStorage.getItem("bento:island:recent") : null;
    if (!stored) return islandItems.slice(0, 4);
    try {
      const ids = JSON.parse(stored) as string[];
      const items = ids
        .map((id) => islandItems.find((i) => i.id === id))
        .filter(Boolean) as IslandItem[];
      return items.length ? items : islandItems.slice(0, 4);
    } catch {
      return islandItems.slice(0, 4);
    }
  }

  pushRecent(id: string) {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem("bento:island:recent");
    const recent: string[] = raw ? JSON.parse(raw) : [];
    const updated = [id, ...recent.filter((existing) => existing !== id)].slice(0, 6);
    localStorage.setItem("bento:island:recent", JSON.stringify(updated));
    this.recentCache = this.loadRecent();
  }

  get filteredItems(): IslandItem[] {
    if (!this.searchQuery.trim()) return islandItems;
    const q = this.searchQuery.toLowerCase();
    return islandItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.tagline.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    );
  }

  get selectedItem(): IslandItem | null {
    if (!this.selectedItemId) return null;
    return this.filteredItems.find((i) => i.id === this.selectedItemId) ?? null;
  }

  get recentItems(): IslandItem[] {
    return this.recentCache;
  }
}

export const islandStore = new IslandStore();
