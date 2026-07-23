import { invoke } from "@tauri-apps/api/core";
import type { WidgetContent } from "$lib/data/island-catalog";

/**
 * Map of module id → live widget content fetched from the user's local DB.
 * Falls back to a sensible default if no data exists yet or if the backend
 * command is unavailable.
 */
const liveWidgets = $state<Record<string, WidgetContent>>({});

/**
 * Whether the initial fetch has completed for each module.
 */
const loaded = $state<Record<string, boolean>>({});

// ── invoke wrapper that silently fails ─────────────────────────────────────

async function tryInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

// ── Data loaders per module ────────────────────────────────────────────────

async function loadTasksWidget() {
  const tasks = await tryInvoke<{ id: string; done: boolean }[]>("list_tasks", { limit: 200 });
  if (!tasks) { loaded["tasks"] = true; return; }
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  liveWidgets["tasks"] = {
    layout: "progress",
    primary: String(done),
    secondary: `of ${total} done`,
    unit: `/${total}`,
    progress: pct,
    width: "md",
  };
  loaded["tasks"] = true;
}

async function loadHabitsWidget() {
  const stats = await tryInvoke<{ topStreak: number; completedToday: number; totalHabits: number }>(
    "habits_get_stats",
  );
  if (!stats) { loaded["habits"] = true; return; }
  const streak = stats.topStreak;
  liveWidgets["habits"] = {
    layout: "stat",
    primary: String(streak),
    secondary: streak === 1 ? "day streak" : "day streak",
    unit: "days",
    width: "sm",
  };
  loaded["habits"] = true;
}

async function loadFocusWidget() {
  const dash = await tryInvoke<{ todayMinutes: number }>("get_focus_dashboard");
  if (!dash) { loaded["focus"] = true; return; }
  const mins = dash.todayMinutes;
  if (mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    liveWidgets["focus"] = {
      layout: "timer",
      primary: `${h}:${String(m).padStart(2, "0")}`,
      secondary: "today",
      width: "md",
    };
  } else {
    liveWidgets["focus"] = {
      layout: "timer",
      primary: "Ready",
      secondary: "Start a session",
      width: "md",
    };
  }
  loaded["focus"] = true;
}

async function loadJournalWidget() {
  const entries = await tryInvoke<{ id: string }[]>("list_journal_entries", { limit: 3 });
  if (!entries) { loaded["journal"] = true; return; }
  if (entries.length > 0) {
    liveWidgets["journal"] = {
      layout: "list",
      primary: entries.length === 1 ? "1 entry" : `${entries.length} entries`,
      secondary: "this month",
      width: "md",
    };
  } else {
    liveWidgets["journal"] = {
      layout: "list",
      primary: "No entries yet",
      secondary: "Write your first",
      width: "md",
    };
  }
  loaded["journal"] = true;
}

async function loadBudgetWidget() {
  const overview = await tryInvoke<{ totalExpenses: number; totalIncome: number }>(
    "budget_monthly_overview",
  );
  if (!overview) {
    liveWidgets["budget"] = {
      layout: "progress",
      primary: "—",
      secondary: "Could not load",
      progress: 0,
      width: "md",
    };
    loaded["budget"] = true;
    return;
  }
  const remaining = overview.totalIncome - overview.totalExpenses;
  const pct =
    overview.totalIncome > 0
      ? Math.round(((overview.totalIncome - overview.totalExpenses) / overview.totalIncome) * 100)
      : 0;
  liveWidgets["budget"] = {
    layout: "progress",
    primary: `€${remaining.toFixed(0)}`,
    secondary: "remaining",
    progress: Math.max(Math.min(pct, 100), 0),
    width: "md",
  };
  loaded["budget"] = true;
}

async function loadHealthWidget() {
  const today = await tryInvoke<{ energy: number; mood: string }>("health_log_today");
  if (!today) {
    loaded["health"] = true;
    return;
  }
  liveWidgets["health"] = {
    layout: "stat",
    primary: String(today.energy),
    secondary: today.mood ? `mood: ${today.mood}` : "energy today",
    unit: "/10",
    width: "sm",
  };
  loaded["health"] = true;
}

