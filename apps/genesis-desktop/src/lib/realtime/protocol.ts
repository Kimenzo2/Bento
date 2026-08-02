// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Realtime wire protocol — client side.
//
// Harvested from svelte-realtime (lanteanio). The desktop WebView talks to
// the native Rust realtime server (spawned on the LAN) using the SAME wire
// format the phone app uses, so one client implementation covers both.
//
//   Request:  { rpc, id, args, stream?: true }       (id present → reply expected)
//   Volatile: { rpc, args }                          (no id → no reply expected)
//   Batch:    { batch: [ { rpc, id, args, stream? }, ... ] }
//
//   RPC reply envelope:  { channel: "__rpc", event: <id>, data: result }
//     result.ok = true  → { ok, data, requestId }
//     result.ok = false → { ok: false, code, error, requestId }
//     batch reply:      { channel: "__rpc", event: "__batch",
//                         data: { ok: true, batch: [ result, ... ] } }
//   Stream event:       { channel: <topic>, event: <merge-event>, data }
//   Auth handshake:     client → { type: "auth", accessToken, deviceId }
//                       server  → { channel: "__auth", event: "authenticated"|"denied",
//                                   data: { ok, ... } }
// ═══════════════════════════════════════════════════════════════════════

export type MergeStrategy = "crud" | "latest" | "set" | "presence" | "cursor";

export interface StreamOptions {
  merge?: MergeStrategy;
  key?: string | null;
  prepend?: boolean;
  max?: number | null;
}

export type RpcEnvelope = {
  channel: string;
  event: string;
  data: any;
};

export interface RpcResult {
  ok: boolean;
  data?: any;
  code?: string;
  error?: string;
  requestId?: string;
  topic?: string;
  merge?: MergeStrategy;
  key?: string;
  prepend?: boolean;
  max?: number;
  issues?: unknown;
}

/** RPC failure raised by the realtime client. */
export class RpcError extends Error {
  code: string;
  issues?: unknown;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RpcError";
    this.code = code;
  }
}

// ── Correlation ids (mirrors svelte-realtime client.js) ────────────────

const ID_PREFIX = Math.random().toString(36).slice(2, 6);
let idCounter = 0;

/** Generate a unique correlation id, wrapping before the safe integer range. */
export function nextId(): string {
  if (idCounter >= 0x1fffffffffffff) idCounter = 0;
  return ID_PREFIX + (idCounter++).toString(36);
}

// ── Row sanitization (defense-in-depth at ingress) ─────────────────────

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursively strip prototype-pollution keys from row data. A no-op when the
 * danger keys are absent (every legitimate envelope).
 */
export function sanitizeRowData(data: any): any {
  if (Array.isArray(data)) return data.map(sanitizeRowData);
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(data)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      out[k] = sanitizeRowData(data[k]);
    }
    return out;
  }
  return data;
}

// ── Merge engine (harvested from svelte-realtime `_applyMergeFn`) ──────

export interface MergeResult {
  value: any;
  replaced: boolean;
  modified: boolean;
}

function rebuildIndex(value: any, index: Map<any, number>, key?: string | null): void {
  index.clear();
  if (Array.isArray(value) && key) {
    for (let i = 0; i < value.length; i++) index.set(value[i]?.[key], i);
  }
}

/**
 * Apply a stream merge event to the authoritative value, mutating `value` and
 * `index` in place and returning a new array reference when the array changed.
 */
export function applyMerge(
  value: any,
  index: Map<any, number>,
  envelope: { event: string; data: any },
  opts: StreamOptions,
): MergeResult {
  const merge = opts.merge ?? "crud";
  const key = opts.key ?? null;
  const prepend = opts.prepend ?? false;
  const max = opts.max ?? null;
  const { event } = envelope;

  const data =
    merge === "crud" || merge === "presence" || merge === "cursor"
      ? sanitizeRowData(envelope.data)
      : envelope.data;

  if (event === "refreshed") {
    value = data;
    if (merge === "crud" || merge === "presence" || merge === "cursor") {
      rebuildIndex(value, index, key);
    }
    return { value, replaced: true, modified: true };
  }

  if (merge === "crud") {
    if (!Array.isArray(value)) {
      value = [];
      index.clear();
    }
    if (!key || data == null || data[key] === undefined) {
      return { value, replaced: false, modified: false };
    }
    let modified = false;
    if (event === "created") {
      const idx = index.get(data[key]);
      if (idx !== undefined) {
        value[idx] = data;
      } else if (prepend) {
        value.unshift(data);
        for (const [k, i] of index) index.set(k, i + 1);
        index.set(data[key], 0);
        if (max && value.length > max) {
          const removed = value.splice(max);
          for (const item of removed) index.delete(item[key]);
        }
      } else {
        index.set(data[key], value.length);
        value.push(data);
        if (max && value.length > max) {
          const removed = value.splice(0, value.length - max);
          for (const item of removed) index.delete(item[key]);
          rebuildIndex(value, index, key);
        }
      }
      modified = true;
    } else if (event === "updated") {
      const idx = index.get(data[key]);
      if (idx !== undefined) {
        value[idx] = data;
        modified = true;
      }
    } else if (event === "deleted") {
      const idx = index.get(data[key]);
      if (idx !== undefined) {
        index.delete(data[key]);
        const last = value.length - 1;
        if (idx < last) {
          const swapped = value[last];
          value[idx] = swapped;
          index.set(swapped[key], idx);
        }
        value.length = last;
        modified = true;
      }
    }
    return { value, replaced: false, modified };
  }

  if (merge === "latest") {
    if (!Array.isArray(value)) value = [];
    value.push(data);
    if (max && value.length > max) {
      value = value.slice(-max);
      return { value, replaced: true, modified: true };
    }
    return { value, replaced: false, modified: true };
  }

  if (merge === "presence" || merge === "cursor") {
    if (!Array.isArray(value)) {
      value = [];
      index.clear();
    }
    const keyName = "key";
    let modified = false;
    if (event === "join" || event === "update") {
      const idx = index.get(data?.[keyName]);
      if (idx !== undefined) {
        value[idx] = data;
      } else {
        index.set(data?.[keyName], value.length);
        value.push(data);
      }
      modified = true;
    } else if (event === "leave" || event === "remove") {
      const idx = index.get(data?.[keyName]);
      if (idx !== undefined) {
        index.delete(data?.[keyName]);
        const last = value.length - 1;
        if (idx < last) {
          const swapped = value[last];
          value[idx] = swapped;
          index.set(swapped[keyName], idx);
        }
        value.length = last;
        modified = true;
      }
    } else if (event === "set") {
      value = data;
      rebuildIndex(value, index, keyName);
      return { value, replaced: true, modified: true };
    }
    return { value, replaced: false, modified };
  }

  // set
  if (data === value) return { value, replaced: true, modified: false };
  return { value: data, replaced: true, modified: true };
}
