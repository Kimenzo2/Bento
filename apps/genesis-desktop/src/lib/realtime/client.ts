// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// RealtimeClient — WebSocket RPC + reactive stream client.
//
// Harvested behavior from svelte-realtime's client.js:
//   - Auth handshake as the FIRST frame; no traffic is routed until the
//     server replies `authenticated` on the `__auth` channel.
//   - Correlation ids (`_idPrefix` + base36 counter).
//   - `__rpc` envelope routing (single + `__batch`).
//   - Reconnect with jittered exponential backoff.
//   - In-flight RPCs are rejected with `DISCONNECTED` on a dropped socket
//     (callers retry); nothing is silently dropped on the reliable path.
// ═══════════════════════════════════════════════════════════════════════

import { nextId, RpcError, type RpcEnvelope, type RpcResult } from "./protocol";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "authenticating"
  | "open"
  | "reconnecting"
  | "closed"
  | "failed";

export type TopicListener = (envelope: RpcEnvelope) => void;

/** The minimal WebSocket surface the client relies on (real or mock). */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: any) => void) | null;
  onmessage: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

interface PendingRpc {
  stream: boolean;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (value: any) => void;
  reject: (reason: unknown) => void;
}

/** Reliable frames queued while the socket is connecting/authenticating. */
const MAX_SEND_QUEUE = 1024;

/** `WebSocket.OPEN` — kept as a literal so tests don't need a global WebSocket. */
const WS_OPEN = 1;

export class RealtimeClient {
  private ws: WebSocketLike | null = null;
  private url: string;
  private accessToken: string;
  private deviceId: string;
  private wsFactory: WebSocketFactory | null;

  private pending = new Map<string, PendingRpc>();
  private topicListeners = new Map<string, Set<TopicListener>>();
  private sendQueue: string[] = [];

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private authenticated = false;

  private _status: RealtimeStatus = "idle";

  /** Called on every status transition. */
  onChange: ((status: RealtimeStatus) => void) | null = null;

  constructor(
    url: string,
    accessToken: string,
    deviceId: string,
    wsFactory?: WebSocketFactory,
  ) {
    this.url = url;
    this.accessToken = accessToken;
    this.deviceId = deviceId;
    const globalWs = (globalThis as any).WebSocket as WebSocketFactory | undefined;
    this.wsFactory = wsFactory ?? globalWs ?? null;
  }

  get status(): RealtimeStatus {
    return this._status;
  }

  get connected(): boolean {
    return this.authenticated && this._status === "open";
  }

