// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial stream-store tests: a hostile / buggy native server dumping
// malformed frames, spoofed topics, wrong merge strategies, and refreshed
// payloads at the reactive stream store. Extends bridge.test.ts — everything
// here exercises behavior the happy-path tests never reach.

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

/** Subscribe to a stream and hydrate it with server-authoritative opts. */
async function subscribeHydrated(
  path = "tasks/list",
  opts: any = {},
  reply: any = {
    ok: true,
    data: [],
    merge: "crud",
    key: "id",
    topic: path,
  },
): Promise<{ s: FakeSocket; handle: any }> {
  const handle = bridge.realtimeStream(path, opts);
  await flush();
  const s = connectAndAuth();
  await flush();
  const sub = s.sentJson().find((f) => f.rpc === path)!;
  s.receiveJson({ channel: "__rpc", event: sub.id, data: reply });
  await flush();
  return { s, handle };
}

describe("hostile topic frames", () => {
  it("malformed JSON on a subscribed topic is ignored; the stream survives", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1, title: "a" }],
      merge: "crud",
      key: "id",
      topic: "tasks/list",
    });
    s.receive("{not json");
    s.receiveJson({ channel: "tasks/list", event: null }); // missing data
    s.receiveJson({ channel: "tasks/list", event: "created" }); // missing data entirely
    await flush();
    expect(get(handle)).toEqual([{ id: 1, title: "a" }]);
    expect(get(handle.status)).toBe("connected");
  });

  it("a crud event with no key field is a no-op (index can't resolve it)", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1 }],
      merge: "crud",
      key: "id",
      topic: "tasks/list",
    });
    s.receiveJson({ channel: "tasks/list", event: "updated", data: { title: "no id" } });
    await flush();
    expect(get(handle)).toEqual([{ id: 1 }]);
  });

  it("a spoofed topic frame on an UNRELATED channel never touches the stream", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1 }],
      merge: "crud",
      key: "id",
      topic: "tasks/list",
    });
    s.receiveJson({ channel: "notes/list", event: "created", data: { id: 99 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 1 }]);
  });

  it("a listener whose merge throws does not kill the stream", async () => {
    // A crud event whose payload has a hostile shape must be routed through
    // applyMerge, which must never throw (even with undefined value/key).
    const handle = bridge.realtimeStream("tasks/list", { merge: "crud", key: "id" } as any);
    await flush();
    const s = connectAndAuth();
    await flush();
    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({ channel: "__rpc", event: sub.id, data: { ok: true, data: null, topic: "tasks/list" } });
    await flush();

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 1 } });
    s.receiveJson({ channel: "tasks/list", event: "refreshed", data: "not-an-array" });
    await flush();
    expect(get(handle.status)).toBe("connected");
  });
});

describe("merge strategy adoption", () => {
  it("server-authoritative `latest` appends indefinitely (local default overridden)", async () => {
    const { s, handle } = await subscribeHydrated("logs", { merge: "set" as any }, {
      ok: true,
      data: [{ n: 1 }],
      merge: "latest",
      topic: "logs",
    });
    s.receiveJson({ channel: "logs", event: "created", data: { n: 2 } });
    s.receiveJson({ channel: "logs", event: "created", data: { n: 3 } });
    await flush();
    expect(get(handle)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it("server-authoritative `set` replaces the whole array on every event", async () => {
    const { s, handle } = await subscribeHydrated("meta", {}, {
      ok: true,
      data: [{ id: 1 }],
      merge: "set",
      topic: "meta",
    });
    s.receiveJson({ channel: "meta", event: "changed", data: [{ id: 2 }] });
    await flush();
    expect(get(handle)).toEqual([{ id: 2 }]);
  });

  it("server-authoritative `presence` merges join/leave with a `key` field", async () => {
    const { s, handle } = await subscribeHydrated("devices/presence", {}, {
      ok: true,
      data: [{ key: "phone", name: "P" }],
      merge: "presence",
      key: "key", // presence streams MUST ship the key field or the store's index stays empty
      topic: "devices/presence",
    });
    s.receiveJson({ channel: "devices/presence", event: "join", data: { key: "laptop", name: "L" } });
    s.receiveJson({ channel: "devices/presence", event: "leave", data: { key: "phone" } });
    await flush();
    expect(get(handle)).toEqual([{ key: "laptop", name: "L" }]);
  });

  it("presence WITHOUT a server key field leaves the index empty — in-place updates fail (hazard pinned)", async () => {
    // The engine's presence branch hardcodes `key` for join/leave lookups, but
    // the store only rebuilds its index when the reply carries `key`. Omit it
    // and the index stays empty: `join` appends blindly (works), but an
    // existing-key `update`/`leave` can never resolve → stale duplicates.
    const { s, handle } = await subscribeHydrated("devices/presence", {}, {
      ok: true,
      data: [{ key: "phone", name: "P" }],
      merge: "presence",
      topic: "devices/presence", // no `key` field → store.index is empty
    });
    s.receiveJson({ channel: "devices/presence", event: "join", data: { key: "phone", name: "P2" } });
    await flush();
    // Appended as a NEW row instead of updating the existing "phone" in place.
    expect(get(handle)).toEqual([
      { key: "phone", name: "P" },
      { key: "phone", name: "P2" },
    ]);
  });

  it("server-adopted max evicts the head when the list overflows", async () => {
    const { s, handle } = await subscribeHydrated("recent", {}, {
      ok: true,
      data: [{ id: 1 }, { id: 2 }],
      merge: "crud",
      key: "id",
      max: 2,
      topic: "recent",
    });
    s.receiveJson({ channel: "recent", event: "created", data: { id: 3 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 2 }, { id: 3 }]);
  });

  it("server omitting merge keeps the local default", async () => {
    const handle = bridge.realtimeStream("tasks/list", { merge: "set" } as any);
    await flush();
    const s = connectAndAuth();
    await flush();
    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({ channel: "__rpc", event: sub.id, data: { ok: true, data: [{ id: 1 }], topic: "tasks/list" } });
    await flush();

    // Local `set` was NOT overridden (server sent no merge field): an event
    // with a scalar replaces the whole array.
    s.receiveJson({ channel: "tasks/list", event: "changed", data: "scalar" });
    await flush();
    expect(get(handle)).toBe("scalar");
  });
});

describe("topic resolution", () => {
  it("a subscribe reply whose topic differs from the path routes events on the REAL topic", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1 }],
      merge: "crud",
      key: "id",
      topic: "tasks/list:own",
    });
    // An event on the request path must NOT arrive…
    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 1 }]);
    // …but an event on the resolved topic does.
    s.receiveJson({ channel: "tasks/list:own", event: "created", data: { id: 2 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("refreshed rehydration in the store", () => {
  it("refreshed replaces the value and rebuilds the index for follow-up crud", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1 }, { id: 2 }],
      merge: "crud",
      key: "id",
      topic: "tasks/list",
    });
    s.receiveJson({ channel: "tasks/list", event: "refreshed", data: [{ id: 9 }, { id: 8 }] });
    await flush();
    expect(get(handle)).toEqual([{ id: 9 }, { id: 8 }]);

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 7 } });
    await flush();
    expect(get(handle)).toEqual([{ id: 9 }, { id: 8 }, { id: 7 }]);
  });

  it("refreshed with a scalar replaces the value and drops the index (lists must not get this)", async () => {
    const { s, handle } = await subscribeHydrated("tasks/list", {}, {
      ok: true,
      data: [{ id: 1 }],
      merge: "crud",
      key: "id",
      topic: "tasks/list",
    });
    s.receiveJson({ channel: "tasks/list", event: "refreshed", data: "oops" });
    await flush();
    expect(get(handle)).toBe("oops");
  });
});

