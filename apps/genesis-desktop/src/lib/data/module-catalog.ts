export type AppLaunchIconName =
  | 'activity'
  | 'book-heart'
  | 'bot'
  | 'brain'
  | 'clipboard-list'
  | 'clock-4'
  | 'droplets'
  | 'file-text'
  | 'gauge'
  | 'hourglass'
  | 'layout-dashboard'
  | 'layout-grid'
  | 'library'
  | 'mic'
  | 'moon'
  | 'settings'
  | 'shield-check'
  | 'shopping-cart'
  | 'smile-plus'
  | 'target'
  | 'timer'
  | 'trophy'
  | 'utensils-crossed'
  | 'wallet'
  | 'wind';

export const shellNativeModuleIds = ['dashboard', 'notes', 'ai', 'settings'] as const;

export const starterModuleIds = [
  'journal',
  'tasks',
  'habits',
  'focus',
  'passwords',
  'health',
  'sleep',
  'nutrition',
  'mood',
  'budget',
  'flashcards',
  'reading',
  'grocery',
  'recipes',
  'time',
  'goals',
  'clipboard',
  'breathing',
  'voice-memos',
  'countdown',
  'telemetry',
] as const;

export const moduleIdValues = [
  'dashboard',
  'notes',
  'journal',
  'tasks',
  'habits',
  'focus',
  'passwords',
  'health',
  'sleep',
  'nutrition',
  'mood',
  'budget',
  'flashcards',
  'reading',
  'grocery',
  'recipes',
  'time',
  'goals',
  'clipboard',
  'breathing',
  'voice-memos',
  'countdown',
  'telemetry',
  'ai',
  'settings',
] as const;

export type ShellNativeModuleId = (typeof shellNativeModuleIds)[number];
export type StarterModuleId = (typeof starterModuleIds)[number];
export type BentoModuleId = (typeof moduleIdValues)[number];

export type AppLaunchIdentity = {
  id: BentoModuleId;
  name: string;
  tagline: string;
  icon: AppLaunchIconName;
  accentColor: string;
  launchBg: string;
};

export type SidebarItemSpec = {
  label: string;
  /** Lucide icon name (kebab-case, e.g. 'calendar-days', 'history') */
  icon: string;
  /**
   * If 'flyout', clicking this item opens a flyout panel (Avnac-style)
   * instead of setting the module section.
   */
  action?: 'section' | 'flyout';
};

type SidebarSpec = {
  sectionLabel: string;
  /**
   * Items can be plain strings (legacy — will cycle through generic icons)
   * or objects with `label` + `icon` for fully custom per-item icons.
   */
  items: readonly (string | SidebarItemSpec)[];
};

export type ModuleCatalogEntry = {
  id: BentoModuleId;
  name: string;
  navLabel: string;
  subtitle: string;
  route: string;
  host: 'shell-native' | 'starter';
  installKind: 'builtin' | 'installable';
  launch: AppLaunchIdentity;
  sidebar: SidebarSpec | null;
};

