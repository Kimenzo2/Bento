// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial tests for the realtime merge engine + id generation + row
// sanitization. These exercise every branch of `applyMerge`, including the
// "impossible" states (garbage current value, missing keys, swap-delete
// bookkeeping, max-eviction) that the clone's merge strategies must survive.

import { describe, expect, it } from "vitest";

import { applyMerge, nextId, RpcError, sanitizeRowData } from "./protocol";

function makeIndex(): Map<any, number> {
  return new Map();
}

const CRUD = { merge: "crud", key: "id" } as const;
const PRESENCE = { merge: "presence" } as const;
const CURSOR = { merge: "cursor" } as const;
const LATEST = { merge: "latest" } as const;
const SET = { merge: "set" } as const;

// ── CRUD ────────────────────────────────────────────────────────────────

describe("crud merge", () => {
  it("created into an empty array appends and indexes", () => {
    const index = makeIndex();
    const { value } = applyMerge([], index, { event: "created", data: { id: 1 } }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
    expect(index.get(1)).toBe(0);
  });

  it("created with an existing key updates in place instead of duplicating", () => {
    const index = makeIndex();
    const value = [{ id: 1, v: "a" }];
    index.set(1, 0);
    const { value: out } = applyMerge(value, index, { event: "created", data: { id: 1, v: "b" } }, CRUD);
    expect(out).toEqual([{ id: 1, v: "b" }]);
    expect(out).toHaveLength(1);
    expect(index.get(1)).toBe(0);
  });

  it("created with prepend unshifts and re-indexes existing rows", () => {
    const index = makeIndex();
    const value = [{ id: 2 }, { id: 3 }];
    index.set(2, 0);
    index.set(3, 1);
    const { value: out } = applyMerge(
      value,
      index,
      { event: "created", data: { id: 1 } },
      { merge: "crud", key: "id", prepend: true },
    );
    expect(out).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(index.get(1)).toBe(0);
    expect(index.get(2)).toBe(1);
    expect(index.get(3)).toBe(2);
  });

  it("created with prepend evicts from the HEAD when max is exceeded", () => {
    const index = makeIndex();
    const value = [{ id: 1 }, { id: 2 }];
    index.set(1, 0);
    index.set(2, 1);
    const { value: out } = applyMerge(
      value,
      index,
      { event: "created", data: { id: 3 } },
      { merge: "crud", key: "id", prepend: true, max: 2 },
    );
    expect(out).toEqual([{ id: 3 }, { id: 1 }]);
    expect(index.has(2)).toBe(false);
    expect(index.get(3)).toBe(0);
  });

  it("created evicts from the TAIL when max is exceeded (append path)", () => {
    const index = makeIndex();
    const value = [{ id: 1 }, { id: 2 }];
    index.set(1, 0);
    index.set(2, 1);
    const { value: out } = applyMerge(
      value,
      index,
      { event: "created", data: { id: 3 } },
      { merge: "crud", key: "id", max: 2 },
    );
    expect(out).toEqual([{ id: 2 }, { id: 3 }]);
    expect(index.has(1)).toBe(false);
    expect(index.get(2)).toBe(0);
    expect(index.get(3)).toBe(1);
  });

  it("updated replaces the row at the keyed index", () => {
    const index = makeIndex();
    const value = [{ id: 1, v: "a" }, { id: 2, v: "b" }];
    index.set(1, 0);
    index.set(2, 1);
    const { value: out } = applyMerge(value, index, { event: "updated", data: { id: 2, v: "B" } }, CRUD);
    expect(out).toEqual([{ id: 1, v: "a" }, { id: 2, v: "B" }]);
  });

  it("updated for a missing key is a no-op", () => {
    const index = makeIndex();
    const value = [{ id: 1 }];
    index.set(1, 0);
    const { value: out, modified } = applyMerge(value, index, { event: "updated", data: { id: 99 } }, CRUD);
    expect(out).toEqual([{ id: 1 }]);
    expect(index.size).toBe(1);
    expect(modified).toBe(false);
  });

  it("deleted swaps the LAST element into the gap (stable order bookkeeping)", () => {
    const index = makeIndex();
    const value = [{ id: 1 }, { id: 2 }, { id: 3 }];
    index.set(1, 0);
    index.set(2, 1);
    index.set(3, 2);
    const { value: out } = applyMerge(value, index, { event: "deleted", data: { id: 2 } }, CRUD);
    expect(out).toEqual([{ id: 1 }, { id: 3 }]);
    expect(index.get(3)).toBe(1);
    expect(index.has(2)).toBe(false);
  });

  it("deleted LAST element just truncates", () => {
    const index = makeIndex();
    const value = [{ id: 1 }, { id: 2 }];
    index.set(1, 0);
    index.set(2, 1);
    const { value: out } = applyMerge(value, index, { event: "deleted", data: { id: 2 } }, CRUD);
    expect(out).toEqual([{ id: 1 }]);
  });

  it("deleted only element leaves an empty array", () => {
    const index = makeIndex();
    const value = [{ id: 1 }];
    index.set(1, 0);
    const { value: out } = applyMerge(value, index, { event: "deleted", data: { id: 1 } }, CRUD);
    expect(out).toEqual([]);
  });

  it("deleted for a missing key is a no-op", () => {
    const index = makeIndex();
    const value = [{ id: 1 }];
    index.set(1, 0);
    const { modified } = applyMerge(value, index, { event: "deleted", data: { id: 404 } }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
    expect(modified).toBe(false);
  });

  it("refreshed replaces the whole value and rebuilds the index", () => {
    const index = makeIndex();
    const stale = [{ id: 1 }];
    index.set(1, 0);
    const fresh = [{ id: 9 }, { id: 8 }];
    const { value, replaced } = applyMerge(stale, index, { event: "refreshed", data: fresh }, CRUD);
    expect(value).toEqual(fresh);
    expect(replaced).toBe(true);
    expect(index.get(9)).toBe(0);
    expect(index.get(8)).toBe(1);
    expect(index.has(1)).toBe(false);
  });

  it("a non-array current value is reset to an array on created", () => {
    const index = makeIndex();
    const { value } = applyMerge("garbage" as any, index, { event: "created", data: { id: 1 } }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
    expect(index.get(1)).toBe(0);
  });

  it("data WITHOUT the key field is a no-op (defensive)", () => {
    const index = makeIndex();
    const value = [{ id: 1 }];
    index.set(1, 0);
    const { modified } = applyMerge(value, index, { event: "created", data: { not_id: 2 } }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
    expect(modified).toBe(false);
  });

  it("a missing key OPTION makes keyed events a no-op", () => {
    const index = makeIndex();
    const value: any[] = [];
    const { modified } = applyMerge(value, index, { event: "created", data: { id: 1 } }, { merge: "crud" });
    expect(value).toEqual([]);
    expect(modified).toBe(false);
  });
});

// ── latest ──────────────────────────────────────────────────────────────

describe("latest merge", () => {
  it("pushes data onto the tail", () => {
    const index = makeIndex();
    const { value } = applyMerge([1, 2], index, { event: "event", data: 3 }, LATEST);
    expect(value).toEqual([1, 2, 3]);
  });

  it("keeps only the newest `max` entries", () => {
    const index = makeIndex();
    const { value, replaced } = applyMerge([1, 2, 3, 4, 5], index, { event: "event", data: 6 }, { merge: "latest", max: 3 });
    expect(value).toEqual([4, 5, 6]);
    expect(replaced).toBe(true);
  });

  it("does NOT reset a non-array — it coerces to an array of one", () => {
    const index = makeIndex();
    const { value } = applyMerge("garbage" as any, index, { event: "event", data: 1 }, LATEST);
    expect(value).toEqual([1]);
  });

  it("refreshed replaces wholesale", () => {
    const index = makeIndex();
    const { value, modified } = applyMerge([1], index, { event: "refreshed", data: [7, 8] }, LATEST);
    expect(value).toEqual([7, 8]);
    expect(modified).toBe(true);
  });
});

// ── set ─────────────────────────────────────────────────────────────────

describe("set merge", () => {
  it("replaces the value entirely", () => {
    const index = makeIndex();
    const { value, replaced, modified } = applyMerge([1, 2], index, { event: "event", data: { a: 1 } }, SET);
    expect(value).toEqual({ a: 1 });
    expect(replaced).toBe(true);
    expect(modified).toBe(true);
  });

  it("identical primitive does not notify", () => {
    const index = makeIndex();
    const { modified, replaced } = applyMerge(5, index, { event: "event", data: 5 }, SET);
    expect(modified).toBe(false);
    expect(replaced).toBe(true);
  });

  it("identical object REFERENCE does not notify", () => {
    const index = makeIndex();
    const same = { a: 1 };
    const { modified } = applyMerge(same, index, { event: "event", data: same }, SET);
    expect(modified).toBe(false);
  });

  it("refreshed still sets the value", () => {
    const index = makeIndex();
    const { value } = applyMerge("old", index, { event: "refreshed", data: { v: 2 } }, SET);
    expect(value).toEqual({ v: 2 });
  });
});

// ── presence ────────────────────────────────────────────────────────────

describe("presence merge", () => {
  it("join adds and indexes by presence.key", () => {
    const index = makeIndex();
    const { value } = applyMerge([], index, { event: "join", data: { key: "a", x: 1 } }, PRESENCE);
    expect(value).toEqual([{ key: "a", x: 1 }]);
    expect(index.get("a")).toBe(0);
  });

  it("join with an existing key updates in place", () => {
    const index = makeIndex();
    const value = [{ key: "a", x: 1 }];
    index.set("a", 0);
    const { value: out } = applyMerge(value, index, { event: "join", data: { key: "a", x: 2 } }, PRESENCE);
    expect(out).toEqual([{ key: "a", x: 2 }]);
    expect(out).toHaveLength(1);
  });

  it("leave swap-deletes and fixes the swapped index", () => {
    const index = makeIndex();
    const value = [{ key: "a" }, { key: "b" }, { key: "c" }];
    index.set("a", 0);
    index.set("b", 1);
    index.set("c", 2);
    const { value: out } = applyMerge(value, index, { event: "leave", data: { key: "b" } }, PRESENCE);
    expect(out).toEqual([{ key: "a" }, { key: "c" }]);
    expect(index.get("c")).toBe(1);
    expect(index.has("b")).toBe(false);
  });

  it("set replaces all entries and rebuilds the index", () => {
    const index = makeIndex();
    const value = [{ key: "a" }];
    index.set("a", 0);
    const { value: out, replaced } = applyMerge(value, index, { event: "set", data: [{ key: "z" }] }, PRESENCE);
    expect(out).toEqual([{ key: "z" }]);
    expect(replaced).toBe(true);
    expect(index.get("z")).toBe(0);
    expect(index.has("a")).toBe(false);
  });

  it("presence 'leave' for an absent key is a no-op", () => {
    const index = makeIndex();
    const value = [{ key: "a" }];
    index.set("a", 0);
    const { modified } = applyMerge(value, index, { event: "leave", data: { key: "nope" } }, PRESENCE);
    expect(modified).toBe(false);
  });
});

// ── cursor ──────────────────────────────────────────────────────────────

describe("cursor merge", () => {
  it("update adds a cursor entry", () => {
    const index = makeIndex();
    const { value } = applyMerge([], index, { event: "update", data: { key: "c1", x: 1 } }, CURSOR);
    expect(value).toEqual([{ key: "c1", x: 1 }]);
  });

  it("remove deletes the cursor entry", () => {
    const index = makeIndex();
    const value = [{ key: "c1" }, { key: "c2" }];
    index.set("c1", 0);
    index.set("c2", 1);
    const { value: out } = applyMerge(value, index, { event: "remove", data: { key: "c1" } }, CURSOR);
    expect(out).toEqual([{ key: "c2" }]);
  });

  it("set replaces all cursors", () => {
    const index = makeIndex();
    const { value: out } = applyMerge([{ key: "old" }], index, { event: "set", data: [{ key: "new" }] }, CURSOR);
    expect(out).toEqual([{ key: "new" }]);
  });
});

// ── sanitize ────────────────────────────────────────────────────────────

describe("row sanitization (prototype-pollution defense)", () => {
  it("strips __proto__ / constructor / prototype at the top level", () => {
    const data = { id: 1, "__proto__": { hacked: true }, "constructor": 1, "prototype": 2 };
    const out = sanitizeRowData(data);
    expect(out).toEqual({ id: 1 });
    expect(Object.prototype.hasOwnProperty.call(out, "__proto__")).toBe(false);
  });

  it("recurses into nested objects and arrays", () => {
    const data = { rows: [{ id: 1, "__proto__": 1 }], meta: { "__proto__": 2 } };
    const out = sanitizeRowData(data);
    expect(out).toEqual({ rows: [{ id: 1 }], meta: {} });
  });

  it("crud merge sanitizes incoming row data", () => {
    const index = makeIndex();
    const { value } = applyMerge([], index, { event: "created", data: { id: 1, "__proto__": { x: 1 } } }, CRUD);
    expect(value[0]).toEqual({ id: 1 });
  });

  it("latest/set do NOT sanitize (matches clone semantics)", () => {
    const dirty = { "__proto__": 1 };
    expect(sanitizeRowData(dirty)).toEqual({});
  });

  it("sanitize is an identity for clean data (no allocation churn on nested arrays)", () => {
    const clean = [{ id: 1, tags: ["a", "b"] }];
    expect(sanitizeRowData(clean)).toEqual(clean);
  });
});

// ── ids ─────────────────────────────────────────────────────────────────

describe("correlation id generation", () => {
  it("id prefix is 4 lowercase base36 chars", () => {
    expect(nextId()).toMatch(/^[a-z0-9]{4}/);
  });

  it("ids are unique across a large burst", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const id = nextId();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("ids are strictly monotonic within a session", () => {
    const a = nextId();
    const b = nextId();
    const c = nextId();
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });
});

// ── RpcError ────────────────────────────────────────────────────────────

describe("RpcError", () => {
  it("carries code + message and is an Error", () => {
    const err = new RpcError("FORBIDDEN", "no");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("no");
    expect(err).toBeInstanceOf(Error);
  });
});
