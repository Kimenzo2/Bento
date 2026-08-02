// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Adversarial tests for the data-changed consumption bridge. Every scenario
// drives the bus with a fake Tauri `listen` and fake timers — exactly like a
// chatty Rust backend firing `bento://data-changed` after every DB write.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataChangedBus, type DataChangedPayload, type TauriListen } from "./data-changed";

function makeFakeListen(): { listen: TauriListen; calls: string[]; unlistenFns: (() => void)[]; handler: ((e: { payload: DataChangedPayload }) => void) | null } {
  const calls: string[] = [];
  const unlistenFns: (() => void)[] = [];
  let handler: ((e: { payload: DataChangedPayload }) => void) | null = null;
  const listen: TauriListen = ((event: string, h: any) => {
    calls.push(event);
    handler = h;
    const off = vi.fn();
    unlistenFns.push(off);
    return Promise.resolve(off);
  }) as TauriListen;
  return { listen, calls, unlistenFns, get handler() { return handler as any; } };
}

describe("init", () => {
  it("attaches one listener for bento://data-changed", async () => {
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    await bus.init();
    expect(fake.calls).toEqual(["bento://data-changed"]);
    expect(bus.isListening).toBe(true);
  });

  it("double init does NOT attach a second Tauri listener", async () => {
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    await bus.init();
    await bus.init();
    await bus.init();
    expect(fake.calls.filter((c) => c === "bento://data-changed")).toHaveLength(1);
    expect(bus.isListening).toBe(true);
  });

  it("returns a cleanup fn that unlistens", async () => {
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const cleanup = await bus.init();
    cleanup();
    expect(fake.unlistenFns[0]).toHaveBeenCalled();
    expect(bus.isListening).toBe(false);
  });

  it("cleanup cancels pending debounce timers (no late refreshes)", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 50 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle({ topic: "tasks/list" }); // schedules a timer
    bus.cleanup(); // must cancel it
    vi.advanceTimersByTime(100);
    expect(refresher).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("re-init after cleanup re-attaches the listener", async () => {
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const cleanup = await bus.init();
    cleanup();
    await bus.init();
    expect(fake.calls.filter((c) => c === "bento://data-changed")).toHaveLength(2);
  });

  it("init does NOT reject when the Tauri listener cannot attach (no-op cleanup)", async () => {
    const listen = (() => Promise.reject(new Error("not in tauri"))) as TauriListen;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = new DataChangedBus({ listen, debounceMs: 10 });
    const cleanup = await bus.init(); // must resolve, not reject
    expect(bus.isListening).toBe(false);
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
    // A later init can still succeed once the runtime is available.
    warnSpy.mockRestore();
  });
});

describe("topic routing", () => {
  it("an exact topic match runs the refresher", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(refresher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("a namespace wildcard (tasks/*) matches tasks/list", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const refresher = vi.fn();
    bus.register("tasks/*", refresher);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(refresher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("a wildcard matches deeper sub-topics but never other namespaces", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const tasks = vi.fn();
    bus.register("tasks/*", tasks);
    await bus.init();

    // Each distinct emitted topic gets its own debounce window, so advance the
    // timer between topics to count matches, not coalescing.
    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    bus.handle({ topic: "tasks/list/sub" }); // deeper sub-topic: matches
    vi.advanceTimersByTime(10);
    expect(tasks).toHaveBeenCalledTimes(2);

    bus.handle({ topic: "notes/list" }); // other namespace: no match
    vi.advanceTimersByTime(10);
    bus.handle({ topic: "tasks" }); // bare namespace, no trailing slash: no match
    vi.advanceTimersByTime(10);
    expect(tasks).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("an unrelated topic does NOT fire the refresher", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle({ topic: "notes/list" });
    vi.advanceTimersByTime(100);
    expect(refresher).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("a global catch-all (*) matches every topic", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const all = vi.fn();
    bus.register("*", all);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(all).toHaveBeenCalledTimes(1);

    bus.handle({ topic: "sleep/routine-status" });
    vi.advanceTimersByTime(10);
    expect(all).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("an unknown topic with no refresher is a safe no-op", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    bus.register("tasks/list", vi.fn());
    await bus.init();

    expect(() => bus.handle({ topic: "totally/unknown" })).not.toThrow();
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it("missing / malformed payloads are safe no-ops", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle(null);
    bus.handle(undefined);
    bus.handle({} as any);
    bus.handle({ topic: "" } as any);
    bus.handle({ topic: 42 } as any);
    vi.advanceTimersByTime(100);
    expect(refresher).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("debouncing", () => {
  it("coalesces a burst of N events into a single refresh", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 150 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    for (let i = 0; i < 20; i++) bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(149);
    expect(refresher).not.toHaveBeenCalled(); // still inside the window
    vi.advanceTimersByTime(1);
    expect(refresher).toHaveBeenCalledTimes(1); // exactly once, not 20
    vi.useRealTimers();
  });

  it("a second burst AFTER the window fires again", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 50 });
    const refresher = vi.fn();
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    await vi.advanceTimersByTimeAsync(50);
    expect(refresher).toHaveBeenCalledTimes(1);

    bus.handle({ topic: "tasks/list" });
    await vi.advanceTimersByTimeAsync(50);
    expect(refresher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("debounce windows are per-topic (tasks and notes refresh independently)", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 100 });
    const tasks = vi.fn();
    const notes = vi.fn();
    bus.register("tasks/list", tasks);
    bus.register("notes/list", notes);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    bus.handle({ topic: "notes/list" });
    bus.handle({ topic: "tasks/list" }); // bursts each topic independently
    vi.advanceTimersByTime(100);
    expect(tasks).toHaveBeenCalledTimes(1);
    expect(notes).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("registration lifecycle", () => {
  it("registering the same topic twice keeps BOTH refreshers (fan-out)", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const a = vi.fn();
    const b = vi.fn();
    bus.register("tasks/list", a);
    bus.register("tasks/list", b);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("unregisterRefresher stops future refreshes", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const a = vi.fn();
    const off = bus.register("tasks/list", a);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(a).toHaveBeenCalledTimes(1);

    off();
    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(a).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("unregistering the last refresher for a topic removes the topic entry", () => {
    const bus = new DataChangedBus({ debounceMs: 10 });
    const a = vi.fn();
    const off = bus.register("tasks/list", a);
    expect(bus.refresherCount).toBe(1);
    off();
    expect(bus.refresherCount).toBe(0);
  });

  it("a stale unregister closure does not wipe a re-registered topic", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    await bus.init();

    const a = vi.fn();
    const staleOff = bus.register("tasks/list", a);
    staleOff(); // empties and deletes the topic entry

    // Re-register a brand-new refresher for the same topic.
    const b = vi.fn();
    bus.register("tasks/list", b);

    // Calling the OLD closure must NOT remove topic "tasks/list" (which now
    // holds a different Set with "b").
    staleOff();
    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10);
    expect(b).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("resilience", () => {
  it("a throwing refresher does not break the listener or other refreshers", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const good = vi.fn();
    bus.register("tasks/list", () => {
      throw new Error("refresher bug");
    });
    bus.register("tasks/list", good);
    await bus.init();

    expect(() => bus.handle({ topic: "tasks/list" })).not.toThrow();
    vi.advanceTimersByTime(10);
    expect(good).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it("an async refresher is awaited (never left dangling) and rejections are swallowed", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order: string[] = [];
    bus.register("tasks/list", async () => {
      order.push("slow:start");
      await new Promise((r) => setTimeout(r, 20));
      order.push("slow:end");
    });
    bus.register("tasks/list", () => {
      order.push("fast");
    });
    bus.register("tasks/list", () => Promise.reject(new Error("boom")));
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10); // debounce fires
    await vi.runAllTimersAsync(); // let the awaited async refresher finish
    // All refreshers start synchronously in one batch (slow:start's sync prefix
    // first), then the async one completes after its await.
    expect(order).toEqual(["slow:start", "fast", "slow:end"]);
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("single-flight (takeLatest-with-trailing)", () => {
  it("events during an in-flight refresh do NOT start a parallel refresh", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const refresher = vi.fn(() => gate);
    bus.register("tasks/list", refresher);
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(10); // fire → refresher 1 starts and hangs on gate
    expect(refresher).toHaveBeenCalledTimes(1);

    // Burst while the first refresh is still in flight.
    for (let i = 0; i < 5; i++) bus.handle({ topic: "tasks/list" });
    vi.advanceTimersByTime(100);
    // No second refresh may start while the first is pending.
    expect(refresher).toHaveBeenCalledTimes(1);

    release();
    await vi.runAllTimersAsync();
    // Exactly ONE trailing refresh runs after the in-flight one settles.
    expect(refresher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not run refreshers at all for a topic nobody registered", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    await bus.init();
    bus.handle({ topic: "ghost/topic" });
    vi.advanceTimersByTime(100);
    expect(bus.getStats().refreshesRun).toBe(0);
    vi.useRealTimers();
  });
});

describe("observability", () => {
  it("counts handled events and coalesced bursts", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 50 });
    bus.register("tasks/list", vi.fn());
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    bus.handle({ topic: "tasks/list" });
    bus.handle({ topic: "tasks/list" });
    expect(bus.getStats().eventsHandled).toBe(3);
    expect(bus.getStats().burstsCoalesced).toBe(2); // two swallowed into the first

    vi.advanceTimersByTime(50);
    expect(bus.getStats().refreshesRun).toBe(1);
    expect(bus.getStats().refreshesFailed).toBe(0);
    vi.useRealTimers();
  });

  it("records refreshesFailed when a refresher rejects and logs a warning", async () => {
    vi.useFakeTimers();
    const fake = makeFakeListen();
    const bus = new DataChangedBus({ listen: fake.listen as any, debounceMs: 10 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    bus.register("tasks/list", () => Promise.reject(new Error("loadAll exploded")));
    await bus.init();

    bus.handle({ topic: "tasks/list" });
    await vi.advanceTimersByTimeAsync(10);
    expect(bus.getStats().refreshesFailed).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});
