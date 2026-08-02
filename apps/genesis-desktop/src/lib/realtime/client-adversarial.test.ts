// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial RealtimeClient tests: the second layer of hostile frames that
// rpc.test.ts / transport.test.ts / reconnect.test.ts don't reach — spoofed
// auth from stale sockets, premature auth, duplicate connects that leak
// sockets, non-string message data, malformed __rpc shapes, and listener-set
// idempotency. Every scenario must fail gracefully: never throw, never leak
// pending promises, never settle an RPC with data from the wrong socket.

import { describe, expect, it, vi } from "vitest";

import { RealtimeClient, type RealtimeStatus } from "./client";
import { RpcError } from "./protocol";
import { acceptAuth, FakeSocket, makeFactory } from "./test-utils";

function makeClient(): { client: RealtimeClient; sockets: FakeSocket[] } {
  const { factory, sockets } = makeFactory();
  const client = new RealtimeClient("ws://test.local:9000", "t", "d", factory);
  client.onChange = () => {};
  return { client, sockets };
}

function openAndAuth(socket: FakeSocket): void {
  socket.open();
  acceptAuth(socket);
}

/** Advance fake time (in 100ms steps) until `count` sockets exist. */
function advanceUntil(sockets: FakeSocket[], count: number, maxMs: number): number {
  let advanced = 0;
  while (sockets.length < count && advanced < maxMs) {
    vi.advanceTimersByTime(100);
    advanced += 100;
  }
  return advanced;
}

describe("inbound data shapes", () => {
  it("object / array / numeric message data is ignored (typeof !== 'string')", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    // Drive onmessage directly with non-string payloads.
    sockets[0].receiveJson({ channel: "tasks/list", event: "created", data: { id: 1 } });
    sockets[0].receiveJson([1, 2, 3]);
    sockets[0].receiveJson(42);
    sockets[0].receiveJson({ a: 1 });
    expect(client.status).toBe("open");
  });

  it("a __rpc reply with NO event field is a silent no-op", async () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson({ channel: "__rpc", data: { ok: true, data: 1 } });
    expect(client.status).toBe("open");
  });

  it("a __rpc reply with a numeric event id is ignored (ids are strings)", async () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    const p = client.rpc("op", []);
    const frame = sockets[0].sentJson().find((f) => f.rpc === "op")!;
    sockets[0].receiveJson({ channel: "__rpc", event: Number(frame.id), data: { ok: true, data: 1 } });
    // The real reply (correct string id) still settles it.
    sockets[0].receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "REAL" } });
    expect(await p).toBe("REAL");
  });

  it("a __batch where data.batch is not an array is a silent no-op", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson({ channel: "__rpc", event: "__batch", data: { ok: true, batch: "nope" } });
    sockets[0].receiveJson({ channel: "__rpc", event: "__batch", data: { ok: true, batch: {} } });
    expect(client.status).toBe("open");
  });

  it("a __rpc reply with ok:true but NO data resolves to undefined", async () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    const p = client.rpc("void", []);
    const frame = sockets[0].sentJson().find((f) => f.rpc === "void")!;
    sockets[0].receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true } });
    expect(await p).toBeUndefined();
  });
});

