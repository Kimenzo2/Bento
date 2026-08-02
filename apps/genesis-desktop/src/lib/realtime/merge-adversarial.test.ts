// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Adversarial merge-engine tests — round 2 (lives outside source files).
//
// The merge engine is the ONLY thing standing between a `hub.emit_change`
// frame (Rust) and a correct on-screen list (Svelte). These cases attack the
// exact shapes the realtime server can produce: partial-row `updated`
// payloads, payloads that drop the key field, `refreshed` rehydrations that
// race with live events, swap-delete ordering hazards, and index bookkeeping
// that must survive arbitrary event sequences.
//
// Every test pins the CURRENT engine behavior. If any assertion here fails,
// the engine drifted from the wire contract — a real bug, not a typo.
// ═══════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";

import { applyMerge, sanitizeRowData, type MergeResult } from "./protocol";

function makeIndex(): Map<any, number> {
  return new Map();
}

const CRUD = { merge: "crud", key: "id" } as const;
const CRUD_PREPEND = { merge: "crud", key: "id", prepend: true } as const;

/** Which field the engine uses to key a strategy (presence/cursor hardcode "key"). */
function keyFieldFor(opts: any): string | null {
  if (opts?.merge === "presence" || opts?.merge === "cursor") return "key";
  return opts?.key ?? null;
}

function seed(rows: any[], index: Map<any, number>, keyField: string | null): void {
  if (!Array.isArray(rows) || !keyField) return;
  rows.forEach((r, i) => index.set(r?.[keyField], i));
}

/**
 * Drive a full event sequence and return the final value, index, and the last
 * result flags. Handles non-array initial values and per-strategy key fields.
 */
function run(
  initial: any,
  events: Array<[string, any]>,
  opts: any = CRUD,
): { value: any; index: Map<any, number>; modified: boolean; replaced: boolean } {
  const index = makeIndex();
  const keyField = keyFieldFor(opts);
  if (Array.isArray(initial) && keyField) {
    initial.forEach((r, i) => index.set(r?.[keyField], i));
  }
  let value = initial;
  let modified = false;
  let replaced = false;
  for (const [event, data] of events) {
    const result = applyMerge(value, index, { event, data }, opts);
    value = result.value;
    modified = result.modified;
    replaced = result.replaced;
  }
  return { value, index, modified, replaced };
}

// ── Partial-row `updated` payloads (the #1 realtime hazard) ──────────────

describe("partial-row updated payloads", () => {
  it("updated with only {id, food} DROPS the fields the server omitted", () => {
    const index = makeIndex();
    const rows = [{ id: "m1", food: [], calories: 400, note: "lunch" }];
    seed(rows, index, "id");
    // nutrition_add_food_to_meal emits `{ id, food }` — the full row shape
    // must be preserved by the EMITTER, not the merge engine. If this row
    // shrinks, the UI loses calories/note. Pin it so the hazard is visible.
    const { value } = applyMerge(rows, index, {
      event: "updated",
      data: { id: "m1", food: [{ name: "rice", grams: 100 }] },
    }, CRUD);
    expect(value).toEqual([{ id: "m1", food: [{ name: "rice", grams: 100 }] }]);
  });

  it("created with a partial payload likewise lands as-is", () => {
    const { value } = run([], [["created", { id: "x", title: "only-title" }]]);
    expect(value).toEqual([{ id: "x", title: "only-title" }]);
  });

  it("updated payload WITHOUT the key field is a safe no-op", () => {
    const index = makeIndex();
    const rows = [{ id: 1, v: "a" }];
    seed(rows, index, "id");
    const { value, modified } = applyMerge(rows, index, {
      event: "updated",
      data: { title: "no id here" },
    }, CRUD);
    expect(value).toEqual([{ id: 1, v: "a" }]);
    expect(modified).toBe(false);
  });

  it("updated carrying a DIFFERENT key is a no-op (index lookup misses)", () => {
    const index = makeIndex();
    const rows = [{ id: "a", v: 1 }];
    seed(rows, index, "id");
    // `updated` looks up index.get(data[key]) — key "b" isn't indexed, so the
    // event is ignored. Payloads must never change the key field mid-flight.
    const { value, modified } = applyMerge(rows, index, {
      event: "updated",
      data: { id: "b", v: 2 },
    }, CRUD);
    expect(value).toEqual([{ id: "a", v: 1 }]);
    expect(modified).toBe(false);
  });
});