describe("fan-out and isolation", () => {
  it("two streams on the SAME path stay independent (both merge)", async () => {
    const a = bridge.realtimeStream("tasks/list");
    const b = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();

    // Both subscribe frames go out; reply to each.
    const subs = s.sentJson().filter((f) => f.rpc === "tasks/list");
    expect(subs.length).toBeGreaterThanOrEqual(2);
    for (const sub of subs) {
      s.receiveJson({ channel: "__rpc", event: sub.id, data: { ok: true, data: [], merge: "crud", key: "id", topic: "tasks/list" } });
    }
    await flush();

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 1 } });
    await flush();
    expect(get(a)).toEqual([{ id: 1 }]);
    expect(get(b)).toEqual([{ id: 1 }]);

    a.destroy();
    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2 } });
    await flush();
    expect(get(a)).toEqual([{ id: 1 }]); // destroyed stream frozen
    expect(get(b)).toEqual([{ id: 1 }, { id: 2 }]); // sibling still live
  });

  it("two streams on DIFFERENT topics don't cross-contaminate", async () => {
    const tasks = bridge.realtimeStream("tasks/list");
    const notes = bridge.realtimeStream("notes/list");
    await flush();
    const s = connectAndAuth();
    await flush();

    const subT = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    const subN = s.sentJson().find((f) => f.rpc === "notes/list")!;
    s.receiveJson({ channel: "__rpc", event: subT.id, data: { ok: true, data: [{ id: "t1" }], merge: "crud", key: "id", topic: "tasks/list" } });
    s.receiveJson({ channel: "__rpc", event: subN.id, data: { ok: true, data: [{ id: "n1" }], merge: "crud", key: "id", topic: "notes/list" } });
    await flush();

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: "t2" } });
    await flush();
    expect(get(tasks)).toEqual([{ id: "t1" }, { id: "t2" }]);
    expect(get(notes)).toEqual([{ id: "n1" }]);
  });
});

describe("destroy edge cases", () => {
  it("destroy() while a subscribe is STILL IN FLIGHT: the late reply re-arms delivery (hazard pinned)", async () => {
    // The destroy() path nulls `unsubTopic` but does NOT bump the attempt
    // counter. When the in-flight subscribe resolves afterwards, the store
    // sees `!unsubTopic` and re-registers the topic listener — so the stream
    // keeps live-merging even though the caller destroyed it.
    const handle = bridge.realtimeStream("tasks/list");
    await flush();
    const s = connectAndAuth();
    await flush();

    handle.destroy();
    const sub = s.sentJson().find((f) => f.rpc === "tasks/list")!;
    s.receiveJson({ channel: "__rpc", event: sub.id, data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", topic: "tasks/list" } });
    await flush();

    s.receiveJson({ channel: "tasks/list", event: "created", data: { id: 2 } });
    await flush();
    // Value was set by the late reply AND the topic listener got re-armed:
    expect(get(handle)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
