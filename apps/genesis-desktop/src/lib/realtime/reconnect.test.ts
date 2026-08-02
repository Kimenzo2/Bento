// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial reconnect tests: drops, backoff growth, reset-on-success,
// reconnect storms, close-before-open, and mid-flight rejections. Everything
// runs under fake timers so the jittered exponential backoff is deterministic.

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

describe("disconnect handling", () => {
  it("a drop while open flips to reconnecting and rejects in-flight RPCs", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);
    const p = client.rpc("slow", []);

    sockets[0].drop();
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("DISCONNECTED");
    expect(client.status).toBe("reconnecting");
    expect(seen).toContain("reconnecting");
    vi.useRealTimers();
  });

  it("a drop before ever reaching open is treated as closed, then reconnects", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);

    client.connect();
    sockets[0].drop(); // never opened
    expect(seen[seen.length - 1]).toBe("closed");

    advanceUntil(sockets, 2, 1_000);
    expect(sockets).toHaveLength(2);
    expect(client.status).toBe("connecting");
    vi.useRealTimers();
  });

  it("the first reconnect is fast (≤100ms)", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    sockets[0].drop();
    const gap = advanceUntil(sockets, 2, 5_000);
    expect(gap).toBeLessThanOrEqual(200);
    vi.useRealTimers();
  });

  it("reconnect delays grow exponentially after failures", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    // The clone keeps the FIRST TWO retries fast (attempts 0 and 1), then
    // switches to exponential backoff from the third retry onward.
    const gaps: number[] = [];
    for (let i = 1; i <= 4; i++) {
      sockets[i - 1].drop();
      gaps.push(advanceUntil(sockets, i + 1, 20_000));
      sockets[i].open(); // open but never authenticate → keeps failing
    }

    expect(gaps[0]).toBeLessThanOrEqual(200); // retry 1: 20–100ms
    expect(gaps[1]).toBeLessThanOrEqual(200); // retry 2: still fast
    expect(gaps[2]).toBeGreaterThan(700); // retry 3: base 1000ms → 750–1250ms
    expect(gaps[2]).toBeLessThan(1400);
    expect(gaps[3]).toBeGreaterThan(1600); // retry 4: base 2200ms → 1650–2750ms
    expect(gaps[3]).toBeLessThan(2900);
    vi.useRealTimers();
  });

  it("the backoff caps near 300s even under endless failure", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    // Fail repeatedly to drive `reconnectAttempts` high.
    for (let i = 1; i <= 12; i++) {
      sockets[i - 1].drop();
      advanceUntil(sockets, i + 1, 400_000);
      sockets[i].open();
    }

    // Drop once more: the attempt delay must be capped at a 300s base
    // (jittered 0.75–1.25×, i.e. 225–375s) — far above the early exponential
    // growth, proving the cap engages.
    sockets[sockets.length - 1].drop();
    const gap = advanceUntil(sockets, sockets.length + 1, 400_000);
    expect(gap).toBeGreaterThanOrEqual(225_000);
    expect(gap).toBeLessThanOrEqual(376_000);
    vi.useRealTimers();
  });

  it("reconnectAttempts reset to 0 after a successful auth", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    // Fail once, then succeed.
    sockets[0].drop();
    advanceUntil(sockets, 2, 5_000);
    openAndAuth(sockets[1]);
    expect(client.connected).toBe(true);

    // Drop again: should be the fast path again (attempts were reset).
    sockets[1].drop();
    const gap = advanceUntil(sockets, 3, 5_000);
    expect(gap).toBeLessThanOrEqual(200);
    vi.useRealTimers();
  });

  it("a reconnect storm (multiple drops) collapses into a single retry", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    sockets[0].drop();
    sockets[0].drop(); // duplicate while a timer is already pending
    sockets[0].drop();
    advanceUntil(sockets, 2, 5_000);
    expect(sockets).toHaveLength(2); // exactly one retry scheduled
    vi.useRealTimers();
  });

  it("close() cancels a pending reconnect even if scheduled", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    sockets[0].drop(); // schedules a reconnect
    client.close();
    vi.advanceTimersByTime(1_000_000);
    expect(sockets).toHaveLength(1); // reconnect never fired
    expect(client.status).toBe("closed");
    vi.useRealTimers();
  });

  it("a drop after close() does not schedule another reconnect", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    client.close();
    sockets[0].drop(); // stale onclose after close
    vi.advanceTimersByTime(1_000_000);
    expect(sockets).toHaveLength(1);
    expect(client.status).toBe("closed");
    vi.useRealTimers();
  });

  it("status transitions across a full reconnect cycle are sane", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    const seen: RealtimeStatus[] = [];
    client.onChange = (s) => seen.push(s);

    client.connect();
    openAndAuth(sockets[0]);
    sockets[0].drop();
    advanceUntil(sockets, 2, 5_000);
    openAndAuth(sockets[1]);

    expect(seen).toContain("connecting");
    expect(seen).toContain("authenticating");
    expect(seen).toContain("open");
    expect(seen).toContain("reconnecting");
    expect(seen[seen.length - 1]).toBe("open");
    expect(client.connected).toBe(true);
    vi.useRealTimers();
  });

  it("pending RPCs issued across reconnect settle correctly", async () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    openAndAuth(sockets[0]);

    const before = client.rpc("before", []);
    sockets[0].drop();
    const err = await before.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as RpcError).code).toBe("DISCONNECTED");

    advanceUntil(sockets, 2, 5_000);
    openAndAuth(sockets[1]);
    const after = client.rpc("after", []);
    const frame = sockets[1].sentJson().find((f) => f.rpc === "after")!;
    sockets[1].receiveJson({ channel: "__rpc", event: frame.id, data: { ok: true, data: "ok" } });
    expect(await after).toBe("ok");
    vi.useRealTimers();
  });
});
