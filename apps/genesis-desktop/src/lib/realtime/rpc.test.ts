// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial RPC tests: request/reply correlation, batch replies, timeouts,
// the pre-auth reliable send queue, and queue overflow. Deliberately throws
// malformed, duplicated, missing and out-of-order replies at the client.

import { describe, expect, it, vi } from "vitest";

import { RealtimeClient } from "./client";
import { RpcError } from "./protocol";
import { acceptAuth, FakeSocket, makeFactory } from "./test-utils";

function makeConnectedClient(): { client: RealtimeClient; socket: FakeSocket } {
  const { factory, sockets } = makeFactory();
  const client = new RealtimeClient("ws://test.local:9000", "t", "d", factory);
  client.onChange = () => {};
  client.connect();
  const socket = sockets[0];
  openAndAuth(socket);
  return { client, socket };
}

function openAndAuth(socket: FakeSocket): void {
  socket.open();
  acceptAuth(socket);
}

describe("single RPC", () => {
  it("resolves with result.data for a non-stream RPC", async () => {
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("tasks/get", [{ id: 1 }]);
    const frame = socket.sentJson().find((f) => f.rpc === "tasks/get")!;
    expect(frame).toEqual({ rpc: "tasks/get", id: frame.id, args: [{ id: 1 }] });

    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: { id: 1, title: "x" } } });
    expect(await p).toEqual({ id: 1, title: "x" });
  });

  it("a stream RPC resolves with the FULL result (carries merge opts)", async () => {
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("tasks/list", [], { stream: true });
    const frame = socket.sentJson().find((f) => f.rpc === "tasks/list")!;
    expect(frame.stream).toBe(true);

    socket.receiveJson({
      channel: "__rpc",
      event: frame.id,
      data: { ok: true, data: [{ id: 1 }], merge: "crud", key: "id", max: 100, topic: "tasks/list" },
    });
    const result = await p;
    expect(result).toMatchObject({ merge: "crud", key: "id", topic: "tasks/list" });
    expect(result.data).toEqual([{ id: 1 }]);
  });

  it("an error reply rejects with code + message", async () => {
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("tasks/get", []);
    const frame = socket.sentJson().find((f) => f.rpc === "tasks/get")!;
    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: false, code: "NOT_FOUND", error: "gone" } });

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).code).toBe("NOT_FOUND");
    expect((err as RpcError).message).toBe("gone");
  });

  it("an error reply carries the server validation `issues`", async () => {
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("tasks/update", []);
    const frame = socket.sentJson().find((f) => f.rpc === "tasks/update")!;
    socket.receiveJson({
      channel: "__rpc",
      event: frame.id,
      data: { ok: false, code: "VALIDATION", error: "bad", issues: [{ path: ["title"], message: "required" }] },
    });

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).issues).toEqual([{ path: ["title"], message: "required" }]);
  });

  it("a reply for an unknown id is silently ignored", async () => {
    const { client, socket } = makeConnectedClient();
    socket.receiveJson({ channel: "__rpc", event: "totally-unknown", data: { ok: true, data: 1 } });
    expect(client.status).toBe("open");
  });

  it("a reply with no `ok` field is treated as an error (UNKNOWN)", async () => {
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("noop", []);
    const frame = socket.sentJson().find((f) => f.rpc === "noop")!;
    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { data: 1 } });

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("UNKNOWN");
  });

  it("out-of-order replies settle independently", async () => {
    const { client, socket } = makeConnectedClient();
    const a = client.rpc("a", []);
    const b = client.rpc("b", []);
    const fa = socket.sentJson().find((f) => f.rpc === "a")!;
    const fb = socket.sentJson().find((f) => f.rpc === "b")!;

    socket.receiveJson({ channel: "__rpc", event: fb.id, data: { ok: true, data: "B" } });
    socket.receiveJson({ channel: "__rpc", event: fa.id, data: { ok: true, data: "A" } });
    expect(await a).toBe("A");
    expect(await b).toBe("B");
  });

  it("double replies: the second is a no-op", async () => {
    const { client, socket } = makeConnectedClient();
    let resolved = 0;
    const p = client.rpc("once", []).then(() => resolved++);
    const frame = socket.sentJson().find((f) => f.rpc === "once")!;

    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: 1 } });
    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: 2 } });
    await p;
    expect(resolved).toBe(1);
  });
});