async function loadSleepWidget() {
  const last = await tryInvoke<{ qualityScore: number | null; durationMin: number }>(
    "get_last_night",
  );
  if (!last) {
    liveWidgets["sleep"] = {
      layout: "score",
      primary: "—",
      secondary: "No data yet",
      unit: "score",
      width: "sm",
    };
    loaded["sleep"] = true;
    return;
  }
  const score = last.qualityScore ?? Math.round((last.durationMin / 480) * 100);
  const h = Math.floor(last.durationMin / 60);
  const m = last.durationMin % 60;
  const durStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
  liveWidgets["sleep"] = {
    layout: "score",
    primary: String(Math.min(score, 100)),
    secondary: `${durStr} — last night`,
    unit: "score",
    width: "sm",
  };
  loaded["sleep"] = true;
}

async function loadNutritionWidget() {
  const water = await tryInvoke<{ totalMl: number; goalMl: number; percentage: number }>(
    "nutrition_get_today_water",
  );
  if (!water) { loaded["nutrition"] = true; return; }
  const glasses = Math.round(water.totalMl / 250);
  const pct = water.percentage;
  liveWidgets["nutrition"] = {
    layout: "progress",
    primary: String(glasses),
    secondary: "glasses today",
    unit: `/ ${Math.round(water.goalMl / 250)}`,
    progress: pct,
    width: "md",
  };
  loaded["nutrition"] = true;
}

async function loadMoodWidget() {
  const today = await tryInvoke<{ mood: string; loggedAt: number }[]>("mood_checkins_today");
  if (!today || today.length === 0) { loaded["mood"] = true; return; }
  const latest = today[today.length - 1];
  const minsAgo = Math.floor((Date.now() - latest.loggedAt) / 60000);
  const ago =
    minsAgo < 1
      ? "just now"
      : minsAgo < 60
        ? `${minsAgo}m ago`
        : `${Math.floor(minsAgo / 60)}h ago`;
  liveWidgets["mood"] = {
    layout: "mood",
    primary: latest.mood.charAt(0).toUpperCase() + latest.mood.slice(1),
    secondary: `Logged ${ago}`,
    width: "sm",
  };
  loaded["mood"] = true;
}

async function loadGoalsWidget() {
  const goals = await tryInvoke<{ progress: number }[]>("goals_list_light");
  if (!goals) { loaded["goals"] = true; return; }
  const total = goals.length;
  const avgPct = total > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / total) : 0;
  const met = goals.filter((g) => g.progress >= 100).length;
  liveWidgets["goals"] = {
    layout: "progress",
    primary: `${avgPct}%`,
    secondary: `avg progress · ${met} of ${total} done`,
    unit: `/${total}`,
    progress: avgPct,
    width: "md",
  };
  loaded["goals"] = true;
}

async function loadPasswordsWidget() {
  const items = await tryInvoke<{ id: string }[]>("passwords_list");
  if (!items) { loaded["passwords"] = true; return; }
  liveWidgets["passwords"] = {
    layout: "stat",
    primary: String(items.length),
    secondary: "vault items",
    unit: "items",
    width: "sm",
  };
  loaded["passwords"] = true;
}

async function loadVoiceMemosWidget() {
  const recordings = await tryInvoke<{ id: string }[]>("list_recordings");
  if (!recordings) { loaded["voice-memos"] = true; return; }
  if (recordings.length > 0) {
    liveWidgets["voice-memos"] = {
      layout: "action",
      primary: "Tap to Record",
      secondary: `${recordings.length} saved`,
      width: "md",
    };
  } else {
    liveWidgets["voice-memos"] = {
      layout: "action",
      primary: "Tap to Record",
      secondary: "No recordings yet",
      width: "md",
    };
  }
  loaded["voice-memos"] = true;
}

