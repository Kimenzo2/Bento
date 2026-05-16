export type AppLaunchIconName =
  | "activity"
  | "book-heart"
  | "bot"
  | "brain"
  | "clipboard-list"
  | "clock-4"
  | "droplets"
  | "file-text"
  | "gauge"
  | "hourglass"
  | "layout-dashboard"
  | "layout-grid"
  | "library"
  | "mic"
  | "moon"
  | "settings"
  | "shield-check"
  | "shopping-cart"
  | "smile-plus"
  | "target"
  | "timer"
  | "trophy"
  | "utensils-crossed"
  | "wallet"
  | "wind";

export const shellNativeModuleIds = [
  "dashboard",
  "notes",
  "ai",
  "settings",
] as const;

export const starterModuleIds = [
  "journal",
  "tasks",
  "habits",
  "focus",
  "passwords",
  "health",
  "sleep",
  "nutrition",
  "mood",
  "budget",
  "flashcards",
  "reading",
  "grocery",
  "recipes",
  "time",
  "goals",
  "clipboard",
  "breathing",
  "voice-memos",
  "countdown",
  "telemetry",
] as const;

export const moduleIdValues = [
  "dashboard",
  "notes",
  "journal",
  "tasks",
  "habits",
  "focus",
  "passwords",
  "health",
  "sleep",
  "nutrition",
  "mood",
  "budget",
  "flashcards",
  "reading",
  "grocery",
  "recipes",
  "time",
  "goals",
  "clipboard",
  "breathing",
  "voice-memos",
  "countdown",
  "telemetry",
  "ai",
  "settings",
] as const;

export type ShellNativeModuleId = (typeof shellNativeModuleIds)[number];
export type StarterModuleId = (typeof starterModuleIds)[number];
export type GenesisModuleId = (typeof moduleIdValues)[number];

export type AppLaunchIdentity = {
  id: GenesisModuleId;
  name: string;
  tagline: string;
  icon: AppLaunchIconName;
  accentColor: string;
  launchBg: string;
};

type SidebarSpec = {
  sectionLabel: string;
  items: readonly string[];
};

export type ModuleCatalogEntry = {
  id: GenesisModuleId;
  name: string;
  navLabel: string;
  subtitle: string;
  route: string;
  host: "shell-native" | "starter";
  installKind: "builtin" | "installable";
  launch: AppLaunchIdentity;
  sidebar: SidebarSpec | null;
};

const starterSidebarSpecs = {
  journal: {
    sectionLabel: "Journal",
    items: ["Today", "Timeline", "Mood", "Photos", "Recap", "Export"],
  },
  tasks: {
    sectionLabel: "Tasks",
    items: ["Board", "Today", "Upcoming", "Recurring", "Filters", "Archive"],
  },
  habits: {
    sectionLabel: "Habits",
    items: ["Today", "Heatmap", "Stacks", "Review", "Widgets", "Export"],
  },
  focus: {
    sectionLabel: "Focus",
    items: ["Timer", "Sessions", "Sounds", "Blocking", "History", "Review"],
  },
  passwords: {
    sectionLabel: "Vault",
    items: ["Vault", "Health", "Passkeys", "Secure Notes", "Travel Mode", "Audit"],
  },
  health: {
    sectionLabel: "Health",
    items: ["Dashboard", "Workouts", "Metrics", "Photos", "Insights", "Export"],
  },
  sleep: {
    sectionLabel: "Sleep",
    items: ["Tonight", "Score", "Routine", "Trends", "Alarm", "Export"],
  },
  nutrition: {
    sectionLabel: "Nutrition",
    items: ["Today", "Water", "Meals", "Macros", "Reminders", "Export"],
  },
  mood: {
    sectionLabel: "Mood",
    items: ["Check-in", "Calendar", "Activities", "Patterns", "Therapist", "Export"],
  },
  budget: {
    sectionLabel: "Budget",
    items: ["Overview", "Transactions", "Budgets", "Bills", "Trends", "Export"],
  },
  flashcards: {
    sectionLabel: "Flashcards",
    items: ["Decks", "Due Today", "Learn", "Cram", "Generate", "Progress"],
  },
  reading: {
    sectionLabel: "Reading",
    items: ["Library", "Current", "Sessions", "Highlights", "Goals", "Export"],
  },
  grocery: {
    sectionLabel: "Grocery",
    items: ["List", "Shared", "Sections", "Recipes", "Prices", "Export"],
  },
  recipes: {
    sectionLabel: "Recipes",
    items: ["Recipes", "Import", "Cook Mode", "Meal Plan", "Shopping", "Export"],
  },
  time: {
    sectionLabel: "Time",
    items: ["Timer", "Projects", "Timeline", "Idle", "Invoices", "Export"],
  },
  goals: {
    sectionLabel: "Goals",
    items: ["Goals", "Milestones", "Check-ins", "Vision", "Review", "Export"],
  },
  clipboard: {
    sectionLabel: "Clipboard",
    items: ["History", "Pinned", "Snippets", "Images", "Sensitive", "Settings"],
  },
  breathing: {
    sectionLabel: "Calm",
    items: ["Breathe", "Sessions", "Sounds", "Check-ins", "Streaks", "Export"],
  },
  "voice-memos": {
    sectionLabel: "Voice Memos",
    items: ["Record", "Transcripts", "Speakers", "Search", "Tags", "Export"],
  },
  countdown: {
    sectionLabel: "Countdown",
    items: ["Events", "Birthdays", "Since", "Cards", "Widgets", "Export"],
  },
  telemetry: {
    sectionLabel: "Telemetry",
    items: ["Brain Overview", "Module Detail", "Insights"],
  },
} as const satisfies Record<StarterModuleId, SidebarSpec>;