describe("batch replies", () => {
  it("settles every RPC in a batch", async () => {
    const { client, socket } = makeConnectedClient();
    const a = client.rpc("a", []);
    const b = client.rpc("b", []);
    const fa = socket.sentJson().find((f) => f.rpc === "a")!;
    const fb = socket.sentJson().find((f) => f.rpc === "b")!;

    socket.receiveJson({
      channel: "__rpc",
      event: "__batch",
      data: { ok: true, batch: [
        { id: fa.id, ok: true, data: "A" },
        { id: fb.id, ok: true, data: "B" },
      ] },
    });
    expect(await a).toBe("A");
    expect(await b).toBe("B");
  });

  it("a batch with a null/undefined member skips that entry safely", async () => {
    const { client, socket } = makeConnectedClient();
    const a = client.rpc("a", []);
    const b = client.rpc("b", []);
    const fa = socket.sentJson().find((f) => f.rpc === "a")!;
    const fb = socket.sentJson().find((f) => f.rpc === "b")!;

    socket.receiveJson({
      channel: "__rpc",
      event: "__batch",
      data: { ok: true, batch: [null, undefined, { id: fa.id, ok: true, data: "A" }, { id: fb.id, ok: true, data: "B" }] },
    });
    expect(await a).toBe("A");
    expect(await b).toBe("B");
  });

  it("a batch missing a member leaves that RPC pending (times out, does not crash)", async () => {
    vi.useFakeTimers();
    const { client, socket } = makeConnectedClient();
    const a = client.rpc("a", [], { timeout: 5000 });
    const b = client.rpc("b", []);
    const fa = socket.sentJson().find((f) => f.rpc === "a")!;
    const fb = socket.sentJson().find((f) => f.rpc === "b")!;

    socket.receiveJson({ channel: "__rpc", event: "__batch", data: { ok: true, batch: [{ id: fb.id, ok: true, data: "B" }] } });
    expect(await b).toBe("B");

    const errPromise = a.then(
      () => null,
      (e: unknown) => e,
    );
    vi.advanceTimersByTime(5_000);
    const err = await errPromise;
    expect((err as RpcError).code).toBe("TIMEOUT");
    expect(fa.id).not.toBe(fb.id);
    vi.useRealTimers();
  });

  it("a batch where a member's `ok` is false rejects just that RPC", async () => {
    const { client, socket } = makeConnectedClient();
    const a = client.rpc("a", []);
    const b = client.rpc("b", []);
    const fa = socket.sentJson().find((f) => f.rpc === "a")!;
    const fb = socket.sentJson().find((f) => f.rpc === "b")!;

    socket.receiveJson({
      channel: "__rpc",
      event: "__batch",
      data: { ok: true, batch: [
        { id: fa.id, ok: false, code: "DENIED", error: "nope" },
        { id: fb.id, ok: true, data: "B" },
      ] },
    });
    const errA = await a.then(
      () => null,
      (e: unknown) => e,
    );
    expect((errA as RpcError).code).toBe("DENIED");
    expect(await b).toBe("B");
  });
});

describe("timeouts", () => {
  it("a default timeout rejects with TIMEOUT after 30s", async () => {
    vi.useFakeTimers();
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("never", []);
    const errPromise = p.then(
      () => null,
      (e: unknown) => e,
    );
    vi.advanceTimersByTime(30_000);
    const err = await errPromise;
    expect((err as RpcError).code).toBe("TIMEOUT");
    expect((err as RpcError).message).toContain("30s");
    vi.useRealTimers();
  });

  it("a custom timeout is honored", async () => {
    vi.useFakeTimers();
    const { client, socket } = makeConnectedClient();
    const p = client.rpc("never", [], { timeout: 1500 });
    const errPromise = p.then(
      () => null,
      (e: unknown) => e,
    );
    vi.advanceTimersByTime(1499);
    let settled = false;
    p.then(
      () => (settled = true),
      () => (settled = true),
    );
    vi.advanceTimersByTime(1);
    await errPromise;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("a reply that arrives just before the timeout wins (no double-settle)", async () => {
    vi.useFakeTimers();
    const { client, socket } = makeConnectedClient();
    let count = 0;
    const p = client.rpc("races", [], { timeout: 5000 });
    p.then(() => count++, () => count++);
    const frame = socket.sentJson().find((f) => f.rpc === "races")!;

    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "ok" } });
    vi.advanceTimersByTime(5_000);
    await p;
    expect(count).toBe(1);
    vi.useRealTimers();
  });

  it("a reply that arrives AFTER the timeout is ignored (no double-settle)", async () => {
    vi.useFakeTimers();
    const { client, socket } = makeConnectedClient();
    let count = 0;
    const p = client.rpc("late", [], { timeout: 1000 });
    p.then(() => count++, () => count++);
    const frame = socket.sentJson().find((f) => f.rpc === "late")!;

    const errPromise = p.then(
      () => null,
      (e: unknown) => e,
    );
    vi.advanceTimersByTime(1_000);
    const err = await errPromise;
    expect((err as RpcError).code).toBe("TIMEOUT");

    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "too-late" } });
    expect(count).toBe(1);
    vi.useRealTimers();
  });
});