  connect(): void {
    this.manuallyClosed = false;
    this.reconnectAttempts = 0;
    this.open();
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.authenticated = false;
    this.sendQueue = [];
    this.rejectAllPending(new RpcError("CONNECTION_CLOSED", "Connection closed"));
    this.setStatus("closed");
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Call an RPC. Resolves with `result.data` (or the full result when
   * `stream` is true, which carries the server-authoritative merge opts).
   */
  rpc<T = any>(path: string, args: any[] = [], opts?: { timeout?: number; stream?: boolean }): Promise<T> {
    const id = nextId();
    return new Promise<T>((resolve, reject) => {
      const timeout = opts?.timeout ?? 30_000;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError("TIMEOUT", `RPC '${path}' timed out after ${Math.round(timeout / 1000)}s`));
      }, timeout);

      this.pending.set(id, {
        stream: opts?.stream ?? false,
        timer,
        resolve,
        reject,
      });

      const frame = opts?.stream ? { rpc: path, id, args, stream: true } : { rpc: path, id, args };
      this.sendQueued(frame);
    });
  }

  /** Subscribe to a reactive stream. Resolves with the initial data + opts. */
  subscribe<T = any>(path: string, args: any[] = []): Promise<RpcResult & { data: T }> {
    return this.rpc<RpcResult & { data: T }>(path, args, { stream: true });
  }

  /**
   * Listen to a topic channel (stream events fan out on their topic). Returns
   * an unsubscribe function.
   */
  on(topic: string, listener: TopicListener): () => void {
    let set = this.topicListeners.get(topic);
    if (!set) {
      set = new Set();
      this.topicListeners.set(topic, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.topicListeners.delete(topic);
    };
  }

  // ── Connection lifecycle ─────────────────────────────────────────────

  private setStatus(status: RealtimeStatus): void {
    if (status === this._status) return;
    this._status = status;
    try {
      this.onChange?.(status);
    } catch (err) {
      console.warn("[realtime] onChange listener threw:", err);
    }
  }

  private open(): void {
    this.setStatus(this.authenticated ? "reconnecting" : "connecting");
    if (!this.wsFactory) {
      console.error("[realtime] WebSocket not available in this environment");
      this.scheduleReconnect();
      return;
    }
    let ws: WebSocketLike;
    try {
      ws = this.createSocket(this.url);
    } catch (err) {
      console.error("[realtime] failed to open WebSocket:", err);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => this.sendAuthFrame();
    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      this.onMessage(event.data);
    };
    ws.onerror = () => {
      // Errors surface via onclose; nothing to do here.
    };
    ws.onclose = () => this.onDisconnect();
  }

  /** Invoke the factory whether it's a plain function or a native `WebSocket`-style constructor. */
  private createSocket(url: string): WebSocketLike {
    // Defensive dispatch: the seam accepts plain functions AND constructor-style
    // factories (e.g. the native `WebSocket` class). TS can't narrow a union of
    // the two call shapes, so the runtime guard below does the work.
    const factory: any = this.wsFactory;
    try {
      const ws = factory(url);
      if (ws && typeof ws.send === "function") return ws;
    } catch {
      // fall through to constructor invocation (native WebSocket needs `new`)
    }
    const ws = new factory(url);
    if (ws && typeof ws.send === "function") return ws;
    throw new Error("WebSocket factory returned an unusable socket");
  }

  private sendAuthFrame(): void {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return;
    this.setStatus("authenticating");
    this.ws.send(
      JSON.stringify({ type: "auth", accessToken: this.accessToken, deviceId: this.deviceId }),
    );
  }

  private onDisconnect(): void {
    const wasOpen = this._status === "open";
    this.authenticated = false;
    this.setStatus(wasOpen ? "reconnecting" : "closed");
    this.rejectAllPending(new RpcError("DISCONNECTED", "WebSocket connection lost"));
    this.sendQueue = [];
    if (this.manuallyClosed) {
      this.setStatus("closed");
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed) return;
    if (this.reconnectTimer) return;

    let delay: number;
    if (this.reconnectAttempts < 2) {
      delay = 20 + Math.floor(Math.random() * 80);
    } else {
      const base = Math.min(1000 * Math.pow(2.2, this.reconnectAttempts - 2), 300_000);
      delay = Math.floor(base * (0.75 + Math.random() * 0.5));
    }
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private rejectAllPending(err: RpcError): void {
    for (const [id, entry] of this.pending) {
      this.pending.delete(id);
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(err);
    }
  }

  // ── Inbound routing ──────────────────────────────────────────────────

  private onMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    const channel = msg.channel as string | undefined;

    if (channel === "__auth") {
      this.onAuth(msg.data);
      return;
    }

    if (channel === "__rpc") {
      this.routeRpc(msg.event as string, msg.data);
      return;
    }

    if (typeof channel !== "string") return;

    const listeners = this.topicListeners.get(channel);
    if (listeners) {
      const envelope = msg as RpcEnvelope;
      for (const listener of [...listeners]) {
        try {
          listener(envelope);
        } catch (err) {
          console.warn(`[realtime] topic '${channel}' listener threw:`, err);
        }
      }
    }
  }

  private onAuth(data: any): void {
    if (!data) return;
    if (data.ok) {
      this.authenticated = true;
      this.reconnectAttempts = 0;
      this.setStatus("open");
      this.flushQueue();
    } else {
      console.error(`[realtime] auth denied: ${data.code ?? "UNKNOWN"} ${data.error ?? ""}`);
      this.setStatus("failed");
      this.rejectAllPending(new RpcError(data.code ?? "UNAUTHORIZED", data.error ?? "Auth denied"));
      this.ws?.close();
    }
  }

  private routeRpc(id: string, data: any): void {
    if (id === "__batch" && Array.isArray(data?.batch)) {
      for (const result of data.batch) {
        this.settleRpc(result?.id as string, result as RpcResult);
      }
      return;
    }
    this.settleRpc(id, data as RpcResult);
  }

  private settleRpc(id: string, result: RpcResult | undefined): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    if (entry.timer) clearTimeout(entry.timer);

    if (result?.ok) {
      entry.resolve(entry.stream ? result : result.data);
    } else {
      const err = new RpcError(result?.code || "UNKNOWN", result?.error || "Unknown error");
      if (result?.issues) err.issues = result.issues;
      entry.reject(err);
    }
  }

  // ── Outbound queueing ────────────────────────────────────────────────

  private sendQueued(frame: Record<string, unknown>): void {
    const text = JSON.stringify(frame);
    if (this.authenticated && this.ws && this.ws.readyState === WS_OPEN) {
      this.ws.send(text);
      return;
    }
    if (this.sendQueue.length >= MAX_SEND_QUEUE) {
      console.warn("[realtime] send queue full — dropping oldest frame");
      this.sendQueue.shift();
    }
    this.sendQueue.push(text);
  }

  private flushQueue(): void {
    if (!this.authenticated || !this.ws || this.ws.readyState !== WS_OPEN) return;
    const queue = this.sendQueue;
    this.sendQueue = [];
    for (const text of queue) {
      this.ws.send(text);
    }
  }
}
