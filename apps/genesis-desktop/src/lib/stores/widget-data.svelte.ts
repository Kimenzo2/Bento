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
  if (!tasks) return;
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
  if (!stats) return;
  const streak = stats.topStreak;
  const done = stats.completedToday;
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
  if (!dash) return;
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
  if (!entries) return;
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
  if (!overview) return;
  const remaining = overview.totalIncome - overview.totalExpenses;
  const pct =
    overview.totalIncome > 0
      ? Math.round((overview.totalExpenses / overview.totalIncome) * 100)
      : 0;
  liveWidgets["budget"] = {
    layout: "progress",
    primary: `$${remaining.toFixed(0)}`,
    secondary: "remaining",
    progress: Math.min(pct, 100),
    width: "md",
  };
  loaded["budget"] = true;
}

async function loadHealthWidget() {
  const today = await tryInvoke<{ energy: number; mood: string }>("health_log_today");
  if (!today) return;
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
  if (!last) return;
  const score = last.qualityScore ?? Math.round((last.durationMin / 480) * 100);
  liveWidgets["sleep"] = {
    layout: "score",
    primary: String(Math.min(score, 100)),
    secondary: "last night",
    unit: "score",
    width: "sm",
  };
  loaded["sleep"] = true;
}

async function loadNutritionWidget() {
  const water = await tryInvoke<{ totalMl: number; goalMl: number; percentage: number }>(
    "nutrition_get_today_water",
  );
  if (!water) return;
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
  if (!today || today.length === 0) return;
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
  const goals = await tryInvoke<{ progress: number }[]>("goals_list");
  if (!goals) return;
  const total = goals.length;
  const met = goals.filter((g) => g.progress >= 100).length;
  const pct = total > 0 ? Math.round((met / total) * 100) : 0;
  liveWidgets["goals"] = {
    layout: "progress",
    primary: String(met),
    secondary: `of ${total} goals met`,
    unit: `/${total}`,
    progress: pct,
    width: "md",
  };
  loaded["goals"] = true;
}

async function loadPasswordsWidget() {
  const items = await tryInvoke<{ id: string }[]>("passwords_list");
  if (!items) return;
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
  if (!recordings) return;
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

async function loadRecipesWidget() {
  const recipes = await tryInvoke<{ id: string }[]>("recipes_list");
  if (!recipes) return;
  liveWidgets["recipes"] = {
    layout: "stat",
    primary: String(recipes.length),
    secondary: recipes.length === 1 ? "saved recipe" : "saved recipes",
    unit: "recipes",
    width: "sm",
  };
  loaded["recipes"] = true;
}

async function loadClipboardWidget() {
  const count = await tryInvoke<number>("clipboard_count");
  if (count === null) return;
  liveWidgets["clipboard"] = {
    layout: "stat",
    primary: String(count),
    secondary: count === 1 ? "item saved" : "items saved",
    unit: "items",
    width: "sm",
  };
  loaded["clipboard"] = true;
}

async function loadBreathingWidget() {
  // Breathing is session-based — show a simple action card
  liveWidgets["breathing"] = {
    layout: "action",
    primary: "Start 5 min",
    secondary: "Calm session",
    width: "sm",
  };
  loaded["breathing"] = true;
}

async function loadTimeWidget() {
  // Time tracker — check for active timers via local store or fallback
  liveWidgets["time"] = {
    layout: "timer",
    primary: "Start",
    secondary: "Track your time",
    width: "md",
  };
  loaded["time"] = true;
}

async function loadCountdownWidget() {
  const events = await tryInvoke<{ id: string }[]>("countdown_list_events");
  if (!events) return;
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
  if (!notes || notes.length === 0) return;
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
  recipes: loadRecipesWidget,
  clipboard: loadClipboardWidget,
  breathing: loadBreathingWidget,
  time: loadTimeWidget,
  countdown: loadCountdownWidget,
  notes: loadNotesWidget,
};

let initialized = false;

/**
 * Initialize all widget data loaders. Call this once on mount.
 * Each loader invokes its Tauri command and updates the reactive store.
 */
export function initWidgetData(): void {
  if (initialized) return;
  initialized = true;
  for (const [, loader] of Object.entries(ALL_LOADERS)) {
    loader().catch(() => {
      /* silent — falls back to hardcoded data */
    });
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