describe("pre-auth reliable send queue", () => {
  it("RPCs issued before auth are queued and flushed after auth", async () => {
    const { factory, sockets } = makeFactory();
    const client = new RealtimeClient("ws://x", "t", "d", factory);
    client.onChange = () => {};
    client.connect();
    const socket = sockets[0];

    const p1 = client.rpc("a", [1]);
    const p2 = client.rpc("b", [2]);
    expect(socket.sent).toHaveLength(0); // nothing sent pre-auth

    socket.open();
    acceptAuth(socket);
    // Auth frame first, then the queued RPCs, in FIFO order.
    const frames = socket.sentJson();
    expect(frames[0].type).toBe("auth");
    expect(frames.slice(1).map((f) => f.rpc)).toEqual(["a", "b"]);

    socket.receiveJson({ channel: "__rpc", event: frames[1].id, data: { ok: true, data: "A" } });
    socket.receiveJson({ channel: "__rpc", event: frames[2].id, data: { ok: true, data: "B" } });
    expect(await p1).toBe("A");
    expect(await p2).toBe("B");
  });

  it("when the queue overflows, the OLDEST frame is dropped (newest wins)", async () => {
    vi.useFakeTimers();
    const { factory, sockets } = makeFactory();
    const client = new RealtimeClient("ws://x", "t", "d", factory);
    client.onChange = () => {};
    client.connect();
    const socket = sockets[0];

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 1024 + 50; i++) {
      promises.push(client.rpc(`op${i}`, []).catch(() => null));
    }
    socket.open();
    acceptAuth(socket);
    const frames = socket.sentJson().filter((f) => f.type !== "auth");
    expect(frames).toHaveLength(1024);
    // First (oldest) queued op was evicted.
    expect(frames.some((f) => f.rpc === "op0")).toBe(false);
    expect(frames.some((f) => f.rpc === "op1023")).toBe(true);
    vi.useRealTimers();
  });

  it("a drop while queued clears the queue and rejects in-flight RPCs", async () => {
    vi.useFakeTimers();
    const { factory, sockets } = makeFactory();
    const client = new RealtimeClient("ws://x", "t", "d", factory);
    client.onChange = () => {};
    client.connect();
    const socket = sockets[0];
    socket.open(); // open but auth not yet accepted
    const p = client.rpc("op", []);
    expect(socket.sent).toHaveLength(1); // auth frame only

    socket.drop();
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("DISCONNECTED");

    // Reconnect: the stale queued frame must NOT be replayed.
    vi.advanceTimersByTime(100);
    const socket2 = sockets[1];
    socket2.open();
    acceptAuth(socket2);
    expect(socket2.sentJson().filter((f) => f.type !== "auth")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("close() while frames are queued drops them and rejects with CONNECTION_CLOSED", async () => {
    const { factory, sockets } = makeFactory();
    const client = new RealtimeClient("ws://x", "t", "d", factory);
    client.onChange = () => {};
    client.connect();
    const socket = sockets[0];

    const p = client.rpc("op", []);
    client.close();
    expect(socket.sent).toHaveLength(0);

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("CONNECTION_CLOSED");
  });

  it("frames queued after auth but before open are flushed on open", async () => {
    const { factory, sockets } = makeFactory();
    const client = new RealtimeClient("ws://x", "t", "d", factory);
    client.onChange = () => {};
    client.connect();
    const socket = sockets[0];

    // Auth accepted while the socket is still open...
    socket.open();
    socket.receiveJson({ channel: "__auth", data: { ok: true } });
    expect(client.connected).toBe(true);

    // ...a later RPC goes straight out (no queue), but queue path still works.
    const p = client.rpc("op", []);
    const frame = socket.sentJson().find((f) => f.rpc === "op")!;
    socket.receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "ok" } });
    expect(await p).toBe("ok");
  });
});
