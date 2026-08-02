// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Data-changed consumption bridge.
//
// Rust's `RealtimeHub::emit_change(topic, event, data)` fires a
// `bento://data-changed` Tauri event (with `{topic, event}`) after EVERY DB
// write, on ~36 topics across every module. This module is the WebView side
// of that contract: it listens once, fans the topic out to registered module
// refreshers (exact or `prefix/*` matches), and coalesces bursts per topic so
// a 10-row write triggers one re-fetch, not ten.
//
// This is the missing "Agent → UI realtime" / "Module → Module realtime"
// consumption half. Modules keep their existing invoke-based loads; they just
// register a re-fetch hook here.
//
// Concurrency model (takeLatest-with-trailing):
//   - While a debounce timer is pending for a topic, new events coalesce into
//     it (no new timer).
//   - While a refresh for a topic is IN FLIGHT, new events set a "rerun"
//     flag instead of starting a parallel refresh — at most ONE refresh runs
//     per topic at a time, and exactly one trailing refresh runs after the
//     current one settles. This prevents out-of-order responses from writing
//     stale data over fresh data (the classic debounce+fetch race).
// ═══════════════════════════════════════════════════════════════════════

/** Payload Rust sends on `bento://data-changed`. */
export interface DataChangedPayload {
  topic: string;
  event?: string;
}

/** A module's re-fetch hook. May return a promise (awaited, never left dangling). */
export type Refresher = () => void | Promise<void>;

/** The `listen` shape from `@tauri-apps/api/event` (injectable for tests). */
export type TauriListen = <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>;

export const DEFAULT_DEBOUNCE_MS = 150;

/** Observable counters for tooling / the Settings realtime panel. */
export interface DataChangedStats {
  /** Inbound `bento://data-changed` events with a valid topic. */
  eventsHandled: number;
  /** Refresh cycles actually executed (one per settled fire). */
  refreshesRun: number;
  /** Refresh cycles that completed with at least one rejected refresher. */
  refreshesFailed: number;
  /** Events swallowed while a timer or in-flight refresh already covered the topic. */
  burstsCoalesced: number;
}

const DEFAULT_LISTEN: TauriListen = async (event, handler) => {
  const { listen } = await import("@tauri-apps/api/event");
  return listen(event, handler);
};

/**
 * Topic-aware refresh bus. Instantiate directly in tests with a fake `listen`;
 * the app uses the exported `dataChangedBus` singleton.
 */
export class DataChangedBus {
  private refreshers = new Map<string, Set<Refresher>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private rerun = new Set<string>();
  private unlisten: (() => void) | null = null;
  private listening = false;
  private readonly listenImpl: TauriListen;
  readonly debounceMs: number;
  private stats: DataChangedStats = { eventsHandled: 0, refreshesRun: 0, refreshesFailed: 0, burstsCoalesced: 0 };

