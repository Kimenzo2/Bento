// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial bridge tests: initRealtime against a mocked Tauri `invoke`, and
// the reactive stream store. The real RealtimeClient runs on a global fake
// WebSocket so stream merge, refresh-superseding, re-subscribe-on-reconnect,
// destroy, and error paths are all exercised end-to-end.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { FakeSocket } from "./test-utils";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

type BridgeModule = typeof import("./bridge");

let bridge: BridgeModule;
let invokeMock: ReturnType<typeof vi.fn>;
let lastSocket: FakeSocket | null = null;

const SERVER_INFO = {
  url: "ws://192.168.1.5:14872",
  localUrl: "ws://127.0.0.1:14872",
  port: 14872,
  lanIp: "192.168.1.5",
};

function mockInvoke() {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "get_realtime_connection_info") return Promise.resolve(SERVER_INFO);
    if (cmd === "get_realtime_auth") return Promise.resolve({ accessToken: "tok", userId: "u1" });
    return Promise.resolve(undefined);
  });
}

beforeEach(async () => {
  vi.resetModules();
  const { invoke } = await import("@tauri-apps/api/core");
  invokeMock = invoke as ReturnType<typeof vi.fn>;
  mockInvoke();

  lastSocket = null;
  (globalThis as any).WebSocket = (url: string) => {
    const s = new FakeSocket(url);
    lastSocket = s;
    return s;
  };

  bridge = await import("./bridge");
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function getSocket(): FakeSocket {
  const s = lastSocket;
  if (!s) throw new Error("no socket created");
  return s;
}

/** Drive open + accept the auth handshake, then return the client's socket. */
function connectAndAuth(): FakeSocket {
  const s = getSocket();
  s.open();
  const first = s.sentJson()[0];
  if (first?.type !== "auth") throw new Error("expected auth frame");
  s.receiveJson({ channel: "__auth", data: { ok: true } });
  return s;
}

describe("initRealtime", () => {
  it("exposes connection info and live status in the stores", async () => {
    const client = await bridge.initRealtime();
    expect(client).not.toBeNull();
    expect(get(bridge.realtimeConnection)).toMatchObject({
      url: SERVER_INFO.url,
      localUrl: SERVER_INFO.localUrl,
      port: 14872,
      lanIp: "192.168.1.5",
    });

    const s = getSocket();
    expect(get(bridge.realtimeStatus)).toBe("connecting");
    s.open();
    expect(get(bridge.realtimeStatus)).toBe("authenticating");
    s.receiveJson({ channel: "__auth", data: { ok: true } });
    expect(get(bridge.realtimeStatus)).toBe("open");
    expect(get(bridge.realtimeConnection)?.status).toBe("open");
  });

  it("returns null when the user is not signed in", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_realtime_connection_info") return Promise.resolve(SERVER_INFO);
      if (cmd === "get_realtime_auth") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    expect(await bridge.initRealtime()).toBeNull();
  });

  it("polls for server info until the native server registers state", async () => {
    vi.useFakeTimers();
    let calls = 0;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_realtime_connection_info") {
        calls++;
        if (calls <= 2) return Promise.reject(new Error("not ready"));
        return Promise.resolve(SERVER_INFO);
      }
      if (cmd === "get_realtime_auth") return Promise.resolve({ accessToken: "tok", userId: "u1" });
      return Promise.resolve(undefined);
    });

    const p = bridge.initRealtime();
    await vi.advanceTimersByTimeAsync(600);
    const client = await p;
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(client).not.toBeNull();
    vi.useRealTimers();
  });

  it("gives up (null) when the server never registers", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValue(new Error("no server"));
    const p = bridge.initRealtime();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await p).toBeNull();
    vi.useRealTimers();
  });
});