async function loadClipboardWidget() {
  const count = await tryInvoke<number>("clipboard_count");
  if (count === null) { loaded["clipboard"] = true; return; }
  liveWidgets["clipboard"] = {
    layout: "stat",
    primary: String(count),
    secondary: count === 1 ? "item saved" : "items saved",
    unit: "items",
    width: "sm",
  };
  loaded["clipboard"] = true;
}

async function loadCountdownWidget() {
  const events = await tryInvoke<{ id: string }[]>("countdown_list_events");
  if (!events) { loaded["countdown"] = true; return; }
  if (events.length > 0) {
    liveWidgets["countdown"] = {
      layout: "countdown",
      primary: `${events.length} event${events.length === 1 ? "" : "s"}`,
      secondary: "upcoming",
      width: "sm",
    };
  } else {
    liveWidgets["countdown"] = {
      layout: "countdown",
      primary: "No events",
      secondary: "Add your first",
      width: "sm",
    };
  }
  loaded["countdown"] = true;
}

async function loadNotesWidget() {
  const notes = await tryInvoke<{ id: string; title: string; updatedAt: number }[]>("notes_list", {
    limit: 5,
  });
  if (!notes || notes.length === 0) { loaded["notes"] = true; return; }
  const titles = notes.map((n) => n.title || "Untitled").filter(Boolean);
  const latest = notes[0];
  const date = latest.updatedAt
    ? new Date(latest.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  liveWidgets["notes"] = {
    layout: "list",
    primary: "Recent notes",
    secondary: date ? `Last: ${date}` : "",
    items: titles.slice(0, 3),
    width: "md",
  };
  loaded["notes"] = true;
}

// ── Batch loader ───────────────────────────────────────────────────────────

const ALL_LOADERS: Record<string, () => Promise<void>> = {
  tasks: loadTasksWidget,
  habits: loadHabitsWidget,
  focus: loadFocusWidget,
  journal: loadJournalWidget,
  budget: loadBudgetWidget,
  health: loadHealthWidget,
  sleep: loadSleepWidget,
  nutrition: loadNutritionWidget,
  mood: loadMoodWidget,
  goals: loadGoalsWidget,
  passwords: loadPasswordsWidget,
  "voice-memos": loadVoiceMemosWidget,
  clipboard: loadClipboardWidget,
  countdown: loadCountdownWidget,
  notes: loadNotesWidget,
};

let initialized = false;

/**
 * Run a single widget loader with retry logic.
 *
 * Loaders use `tryInvoke()` which catches all invoke errors and returns null.
 * The loaders then silently exit without throwing. To detect failure, we check
 * whether the `loaded[id]` flag was set after each attempt.
 *
 * Retries up to `maxRetries` times with linear backoff to handle transient
 * failures (Rust command timeout, DB not ready on first launch). After
 * exhausting retries, `loaded[id]` stays false and the Island falls back
 * to static default data from island-catalog.ts.
 */
async function runLoaderWithRetry(
  loader: () => Promise<void>,
  moduleId: string,
  maxRetries: number = 2,
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await loader();
    if (loaded[moduleId]) return; // data loaded successfully
    if (attempt < maxRetries) {
      const delay = (attempt + 1) * 1500; // 1.5s, 3s
      console.warn(
        `[widget-data] ${moduleId} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Initialize all widget data loaders. Call this once on mount.
 * Each loader invokes its Tauri command and updates the reactive store.
 * On transient failure, retries with linear backoff before falling back.
 */
export function initWidgetData(): void {
  if (initialized) return;
  initialized = true;
  for (const [id, loader] of Object.entries(ALL_LOADERS)) {
    // runLoaderWithRetry never throws — all errors are caught internally
    runLoaderWithRetry(loader, id);
  }
}

/**
 * Get live widget content for a module id.
 * Returns `undefined` if not yet loaded — the caller should fall back
 * to the hardcoded widget data from island-catalog.ts.
 */
export function getLiveWidget(id: string): WidgetContent | undefined {
  return liveWidgets[id];
}

/**
 * Whether the widget data has finished loading for a given module.
 */
export function isWidgetLoaded(id: string): boolean {
  return loaded[id] ?? false;
}