const shellModules = [
  {
    id: "dashboard",
    name: "Dashboard",
    navLabel: "Home",
    subtitle: "Recent work, quick actions, and local orchestration health.",
    route: "/",
    host: "shell-native",
    installKind: "builtin",
    launch: {
      id: "dashboard",
      name: "Dashboard",
      tagline: "Recent work",
      icon: "layout-dashboard",
      accentColor: "#f8fafc",
      launchBg: "#0b0b0b",
    },
    sidebar: null,
  },
  {
    id: "notes",
    name: "Notes",
    navLabel: "Notes",
    subtitle: "Capture everything with the shell-native editor and local context.",
    route: "/editor",
    host: "shell-native",
    installKind: "builtin",
    launch: {
      id: "notes",
      name: "Notes",
      tagline: "Capture everything",
      icon: "file-text",
      accentColor: "#6366f1",
      launchBg: "#3730a3",
    },
    sidebar: null,
  },
  {
    id: "ai",
    name: "AI Studio",
    navLabel: "AI Studio",
    subtitle: "Prompt workflows, local channels, and streaming responses.",
    route: "/visual-studio",
    host: "shell-native",
    installKind: "builtin",
    launch: {
      id: "ai",
      name: "AI Studio",
      tagline: "Prompt workflows",
      icon: "bot",
      accentColor: "#38bdf8",
      launchBg: "#0c2340",
    },
    sidebar: null,
  },
  {
    id: "settings",
    name: "Settings",
    navLabel: "Settings",
    subtitle: "Shell controls, theme tokens, and local platform preferences.",
    route: "/settings",
    host: "shell-native",
    installKind: "builtin",
    launch: {
      id: "settings",
      name: "Settings",
      tagline: "Shell controls",
      icon: "settings",
      accentColor: "#e5e7eb",
      launchBg: "#171717",
    },
    sidebar: null,
  },
] as const satisfies readonly ModuleCatalogEntry[];

