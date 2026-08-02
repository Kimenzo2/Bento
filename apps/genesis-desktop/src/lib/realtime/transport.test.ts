// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial transport tests: connection lifecycle, auth handshake, and the
// inbound frame router. Each scenario deliberately breaks something — bad
// frames, spoofed channels, stale sockets, hostile auth — to verify the client
// fails gracefully (never throws, never leaks pending promises).

import { describe, expect, it, vi } from "vitest";

import { RealtimeClient, type RealtimeStatus } from "./client";
import { RpcError } from "./protocol";
import { acceptAuth, FakeSocket, makeFactory } from "./test-utils";

function makeClient(opts?: { onStatus?: (s: RealtimeStatus) => void }): {
  client: RealtimeClient;
  sockets: FakeSocket[];
} {
  const { factory, sockets } = makeFactory();
  const client = new RealtimeClient("ws://test.local:9000", "token-1", "dev-1", factory);
  client.onChange = opts?.onStatus ?? (() => {});
  return { client, sockets };
}

function openAndAuth(socket: FakeSocket): void {
  socket.open();
  acceptAuth(socket);
}

describe("connection lifecycle", () => {
  it("connect() opens a socket at the url and drives connecting → authenticating → open", () => {
    const { client, sockets } = makeClient();
    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);

    client.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe("ws://test.local:9000");
    expect(seen).toEqual(["connecting"]);

    sockets[0].open();
    expect(seen).toEqual(["connecting", "authenticating"]);
    expect(sockets[0].sentJson()[0]).toEqual({
      type: "auth",
      accessToken: "token-1",
      deviceId: "dev-1",
    });

    sockets[0].receiveJson({ channel: "__auth", data: { ok: true } });
    expect(seen).toEqual(["connecting", "authenticating", "open"]);
    expect(client.connected).toBe(true);
  });

  it("a native-style constructor factory (requires `new`) is invoked correctly", () => {
    const sockets: FakeSocket[] = [];
    // Simulate the browser WebSocket being a class that throws when called
    // without `new`.
    class NativeWebSocket extends FakeSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    }
    const client = new RealtimeClient("ws://test.local:9000", "t", "d", NativeWebSocket as any);
    client.onChange = () => {};
    client.connect();
    expect(sockets).toHaveLength(1);
    openAndAuth(sockets[0]);
    expect(client.connected).toBe(true);
  });

  it("factory returning an unusable object schedules a retry instead of throwing", () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    let calls = 0;
    const client = new RealtimeClient("ws://test.local:9000", "t", "d", (url) => {
      calls++;
      if (calls === 1) return {} as any;
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    });
    client.onChange = () => {};
    client.connect();
    expect(calls).toBe(1);
    expect(sockets).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(calls).toBeGreaterThan(1);
    expect(sockets).toHaveLength(1);
    openAndAuth(sockets[0]);
    expect(client.connected).toBe(true);
    vi.useRealTimers();
  });

  it("factory that throws on construction schedules a retry", () => {
    vi.useFakeTimers();
    let calls = 0;
    const client = new RealtimeClient("ws://x", "t", "d", () => {
      calls++;
      throw new Error("network down");
    });
    client.onChange = () => {};
    client.connect();
    expect(calls).toBe(1);
    vi.advanceTimersByTime(100);
    expect(calls).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("connected is false before auth completes even with an open socket", () => {
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0].open();
    expect(client.connected).toBe(false);
  });

  it("close() marks closed, closes the socket, and never reconnects", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    expect(client.connected).toBe(true);

    client.close();
    expect(sockets[0].closed).toBe(true);
    expect(client.status).toBe("closed");
    expect(client.connected).toBe(false);
    vi.advanceTimersByTime(1_000_000);
    expect(sockets).toHaveLength(1); // no new socket ever created
    vi.useRealTimers();
  });

  it("close() before any connect is a safe no-op", () => {
    const { client } = makeClient();
    expect(() => client.close()).not.toThrow();
    expect(client.status).toBe("closed");
  });

  it("double close() is safe", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    client.close();
    expect(() => client.close()).not.toThrow();
    expect(client.status).toBe("closed");
  });

  it("connect() after close() opens a fresh socket", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    client.close();
    client.connect();
    expect(sockets).toHaveLength(2);
    openAndAuth(sockets[1]);
    expect(client.connected).toBe(true);
  });
});