// ── Event-type vocabulary ────────────────────────────────────────────────

describe("event-type vocabulary", () => {
  it("an unknown event type on crud is a no-op (not a crash)", () => {
    const { value, modified } = run([{ id: 1 }], [["wat", { id: 2 }]]);
    expect(value).toEqual([{ id: 1 }]);
    expect(modified).toBe(false);
  });

  it("an unknown event type on latest still appends (latest ignores event)", () => {
    const { value } = run([1, 2], [["weird", 3]], { merge: "latest" });
    expect(value).toEqual([1, 2, 3]);
  });

  it("an unknown event type on set still replaces (set ignores event)", () => {
    const { value } = run([1, 2], [["whatever", { x: 1 }]], { merge: "set" });
    expect(value).toEqual({ x: 1 });
  });

  it("a crud event on a presence topic is a no-op", () => {
    const { value, modified } = run(
      [{ key: "p1" }],
      [["created", { key: "p2" }]],
      { merge: "presence" },
    );
    expect(value).toEqual([{ key: "p1" }]);
    expect(modified).toBe(false);
  });

  it("a crud event on a cursor topic is a no-op", () => {
    const { value, modified } = run(
      [{ key: "c1" }],
      [["created", { key: "c2" }]],
      { merge: "cursor" },
    );
    expect(value).toEqual([{ key: "c1" }]);
    expect(modified).toBe(false);
  });
});

// ── refreshed rehydration (reconnect baseline) ───────────────────────────

describe("refreshed rehydration", () => {
  it("refreshed with an EMPTY array clears the list and the index", () => {
    const index = makeIndex();
    const rows = [{ id: 1 }, { id: 2 }];
    seed(rows, index, "id");
    const { value, replaced } = applyMerge(rows, index, {
      event: "refreshed",
      data: [],
    }, CRUD);
    expect(value).toEqual([]);
    expect(replaced).toBe(true);
    expect(index.size).toBe(0);
  });

  it("refreshed rebuilds the index so a follow-up created lands correctly", () => {
    const { value } = run(
      [{ id: 1 }],
      [
        ["refreshed", [{ id: 9 }, { id: 8 }]],
        ["created", { id: 7 }],
      ],
    );
    expect(value).toEqual([{ id: 9 }, { id: 8 }, { id: 7 }]);
  });

  it("refreshed then deleted uses the NEW index, not stale positions", () => {
    const { value } = run(
      [{ id: 1 }, { id: 2 }],
      [
        ["refreshed", [{ id: 10 }, { id: 11 }, { id: 12 }]],
        ["deleted", { id: 11 }],
      ],
    );
    expect(value).toEqual([{ id: 10 }, { id: 12 }]);
  });

  it("a live created racing a refreshed (created lands, then refresh wins) is order-dependent", () => {
    // Simulates a mutation arriving while a reconnect rehydrates. Whichever
    // frame is applied last wins; the list must never duplicate the row.
    const a = run([], [
      ["created", { id: 1 }],
      ["refreshed", [{ id: 1 }]],
    ]);
    expect(a.value).toEqual([{ id: 1 }]);

    const b = run([], [
      ["refreshed", []],
      ["created", { id: 1 }],
    ]);
    expect(b.value).toEqual([{ id: 1 }]);
  });

  it("refreshed with a NON-ARRAY clears the index (rebuild clears first)", () => {
    const index = makeIndex();
    const rows = [{ id: 1 }, { id: 2 }];
    seed(rows, index, "id");
    const { value } = applyMerge(rows, index, {
      event: "refreshed",
      data: { totally: "not-an-array" },
    }, CRUD);
    expect(value).toEqual({ totally: "not-an-array" });
    // rebuildIndex() clears unconditionally, then only re-populates for arrays.
    expect(index.size).toBe(0);
  });

  it("refreshed with null replaces the value (server must never do this for lists)", () => {
    const { value, replaced } = run([{ id: 1 }], [["refreshed", null]]);
    expect(value).toBeNull();
    expect(replaced).toBe(true);
  });
});