const starterModules = [
  {
    id: "journal",
    name: "Journal / Diary",
    navLabel: "Journal",
    subtitle: "Daily prompts, mood check-ins, photo attachments, and private recaps.",
    route: "/apps/journal",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "journal",
      name: "Journal",
      tagline: "Write your story",
      icon: "book-heart",
      accentColor: "#818cf8",
      launchBg: "#1e1b4b",
    },
    sidebar: starterSidebarSpecs.journal,
  },
  {
    id: "tasks",
    name: "To-Do / Tasks",
    navLabel: "Tasks",
    subtitle: "Natural-language task capture, recurring work, and action-first planning.",
    route: "/apps/tasks",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "tasks",
      name: "Tasks",
      tagline: "Get things done",
      icon: "layout-grid",
      accentColor: "#52b788",
      launchBg: "#1b5e3b",
    },
    sidebar: starterSidebarSpecs.tasks,
  },
  {
    id: "habits",
    name: "Habit Tracker",
    navLabel: "Habits",
    subtitle: "Streaks, flexible frequency, heatmaps, and weekly review summaries.",
    route: "/apps/habits",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "habits",
      name: "Habits",
      tagline: "Build your streaks",
      icon: "target",
      accentColor: "#c8f535",
      launchBg: "#1a2800",
    },
    sidebar: starterSidebarSpecs.habits,
  },
  {
    id: "focus",
    name: "Focus Timer",
    navLabel: "Focus",
    subtitle: "Pomodoro sessions, custom intervals, ambient modes, and history.",
    route: "/apps/focus",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "focus",
      name: "Focus",
      tagline: "Deep work sessions",
      icon: "timer",
      accentColor: "#f5c400",
      launchBg: "#7a6200",
    },
    sidebar: starterSidebarSpecs.focus,
  },
  {
    id: "passwords",
    name: "Password Vault",
    navLabel: "Vault",
    subtitle: "Local-first vault, passkeys, breach alerts, and secure notes.",
    route: "/apps/passwords",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "passwords",
      name: "Vault",
      tagline: "Secure your secrets",
      icon: "shield-check",
      accentColor: "#9eff57",
      launchBg: "#0d2800",
    },
    sidebar: starterSidebarSpecs.passwords,
  },
  {
    id: "health",
    name: "Health Tracker",
    navLabel: "Health",
    subtitle: "Workout logs, body metrics, progress photos, and device sync placeholders.",
    route: "/apps/health",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "health",
      name: "Health",
      tagline: "Track your body",
      icon: "activity",
      accentColor: "#c8f535",
      launchBg: "#0d1500",
    },
    sidebar: starterSidebarSpecs.health,
  },
  {
    id: "sleep",
    name: "Sleep Tracker",
    navLabel: "Sleep",
    subtitle: "Scores, smart alarm prep, snore detection, and weekly sleep trends.",
    route: "/apps/sleep",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "sleep",
      name: "Sleep",
      tagline: "Own your nights",
      icon: "moon",
      accentColor: "#8cc8ff",
      launchBg: "#101624",
    },
    sidebar: starterSidebarSpecs.sleep,
  },
  {
    id: "nutrition",
    name: "Water & Nutrition",
    navLabel: "Nutrition",
    subtitle: "Hydration goals, macros, meal logging, and reminder-driven tracking.",
    route: "/apps/nutrition",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "nutrition",
      name: "Nutrition",
      tagline: "Fuel the day",
      icon: "droplets",
      accentColor: "#1aa6a6",
      launchBg: "#063b3c",
    },
    sidebar: starterSidebarSpecs.nutrition,
  },
  {
    id: "mood",
    name: "Mood Tracker",
    navLabel: "Mood",
    subtitle: "One-tap emotion logging, activity correlation, and pattern detection.",
    route: "/apps/mood",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "mood",
      name: "Mood",
      tagline: "Track your state",
      icon: "smile-plus",
      accentColor: "#d92b67",
      launchBg: "#5f1231",
    },
    sidebar: starterSidebarSpecs.mood,
  },
  {
    id: "budget",
    name: "Budget Tracker",
    navLabel: "Budget",
    subtitle: "Manual transactions, category budgets, reminders, and privacy-first planning.",
    route: "/apps/budget",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "budget",
      name: "Budget",
      tagline: "Own your money",
      icon: "wallet",
      accentColor: "#e05a3a",
      launchBg: "#6b1f0a",
    },
    sidebar: starterSidebarSpecs.budget,
  },
  {
    id: "flashcards",
    name: "Flashcards / Study",
    navLabel: "Flashcards",
    subtitle: "Spaced repetition, AI card generation, cram mode, and deck progress.",
    route: "/apps/flashcards",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "flashcards",
      name: "Flashcards",
      tagline: "Study with memory",
      icon: "brain",
      accentColor: "#6d5ce7",
      launchBg: "#2f247f",
    },
    sidebar: starterSidebarSpecs.flashcards,
  },
  {
    id: "reading",
    name: "Reading Tracker",
    navLabel: "Reading",
    subtitle: "Book logs, sessions, highlights, and annual reading goals.",
    route: "/apps/reading",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "reading",
      name: "Reading",
      tagline: "Read more books",
      icon: "library",
      accentColor: "#e11d48",
      launchBg: "#881337",
    },
    sidebar: starterSidebarSpecs.reading,
  },
  {
    id: "grocery",
    name: "Grocery / Shopping",
    navLabel: "Grocery",
    subtitle: "Shared lists, store sections, quick capture, and recipe-to-list conversion.",
    route: "/apps/grocery",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "grocery",
      name: "Grocery",
      tagline: "Shop with clarity",
      icon: "shopping-cart",
      accentColor: "#22c55e",
      launchBg: "#064e3b",
    },
    sidebar: starterSidebarSpecs.grocery,
  },
  {
    id: "recipes",
    name: "Recipe Manager",
    navLabel: "Recipes",
    subtitle: "Recipe import, cooking mode, meal planning, and shopping generation.",
    route: "/apps/recipes",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "recipes",
      name: "Recipes",
      tagline: "Cook with structure",
      icon: "utensils-crossed",
      accentColor: "#d4a017",
      launchBg: "#4a3308",
    },
    sidebar: starterSidebarSpecs.recipes,
  },
  {
    id: "time",
    name: "Time Tracker",
    navLabel: "Time",
    subtitle: "One-tap timers, project tagging, idle detection, and invoice-ready export.",
    route: "/apps/time",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "time",
      name: "Time",
      tagline: "Track the hours",
      icon: "clock-4",
      accentColor: "#ffd95b",
      launchBg: "#5b4300",
    },
    sidebar: starterSidebarSpecs.time,
  },
  {
    id: "goals",
    name: "Goal Tracker",
    navLabel: "Goals",
    subtitle: "Long-term goals, milestones, check-ins, and accountability reviews.",
    route: "/apps/goals",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "goals",
      name: "Goals",
      tagline: "Aim at milestones",
      icon: "trophy",
      accentColor: "#ccff00",
      launchBg: "#182400",
    },
    sidebar: starterSidebarSpecs.goals,
  },
  {
    id: "clipboard",
    name: "Clipboard Manager",
    navLabel: "Clipboard",
    subtitle: "Clipboard history, pinned snippets, images, and sensitive-item expiry.",
    route: "/apps/clipboard",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "clipboard",
      name: "Clipboard",
      tagline: "Everything you copied",
      icon: "clipboard-list",
      accentColor: "#e11d48",
      launchBg: "#4c0519",
    },
    sidebar: starterSidebarSpecs.clipboard,
  },
  {
    id: "breathing",
    name: "Breathing / Calm",
    navLabel: "Calm",
    subtitle: "Guided breathing, calm sessions, check-ins, and session streaks.",
    route: "/apps/breathing",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "breathing",
      name: "Calm",
      tagline: "Slow the day down",
      icon: "wind",
      accentColor: "#65d7c1",
      launchBg: "#063d35",
    },
    sidebar: starterSidebarSpecs.breathing,
  },
  {
    id: "voice-memos",
    name: "Voice Memos",
    navLabel: "Voice Memos",
    subtitle: "One-tap recording, transcription, speaker labels, and searchable memos.",
    route: "/apps/voice-memos",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "voice-memos",
      name: "Voice Memos",
      tagline: "Capture and transcribe",
      icon: "mic",
      accentColor: "#8b5cf6",
      launchBg: "#2e1065",
    },
    sidebar: starterSidebarSpecs["voice-memos"],
  },
  {
    id: "countdown",
    name: "Countdown / Life Events",
    navLabel: "Countdown",
    subtitle: "Event countdowns, birthdays, days-since tracking, and shareable cards.",
    route: "/apps/countdown",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "countdown",
      name: "Countdown",
      tagline: "Mark what matters",
      icon: "hourglass",
      accentColor: "#ec4899",
      launchBg: "#831843",
    },
    sidebar: starterSidebarSpecs.countdown,
  },
  {
    id: "telemetry",
    name: "Personal Telemetry",
    navLabel: "Telemetry",
    subtitle: "On-device health, anomaly detection, and self-healing system intelligence.",
    route: "/apps/telemetry",
    host: "starter",
    installKind: "builtin",
    launch: {
      id: "telemetry",
      name: "Telemetry",
      tagline: "System intelligence",
      icon: "gauge",
      accentColor: "#38bdf8",
      launchBg: "#0c2340",
    },
    sidebar: starterSidebarSpecs.telemetry,
  },
] as const satisfies readonly ModuleCatalogEntry[];