  constructor(opts?: { listen?: TauriListen; debounceMs?: number }) {
    this.listenImpl = opts?.listen ?? DEFAULT_LISTEN;
    this.debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  /** Whether the Tauri listener is currently attached. */
  get isListening(): boolean {
    return this.listening;
  }

  /** Number of registered refreshers (observability for tests/tooling). */
  get refresherCount(): number {
    let n = 0;
    for (const set of this.refreshers.values()) n += set.size;
    return n;
  }

  /** Snapshot of the counters (avoids leaking a mutable reference). */
  getStats(): DataChangedStats {
    return { ...this.stats };
  }

  /**
   * Attach the `bento://data-changed` listener (once). Returns a cleanup fn.
   * Safe to call multiple times — a second call returns the existing cleanup
   * WITHOUT attaching a second Tauri listener.
   *
   * Never rejects: if the listener can't be attached (e.g. running outside
   * Tauri), it warns and returns a no-op cleanup so the app's bridge teardown
   * chain (`Promise.all` over unlisten callbacks) is never poisoned.
   */
  async init(): Promise<() => void> {
    if (this.listening) return this.cleanup;
    this.listening = true;
    try {
      this.unlisten = await this.listenImpl<DataChangedPayload>("bento://data-changed", (e) => {
        this.handle(e.payload);
      });
    } catch (err) {
      this.listening = false;
      console.warn("[data-changed] failed to attach listener — realtime refresh disabled:", err);
    }
    return this.cleanup;
  }

  /**
   * Register a refresher for a topic. `topic` may be exact (`tasks/list`) or a
   * namespace wildcard (`tasks/*`). Returns an unregister fn.
   */
  register(topic: string, refresher: Refresher): () => void {
    let set = this.refreshers.get(topic);
    if (!set) {
      set = new Set();
      this.refreshers.set(topic, set);
    }
    set.add(refresher);
    return () => {
      // Re-read from the map so a stale closure (after a delete + re-register
      // cycle) never wipes out a newer set for the same topic.
      const current = this.refreshers.get(topic);
      if (current) {
        current.delete(refresher);
        if (current.size === 0) this.refreshers.delete(topic);
      }
    };
  }

  /** Unregister a specific topic → refresher pair. */
  unregister(topic: string, refresher: Refresher): void {
    const set = this.refreshers.get(topic);
    if (!set) return;
    set.delete(refresher);
    if (set.size === 0) this.refreshers.delete(topic);
  }

  /**
   * Handle an inbound `data-changed` payload. Public for testability; the
   * Tauri listener calls this. Missing/invalid payloads are a safe no-op.
   */
  handle(payload: DataChangedPayload | null | undefined): void {
    if (!payload || typeof payload.topic !== "string" || payload.topic.length === 0) return;
    this.stats.eventsHandled++;
    this.schedule(payload.topic);
  }

  private schedule(topic: string): void {
    // A refresh for this topic is already running — remember to re-run once
    // after it settles instead of starting a second, overlapping refresh.
    if (this.inFlight.has(topic)) {
      this.stats.burstsCoalesced++;
      this.rerun.add(topic);
      return;
    }
    // A debounce timer is already pending for this topic — coalesce into it.
    if (this.timers.has(topic)) {
      this.stats.burstsCoalesced++;
      return;
    }
    this.timers.set(
      topic,
      setTimeout(() => {
        this.timers.delete(topic);
        void this.fire(topic);
      }, this.debounceMs),
    );
  }

  private async fire(topic: string): Promise<void> {
    if (this.inFlight.has(topic)) {
      this.rerun.add(topic);
      return;
    }
    this.inFlight.add(topic);
    try {
      // Exact match + namespace-wildcard matches (`tasks/*` matches `tasks/list`).
      const targets = new Set<Refresher>();
      for (const [registered, set] of this.refreshers) {
        if (matchesTopic(registered, topic)) {
          for (const r of set) targets.add(r);
        }
      }
      if (targets.size === 0) return;

      this.stats.refreshesRun++;
      const results = await Promise.allSettled(
        [...targets].map((r) => {
          try {
            return Promise.resolve(r());
          } catch (err) {
            return Promise.reject(err);
          }
        }),
      );
      for (const result of results) {
        if (result.status === "rejected") {
          this.stats.refreshesFailed++;
          console.warn(`[data-changed] refresher for '${topic}' failed:`, result.reason);
        }
      }
    } finally {
      this.inFlight.delete(topic);
      // Events arrived while we were refreshing — run exactly one trailing
      // refresh so the UI converges on the newest state.
      if (this.rerun.delete(topic)) {
        this.schedule(topic);
      }
    }
  }

  /** Tear down: cancel pending debounce timers and detach the Tauri listener. */
  cleanup = (): void => {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.inFlight.clear();
    this.rerun.clear();
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
    this.listening = false;
  };
}

function matchesTopic(registered: string, emitted: string): boolean {
  if (registered === emitted) return true;
  if (registered === "*") return true; // global catch-all (e.g. the dashboard)
  if (registered.endsWith("/*")) {
    const prefix = registered.slice(0, -1); // "tasks/" (strip the "*")
    return emitted.startsWith(prefix);
  }
  return false;
}

/** App-wide singleton. Initialize once from RuntimeBridge.svelte. */
export const dataChangedBus = new DataChangedBus();

/** Convenience wrappers over the singleton. */
export function initDataChangedListener(): Promise<() => void> {
  return dataChangedBus.init();
}
export function registerRefresher(topic: string, refresher: Refresher): () => void {
  return dataChangedBus.register(topic, refresher);
}
export function unregisterRefresher(topic: string, refresher: Refresher): void {
  dataChangedBus.unregister(topic, refresher);
}
