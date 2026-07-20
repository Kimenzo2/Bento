import { moduleCatalog, type BentoModuleId } from "$lib/data/module-catalog";

export type IslandAction = {
  label: string;
  icon: string;
  action: string;
};

export type WidgetLayout =
  | "stat"
  | "progress"
  | "timer"
  | "score"
  | "mood"
  | "action"
  | "list"
  | "system"
  | "countdown";

export type WidgetContent = {
  layout: WidgetLayout;
  primary: string;
  secondary: string;
  unit?: string;
  progress?: number;
  items?: string[];
  width?: "sm" | "md" | "lg";
};

export type IslandItem = {
  id: BentoModuleId;
  name: string;
  tagline: string;
  icon: string;
  accentColor: string;
  launchBg: string;
  quickActions: IslandAction[];
  widget: WidgetContent;
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
  mood: [{ label: "Check-in", icon: "smile", action: "open:/apps/mood" }],
  goals: [
    { label: "New Goal", icon: "flag", action: "open:/apps/goals?new" },
    { label: "Progress", icon: "trending-up", action: "open:/apps/goals" },
  ],
  passwords: [{ label: "Search Vault", icon: "search", action: "open:/apps/passwords" }],
  "voice-memos": [{ label: "Record", icon: "mic", action: "open:/apps/voice-memos?record" }],
  countdown: [{ label: "New Event", icon: "plus", action: "open:/apps/countdown?new" }],
  clipboard: [{ label: "History", icon: "clipboard-list", action: "open:/apps/clipboard" }],
  notes: [{ label: "New Note", icon: "file-plus", action: "open:/notes?new" }],
};

const WIDGETS: Record<string, WidgetContent> = {
  tasks: {
    layout: "progress",
    primary: "3",
    secondary: "of 8 done",
    unit: "/8",
    progress: 38,
    width: "md",
  },
  habits: { layout: "stat", primary: "12", secondary: "day streak", unit: "days", width: "sm" },
  focus: { layout: "timer", primary: "25:00", secondary: "Ready to start", width: "md" },
  journal: {
    layout: "list",
    primary: "Today's entry",
    secondary: "Edited 2m ago",
    items: ["Felt productive today...", "Morning pages complete"],
    width: "md",
  },
  budget: {
    layout: "progress",
    primary: "$842",
    secondary: "left this month",
    unit: "of $2,400",
    progress: 65,
    width: "md",
  },
  health: {
    layout: "stat",
    primary: "6,432",
    secondary: "steps today",
    unit: "steps",
    width: "sm",
  },
  sleep: { layout: "score", primary: "85", secondary: "last night", unit: "score", width: "sm" },
  nutrition: {
    layout: "progress",
    primary: "4",
    secondary: "glasses of water",
    unit: "/8",
    progress: 50,
    width: "md",
  },
  mood: { layout: "mood", primary: "Great", secondary: "Logged 2h ago", width: "sm" },
  goals: {
    layout: "progress",
    primary: "2",
    secondary: "of 3 goals met",
    unit: "/3",
    progress: 67,
    width: "md",
  },
  passwords: {
    layout: "stat",
    primary: "42",
    secondary: "vault items",
    unit: "items",
    width: "sm",
  },
  "voice-memos": {
    layout: "action",
    primary: "Tap to Record",
    secondary: "Last: Meeting notes",
    width: "md",
  },
  countdown: { layout: "countdown", primary: "12d 4h", secondary: "until launch", width: "sm" },
  clipboard: {
    layout: "list",
    primary: "Recent copy",
    secondary: "email draft",
    items: ["Welcome to the team!", "Meeting at 3pm"],
    width: "md",
  },
  notes: {
    layout: "list",
    primary: "Last edited",
    secondary: "Today at 2:15 PM",
    items: ["Shopping list", "Project ideas"],
    width: "md",
  },
};

const ISLAND_EXCLUDED_IDS = new Set(["settings", "dashboard", "ai"]);

export const islandItems: IslandItem[] = moduleCatalog
  .filter((m) => !ISLAND_EXCLUDED_IDS.has(m.id))
  .map((m) => ({
    id: m.id,
    name: m.launch.name,
    tagline: m.launch.tagline,
    icon: m.launch.icon,
    accentColor: m.launch.accentColor,
    launchBg: m.launch.launchBg,
    quickActions: QUICK_ACTIONS[m.id] ?? [],
    widget: WIDGETS[m.id] ?? {
      layout: "stat",
      primary: m.launch.name,
      secondary: m.launch.tagline,
      width: "md",
    },
  }));

export function getIslandItem(id: string): IslandItem | undefined {
  return islandItems.find((item) => item.id === id);
}