export const moduleCatalog = [
  shellModules[0],
  shellModules[1],
  ...starterModules,
  shellModules[2],
  shellModules[3],
] as const satisfies readonly ModuleCatalogEntry[];

const moduleCatalogById = new Map<GenesisModuleId, ModuleCatalogEntry>(
  moduleCatalog.map((entry) => [entry.id, entry]),
);

const starterModuleIdSet = new Set<string>(starterModuleIds);
const shellNativeModuleIdSet = new Set<string>(shellNativeModuleIds);

export function getModuleCatalogEntry(moduleId: string | undefined) {
  if (!moduleId) {
    return null;
  }

  return moduleCatalogById.get(moduleId as GenesisModuleId) ?? null;
}

export function getStarterModuleEntry(moduleId: string | undefined) {
  const entry = getModuleCatalogEntry(moduleId);
  return entry?.host === "starter" ? entry : null;
}

export function isStarterModuleId(value: string): value is StarterModuleId {
  return starterModuleIdSet.has(value);
}

export function isShellNativeModuleId(value: string): value is ShellNativeModuleId {
  return shellNativeModuleIdSet.has(value);
}

export function getAppLaunchIdentity(moduleId: string): AppLaunchIdentity {
  return (
    getModuleCatalogEntry(moduleId)?.launch ?? {
      id: "dashboard",
      name: "Genesis",
      tagline: "Desktop module",
      icon: "layout-grid",
      accentColor: "#f8fafc",
      launchBg: "#111111",
    }
  );
}
