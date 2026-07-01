import { moduleCatalog, type BentoModuleId } from "$lib/data/module-catalog";

export type IslandAction = {
  label: string;
  icon: string;
  action: string;
};

export type IslandItem = {
  id: BentoModuleId;
  name: string;
  tagline: string;
  icon: string;
  accentColor: string;
  launchBg: string;
  quickActions: IslandAction[];
};

const QUICK_ACTIONS: Record<string, IslandAction[]> = {
  tasks: [
    { label: "New Task", icon: "plus", action: "open:/apps/tasks?new" },
    { label: "Today", icon: "calendar", action: "open:/apps/tasks" },
  ],
  habits: [
    { label: "Log Today", icon: "check-circle", action: "open:/apps/habits" },
    { label: "Streaks", icon: "flame", action: "open:/apps/habits?tab=streaks" },
  ],
  focus: [
    { label: "Start Focus", icon: "timer", action: "open:/apps/focus" },
    { label: "Sessions", icon: "bar-chart", action: "open:/apps/focus?tab=sessions" },
  ],
  journal: [
    { label: "New Entry", icon: "edit", action: "open:/apps/journal?new" },
    { label: "History", icon: "history", action: "open:/apps/journal" },
  ],
  budget: [
    { label: "Add Expense", icon: "minus-circle", action: "open:/apps/budget?new" },
    { label: "Overview", icon: "pie-chart", action: "open:/apps/budget" },
  ],
  health: [
    { label: "Log Workout", icon: "activity", action: "open:/apps/health" },
    { label: "Vitals", icon: "heart", action: "open:/apps/health?tab=vitals" },
  ],
  sleep: [
    { label: "Log Sleep", icon: "moon", action: "open:/apps/sleep" },
    { label: "Score", icon: "gauge", action: "open:/apps/sleep?tab=score" },
  ],
  nutrition: [
    { label: "Log Water", icon: "droplets", action: "open:/apps/nutrition?water" },
    { label: "Log Meal", icon: "utensils", action: "open:/apps/nutrition?meal" },
  ],
  mood: [
    { label: "Check-in", icon: "smile", action: "open:/apps/mood" },
  ],
  goals: [
    { label: "New Goal", icon: "flag", action: "open:/apps/goals?new" },
    { label: "Progress", icon: "trending-up", action: "open:/apps/goals" },
  ],
  passwords: [
    { label: "Search Vault", icon: "search", action: "open:/apps/passwords" },
  ],
  "voice-memos": [
    { label: "Record", icon: "mic", action: "open:/apps/voice-memos?record" },
  ],
  countdown: [
    { label: "New Event", icon: "plus", action: "open:/apps/countdown?new" },
  ],
  grocery: [
    { label: "New Item", icon: "plus", action: "open:/apps/grocery?new" },
  ],
  recipes: [
    { label: "Cook Mode", icon: "utensils-crossed", action: "open:/apps/recipes?cook" },
  ],
  time: [
    { label: "Start Timer", icon: "clock", action: "open:/apps/time" },
  ],
  flashcards: [
    { label: "Review Due", icon: "brain", action: "open:/apps/flashcards?due" },
  ],
  clipboard: [
    { label: "History", icon: "clipboard-list", action: "open:/apps/clipboard" },
  ],
  breathing: [
    { label: "Breathe", icon: "wind", action: "open:/apps/breathing" },
  ],
  telemetry: [
    { label: "Dashboard", icon: "gauge", action: "open:/apps/telemetry" },
  ],
  notes: [
    { label: "New Note", icon: "file-plus", action: "open:/notes?new" },
  ],
  ai: [
    { label: "New Chat", icon: "message-square", action: "open:/visual-studio" },
  ],
};

export const islandItems: IslandItem[] = moduleCatalog
  .filter((m) => m.id !== "settings" && m.id !== "dashboard")
  .map((m) => ({
    id: m.id,
    name: m.launch.name,
    tagline: m.launch.tagline,
    icon: m.launch.icon,
    accentColor: m.launch.accentColor,
    launchBg: m.launch.launchBg,
    quickActions: QUICK_ACTIONS[m.id] ?? [],
  }));

export function getIslandItem(id: string): IslandItem | undefined {
  return islandItems.find((item) => item.id === id);
}
