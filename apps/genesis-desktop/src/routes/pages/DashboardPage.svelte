<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { switchModule, moduleIdSchema, type BentoModuleId } from "$lib/desktop/modules";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";

  let _t = $derived.by(() => createTranslator($activeBundle));

  interface DashboardPayload {
    greeting: string;
    insightLine: string;
    featuredModule: FeaturedModule;
    recentActivity: ActivityEntry[];
    streak: StreakInfo;
    featuredMetric: MetricInfo;
    recentModules: RecentModule[];
    gradientColors: [string, string];
  }

  interface FeaturedModule {
    id: string;
    name: string;
    icon: string;
    accentHex: string;
    primaryCount: number;
    primaryLabel: string;
    descriptorLabel: string;
    items: { text: string; secondary: string | null; completed: boolean }[];
  }

  interface ActivityEntry {
    moduleId: string;
    moduleName: string;
    moduleIcon: string;
    moduleAccent: string;
    action: string;
    timestampRelative: string;
    timestampMs: number;
  }

  interface StreakInfo {
    count: number;
    moduleId: string;
    moduleName: string;
  }

  interface MetricInfo {
    label: string;
    value: string;
    moduleId: string;
    trend: TrendInfo | null;
  }

  interface TrendInfo {
    direction: string;
    percentage: number;
  }

  interface RecentModule {
    id: string;
    name: string;
    icon: string;
    accentHex: string;
    lastUsedMs: number;
  }

  let data = $state<DashboardPayload | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const canUseTauri = browser && isTauri();

  const clientGreeting = $derived.by(() => {
    if (!browser) return data?.greeting ?? "Welcome back";
    const hour = new Date().getHours();
    const base = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const serverGreeting = data?.greeting ?? "";
    const nameMatch = serverGreeting.match(/^Good (?:morning|afternoon|evening),?\s*(.+)?$/i);
    const name = nameMatch?.[1]?.trim();
    if (name) return `${base}, ${name}`;
    return serverGreeting || base;
  });

  function loadFallbackData() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    data = {
      greeting,
      insightLine: "You have 3 tasks due today and a habit streak to protect.",
      featuredModule: {
        id: "tasks", name: "Tasks", icon: "clipboard-list", accentHex: "#3B82F6",
        primaryCount: 5, primaryLabel: "Pending tasks", descriptorLabel: "Open tasks",
        items: [
          { text: "Review Q2 project brief", secondary: "Today at 3pm", completed: false },
          { text: "Update habit tracker streak", secondary: "Overdue", completed: false },
          { text: "Outline journal entry for May", secondary: "Tomorrow", completed: true },
          { text: "Export budget as CSV", secondary: null, completed: true },
        ],
      },
      recentActivity: [
        { moduleId: "journal", moduleName: "Journal", moduleIcon: "file-text", moduleAccent: "#f59e0b", action: "Wrote a new entry", timestampRelative: "12 min ago", timestampMs: time.now() - 720_000 },
        { moduleId: "tasks", moduleName: "Tasks", moduleIcon: "clipboard-list", moduleAccent: "#3B82F6", action: "Completed 'Review draft'", timestampRelative: "34 min ago", timestampMs: time.now() - 2_040_000 },
        { moduleId: "focus", moduleName: "Focus", moduleIcon: "timer", moduleAccent: "#10b981", action: "Finished a 25-min session", timestampRelative: "1 hr ago", timestampMs: time.now() - 3_600_000 },
        { moduleId: "reading", moduleName: "Reading", moduleIcon: "book-heart", moduleAccent: "#ec4899", action: "Logged 12 pages", timestampRelative: "2 hr ago", timestampMs: time.now() - 7_200_000 },
        { moduleId: "water", moduleName: "Water", moduleIcon: "droplets", moduleAccent: "#3b82f6", action: "Logged 2 glasses", timestampRelative: "3 hr ago", timestampMs: time.now() - 10_800_000 },
      ],
      streak: { count: 12, moduleId: "habits", moduleName: "Habit Tracker" },
      featuredMetric: { label: "Focus sessions this week", value: "18", moduleId: "focus", trend: { direction: "up", percentage: 22.5 } },
      recentModules: [
        { id: "journal", name: "Journal", icon: "file-text", accentHex: "#f59e0b", lastUsedMs: time.now() - 720_000 },
        { id: "tasks", name: "Tasks", icon: "clipboard-list", accentHex: "#3B82F6", lastUsedMs: time.now() - 2_040_000 },
        { id: "focus", name: "Focus", icon: "timer", accentHex: "#10b981", lastUsedMs: time.now() - 3_600_000 },
        { id: "reading", name: "Reading", icon: "book-heart", accentHex: "#ec4899", lastUsedMs: time.now() - 7_200_000 },
        { id: "water", name: "Water", icon: "droplets", accentHex: "#3b82f6", lastUsedMs: time.now() - 10_800_000 },
        { id: "habits", name: "Habits", icon: "activity", accentHex: "#22c55e", lastUsedMs: time.now() - 14_400_000 },
        { id: "mood", name: "Mood", icon: "smile-plus", accentHex: "#eab308", lastUsedMs: time.now() - 21_600_000 },
        { id: "budget", name: "Budget", icon: "wallet", accentHex: "#06b6d4", lastUsedMs: time.now() - 28_800_000 },
      ],
      gradientColors: ["#8b5cf6", "#ec4899"],
    };
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function loadDashboard() {
    if (!canUseTauri) { loadFallbackData(); loading = false; return; }
    try {
      const result = await invoke<DashboardPayload>("get_dashboard_data");
      data = result; error = null;
    } catch (err) {
      error = typeof err === "string" ? err : _t('dashboardFailedToLoad');
    } finally { loading = false; }
  }

  function startPolling() {
    if (!canUseTauri) return;
    pollTimer = setInterval(() => { void loadDashboard(); }, 30_000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  onMount(() => {
    void loadDashboard();
    startPolling();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("bento:dashboard-refresh", handleDashboardRefresh as EventListener);
    return () => {
      stopPolling();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("bento:dashboard-refresh", handleDashboardRefresh as EventListener);
    };
  });

  function handleFocus() { void loadDashboard(); }
  function handleDashboardRefresh() { void loadDashboard(); }

  const LAST_MODULE_KEY = "bento:lastModule";
  const LAST_MODULE_AT_KEY = "bento:lastModuleAt";

  // Persist last module whenever we navigate away from dashboard
  async function navigateToModule(id: string) {
    const parsed = moduleIdSchema.safeParse(id);
    if (!parsed.success) {
      return;
    }

    if (browser) {
      try {
        localStorage.setItem(LAST_MODULE_KEY, parsed.data);
        localStorage.setItem(LAST_MODULE_AT_KEY, String(time.now()));
      } catch {}
    }

    try {
      await switchModule(parsed.data as BentoModuleId);
    } catch (err) {
      error = typeof err === "string" ? err : _t('dashboardFailedToOpen');
    }
  }

  // Read the persisted last module on startup — used before Tauri data arrives
  let persistedLastModuleId = $state<string | null>(null);
  let persistedLastModuleName = $state<string | null>(null);
  let persistedLastModuleAt = $state<number>(0);

  // Map of module id → display name (kept in sync with recentModules once loaded)
  const MODULE_NAMES: Record<string, string> = {
    tasks: "Tasks", notes: "Notes", habits: "Habits", focus: "Focus Timer",
    health: "Health", budget: "Budget", journal: "Journal", flashcards: "Flashcards",
    reading: "Reading", goals: "Goals", time: "Time Tracker", mood: "Mood",
    grocery: "Grocery", recipes: "Recipes", countdown: "Countdown",
    "voice-memos": "Voice Memos", clipboard: "Clipboard", nutrition: "Nutrition",
    sleep: "Sleep", breathing: "Breathing", passwords: "Passwords",
    water: "Water", telemetry: "Telemetry",
  };

  if (browser) {
    try {
      const saved = localStorage.getItem(LAST_MODULE_KEY);
      const savedAt = Number(localStorage.getItem(LAST_MODULE_AT_KEY) ?? "0");
      if (saved) {
        persistedLastModuleId = saved;
        persistedLastModuleName = MODULE_NAMES[saved] ?? saved;
        persistedLastModuleAt = Number.isFinite(savedAt) ? savedAt : 0;
      }
    } catch {}
  }

  // The live "last used" module — prefers live Tauri data, falls back to persisted
  const lastModule = $derived.by(() => {
    const liveFirst = data?.recentModules?.[0];
    if (liveFirst) {
      const liveIsNewer =
        !persistedLastModuleAt || liveFirst.lastUsedMs >= persistedLastModuleAt;

      // Keep localStorage in sync with what the backend considers most recent,
      // but do not let a cached backend snapshot overwrite a newer local switch.
      if (browser && liveIsNewer) {
        try {
          localStorage.setItem(LAST_MODULE_KEY, liveFirst.id);
          localStorage.setItem(LAST_MODULE_AT_KEY, String(liveFirst.lastUsedMs));
        } catch {}
      }

      if (liveIsNewer) {
        return { id: liveFirst.id, name: liveFirst.name };
      }
    }
    if (persistedLastModuleId) {
      return { id: persistedLastModuleId, name: persistedLastModuleName ?? persistedLastModuleId };
    }
    return null;
  });

  async function openQuickAdd() {
    if (!canUseTauri) {
      window.dispatchEvent(new CustomEvent("bento:quick-add"));
      return;
    }

    const title = window.prompt("Quick add task", "");
    if (!title || !title.trim()) {
      return;
    }

    try {
      await invoke("create_quick_task", { title: title.trim() });
      await loadDashboard();
    } catch (err) {
      error = typeof err === "string" ? err : _t('dashboardFailedToAdd');
    }
  }
  function openFocusMode() { void navigateToModule("focus"); }
  function continueLastModule() {
    if (lastModule) void navigateToModule(lastModule.id);
  }

  const trendIcon = $derived((direction: string) => direction === "up" ? "↑" : "↓");

  const moduleIconSVG = $derived((iconName: string) => {
    const icons: Record<string, string> = {
      "layout-grid": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
      "file-text": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      "book-heart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M12 6c-1-1.5-3-2-4.5-.5S6 9 12 12c6-3 7-5.5 5.5-7S13 4.5 12 6z"/></svg>`,
      "target": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
      "timer": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M12 2v2"/><path d="M10 2h4"/></svg>`,
      "activity": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
      "smile-plus": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
      "wallet": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      "clock-4": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      "trophy": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
      "clipboard-list": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
      "droplets": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
      "mic": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
      "moon": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
      "wind": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
      "shield-check": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
      "shopping-cart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
      "library": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>`,
      "bot": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
      "settings": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`,
      "gauge": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
      "hourglass": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>`,
      "utensils-crossed": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2v6a4 4 0 0 1-8 0V2"/><path d="M3 2v6a6 6 0 0 0 6 6v8"/><path d="M15 22v-8a6 6 0 0 0 6-6V2"/></svg>`,
      "brain": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 4.5 7.5A5 5 0 1 1 12 18a5 5 0 1 1-4.5-8.5A5 5 0 0 1 12 2z"/><path d="M12 2v20"/></svg>`,
    };
    return icons[iconName] ?? icons["layout-grid"];
  });
</script>

<section class="dashboard">
  {#if loading}
    <div class="dashboard__loading">
      <div class="dashboard__loading-spinner"></div>
      <span>{_t('dashboardLoading')}</span>
    </div>
  {:else if error}
    <div class="dashboard__error">
      <p>{error}</p>
      <button class="dashboard__retry-btn" onclick={() => { loading = true; void loadDashboard(); }}>{_t('dashboardRetry')}</button>
    </div>
  {:else if data}

    <!-- ══ ZONE 1: GREETING ══ -->
    <header class="dashboard__greeting">
      <div class="dashboard__greeting-text">
        <h1 class="dashboard__greeting-heading">{clientGreeting}</h1>
        <p class="dashboard__greeting-insight">{data.insightLine}</p>
      </div>
      <div class="dashboard__pills">
        <button class="dashboard__pill" onclick={openQuickAdd}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__pill-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          {_t('dashboardQuickAdd')}
        </button>
        <button class="dashboard__pill" onclick={continueLastModule} disabled={!lastModule}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__pill-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {_t('dashboardContinueIn').replace('{name}', lastModule?.name ?? '…')}
        </button>
        <button class="dashboard__pill" onclick={openFocusMode}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__pill-icon"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M12 2v2"/><path d="M10 2h4"/></svg>
          {_t('dashboardTodaysFocus')}
        </button>
      </div>
    </header>

    <!-- ══ ZONE 2: THREE CARDS ══ -->
    <div class="dashboard__cards">

      <!-- Card 1: Today's Priority -->
      <article class="dashboard__card dashboard__card--priority" style="--card-accent: {data.featuredModule.accentHex};">
        <div class="dashboard__card-header">
          <span class="dashboard__card-count">{data.featuredModule.primaryCount}</span>
        </div>
        <p class="dashboard__card-primary-label">{data.featuredModule.primaryLabel}</p>

        <!-- ── Linear progress indicator — tasks stack in creation order ── -->
        <ol class="dpi" aria-label="Today's tasks">
          {#each data.featuredModule.items.slice(0, 6) as item, i}
            {@const isLast = i === Math.min(data.featuredModule.items.length, 6) - 1}
            <li class="dpi__item" class:dpi__item--done={item.completed}>
              <!-- Left rail: node + continuous line going down -->
              <div class="dpi__rail">
                <div class="dpi__node" class:dpi__node--done={item.completed}>
                  {#if item.completed}
                    <svg class="dpi__svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="10" cy="10" r="10" fill="#3b82f6"/>
                      <path d="M5.5 10.25l3.25 3.25 5.75-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  {:else}
                    <svg class="dpi__svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                  {/if}
                </div>
                <!-- Line drawn downward — hidden on last item -->
                {#if !isLast}
                  <div class="dpi__connector"
                    class:dpi__connector--done={item.completed && data.featuredModule.items[i + 1]?.completed}>
                  </div>
                {/if}
              </div>
              <!-- Right: text -->
              <div class="dpi__body">
                <span class="dpi__text">{item.text}</span>
                {#if item.secondary}
                  <span class="dpi__secondary"
                    class:dpi__secondary--overdue={item.secondary === 'Overdue'}>
                    {item.secondary}
                  </span>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
        <button class="dashboard__card-action" onclick={() => navigateToModule(data!.featuredModule.id)}>
          {data.featuredModule.descriptorLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__card-arrow"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </article>

      <!-- Card 2: Recent Activity -->
      <article class="dashboard__card dashboard__card--activity">
        <div class="dashboard__card-header">
          <h3 class="dashboard__card-title">{_t('dashboardRecentActivity')}</h3>
        </div>
        <div class="dashboard__activity-feed">
          {#if data.recentActivity.length === 0}
            <div class="dashboard__empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="dashboard__empty-icon"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              <p>{_t('dashboardNoRecentActivity')}</p>
              <span>{_t('dashboardOpenModule')}</span>
            </div>
          {:else}
            {#each data.recentActivity.slice(0, 5) as entry}
              <div class="dashboard__activity-item">
                <div class="dashboard__activity-dot" style="background: {entry.moduleAccent};"></div>
                <div class="dashboard__activity-content">
                  <span class="dashboard__activity-action">{entry.action}</span>
                  <span class="dashboard__activity-module">{entry.moduleName}</span>
                </div>
                <span class="dashboard__activity-time">{entry.timestampRelative}</span>
              </div>
            {/each}
          {/if}
        </div>
      </article>

      <!-- Card 3: Quick Stats -->
      <article class="dashboard__card dashboard__card--stats">
        <div class="dashboard__stat-block dashboard__stat-block--streak"
          style="--stat-gradient-start: {data.gradientColors[0]}; --stat-gradient-end: {data.gradientColors[1]};">
          <div class="dashboard__stat-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__stat-icon"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span class="dashboard__stat-label">{_t('dashboardLongestStreak')}</span>
          </div>
          <div class="dashboard__stat-value">
            <span class="dashboard__stat-number">{data.streak.count}</span>
            <span class="dashboard__stat-unit">{_t('dashboardDays')}</span>
          </div>
          <span class="dashboard__stat-context">{data.streak.count > 0 ? data.streak.moduleName : _t('dashboardNoStreaks')}</span>
        </div>
        <div class="dashboard__stat-block dashboard__stat-block--metric">
          <div class="dashboard__stat-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__stat-icon"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span class="dashboard__stat-label">{data.featuredMetric.label}</span>
          </div>
          <div class="dashboard__stat-value">
            <span class="dashboard__stat-number">{data.featuredMetric.value}</span>
            {#if data.featuredMetric.trend}
              <span class="dashboard__stat-trend"
                class:dashboard__stat-trend--up={data.featuredMetric.trend.direction === "up"}
                class:dashboard__stat-trend--down={data.featuredMetric.trend.direction === "down"}>
                {trendIcon(data.featuredMetric.trend.direction)} {data.featuredMetric.trend.percentage.toFixed(0)}%
              </span>
            {/if}
          </div>
        </div>
      </article>
    </div>

    <!-- ══ ZONE 3: RECENT MODULES ══ -->
    <div class="dashboard__modules">
      <h2 class="dashboard__modules-heading">{_t('dashboardRecentModules')}</h2>
      <div class="dashboard__modules-scroll">
        <div class="dashboard__modules-track">
          {#each data.recentModules.slice(0, 8) as module}
            <button class="dashboard__module-chip" style="--chip-accent: {module.accentHex};" onclick={() => navigateToModule(module.id)}>
              <span class="dashboard__module-chip-icon" style="color: {module.accentHex};">{@html moduleIconSVG(module.icon)}</span>
              <span class="dashboard__module-chip-name">{module.name}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

  {/if}
</section>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     DASHBOARD LAYOUT
     No scrollbars. Everything fits the viewport.
     No sidebar on this page — full width of desktop-workspace__main.
     ═══════════════════════════════════════════════════════════════════ */

  /*
   * The shell's desktop-workspace__main has its own padding (1.5rem).
   * On the dashboard we own all spacing ourselves, so we cancel it out
   * with a :global rule scoped to this component's context.
   * This does NOT affect any other page.
   */
  :global(.desktop-workspace--no-sidebar .desktop-workspace__main) {
    padding: 0 !important;
    overflow: hidden !important;
    /* Dashboard must fill the full main height so cards can stretch into it */
    display: flex !important;
    flex-direction: column !important;
  }

  /* The section must also fill the available height the shell gives it */
  :global(.desktop-workspace--no-sidebar .desktop-workspace__main > section) {
    flex: 1 1 0 !important;
    min-height: 0 !important;
  }

  .dashboard {
    /*
     * 3-row grid — exactly matching 3 HTML children:
     *   row 1: greeting  → auto (shrinks to content)
     *   row 2: cards     → 1fr  (grows to fill all leftover space)
     *   row 3: modules   → auto (shrinks to content)
     * This means cards always fill the viewport — no dead space at the bottom.
     */
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;                      /* fill the flex parent */
    width: 100%;
    max-width: min(900px, 100%);
    margin: 0 auto;
    padding: clamp(24px, 4vh, 48px) clamp(20px, 3vw, 48px) clamp(16px, 2vh, 32px);
    box-sizing: border-box;
    overflow: hidden;
    background: var(--background);
    animation: dashboard-fade-in 300ms ease;
  }

  @keyframes dashboard-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Loading & Error ── */

  .dashboard__loading,
  .dashboard__error {
    display: grid;
    place-items: center;
    gap: 0.75rem;
    min-height: 12rem;
    color: var(--muted);
  }

  .dashboard__loading-spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--border);
    border-top-color: var(--foreground);
    border-radius: 50%;
    animation: dashboard-spin 800ms linear infinite;
  }

  @keyframes dashboard-spin { to { transform: rotate(360deg); } }

  .dashboard__error p { color: var(--destructive); font-size: 0.9rem; }

  .dashboard__retry-btn {
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: transparent;
    color: var(--foreground);
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: default;
    transition: background 150ms ease;
  }
  .dashboard__retry-btn:hover { background: color-mix(in srgb, var(--foreground) 8%, transparent); }

  /* ═══════════════════════════════════════════════════════════════════
     DAILY PROGRESS INDICATOR  (dpi)
     Architecture: each item owns its NODE + the LINE below it.
     The line stretches to fill the full remaining height of the item,
     so it connects flush into the next node — no gaps, no cuts.
     ═══════════════════════════════════════════════════════════════════ */
  .dpi {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  /* Each row: [rail | body] */
  .dpi__item {
    display: flex;
    align-items: stretch;   /* rail stretches full row height */
    gap: 10px;
  }

  /* Left rail — fixed width, holds node at top + connector line below */
  .dpi__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 20px;
  }

  /* The circular node — sits at the top of the rail */
  .dpi__node {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  /* Single SVG for both states — no filter/shadow */
  .dpi__svg {
    width: 20px;
    height: 20px;
    display: block;
  }

  /* Pending node ring color */
  .dpi__node:not(.dpi__node--done) .dpi__svg {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  /* Connector line — fills all remaining vertical space below the node */
  .dpi__connector {
    flex: 1;
    width: 2px;
    min-height: 6px;
    background: color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 0;       /* square ends so segments butt perfectly */
    margin-top: 0;
    margin-bottom: 0;
  }

  /* Blue line when both this item AND next item are done */
  .dpi__connector--done {
    background: #3b82f6;
  }

  /* Right body — text block, padding-bottom creates the row height
     which the rail's connector fills exactly */
  .dpi__body {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 2px;
    padding: 1px 0 14px;    /* top aligns with node center; bottom = spacing between rows */
    min-width: 0;
    flex: 1;
  }

  /* Last item has no connector so no bottom padding needed */
  .dpi__item:last-child .dpi__body {
    padding-bottom: 2px;
  }

  .dpi__text {
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 0.2s ease;
  }

  .dpi__item--done .dpi__text {
    opacity: 0.4;
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--foreground) 25%, transparent);
  }

  .dpi__secondary {
    font-size: 10.5px;
    font-weight: 500;
    color: color-mix(in srgb, var(--foreground) 38%, transparent);
    letter-spacing: 0.01em;
  }

  .dpi__secondary--overdue {
    color: #ef4444;
    font-weight: 600;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ZONE 1: GREETING
     Left-aligned text block. No card, no border, no background.
     ═══════════════════════════════════════════════════════════════════ */

  .dashboard__greeting {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* Breathing gap to Zone 2 — scales with viewport */
    margin-bottom: clamp(20px, 3vh, 36px);
  }

  .dashboard__greeting-text {
    display: flex;
    flex-direction: column;
  }

  .dashboard__greeting-heading {
    margin: 0;
    font-family: var(--font-display);
    /* 34px on large screens, shrinks gracefully */
    font-size: clamp(24px, 3.5vh, 34px);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-tight);
    line-height: var(--line-height-tight);
    color: var(--foreground);
  }

  .dashboard__greeting-insight {
    margin: 0.35rem 0 0;
    color: var(--muted);
    font-size: clamp(13px, 1.8vh, 15px);
    font-weight: 400;
    line-height: var(--line-height-normal);
  }

  /* Pills — 16px below insight, transparent, neutral */

  .dashboard__pills {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;                 /* never wrap — pills clip gracefully */
    margin-top: clamp(10px, 1.5vh, 16px);
    overflow: hidden;                  /* clip if truly tiny screen */
  }

  .dashboard__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 32px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: transparent;
    color: var(--foreground);
    font-size: 12px;
    font-weight: 500;
    cursor: default;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, transform 120ms ease;
    flex-shrink: 0;
  }

  .dashboard__pill:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    border-color: color-mix(in srgb, var(--border) 80%, var(--foreground));
    transform: translateY(-1px);
  }

  .dashboard__pill:active { transform: translateY(0) scale(0.985); }

  .dashboard__pill-icon {
    width: 0.8rem;
    height: 0.8rem;
    flex-shrink: 0;
    opacity: 0.65;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ZONE 2: THREE CARDS
     Must never overflow horizontally or vertically.
     Cards flex-fill available height — no fixed min-height.
     ═══════════════════════════════════════════════════════════════════ */

  .dashboard__cards {
    display: grid;
    /* Fluid columns — will compress on smaller viewports */
    grid-template-columns: 1.4fr 1fr 0.9fr;
    gap: clamp(10px, 1.5vw, 20px);
    /* Cards fill the available vertical space */
    align-items: stretch;
    /* Height is driven by the grid parent (dashboard row 2) — no explicit height */
    min-height: 0;
    margin-bottom: clamp(16px, 2.5vh, 28px);
  }

  .dashboard__card {
    display: grid;
    gap: 0.55rem;
    padding: 0;
    border-radius: 20px;
    min-width: 0;                      /* prevent horizontal blowout */
    min-height: 0;                     /* prevent vertical blowout */
    overflow: hidden;
  }

  .dashboard__card:hover { opacity: 0.97; }

  .dashboard__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .dashboard__card-title {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: var(--letter-spacing-normal);
    color: var(--foreground);
  }

  /* Card 1 — Priority */
  .dashboard__card--priority {
    --card-accent: var(--accent);
    padding: clamp(16px, 2.5vw, 24px);
    background: color-mix(in srgb, var(--card-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--card-accent) 20%, transparent);
    /* Internal layout: header → label → items (stretch) → action pinned bottom */
    grid-template-rows: auto auto 1fr auto;
  }

  .dashboard__card-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.6rem 0.2rem 0.4rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--card-accent) 14%, transparent);
    color: var(--card-accent);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wider);
  }

  .dashboard__card-badge :global(svg) { width: 0.8rem; height: 0.8rem; }

  .dashboard__card-count {
    font-family: var(--font-display);
    /* 64px target, scales down on short/narrow screens */
    font-size: clamp(40px, 6vh, 64px);
    font-weight: 800;
    letter-spacing: var(--letter-spacing-tight);
    color: var(--card-accent);
    line-height: 1;
  }

  .dashboard__card-primary-label {
    margin: -0.15rem 0 0;
    color: var(--muted);
    font-size: clamp(11px, 1.5vh, 14px);
  }

  .dashboard__card-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
    align-content: start;
    overflow: hidden;
  }

  .dashboard__card-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    min-width: 0;
  }

  .dashboard__card-item-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dashboard__card-item-text {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dashboard__card-item-secondary {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
  }

  .dashboard__card-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: none;
    background: transparent;
    color: var(--card-accent);
    font-size: 12px;
    font-weight: 700;
    cursor: default;
    padding: 0.25rem 0;
    transition: gap 150ms ease;
  }
  .dashboard__card-action:hover { gap: 0.55rem; }
  .dashboard__card-arrow { width: 0.8rem; height: 0.8rem; transition: transform 150ms ease; }
  .dashboard__card-action:hover .dashboard__card-arrow { transform: translateX(2px); }

  /* Card 2 — Activity */
  .dashboard__card--activity {
    padding: clamp(16px, 2.5vw, 24px);
    background: var(--surface);
    border: 1px solid var(--border);
    grid-template-rows: auto 1fr;
  }

  .dashboard__activity-feed { display: grid; gap: 0.25rem; margin-top: 0.2rem; overflow: hidden; }

  .dashboard__activity-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.55rem;
    align-items: center;
    padding: 0.4rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  }
  .dashboard__activity-item:last-child { border-bottom: none; }

  .dashboard__activity-dot { width: 0.45rem; height: 0.45rem; border-radius: 50%; flex-shrink: 0; }

  .dashboard__activity-content { display: grid; gap: 0.08rem; min-width: 0; }

  .dashboard__activity-action {
    font-size: 12px;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dashboard__activity-module { font-size: 10px; color: var(--muted); font-weight: 600; }
  .dashboard__activity-time { flex-shrink: 0; font-size: 10px; color: var(--muted); font-weight: 600; }

  .dashboard__empty-state {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    padding: 1rem;
    text-align: center;
    color: var(--muted);
  }
  .dashboard__empty-icon { width: 1.75rem; height: 1.75rem; opacity: 0.4; }
  .dashboard__empty-state p { margin: 0; font-weight: 600; font-size: 13px; color: var(--foreground); }
  .dashboard__empty-state span { font-size: 11px; }

  /* Card 3 — Stats: two stacked halves */
  .dashboard__card--stats {
    display: grid;
    grid-template-rows: 1fr 1fr;
    gap: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid var(--border);
  }

  .dashboard__stat-block {
    display: grid;
    gap: 0.2rem;
    padding: clamp(12px, 2vw, 20px);
    min-height: 0;
    overflow: hidden;
  }

  .dashboard__stat-block--streak {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--stat-gradient-start) 12%, transparent),
      color-mix(in srgb, var(--stat-gradient-end) 6%, transparent)
    );
    border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  }

  .dashboard__stat-block--streak .dashboard__stat-number {
    color: color-mix(in srgb, var(--stat-gradient-start) 78%, var(--stat-gradient-end));
  }

  .dashboard__stat-header { display: flex; align-items: center; gap: 0.4rem; }
  .dashboard__stat-icon { width: 0.8rem; height: 0.8rem; color: var(--muted); }

  .dashboard__stat-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .dashboard__stat-value { display: flex; align-items: baseline; gap: 0.4rem; }

  .dashboard__stat-number {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: var(--letter-spacing-tight);
    line-height: 1;
    color: var(--foreground);
  }

  .dashboard__stat-block--streak .dashboard__stat-number {
    font-size: clamp(32px, 5vh, 48px);
  }

  .dashboard__stat-block--metric .dashboard__stat-number {
    font-size: clamp(24px, 4vh, 36px);
    font-weight: 700;
  }

  .dashboard__stat-unit { font-size: 11px; font-weight: 700; color: var(--muted); }
  .dashboard__stat-context { font-size: 10px; color: var(--muted); }
  .dashboard__stat-trend { font-size: 11px; font-weight: 700; }
  .dashboard__stat-trend--up { color: #22c55e; }
  .dashboard__stat-trend--down { color: #ef4444; }

  /* ═══════════════════════════════════════════════════════════════════
     ZONE 3: RECENT MODULES
     Hidden on short screens. No scrollbar ever visible.
     ═══════════════════════════════════════════════════════════════════ */

  .dashboard__modules {
    overflow: hidden;
  }

  .dashboard__modules-heading {
    margin: 0 0 10px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .dashboard__modules-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .dashboard__modules-scroll::-webkit-scrollbar { display: none; }

  .dashboard__modules-track {
    display: inline-flex;
    gap: 0.5rem;
    padding: 0.1rem 0 0.25rem;
  }

  .dashboard__module-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    border-radius: 9999px;
    color: var(--foreground);
    font-size: 11px;
    font-weight: 500;
    cursor: default;
    white-space: nowrap;
    transition: background 150ms ease, transform 120ms ease;
    flex-shrink: 0;
  }

  .dashboard__module-chip:hover { transform: translateY(-1px); }
  .dashboard__module-chip:active { transform: translateY(0) scale(0.985); }

  .dashboard__module-chip-icon { display: inline-flex; align-items: center; }
  .dashboard__module-chip-icon :global(svg) { width: 0.85rem; height: 0.85rem; }
  .dashboard__module-chip-name { white-space: nowrap; }

  /* ═══════════════════════════════════════════════════════════════════
     RESPONSIVE — width breakpoints (horizontal overflow prevention)
     ═══════════════════════════════════════════════════════════════════ */

  /* Medium desktop — 2-col cards, stats goes full-width */
  @media (max-width: 860px) {
    .dashboard__cards {
      grid-template-columns: 1fr 1fr;
    }
    .dashboard__card--stats {
      grid-column: 1 / -1;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto;
    }
  }

  /* Small / compact — single column */
  @media (max-width: 520px) {
    .dashboard { padding: 20px 16px 16px; }
    .dashboard__cards { grid-template-columns: 1fr; }
    .dashboard__card--stats {
      grid-column: auto;
      grid-template-columns: 1fr;
    }
    .dashboard__pills { overflow-x: auto; flex-wrap: nowrap; }
  }

  /* ═══════════════════════════════════════════════════════════════════
     RESPONSIVE — height breakpoints (vertical overflow prevention)
     ═══════════════════════════════════════════════════════════════════ */

  /* Tall screens (≥900px): extra breathing */
  @media (min-height: 900px) {
    .dashboard__greeting { margin-bottom: clamp(28px, 4vh, 48px); }
    .dashboard__cards { margin-bottom: clamp(20px, 3vh, 36px); }
  }

  /* Short screens (<700px): hide Zone 3, compress greeting */
  @media (max-height: 700px) {
    .dashboard__modules { display: none; }
    .dashboard__greeting { margin-bottom: clamp(12px, 2vh, 20px); }
    .dashboard__cards { margin-bottom: 0; }
    .dashboard__greeting-heading { font-size: clamp(20px, 3vh, 28px); }
  }

  /* Very short (<560px): further compress */
  @media (max-height: 560px) {
    .dashboard { padding-top: 16px; }
    .dashboard__pills { display: none; }
  }
</style>