describe("auth handshake", () => {
  it("auth denied sets failed status and closes the socket", () => {
    const { client, sockets } = makeClient();
    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);

    client.connect();
    sockets[0].open();
    sockets[0].receiveJson({ channel: "__auth", data: { ok: false, code: "FORBIDDEN", error: "no access" } });

    expect(seen).toContain("failed");
    expect(sockets[0].closed).toBe(true);
  });

  it("auth denied rejects in-flight RPCs with the server code", async () => {
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0].open();
    const rpc = client.rpc("tasks/get", [{ id: 1 }]);
    sockets[0].receiveJson({ channel: "__auth", data: { ok: false, code: "FORBIDDEN", error: "no access" } });

    const err = await rpc.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).code).toBe("FORBIDDEN");
    expect((err as RpcError).message).toBe("no access");
  });

  it("an empty auth reply is ignored (no crash, no state change)", () => {
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0].open();
    sockets[0].receiveJson({ channel: "__auth", data: undefined });
    expect(client.status).toBe("authenticating");
  });

  it("an auth ok with a non-object payload is treated as a denial (defensive)", () => {
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0].open();
    sockets[0].receiveJson({ channel: "__auth", data: "garbage" });
    expect(client.status).toBe("failed");
    expect(sockets[0].closed).toBe(true);
  });
});

describe("inbound frame router", () => {
  it("binary / non-string frames are ignored", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    expect(() => sockets[0].receive("\u0000\u0001\u0002binary\u0000")).not.toThrow();
    expect(client.status).toBe("open");
  });

  it("malformed JSON is ignored without throwing", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    expect(() => sockets[0].receive("{not json")).not.toThrow();
    expect(() => sockets[0].receive("[1,2")).not.toThrow();
  });

  it("valid JSON that is null / not an object is ignored", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson(null);
    sockets[0].receiveJson(42);
    sockets[0].receiveJson("str");
    expect(client.status).toBe("open");
  });

  it("a frame with no channel is ignored", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson({ event: "boom", data: { x: 1 } });
    expect(client.status).toBe("open");
  });

  it("a frame with a non-string channel (e.g. numeric) is ignored", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson({ channel: 123, event: "x", data: 1 });
    expect(client.status).toBe("open");
  });

  it("a topic frame with no listeners is ignored", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].receiveJson({ channel: "tasks/list", event: "created", data: { id: 1 } });
    expect(client.status).toBe("open");
  });

  it("a listener that throws does not break the router or other listeners", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    const received: unknown[] = [];
    client.on("tasks/list", () => {
      throw new Error("listener bug");
    });
    client.on("tasks/list", (e) => received.push(e.data));

    sockets[0].receiveJson({ channel: "tasks/list", event: "created", data: { id: 1 } });
    expect(received).toEqual([{ id: 1 }]);
    expect(client.status).toBe("open");
  });

  it("unsubscribing mid-broadcast stops delivery to that listener only", () => {
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    const got: number[] = [];
    const offA = client.on("t", (e) => got.push((e.data as any).a));
    client.on("t", (e) => {
      offA();
      got.push((e.data as any).b);
    });

    sockets[0].receiveJson({ channel: "t", event: "created", data: { a: 1, b: 1 } });
    sockets[0].receiveJson({ channel: "t", event: "created", data: { a: 2, b: 2 } });
    // Second broadcast: listener A is gone, listener B still receives.
    expect(got).toEqual([1, 1, 2]);
  });

  it("a stale socket's late reply cannot settle a newer RPC (ids never collide)", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    // Old socket drops mid-flight; the pending RPC is rejected DISCONNECTED.
    const p1 = client.rpc("slow/op", []);
    const oldId = sockets[0].sentJson().find((f) => f.rpc === "slow/op")!.id;
    sockets[0].drop();
    const e1 = await p1.then(
      () => null,
      (e: unknown) => e,
    );
    expect((e1 as RpcError).code).toBe("DISCONNECTED");

    // Reconnect on a fresh socket and run a new RPC.
    vi.advanceTimersByTime(100);
    expect(sockets).toHaveLength(2);
    openAndAuth(sockets[1]);

    const p2 = client.rpc("fast/op", []);
    const newId = sockets[1].sentJson().find((f) => f.rpc === "fast/op")!.id;

    // A stale `__rpc` for the OLD id arrives after the reconnect.
    sockets[1].receiveJson({ channel: "__rpc", event: oldId, data: { ok: true, data: "STALE" } });
    // Then the real reply for the new id.
    sockets[1].receiveJson({ channel: "__rpc", event: newId, data: { ok: true, data: "FRESH" } });

    expect(await p2).toBe("FRESH");
    vi.useRealTimers();
  });
});