const starterSidebarSpecs = {
  journal: {
    sectionLabel: 'Journal',
    items: [
      { label: 'Today', icon: 'calendar-days' },
      { label: 'History', icon: 'history' },
    ],
  },
  tasks: {
    sectionLabel: 'Tasks',
    items: [
      { label: 'Recurring', icon: 'repeat-2', action: 'flyout' },
      { label: 'Tags', icon: 'tags', action: 'flyout' },
      { label: 'Views', icon: 'eye', action: 'flyout' },
      { label: 'History', icon: 'history', action: 'flyout' },
      { label: 'Search', icon: 'search', action: 'flyout' },
    ],
  },
  habits: {
    sectionLabel: 'Habits',
    items: [
      { label: 'Today', icon: 'calendar-days' },
      { label: 'Heatmap', icon: 'grid-3x3' },
      { label: 'Stacks', icon: 'layers' },
      { label: 'Review', icon: 'search' },
      { label: 'Widgets', icon: 'layout-dashboard' },
      { label: 'Export', icon: 'download' },
    ],
  },
  focus: {
    sectionLabel: 'Focus',
    items: [
      { label: 'Timer', icon: 'timer' },
      { label: 'Sessions', icon: 'list' },
      { label: 'Sounds', icon: 'music' },
      { label: 'Blocking', icon: 'ban' },
      { label: 'History', icon: 'history' },
      { label: 'Review', icon: 'search' },
      { label: 'Quick Timer', icon: 'clock' },
    ],
  },
  passwords: {
    sectionLabel: 'Vault',
    items: [
      { label: 'Vault', icon: 'shield-check' },
      { label: 'Health', icon: 'heart' },
      { label: 'Passkeys', icon: 'key-round' },
      { label: 'Secure Notes', icon: 'file-text' },
      { label: 'Travel Mode', icon: 'plane' },
      { label: 'Audit', icon: 'list-checks' },
    ],
  },
  health: {
    sectionLabel: 'Health',
    items: [
      { label: 'Dashboard', icon: 'layout-dashboard' },
      { label: 'Daily Log', icon: 'clipboard-list' },
      { label: 'Vitals', icon: 'activity' },
      { label: 'Insights', icon: 'brain' },
      { label: 'Medications', icon: 'pill' },
    ],
  },
  sleep: {
    sectionLabel: 'Sleep',
    items: [
      { label: 'Tonight', icon: 'moon' },
      { label: 'Score', icon: 'gauge' },
      { label: 'Routine', icon: 'clock-4' },
      { label: 'Trends', icon: 'chart-line' },
      { label: 'Alarm', icon: 'alarm-clock' },
      { label: 'Export', icon: 'download' },
      { label: 'Log', icon: 'file-text' },
    ],
  },
  nutrition: {
    sectionLabel: 'Nutrition',
    items: [
      { label: 'Today', icon: 'calendar-days' },
      { label: 'Water', icon: 'droplets' },
      { label: 'Meals', icon: 'utensils-crossed' },
      { label: 'Macros', icon: 'pie-chart' },
      { label: 'Reminders', icon: 'bell' },
      { label: 'Export', icon: 'download' },
      { label: 'Journal', icon: 'book-heart' },
    ],
  },
  mood: {
    sectionLabel: 'Mood',
    items: [
      { label: 'Check-in', icon: 'smile-plus' },
      { label: 'Calendar', icon: 'calendar-days' },
      { label: 'Activities', icon: 'activity' },
      { label: 'Patterns', icon: 'brain' },
      { label: 'Therapist', icon: 'message-circle' },
      { label: 'Export', icon: 'download' },
    ],
  },
  budget: {
    sectionLabel: 'Budget',
    items: [
      { label: 'Overview', icon: 'layout-dashboard' },
      { label: 'Transactions', icon: 'arrow-right-left' },
      { label: 'Budgets', icon: 'wallet' },
      { label: 'Bills', icon: 'receipt' },
      { label: 'AI Costs', icon: 'bot' },
      { label: 'Forecast', icon: 'chart-line' },
      { label: 'Export', icon: 'download' },
    ],
  },
  flashcards: {
    sectionLabel: 'Flashcards',
    items: [
      { label: 'Decks', icon: 'layers' },
      { label: 'Due Today', icon: 'calendar-days' },
      { label: 'Learn', icon: 'brain' },
      { label: 'Cram', icon: 'zap' },
      { label: 'Generate', icon: 'sparkles' },
      { label: 'Progress', icon: 'trending-up' },
    ],
  },
  reading: {
    sectionLabel: 'Reading',
    items: [
      { label: 'Library', icon: 'book-open' },
      { label: 'Reader', icon: 'book-open-text' },
      { label: 'Discover', icon: 'compass' },
      { label: 'Collections', icon: 'folder-open' },
      { label: 'Sessions', icon: 'timer' },
      { label: 'Bookmarks', icon: 'bookmark' },
      { label: 'Highlights', icon: 'highlighter' },
      { label: 'Notes', icon: 'file-text' },
      { label: 'Goals', icon: 'target' },
      { label: 'Export', icon: 'download' },
    ],
  },
  grocery: {
    sectionLabel: 'Grocery',
    items: [
      { label: 'List', icon: 'list-checks' },
      { label: 'Shared', icon: 'users' },
      { label: 'Sections', icon: 'layout-grid' },
      { label: 'Recipes', icon: 'utensils-crossed' },
      { label: 'Prices', icon: 'tag' },
      { label: 'Export', icon: 'download' },
    ],
  },
  recipes: {
    sectionLabel: 'Recipes',
    items: [
      { label: 'Recipes', icon: 'utensils-crossed' },
      { label: 'Discover', icon: 'compass' },
      { label: 'Import', icon: 'upload' },
      { label: 'Cook Mode', icon: 'cooking-pot' },
      { label: 'Meal Plan', icon: 'calendar-check' },
      { label: 'Shopping', icon: 'shopping-cart' },
      { label: 'Export', icon: 'download' },
    ],
  },
  time: {
    sectionLabel: 'Time',
    items: [
      { label: 'Timer', icon: 'timer' },
      { label: 'Projects', icon: 'folder' },
      { label: 'Timeline', icon: 'timeline' },
      { label: 'Idle', icon: 'clock' },
      { label: 'Invoices', icon: 'file-text' },
      { label: 'Export', icon: 'download' },
    ],
  },
  goals: {
    sectionLabel: 'Goals',
    items: [
      { label: 'Goals', icon: 'target' },
      { label: 'Milestones', icon: 'flag' },
      { label: 'Check-ins', icon: 'calendar-check' },
      { label: 'Vision', icon: 'eye' },
      { label: 'Review', icon: 'search' },
      { label: 'Export', icon: 'download' },
    ],
  },
  clipboard: {
    sectionLabel: 'Clipboard',
    items: [
      { label: 'History', icon: 'history' },
      { label: 'Pinned', icon: 'pin' },
      { label: 'Snippets', icon: 'scissors' },
      { label: 'Images', icon: 'image' },
      { label: 'Sensitive', icon: 'shield' },
      { label: 'Settings', icon: 'settings' },
    ],
  },
  breathing: {
    sectionLabel: 'Calm',
    items: [
      { label: 'Breathe', icon: 'wind' },
      { label: 'Sessions', icon: 'list' },
      { label: 'Sounds', icon: 'music' },
      { label: 'Check-ins', icon: 'calendar-check' },
      { label: 'Streaks', icon: 'flame' },
      { label: 'Export', icon: 'download' },
    ],
  },
  'voice-memos': {
    sectionLabel: 'Voice Memos',
    items: [
      { label: 'Record', icon: 'mic' },
      { label: 'Transcripts', icon: 'file-text' },
      { label: 'Speakers', icon: 'users' },
      { label: 'Search', icon: 'search' },
      { label: 'Tags', icon: 'tag' },
      { label: 'Export', icon: 'download' },
    ],
  },
  countdown: {
    sectionLabel: 'Countdown',
    items: [
      { label: 'Events', icon: 'calendar-check' },
      { label: 'Birthdays', icon: 'cake' },
      { label: 'Since', icon: 'history' },
      { label: 'Cards', icon: 'image' },
      { label: 'Widgets', icon: 'layout-dashboard' },
      { label: 'Export', icon: 'download' },
    ],
  },
  telemetry: {
    sectionLabel: 'Telemetry',
    items: [
      { label: 'Brain Overview', icon: 'brain' },
      { label: 'Module Detail', icon: 'layout-grid' },
      { label: 'Insights', icon: 'chart-line' },
    ],
  },
} as const satisfies Record<StarterModuleId, SidebarSpec>;