// ── Index bookkeeping under swap-delete sequences ───────────────────────

describe("swap-delete ordering", () => {
  it("delete first, then delete the swapped element — no ghost rows", () => {
    const { value, index } = run(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      [
        ["deleted", { id: 1 }], // [4,2,3] (4 swapped into 0)
        ["deleted", { id: 4 }], // [3,2] (3 swapped into 0)
      ],
    );
    expect(value).toEqual([{ id: 3 }, { id: 2 }]);
    expect(index.size).toBe(2);
    expect(index.get(3)).toBe(0);
    expect(index.get(2)).toBe(1);
  });

  it("delete middle twice converges to a clean tail", () => {
    const { value } = run(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      [
        ["deleted", { id: 2 }], // [1,4,3]
        ["deleted", { id: 3 }], // [1,4]
      ],
    );
    expect(value).toEqual([{ id: 1 }, { id: 4 }]);
  });

  it("after swap-deletes, created appends at the tail with a fresh index", () => {
    const { value, index } = run(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [
        ["deleted", { id: 2 }], // [1,3]
        ["created", { id: 4 }], // [1,3,4]
      ],
    );
    expect(value).toEqual([{ id: 1 }, { id: 3 }, { id: 4 }]);
    expect(index.get(4)).toBe(2);
  });

  it("deleting a key that appears TWICE removes only the indexed slot", () => {
    const index = makeIndex();
    const rows = [{ id: "dup" }, { id: "other" }, { id: "dup" }];
    seed(rows, index, "id");
    // index maps "dup" → 2 (last occurrence wins during rebuild).
    const { value } = applyMerge(rows, index, {
      event: "deleted",
      data: { id: "dup" },
    }, CRUD);
    // idx(2) == last(2): no swap, just truncate → ['dup','other']
    expect(value).toEqual([{ id: "dup" }, { id: "other" }]);
    expect(index.has("dup")).toBe(false);
    expect(index.get("other")).toBe(1);
  });
});

// ── max eviction ─────────────────────────────────────────────────────────

describe("max eviction", () => {
  it("append evicts from the head, rebuilds the index", () => {
    const { value, index } = run(
      [{ id: 1 }, { id: 2 }],
      [["created", { id: 3 }]],
      { merge: "crud", key: "id", max: 2 },
    );
    expect(value).toEqual([{ id: 2 }, { id: 3 }]);
    expect(index.get(2)).toBe(0);
    expect(index.get(3)).toBe(1);
  });

  it("prepend evicts from the tail, keeps the renumbered index", () => {
    const { value, index } = run(
      [{ id: 1 }, { id: 2 }],
      [["created", { id: 3 }]],
      { merge: "crud", key: "id", prepend: true, max: 2 },
    );
    expect(value).toEqual([{ id: 3 }, { id: 1 }]);
    expect(index.get(3)).toBe(0);
    expect(index.get(1)).toBe(1);
    expect(index.has(2)).toBe(false);
  });

  it("created with an EXISTING key at max does NOT evict (update in place)", () => {
    const { value } = run(
      [{ id: 1 }, { id: 2 }],
      [["created", { id: 2, v: "new" }]],
      { merge: "crud", key: "id", max: 2 },
    );
    expect(value).toEqual([{ id: 1 }, { id: 2, v: "new" }]);
  });

  it("prepend created with an existing key updates in place, no reorder", () => {
    const { value } = run(
      [{ id: 1 }, { id: 2 }],
      [["created", { id: 2, v: "new" }]],
      CRUD_PREPEND,
    );
    expect(value).toEqual([{ id: 1 }, { id: 2, v: "new" }]);
  });

  it("max=0 is falsy in JS — treated as NO max (degenerate, pinned)", () => {
    const { value } = run([], [["created", { id: 1 }]], {
      merge: "crud",
      key: "id",
      max: 0,
    });
    expect(value).toEqual([{ id: 1 }]);
  });

  it("updated at max never triggers eviction", () => {
    const { value } = run(
      [{ id: 1 }, { id: 2 }],
      [["updated", { id: 1, v: 9 }]],
      { merge: "crud", key: "id", max: 2 },
    );
    expect(value).toEqual([{ id: 1, v: 9 }, { id: 2 }]);
  });
});