describe("auth handshake edges", () => {
  it("a duplicate auth ok is idempotent (no crash, still open)", () => {
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0].open();
    acceptAuth(sockets[0]);
    sockets[0].receiveJson({ channel: "__auth", data: { ok: true } });
    expect(client.status).toBe("open");
    expect(client.connected).toBe(true);
  });

  it("an auth ok arriving BEFORE the socket opens reports open prematurely (hazard pinned)", () => {
    const { client, sockets } = makeClient();
    client.connect();
    // onmessage is wired synchronously at connect(); a frame sent before
    // socket.open() still routes to onAuth. The client flips to "open" even
    // though the socket is still CONNECTING — and re-sends the auth frame
    // when onopen eventually fires.
    sockets[0].receiveJson({ channel: "__auth", data: { ok: true } });
    expect(client.status).toBe("open");
    expect(client.connected).toBe(true);

    sockets[0].open();
    expect(sockets[0].sentJson().filter((f) => f.type === "auth")).toHaveLength(1);
  });

  it("a stale socket's late auth ok marks the CURRENT socket authenticated (hazard pinned)", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].drop();
    advanceUntil(sockets, 2, 5_000);
    const s2 = sockets[1];
    expect(client.status).toBe("connecting");

    // s2 has opened but NOT yet authenticated. A stale frame from the OLD
    // socket flips the client to open and flushes its queue onto s2 — the
    // current socket never sent its own auth frame.
    sockets[0].receiveJson({ channel: "__auth", data: { ok: true } });
    expect(client.status).toBe("open");
    expect(s2.sentJson().filter((f) => f.type === "auth")).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("stale socket isolation", () => {
  it("a stale socket reply carrying the CURRENT pending id settles the RPC (hazard pinned)", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    const p = client.rpc("op", []);
    const frame = sockets[0].sentJson().find((f) => f.rpc === "op")!;

    // Drop, reconnect — the pending RPC is rejected DISCONNECTED.
    sockets[0].drop();
    const e1 = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((e1 as RpcError).code).toBe("DISCONNECTED");

    advanceUntil(sockets, 2, 5_000);
    openAndAuth(sockets[1]);
    const p2 = client.rpc("op2", []);
    const frame2 = sockets[1].sentJson().find((f) => f.rpc === "op2")!;

    // A stale frame from the OLD socket carries op2's id — no socket-origin
    // check exists, so it settles the live RPC. Result: the reply was "forged"
    // by a dead connection.
    sockets[0].receiveJson({ channel: "__rpc", event: frame2.id, data: { ok: true, data: "FORGED" } });
    expect(await p2).toBe("FORGED");
    expect(frame.id).not.toBe(frame2.id);
    vi.useRealTimers();
  });

  it("a stale socket topic frame after unsubscribe is never delivered", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    const got: unknown[] = [];
    const off = client.on("t", (e) => got.push(e.data));
    sockets[0].receiveJson({ channel: "t", event: "created", data: { a: 1 } });
    expect(got).toEqual([{ a: 1 }]);

    off();
    sockets[0].receiveJson({ channel: "t", event: "created", data: { a: 2 } });
    expect(got).toEqual([{ a: 1 }]);
  });
});

describe("connect / disconnect edges", () => {
  it("connect() while already connected leaks a SECOND socket (hazard pinned)", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    expect(client.connected).toBe(true);

    // connect() unconditionally calls open(); the old socket is never closed.
    client.connect();
    expect(sockets).toHaveLength(2);
    expect(sockets[0].closed).toBe(false);
  });

  it("a pending RPC dropped mid-flight has its timeout cleared (no double-settle)", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    let settles = 0;
    const p = client.rpc("op", [], { timeout: 5000 }).then(
      () => settles++,
      () => settles++,
    );
    const frame = sockets[0].sentJson().find((f) => f.rpc === "op")!;

    sockets[0].drop();
    await p; // DISCONNECTED rejection has now settled exactly once
    advanceUntil(sockets, 2, 5_000);
    vi.advanceTimersByTime(10_000); // well past the original timeout
    // The timer was cleared on the drop; the promise settled exactly once.
    expect(settles).toBe(1);
    expect(frame.id).toBeDefined();
    vi.useRealTimers();
  });

  it("status transitions on a forged pre-open auth are sane when the socket opens", () => {
    const { client, sockets } = makeClient();
    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);
    client.connect();
    sockets[0].receiveJson({ channel: "__auth", data: { ok: true } }); // premature
    sockets[0].open(); // real onopen
    expect(seen).toEqual(["connecting", "open", "authenticating"]);
  });
});

describe("listener-set idempotency", () => {
  it("registering the SAME listener twice is deduped; a single unsub removes it", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    let calls = 0;
    const listener = () => calls++;
    const offA = client.on("t", listener);
    const offB = client.on("t", listener);
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    expect(calls).toBe(1);

    offA(); // one unsub kills the deduped entry
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    expect(calls).toBe(1);
    offB(); // second unsub is a safe no-op
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    expect(calls).toBe(1);
  });

  it("calling unsubscribe twice is a safe no-op", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    let calls = 0;
    const off = client.on("t", () => calls++);
    off();
    expect(() => off()).not.toThrow();
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    expect(calls).toBe(0);
  });

  it("unsubscribing the last listener stops all topic delivery", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    let calls = 0;
    const off = client.on("t", () => calls++);
    off();
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    sockets[0].receiveJson({ channel: "t", event: "created", data: {} });
    expect(calls).toBe(0);
  });
});

describe("queue edge cases", () => {
  it("frames queued while reconnecting are flushed onto the NEW socket after auth", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].drop();
    advanceUntil(sockets, 2, 5_000);

    const p = client.rpc("queued", []); // queued while not authenticated
    openAndAuth(sockets[1]);
    const frame = sockets[1].sentJson().find((f) => f.rpc === "queued")!;
    sockets[1].receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "OK" } });
    expect(await p).toBe("OK");
    vi.useRealTimers();
  });

  it("an RPC issued on the OLD socket before a drop is rejected, never silently dropped", async () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    const p = client.rpc("before", []);
    sockets[0].drop();
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("DISCONNECTED");
  });
});