const shellModules = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    navLabel: 'Home',
    subtitle: 'Recent work, quick actions, and local orchestration health.',
    route: '/',
    host: 'shell-native',
    installKind: 'builtin',
    launch: {
      id: 'dashboard',
      name: 'Dashboard',
      tagline: 'Recent work',
      icon: 'layout-dashboard',
      accentColor: '#f8fafc',
      launchBg: '#0b0b0b',
    },
    sidebar: null,
  },
  {
    id: 'notes',
    name: 'Notes',
    navLabel: 'Notes',
    subtitle:
      'Capture everything in a standalone local notes app with rich blocks and sync-safe context.',
    route: '/notes',
    host: 'shell-native',
    installKind: 'builtin',
    launch: {
      id: 'notes',
      name: 'Notes',
      tagline: 'Capture everything',
      icon: 'file-text',
      accentColor: '#6366f1',
      launchBg: '#3730a3',
    },
    sidebar: null,
  },
  {
    id: 'ai',
    name: 'AI Studio',
    navLabel: 'AI Studio',
    subtitle: 'Prompt workflows, local channels, and streaming responses.',
    route: '/visual-studio',
    host: 'shell-native',
    installKind: 'builtin',
    launch: {
      id: 'ai',
      name: 'AI Studio',
      tagline: 'Prompt workflows',
      icon: 'bot',
      accentColor: '#38bdf8',
      launchBg: '#0c2340',
    },
    sidebar: null,
  },
  {
    id: 'settings',
    name: 'Settings',
    navLabel: 'Settings',
    subtitle: 'Shell controls, theme tokens, and local platform preferences.',
    route: '/settings',
    host: 'shell-native',
    installKind: 'builtin',
    launch: {
      id: 'settings',
      name: 'Settings',
      tagline: 'Shell controls',
      icon: 'settings',
      accentColor: '#e5e7eb',
      launchBg: '#171717',
    },
    sidebar: null,
  },
] as const satisfies readonly ModuleCatalogEntry[];

