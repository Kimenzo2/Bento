// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Realtime bridge — desktop WebView ↔ native realtime server.
//
// Initializes the RealtimeClient once (after auth restore), exposes a
// connection/status store for the Settings UI, and provides reactive stream
// stores that subscribe to the native server and live-merge topic events —
// the same protocol the phone app speaks.
// ═══════════════════════════════════════════════════════════════════════

import { invoke } from "@tauri-apps/api/core";
import { get, writable, type Readable } from "svelte/store";

import { BentoEventType, eventBus } from "$lib/services/event-bus";

import { RealtimeClient, type RealtimeStatus } from "./client";
import { applyMerge, RpcError, type StreamOptions } from "./protocol";

// ── Connection state ───────────────────────────────────────────────────

export type RealtimeConnection = {
  url: string;
  localUrl: string;
  port: number;
  lanIp: string | null;
  status: RealtimeStatus;
};

/** Connection info for the Settings UI (LAN url the phone should use). */
export const realtimeConnection = writable<RealtimeConnection | null>(null);

/** Live client status (idle/connecting/authenticating/open/reconnecting/...). */
export const realtimeStatus = writable<RealtimeStatus>("idle");

let client: RealtimeClient | null = null;
let initPromise: Promise<RealtimeClient | null> | null = null;

export function getRealtimeClient(): RealtimeClient | null {
  return client;
}

/**
 * Initialize the realtime client once. Safe to call from anywhere; the layout
 * calls it after auth restore. Returns the client (or null when the realtime
 * server isn't ready or the user isn't signed in).
 */
export async function initRealtime(): Promise<RealtimeClient | null> {
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const info = await waitForRealtimeInfo();
      if (!info) {
        console.warn("[realtime] server info not available yet");
        return null;
      }
      const authInfo = await invoke<{ accessToken: string; userId: string } | null>(
        "get_realtime_auth",
      );
      if (!authInfo?.accessToken) {
        console.warn("[realtime] not signed in — realtime client disabled");
        return null;
      }

      const c = new RealtimeClient(info.localUrl, authInfo.accessToken, "desktop");
      client = c;
      c.onChange = (status) => {
        realtimeStatus.set(status);
        realtimeConnection.update((conn) => (conn ? { ...conn, status } : conn));
        eventBus.emitSimple(BentoEventType.RealtimeStatusChanged, "system", { status });
      };

      realtimeConnection.set({
        url: info.url,
        localUrl: info.localUrl,
        port: info.port,
        lanIp: info.lanIp ?? null,
        status: "idle",
      });

      c.connect();
      return c;
    } catch (err) {
      console.warn("[realtime] init failed:", err);
      return null;
    }
  })();

  return initPromise;
}

/** Poll for the server info until the native realtime server registers state. */
async function waitForRealtimeInfo(): Promise<{
  url: string;
  localUrl: string;
  port: number;
  lanIp?: string | null;
} | null> {
  for (let i = 0; i < 15; i++) {
    try {
      const info = await invoke<{
        url: string;
        localUrl: string;
        port: number;
        lanIp?: string | null;
      }>("get_realtime_connection_info");
      if (info?.localUrl) return info;
    } catch {
      // server state not registered yet — retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

// ── Reactive streams ───────────────────────────────────────────────────

export type StreamLifecycle = "loading" | "connected" | "reconnecting" | "error";

export interface RealtimeStreamHandle<T = any> extends Readable<T | undefined> {
  /** Stream error (RpcError) or null. */
  error: Readable<RpcError | null>;
  /** lifecycle: loading / connected / reconnecting / error. */
  status: Readable<StreamLifecycle>;
  /** Force a re-fetch + re-subscribe. */
  refresh: () => Promise<void>;
  /** Tear down topic/status listeners (call on component unmount). */
  destroy: () => void;
}

/**
 * Create a reactive stream store for a realtime path (e.g. `tasks/list`).
 * Mirrors `live.stream()` from the clone: subscribes for initial data, then
 * live-merges topic events using the server-authoritative merge opts.
 */
export function realtimeStream<T = any>(
  path: string,
  opts: StreamOptions = {},
  args: any[] = [],
): RealtimeStreamHandle<T> {
  const valueStore = writable<T | undefined>(undefined);
  const errorStore = writable<RpcError | null>(null);
  const statusStore = writable<StreamLifecycle>("loading");
  const index = new Map<any, number>();

  let merge = opts.merge ?? "crud";
  let key = opts.key ?? null;
  let prepend = opts.prepend ?? false;
  let max = opts.max ?? null;

  let topic: string | null = null;
  let unsubTopic: (() => void) | null = null;
  let unsubStatus: (() => void) | null = null;
  let attempt = 0;
  let subscribed = false;
  let hasOpenedOnce = false;

  function rebuildIndex(value: unknown): void {
    index.clear();
    if (Array.isArray(value) && key) {
      for (let i = 0; i < value.length; i++) index.set((value[i] as any)?.[key], i);
    }
  }

  function applyEvent(envelope: { event: string; data: any }): void {
    const result = applyMerge(get(valueStore), index, envelope, {
      merge,
      key,
      prepend,
      max,
    });
    if (result.modified) valueStore.set(result.value);
  }

  async function fetchAndSubscribe(): Promise<void> {
    attempt++;
    const myAttempt = attempt;
    statusStore.set("loading");

    if (unsubTopic) {
      unsubTopic();
      unsubTopic = null;
    }

    const c = client ?? (await initRealtime());
    if (!c) {
      if (myAttempt !== attempt) return;
      errorStore.set(new RpcError("NOT_CONNECTED", "Realtime server not connected"));
      statusStore.set("error");
      return;
    }

    try {
      const response = await c.subscribe<any>(path, args);
      if (myAttempt !== attempt) return; // superseded by a newer attempt

      if (response.merge) merge = response.merge;
      if (response.key) key = response.key;
      if (response.prepend !== undefined) prepend = response.prepend;
      if (response.max !== undefined) max = response.max;

      topic = response.topic || path;
      valueStore.set(response.data);
      rebuildIndex(response.data);
      subscribed = true;
      errorStore.set(null);
      statusStore.set("connected");

      if (topic && !unsubTopic) {
        unsubTopic = c.on(topic, (envelope) => applyEvent(envelope));
      }
    } catch (err) {
      if (myAttempt !== attempt) return;
      const rpcErr = err instanceof RpcError ? err : new RpcError("STREAM_ERROR", String(err));
      errorStore.set(rpcErr);
      statusStore.set("error");
    }
  }

  // Watch the client so a reconnect re-subscribes (first open is the baseline
  // for the initial subscribe, which was queued before auth completed).
  unsubStatus = realtimeStatus.subscribe((status) => {
    if (status === "open") {
      if (!hasOpenedOnce) {
        hasOpenedOnce = true;
        return;
      }
      // Reconnect bounce: re-subscribe to rehydrate (only if we were
      // connected or a previous attempt errored — not while the initial
      // subscribe is still queued/in flight).
      if (subscribed || get(statusStore) !== "connected") {
        void fetchAndSubscribe();
      }
    } else if (status === "reconnecting" || status === "closed") {
      if (subscribed) statusStore.set("reconnecting");
    }
  });

  void fetchAndSubscribe();

  return {
    subscribe: valueStore.subscribe,
    error: errorStore,
    status: statusStore,
    refresh: fetchAndSubscribe,
    destroy() {
      unsubStatus?.();
      unsubTopic?.();
      unsubStatus = null;
      unsubTopic = null;
    },
  };
}