describe("realtimeStream", () => {
  it("subscribes, hydrates, and live-merges crud events", async () => {
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();

    const sub = s.sentJson().find((f) => f.rpc === "tasks/list");
    expect(sub).toBeDefined();
    s.receiveJson({
      channel: "__rpc",
      event: sub!.id,
      data: { ok: true, data: [{ id: 1, title: "a" }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await flush();

    expect(get(handle)).toEqual([{ id: 1, title: "a" }]);
    expect(get(handle.status)).toBe("connected");

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2, title: "b" } });
    s.receiveJson({ channel: "tasks/list", event: "updated", data: { id: 1, title: "A" } });
    s.receiveJson({ channel: "tasks/list", event: "deleted", data: { id: 2 } });
    await flush();

    expect(get(handle)).toEqual([{ id: 1, title: "A" }]);
  });

  it("adopts server-authoritative merge opts over local defaults", async () => {
    // Local default is `set`; the server says `crud` — crud must win.
    const handle = bridge.realtimeStream("tasks/list", { merge: "set" } as any);
    await flush();
    const s = connectAndAuth();
    await flush();

    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({
      channel: "__rpc",
      event: sub.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await flush();

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2 } });
    await flush();
    // crud appends; a `set` merge would have replaced the whole array.
    expect(get(handle)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("surfaces subscribe errors via the error + status stores", async () => {
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();

    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({ channel: "__rpc", event: sub.id, data: { ok: false, code: "DENIED", error: "nope" } });
    await flush();

    expect(get(handle.status)).toBe("error");
    expect(get(handle.error)?.code).toBe("DENIED");
    expect(get(handle)).toBeUndefined();
  });

  it("refresh() supersedes a stale in-flight subscribe", async () => {
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();
    const first = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({
      channel: "__rpc",
      event: first.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await flush();

    const r1 = handle.refresh();
    const r2 = handle.refresh();
    await flush();

    const frames = s.sentJson().filter((f) => f.rpc === "tasks/list");
    const stale = frames[frames.length - 2];
    const fresh = frames[frames.length - 1];

    // The older refresh's reply lands first — it must be ignored.
    s.receiveJson({ channel: "__rpc", event: stale.id, data: { ok: true, data: "STALE" } });
    await flush();
    s.receiveJson({ channel: "__rpc", event: fresh.id, data: { ok: true, data: "FRESH" } });
    await r1;
    await r2;
    await flush();

    expect(get(handle)).toBe("FRESH");
  });

  it("refresh() can recover from a prior error", async () => {
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();
    const bad = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({ channel: "__rpc", event: bad.id, data: { ok: false, code: "DENIED", error: "nope" } });
    await flush();
    expect(get(handle.status)).toBe("error");

    const r = handle.refresh();
    await flush();
    const good = s.sentJson().filter((f) => f.rpc === "tasks/list").pop()!;
    s.receiveJson({ channel: "__rpc", event: good.id, data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" } });
    await r;
    await flush();

    expect(get(handle.status)).toBe("connected");
    expect(get(handle.error)).toBeNull();
    expect(get(handle)).toEqual([{ id: 1 }]);
  });

  it("re-subscribes after a reconnect and rehydrates data", async () => {
    vi.useFakeTimers();
    const handle = bridge.realtimeStream("tasks/list");
    await vi.advanceTimersByTimeAsync(0);
    const s = connectAndAuth();
    await vi.advanceTimersByTimeAsync(0);
    const first = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({
      channel: "__rpc",
      event: first.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(get(handle.status)).toBe("connected");

    s.drop();
    await vi.advanceTimersByTimeAsync(200);
    expect(get(handle.status)).toBe("reconnecting");

    const s2 = getSocket();
    s2.open();
    s2.receiveJson({ channel: "__auth", data: { ok: true } });
    await vi.advanceTimersByTimeAsync(0);

    const sub2 = s2.sentJson().find((f) => f.rpc === "tasks/list");
    expect(sub2).toBeDefined();
    s2.receiveJson({
      channel: "__rpc",
      event: sub2!.id,
      data: { ok: true, data: [{ id: 99 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(get(handle)).toEqual([{ id: 99 }]);
    expect(get(handle.status)).toBe("connected");
    vi.useRealTimers();
  });

  it("destroy() stops topic delivery immediately", async () => {
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();
    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({
      channel: "__rpc",
      event: sub.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await flush();

    handle.destroy();
    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 1 }]);
  });

  it("destroy() prevents re-subscribe on a subsequent reconnect", async () => {
    vi.useFakeTimers();
    const handle = bridge.realtimeStream("tasks/list");
    await vi.advanceTimersByTimeAsync(0);
    const s = connectAndAuth();
    await vi.advanceTimersByTimeAsync(0);
    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({
      channel: "__rpc",
      event: sub.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" },
    });
    await vi.advanceTimersByTimeAsync(0);

    handle.destroy();
    s.drop();
    await vi.advanceTimersByTimeAsync(200);
    const s2 = getSocket();
    s2.open();
    s2.receiveJson({ channel: "__auth", data: { ok: true } });
    await vi.advanceTimersByTimeAsync(0);

    expect(s2.sentJson().filter((f) => f.type !== "auth")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("becomes error(NOT_CONNECTED) when no realtime server exists", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValue(new Error("no server"));
    const handle = bridge.realtimeStream("tasks/list");
    await vi.advanceTimersByTimeAsync(4_000);
    expect(get(handle.status)).toBe("error");
    expect(get(handle.error)?.code).toBe("NOT_CONNECTED");
    expect(get(handle)).toBeUndefined();
    vi.useRealTimers();
  });
});