const starterModules = [
  {
    id: 'journal',
    name: 'Journal / Diary',
    navLabel: 'Journal',
    subtitle: 'Daily prompts, mood check-ins, photo attachments, and private recaps.',
    route: '/apps/journal',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'journal',
      name: 'Journal',
      tagline: 'Write your story',
      icon: 'book-heart',
      accentColor: '#818cf8',
      launchBg: '#1e1b4b',
    },
    sidebar: starterSidebarSpecs.journal,
  },
  {
    id: 'tasks',
    name: 'To-Do / Tasks',
    navLabel: 'Tasks',
    subtitle: 'Natural-language task capture, recurring work, and action-first planning.',
    route: '/apps/tasks',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'tasks',
      name: 'Tasks',
      tagline: 'Get things done',
      icon: 'layout-grid',
      accentColor: '#52b788',
      launchBg: '#1b5e3b',
    },
    sidebar: starterSidebarSpecs.tasks,
  },
  {
    id: 'habits',
    name: 'Habit Tracker',
    navLabel: 'Habits',
    subtitle: 'Streaks, flexible frequency, heatmaps, and weekly review summaries.',
    route: '/apps/habits',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'habits',
      name: 'Habits',
      tagline: 'Build your streaks',
      icon: 'target',
      accentColor: '#c8f535',
      launchBg: '#1a2800',
    },
    sidebar: starterSidebarSpecs.habits,
  },
  {
    id: 'focus',
    name: 'Focus Timer',
    navLabel: 'Focus',
    subtitle: 'Pomodoro sessions, custom intervals, ambient modes, and history.',
    route: '/apps/focus',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'focus',
      name: 'Focus',
      tagline: 'Deep work sessions',
      icon: 'timer',
      accentColor: '#f5c400',
      launchBg: '#7a6200',
    },
    sidebar: starterSidebarSpecs.focus,
  },
  {
    id: 'passwords',
    name: 'Password Vault',
    navLabel: 'Vault',
    subtitle: 'Local-first vault, passkeys, breach alerts, and secure notes.',
    route: '/apps/passwords',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'passwords',
      name: 'Vault',
      tagline: 'Secure your secrets',
      icon: 'shield-check',
      accentColor: '#9eff57',
      launchBg: '#0d2800',
    },
    sidebar: starterSidebarSpecs.passwords,
  },
  {
    id: 'health',
    name: 'Health Tracker',
    navLabel: 'Health',
    subtitle: 'Workout logs, body metrics, progress photos, and device sync placeholders.',
    route: '/apps/health',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'health',
      name: 'Health',
      tagline: 'Track your body',
      icon: 'activity',
      accentColor: '#c8f535',
      launchBg: '#0d1500',
    },
    sidebar: starterSidebarSpecs.health,
  },
  {
    id: 'sleep',
    name: 'Sleep Tracker',
    navLabel: 'Sleep',
    subtitle: 'Scores, smart alarm prep, snore detection, and weekly sleep trends.',
    route: '/apps/sleep',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'sleep',
      name: 'Sleep',
      tagline: 'Own your nights',
      icon: 'moon',
      accentColor: '#8cc8ff',
      launchBg: '#101624',
    },
    sidebar: starterSidebarSpecs.sleep,
  },
  {
    id: 'nutrition',
    name: 'Water & Nutrition',
    navLabel: 'Nutrition',
    subtitle: 'Hydration goals, macros, meal logging, and reminder-driven tracking.',
    route: '/apps/nutrition',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'nutrition',
      name: 'Nutrition',
      tagline: 'Fuel the day',
      icon: 'droplets',
      accentColor: '#1aa6a6',
      launchBg: '#063b3c',
    },
    sidebar: starterSidebarSpecs.nutrition,
  },
  {
    id: 'mood',
    name: 'Mood Tracker',
    navLabel: 'Mood',
    subtitle: 'One-tap emotion logging, activity correlation, and pattern detection.',
    route: '/apps/mood',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'mood',
      name: 'Mood',
      tagline: 'Track your state',
      icon: 'smile-plus',
      accentColor: '#d92b67',
      launchBg: '#5f1231',
    },
    sidebar: starterSidebarSpecs.mood,
  },
  {
    id: 'budget',
    name: 'Budget Tracker',
    navLabel: 'Budget',
    subtitle: 'Manual transactions, category budgets, reminders, and privacy-first planning.',
    route: '/apps/budget',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'budget',
      name: 'Budget',
      tagline: 'Own your money',
      icon: 'wallet',
      accentColor: '#e05a3a',
      launchBg: '#6b1f0a',
    },
    sidebar: starterSidebarSpecs.budget,
  },
  {
    id: 'flashcards',
    name: 'Flashcards / Study',
    navLabel: 'Flashcards',
    subtitle: 'Bento-native cue cards for Focus, Recipes, Health, and everyday memory.',
    route: '/apps/flashcards',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'flashcards',
      name: 'Flashcards',
      tagline: 'Study with memory',
      icon: 'brain',
      accentColor: '#6d5ce7',
      launchBg: '#2f247f',
    },
    sidebar: starterSidebarSpecs.flashcards,
  },
  {
    id: 'reading',
    name: 'Reading Tracker',
    navLabel: 'Reading',
    subtitle: 'Book logs, sessions, highlights, and annual reading goals.',
    route: '/apps/reading',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'reading',
      name: 'Reading',
      tagline: 'Read more books',
      icon: 'library',
      accentColor: '#e11d48',
      launchBg: '#881337',
    },
    sidebar: starterSidebarSpecs.reading,
  },
  {
    id: 'grocery',
    name: 'Grocery / Shopping',
    navLabel: 'Grocery',
    subtitle: 'Shared lists, store sections, quick capture, and recipe-to-list conversion.',
    route: '/apps/grocery',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'grocery',
      name: 'Grocery',
      tagline: 'Shop with clarity',
      icon: 'shopping-cart',
      accentColor: '#22c55e',
      launchBg: '#064e3b',
    },
    sidebar: starterSidebarSpecs.grocery,
  },
  {
    id: 'recipes',
    name: 'Recipe Manager',
    navLabel: 'Recipes',
    subtitle: 'Recipe import, cooking mode, meal planning, and shopping generation.',
    route: '/apps/recipes',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'recipes',
      name: 'Recipes',
      tagline: 'Cook with structure',
      icon: 'utensils-crossed',
      accentColor: '#d4a017',
      launchBg: '#4a3308',
    },
    sidebar: starterSidebarSpecs.recipes,
  },
  {
    id: 'time',
    name: 'Time Tracker',
    navLabel: 'Time',
    subtitle: 'One-tap timers, project tagging, idle detection, and invoice-ready export.',
    route: '/apps/time',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'time',
      name: 'Time',
      tagline: 'Track the hours',
      icon: 'clock-4',
      accentColor: '#ffd95b',
      launchBg: '#5b4300',
    },
    sidebar: starterSidebarSpecs.time,
  },
  {
    id: 'goals',
    name: 'Goal Tracker',
    navLabel: 'Goals',
    subtitle: 'Long-term goals, milestones, check-ins, and accountability reviews.',
    route: '/apps/goals',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'goals',
      name: 'Goals',
      tagline: 'Aim at milestones',
      icon: 'trophy',
      accentColor: '#ccff00',
      launchBg: '#182400',
    },
    sidebar: starterSidebarSpecs.goals,
  },
  {
    id: 'clipboard',
    name: 'Clipboard Manager',
    navLabel: 'Clipboard',
    subtitle: 'Clipboard history, pinned snippets, images, and sensitive-item expiry.',
    route: '/apps/clipboard',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'clipboard',
      name: 'Clipboard',
      tagline: 'Everything you copied',
      icon: 'clipboard-list',
      accentColor: '#e11d48',
      launchBg: '#4c0519',
    },
    sidebar: starterSidebarSpecs.clipboard,
  },
  {
    id: 'breathing',
    name: 'Breathing / Calm',
    navLabel: 'Calm',
    subtitle: 'Guided breathing, calm sessions, check-ins, and session streaks.',
    route: '/apps/breathing',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'breathing',
      name: 'Calm',
      tagline: 'Slow the day down',
      icon: 'wind',
      accentColor: '#65d7c1',
      launchBg: '#063d35',
    },
    sidebar: starterSidebarSpecs.breathing,
  },
  {
    id: 'voice-memos',
    name: 'Voice Memos',
    navLabel: 'Voice Memos',
    subtitle: 'One-tap recording, transcription, speaker labels, and searchable memos.',
    route: '/apps/voice-memos',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'voice-memos',
      name: 'Voice Memos',
      tagline: 'Capture and transcribe',
      icon: 'mic',
      accentColor: '#8b5cf6',
      launchBg: '#2e1065',
    },
    sidebar: starterSidebarSpecs['voice-memos'],
  },
  {
    id: 'countdown',
    name: 'Countdown / Life Events',
    navLabel: 'Countdown',
    subtitle: 'Event countdowns, birthdays, days-since tracking, and shareable cards.',
    route: '/apps/countdown',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'countdown',
      name: 'Countdown',
      tagline: 'Mark what matters',
      icon: 'hourglass',
      accentColor: '#ec4899',
      launchBg: '#831843',
    },
    sidebar: starterSidebarSpecs.countdown,
  },
  {
    id: 'telemetry',
    name: 'Personal Telemetry',
    navLabel: 'Telemetry',
    subtitle: 'On-device health, anomaly detection, and self-healing system intelligence.',
    route: '/apps/telemetry',
    host: 'starter',
    installKind: 'builtin',
    launch: {
      id: 'telemetry',
      name: 'Telemetry',
      tagline: 'System intelligence',
      icon: 'gauge',
      accentColor: '#38bdf8',
      launchBg: '#0c2340',
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

const moduleCatalogById = new Map<BentoModuleId, ModuleCatalogEntry>(
  moduleCatalog.map((entry) => [entry.id, entry])
);

const starterModuleIdSet = new Set<string>(starterModuleIds);
const shellNativeModuleIdSet = new Set<string>(shellNativeModuleIds);

export function getModuleCatalogEntry(moduleId: string | undefined) {
  if (!moduleId) {
    return null;
  }

  return moduleCatalogById.get(moduleId as BentoModuleId) ?? null;
}

export function getStarterModuleEntry(moduleId: string | undefined) {
  const entry = getModuleCatalogEntry(moduleId);
  return entry?.host === 'starter' ? entry : null;
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
      id: 'dashboard',
      name: 'Bento',
      tagline: 'Desktop module',
      icon: 'layout-grid',
      accentColor: '#f8fafc',
      launchBg: '#111111',
    }
  );
}
