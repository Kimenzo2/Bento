// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Test driver: a scriptable WebSocket that the RealtimeClient sees through the
// `WebSocketLike` seam. Lets adversarial tests drive open/auth/close/error and
// inject frames, out-of-band, exactly like a flaky native server would.

import type { WebSocketLike } from "./client";

export const WS_CONNECTING = 0;
export const WS_OPEN = 1;
export const WS_CLOSED = 3;

export class FakeSocket implements WebSocketLike {
  readonly url: string;
  readyState = WS_CONNECTING;
  sent: string[] = [];
  closed = false;

  onopen: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    // Mirrors the browser WebSocket: `close()` does NOT synchronously fire
    // `onclose` (that arrives async). Tests that want a disconnect call
    // `drop()` explicitly.
    this.closed = true;
    this.readyState = WS_CLOSED;
  }

  // ── test drivers ──────────────────────────────────────────────────────

  open(): void {
    this.readyState = WS_OPEN;
    this.onopen?.(null);
  }

  receive(raw: string): void {
    this.onmessage?.({ data: raw } as any);
  }

  receiveJson(msg: unknown): void {
    this.receive(JSON.stringify(msg));
  }

  sendError(): void {
    this.onerror?.(null);
  }

  drop(): void {
    this.onclose?.(null);
  }

  sentJson(): any[] {
    return this.sent.map((raw) => JSON.parse(raw));
  }
}

/** Factory that records every socket it hands out, in order. */
export function makeFactory(): { factory: (url: string) => FakeSocket; sockets: FakeSocket[] } {
  const sockets: FakeSocket[] = [];
  const factory = (url: string) => {
    const s = new FakeSocket(url);
    sockets.push(s);
    return s;
  };
  return { factory, sockets };
}

/**
 * Drive a successful auth handshake on `socket` (the client sends the auth
 * frame first; we reply `authenticated`).
 */
export function acceptAuth(socket: FakeSocket): void {
  const first = socket.sentJson()[0];
  if (first?.type !== "auth") {
    throw new Error("expected an auth frame as the first outbound message");
  }
  socket.receiveJson({ channel: "__auth", data: { ok: true } });
}