// ── Null / missing key defense ───────────────────────────────────────────

describe("key defense", () => {
  it("created with a null key field is INSERTED (null !== undefined)", () => {
    const { value, index } = run([], [["created", { id: null, v: 1 }]]);
    expect(value).toEqual([{ id: null, v: 1 }]);
    expect(index.has(null)).toBe(true);
  });

  it("created with a data payload of null is a no-op", () => {
    const { value, modified } = run([{ id: 1 }], [["created", null]]);
    expect(value).toEqual([{ id: 1 }]);
    expect(modified).toBe(false);
  });

  it("deleted with an empty object payload is a no-op", () => {
    const { value, modified } = run([{ id: 1 }], [["deleted", {}]]);
    expect(value).toEqual([{ id: 1 }]);
    expect(modified).toBe(false);
  });

  it("a garbage (non-array) current value is reset before a created", () => {
    const index = makeIndex();
    const { value } = applyMerge("garbage", index, {
      event: "created",
      data: { id: 1 },
    }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
    expect(index.get(1)).toBe(0);
  });

  it("a garbage current value with a payload missing the key stays empty", () => {
    const index = makeIndex();
    const { value, modified } = applyMerge("garbage", index, {
      event: "created",
      data: { not_id: 1 },
    }, CRUD);
    expect(value).toEqual([]);
    expect(modified).toBe(false);
  });
});

// ── presence / cursor deeper cases ───────────────────────────────────────

describe("presence / cursor depth", () => {
  it("presence join with a missing key field inserts an undefined-key row", () => {
    const { value, index } = run([], [["join", { x: 1 }]], { merge: "presence" });
    expect(value).toEqual([{ x: 1 }]);
    expect(index.has(undefined)).toBe(true);
  });

  it("presence join existing key updates in place, then leave removes it", () => {
    const { value, index } = run(
      [{ key: "a", n: 1 }],
      [
        ["join", { key: "a", n: 2 }],
        ["leave", { key: "a" }],
      ],
      { merge: "presence" },
    );
    expect(value).toEqual([]);
    expect(index.size).toBe(0);
  });

  it("presence set with a non-array payload replaces the value", () => {
    const { value, replaced } = run([{ key: "a" }], [["set", { key: "z" }]], {
      merge: "presence",
    });
    expect(value).toEqual({ key: "z" });
    expect(replaced).toBe(true);
  });

  it("cursor update adds, then remove swap-deletes", () => {
    const { value, index } = run(
      [],
      [
        ["update", { key: "c1", pos: 1 }],
        ["update", { key: "c2", pos: 2 }],
        ["remove", { key: "c1" }],
      ],
      { merge: "cursor" },
    );
    expect(value).toEqual([{ key: "c2", pos: 2 }]);
    expect(index.get("c2")).toBe(0);
  });

  it("cursor set rebuilds the index for later removes", () => {
    const { value, index } = run(
      [{ key: "old" }],
      [
        ["set", [{ key: "n1" }, { key: "n2" }]],
        ["remove", { key: "n1" }],
      ],
      { merge: "cursor" },
    );
    expect(value).toEqual([{ key: "n2" }]);
    expect(index.get("n2")).toBe(0);
    expect(index.has("old")).toBe(false);
  });

  it("presence leave for an absent key leaves modified=false", () => {
    const { value, modified } = run([{ key: "a" }], [["leave", { key: "zz" }]], {
      merge: "presence",
    });
    expect(value).toEqual([{ key: "a" }]);
    expect(modified).toBe(false);
  });
});

// ── set / latest ─────────────────────────────────────────────────────────

describe("set / latest depth", () => {
  it("set treats refreshed exactly like any other replace", () => {
    const { value, replaced } = run("old", [["refreshed", { v: 2 }]], {
      merge: "set",
    });
    expect(value).toEqual({ v: 2 });
    expect(replaced).toBe(true);
  });

  it("set with the SAME object reference does not notify", () => {
    const index = makeIndex();
    const same = { a: 1 };
    const { modified, replaced } = applyMerge(same, index, { event: "x", data: same }, { merge: "set" });
    expect(modified).toBe(false);
    expect(replaced).toBe(true);
  });

  it("latest with a non-array current value is reset to [] then appended", () => {
    const { value } = run("not-array", [["event", 1]], { merge: "latest" });
    expect(value).toEqual([1]);
  });

  it("latest max eviction keeps the newest N across many events", () => {
    const events: Array<[string, number]> = [1, 2, 3, 4, 5].map((n) => ["evt", n]);
    const { value } = run([], events, { merge: "latest", max: 3 });
    expect(value).toEqual([3, 4, 5]);
  });

  it("latest refreshed replaces wholesale then pushes continue", () => {
    const { value } = run(
      [1, 2],
      [
        ["refreshed", [8, 9]],
        ["evt", 10],
      ],
      { merge: "latest", max: 3 },
    );
    expect(value).toEqual([8, 9, 10]);
  });

  it("an unknown merge strategy string behaves like set (fallthrough)", () => {
    const { value } = run([1, 2], [["evt", { replaced: true }]], {
      merge: "bogus",
    } as any);
    expect(value).toEqual({ replaced: true });
  });
});

// ── sanitize deeper ──────────────────────────────────────────────────────

describe("sanitize depth", () => {
  it("strips prototype keys inside nested rows of a payload", () => {
    const out = sanitizeRowData({
      id: 1,
      children: [{ id: 2, "__proto__": { evil: true } }],
      meta: { "constructor": 1, ok: true },
    });
    expect(out).toEqual({ id: 1, children: [{ id: 2 }], meta: { ok: true } });
  });

  it("sanitize leaves primitives and null untouched", () => {
    expect(sanitizeRowData(42)).toBe(42);
    expect(sanitizeRowData("x")).toBe("x");
    expect(sanitizeRowData(null)).toBeNull();
    expect(sanitizeRowData(undefined)).toBeUndefined();
  });

  it("sanitize does NOT mutate the input object", () => {
    // Build via JSON.parse so "__proto__" is a REAL own property (an object
    // literal would set the prototype instead of creating the key).
    const input: any = JSON.parse('{"id":1,"__proto__":{"evil":true}}');
    sanitizeRowData(input);
    expect(Object.prototype.hasOwnProperty.call(input, "__proto__")).toBe(true);
  });

  it("crud merge sanitizes a created payload before storing it", () => {
    const index = makeIndex();
    const { value } = applyMerge([], index, {
      event: "created",
      data: { id: 1, "__proto__": { x: 1 } },
    }, CRUD);
    expect(value).toEqual([{ id: 1 }]);
  });

  it("crud merge sanitizes an updated payload before replacing the row", () => {
    const index = makeIndex();
    const rows = [{ id: 1, v: "a" }];
    seed(rows, index, "id");
    const { value } = applyMerge(rows, index, {
      event: "updated",
      data: { id: 1, "constructor": 99, v: "b" },
    }, CRUD);
    expect(value).toEqual([{ id: 1, v: "b" }]);
  });
});

// ── Result flags ─────────────────────────────────────────────────────────

describe("result flags", () => {
  function flags(rows: any[], event: string, data: any, opts: any = CRUD): MergeResult {
    const index = makeIndex();
    seed(rows, index, "id");
    return applyMerge(rows, index, { event, data }, opts);
  }

  it("created reports modified=true, replaced=false", () => {
    const r = flags([], "created", { id: 1 });
    expect(r.modified).toBe(true);
    expect(r.replaced).toBe(false);
  });

  it("updated reports modified=true only when the key exists", () => {
    expect(flags([{ id: 1 }], "updated", { id: 1, v: 2 }).modified).toBe(true);
    expect(flags([{ id: 1 }], "updated", { id: 99 }).modified).toBe(false);
  });

  it("deleted reports modified=true only when the key exists", () => {
    expect(flags([{ id: 1 }], "deleted", { id: 1 }).modified).toBe(true);
    expect(flags([{ id: 1 }], "deleted", { id: 99 }).modified).toBe(false);
  });

  it("refreshed always reports replaced=true + modified=true", () => {
    const r = flags([{ id: 1 }], "refreshed", [{ id: 2 }]);
    expect(r.replaced).toBe(true);
    expect(r.modified).toBe(true);
  });

  it("latest refresh reports replaced=true when it slices", () => {
    const index = makeIndex();
    const value = [1, 2, 3, 4, 5];
    const { replaced } = applyMerge(value, index, { event: "evt", data: 6 }, { merge: "latest", max: 3 });
    expect(replaced).toBe(true);
  });

  it("unknown-event no-op reports modified=false across all strategies", () => {
    expect(flags([{ id: 1 }], "bogus", { id: 2 }).modified).toBe(false);
    expect(flags([{ key: "a" }], "bogus", { key: "b" }, { merge: "presence" }).modified).toBe(false);
    expect(flags([{ key: "a" }], "bogus", { key: "b" }, { merge: "cursor" }).modified).toBe(false);
  });
});

// ── Stress: long random-ish sequences must never corrupt the index ───────

describe("index integrity stress", () => {
  it("interleaved create/update/delete/refresh keeps index == value positions", () => {
    const { value, index } = run(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        ["created", { id: "d" }],
        ["updated", { id: "b", v: 2 }],
        ["deleted", { id: "a" }],
        ["refreshed", [{ id: "x" }, { id: "y" }, { id: "z" }]],
        ["deleted", { id: "y" }],
        ["created", { id: "w" }],
        ["updated", { id: "z", v: 9 }],
      ],
    );
    expect(value).toEqual([{ id: "x" }, { id: "z", v: 9 }, { id: "w" }]);
    // The index must agree with actual positions for every surviving row.
    value.forEach((row: any, i: number) => {
      expect(index.get(row.id)).toBe(i);
    });
    expect(index.size).toBe(value.length);
  });

  it("a double created for the same key does not duplicate the row", () => {
    const { value } = run(
      [],
      [
        ["created", { id: 1, v: "first" }],
        ["created", { id: 1, v: "second" }],
      ],
    );
    expect(value).toEqual([{ id: 1, v: "second" }]);
  });

  it("create/delete/create for the same key settles on a single fresh row", () => {
    const { value } = run(
      [],
      [
        ["created", { id: 1, gen: 1 }],
        ["deleted", { id: 1 }],
        ["created", { id: 1, gen: 2 }],
      ],
    );
    expect(value).toEqual([{ id: 1, gen: 2 }]);
  });

  it("prepend sequences renumber correctly through many inserts", () => {
    const events: Array<[string, any]> = [
      ["created", { id: 3 }],
      ["created", { id: 2 }],
      ["created", { id: 1 }],
    ];
    const { value, index } = run([], events, CRUD_PREPEND);
    expect(value).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(index.get(1)).toBe(0);
    expect(index.get(2)).toBe(1);
    expect(index.get(3)).toBe(2);
  });
});
