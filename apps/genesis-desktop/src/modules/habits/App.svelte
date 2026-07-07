<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import CheckIcon from "@lucide/svelte/icons/check";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import Grid3x3Icon from "@lucide/svelte/icons/grid-3x3";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import SearchIcon from "@lucide/svelte/icons/search";
  import TargetIcon from "@lucide/svelte/icons/target";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from "$lib/components/ui/card/index.js";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  let { moduleId = 'habits', settings = {} } = $props();
  $effect(() => { void settings; });

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Section nav ─────────────────────────────────────────────────
  const sectionLabels = ["Today", "Streaks", "Heatmap", "Review", "Settings"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));
  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  // ── Loading / error ──────────────────────────────────────────────
  let loading = $state(true);
  let loadError = $state('');

  // ── State ────────────────────────────────────────────────────────
  type CompletionType = 'binary' | 'count' | 'duration';
  type Frequency = 'daily' | 'weekdays' | 'weekends';
  type HabitKind = 'build' | 'quit';

  type Habit = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    kind: HabitKind;
    streak: number;
    longestStreak: number;
    completedToday: boolean;
    skippedToday: boolean;
    frozenStreak: boolean;
    completionType: CompletionType;
    targetCount: number;
    currentCount: number;
    unit: string;
    frequency: Frequency;
    why: string;
    completionHistory: boolean[];
    archived: boolean;
    createdAt: number;
  };

  let habits: Habit[] = $state([]);

  // ── Backend sync ─────────────────────────────────────────────────
  async function loadHabits() {
    loading = true;
    loadError = '';
    try {
      const rows: any[] = await invoke('habits_list');
      habits = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        color: r.color,
        kind: (r.kind || 'build') as HabitKind,
        streak: r.streak ?? 0,
        longestStreak: r.longestStreak ?? 0,
        completedToday: r.completedToday ?? false,
        skippedToday: r.skippedToday ?? false,
        frozenStreak: r.frozenStreak ?? false,
        completionType: (r.completionType || 'binary') as CompletionType,
        targetCount: r.targetCount ?? 1,
        currentCount: r.currentCount ?? 0,
        unit: r.unit || '',
        frequency: (r.frequency || 'daily') as Frequency,
        why: r.why || '',
        completionHistory: Array.isArray(r.completionHistory) ? r.completionHistory : [],
        archived: r.archived ?? false,
        createdAt: r.createdAt ?? Date.now(),
      }));
    } catch (e: any) {
      loadError = String(e?.message || e);
      habits = [];
    } finally {
      loading = false;
    }
  }

  async function loadFreezeState() {
    try {
      const state: any = await invoke('habits_get_freeze_state');
      freezeTokens = state.freezeTokens ?? 3;
      usedFreezeTokens = state.usedFreezeTokens ?? 0;
    } catch {
      freezeTokens = 3;
      usedFreezeTokens = 0;
    }
  }

  let freezeTokens = $state(3);
  let usedFreezeTokens = $state(0);
  let availableFreezeTokens = $derived(freezeTokens - usedFreezeTokens);

  onMount(() => {
    loadHabits();
    loadFreezeState();
  });

  // ── Derived ─────────────────────────────────────────────────────
  let activeHabits = $derived(habits.filter(h => !h.archived));
  let completedCount = $derived(activeHabits.filter(h => h.completedToday).length);
  let totalHabits = $derived(activeHabits.length);
  let progressPct = $derived(totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0);
  let topStreak = $derived(Math.max(...activeHabits.map(h => h.streak), 0));
  let avgRate = $derived(activeHabits.length > 0
    ? Math.round(activeHabits.reduce((s,h) => s + h.completionHistory.filter(Boolean).length / 90, 0) / activeHabits.length * 100) : 0);
  let sortedByStreak = $derived([...activeHabits].sort((a,b) => b.streak - a.streak));
  let bestHabit = $derived([...activeHabits].sort((a,b) =>
    b.completionHistory.filter(Boolean).length - a.completionHistory.filter(Boolean).length)[0]);
  let thisWeekTotal = $derived(activeHabits.reduce((s,h) => s + h.completionHistory.slice(-7).filter(Boolean).length, 0));

  let bestDay = $derived.by(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = [0,0,0,0,0,0,0];
    const today = new Date();
    activeHabits.forEach(h => h.completionHistory.forEach((done,i) => {
      if (done) { const d = new Date(today); d.setDate(today.getDate()-(89-i)); counts[d.getDay()]++; }
    }));
    return days[counts.indexOf(Math.max(...counts))];
  });

  // ── Insight generation ─────────────────────────────────────────
  // Today page = quick nudges. Review page = deeper patterns.
  let todayNudges = $derived.by((): { emoji: string; message: string }[] => {
    const msgs: { emoji: string; message: string }[] = [];
    if (activeHabits.length === 0) return [{ emoji: "🌱", message: "Add your first habit. One small step is all it takes." }];

    const undone = activeHabits.filter(h => !h.completedToday && !h.skippedToday);
    if (undone.length === 0) {
      msgs.push({ emoji: "🌟", message: "Everything is done today. Take a moment to appreciate that." });
    } else if (undone.length <= 2) {
      msgs.push({ emoji: "🍃", message: `Just ${undone.length} left — you've got this. No rush.` });
    } else {
      msgs.push({ emoji: "💛", message: `${undone.length} remaining. Pick one, start there. That's enough.` });
    }

    const completed = activeHabits.filter(h => h.completedToday);
    if (completed.length > 0) {
      const quitDone = completed.find(h => h.kind === 'quit');
      if (quitDone) {
        msgs.push({ emoji: "🛡️", message: `You resisted ${quitDone.name} today — that's a choice worth celebrating.` });
      }
    }

    if (topStreak >= 7 && sortedByStreak[0]) {
      msgs.push({ emoji: "🌿", message: `${sortedByStreak[0].name} is at ${topStreak} days. You're in a rhythm now.` });
    }

    return msgs;
  });

  let reviewInsights = $derived.by((): { emoji: string; message: string }[] => {
    const msgs: { emoji: string; message: string }[] = [];
    if (activeHabits.length === 0) return [{ emoji: "🌱", message: "Start small. One habit at a time. The data will follow." }];

    if (topStreak >= 14) msgs.push({ emoji: "🌿", message: `${sortedByStreak[0]?.name} at ${topStreak} days — that's two weeks of steady practice. Real momentum.` });
    else if (topStreak >= 7) msgs.push({ emoji: "💪", message: `${sortedByStreak[0]?.name} reached ${topStreak} days. The first week is the hardest — you've built a foundation.` });
    else if (topStreak >= 3) msgs.push({ emoji: "🌱", message: `A ${topStreak}-day streak on ${sortedByStreak[0]?.name}. Keep showing up — it compounds.` });
    else msgs.push({ emoji: "💛", message: "Every streak starts with day one. You're here, and that matters." });

    if (avgRate >= 80) msgs.push({ emoji: "✨", message: `${avgRate}% consistency over 90 days — that's extraordinary. Trust the process.` });
    else if (avgRate >= 60) msgs.push({ emoji: "👏", message: `${avgRate}% of days over 90 days. Progress, not perfection — you're building a practice.` });
    else if (avgRate >= 40) msgs.push({ emoji: "🔄", message: `${avgRate}% completion over 90 days. Small improvements compound. Try stacking a new habit onto an existing routine.` });
    else msgs.push({ emoji: "🌸", message: "Some seasons are gentler than others. Showing up even some of the time is still a win." });

    if (bestDay) msgs.push({ emoji: "📅", message: `${bestDay}s are your strongest day. What makes ${bestDay}s different? Leaning into that pattern could help.` });

    const quitting = activeHabits.filter(h => h.kind === 'quit');
    if (quitting.length > 0) {
      const qStreaks = quitting.filter(h => h.streak >= 3);
      if (qStreaks.length > 0) {
        msgs.push({ emoji: "🛡️", message: `Reducing ${qStreaks[0].name} for ${qStreaks[0].streak} days — every resisted urge rewires the habit loop.` });
      } else {
        msgs.push({ emoji: "💛", message: `Working on reducing ${quitting[0].name}. Be kind to yourself — changing takes time.` });
      }
    }

    // Pattern: consistency across weekdays
    if (activeHabits.length >= 3) {
      const weekCounts = [0,0,0,0,0,0,0];
      const today = new Date();
      activeHabits.forEach(h => h.completionHistory.forEach((done, i) => {
        if (done) { const d = new Date(today); d.setDate(today.getDate()-(89-i)); weekCounts[d.getDay()]++; }
      }));
      const max = Math.max(...weekCounts);
      const nonZero = weekCounts.filter(c => c > 0);
      if (nonZero.length > 0) {
        const min = Math.min(...nonZero);
        if (max > 0 && max - min > 5) {
        const bestDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weekCounts.indexOf(max)];
        const worstDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weekCounts.indexOf(min)];
        msgs.push({ emoji: "📊", message: `Your consistency dips on ${worstDayName}s. Could you prepare something the night before?` });
      } }
    }

    return msgs;
  });

  // ── Actions ─────────────────────────────────────────────────────
  async function toggleComplete(id: string) {
    try {
      await invoke('habits_toggle_complete', { habitId: id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function skipHabit(id: string) {
    try {
      await invoke('habits_skip_today', { habitId: id });
      await loadHabits();
    } catch {
      // fallback: local only
      habits = habits.map(h => h.id !== id ? h : { ...h, skippedToday: true, completedToday: false });
    }
  }

  async function freezeStreak(id: string) {
    if (availableFreezeTokens <= 0) return;
    try {
      await invoke('habits_freeze_streak', { habitId: id });
      await loadHabits();
      await loadFreezeState();
    } catch {
      // fallback
      habits = habits.map(h => h.id !== id ? h : { ...h, frozenStreak: true });
      usedFreezeTokens++;
    }
  }

  async function incrementCount(id: string) {
    try {
      await invoke('habits_increment', { habitId: id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function archiveHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!confirm(`Archive "${habit.name}"? You can always unarchive it later.`)) return;
    try {
      await invoke('habits_save', {
        input: {
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          kind: habit.kind,
          completionType: habit.completionType,
          targetCount: habit.targetCount,
          unit: habit.unit,
          frequency: habit.frequency,
          why: habit.why,
          archived: true,
        },
      });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function unarchiveHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    try {
      await invoke('habits_save', {
        input: {
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          kind: habit.kind,
          completionType: habit.completionType,
          targetCount: habit.targetCount,
          unit: habit.unit,
          frequency: habit.frequency,
          why: habit.why,
          archived: false,
        },
      });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function deleteHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!confirm(`Permanently delete "${habit.name}"? This cannot be undone.`)) return;
    try {
      await invoke('habits_delete', { id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  // ── Add / Edit habit modal ──────────────────────────────────────
  let showAddModal = $state(false);
  let editingHabitId: string | null = $state(null);
  let isEditing = $derived(editingHabitId !== null);
  let newHabit = $state({
    name: '', emoji: '⭐', color: 'var(--mod-accent)',
    kind: 'build' as HabitKind,
    completionType: 'binary' as CompletionType,
    targetCount: 1, unit: '', frequency: 'daily' as Frequency, why: '',
  });
  const emojiOptions = ['⭐','🚶','📖','💧','🫁','📱','🎯','💪','🥗','😴','🎨','🎵','✍️','🌿','🧠','🧘','🏃','💻','🎧','☕'];
  const colorOptions = ['var(--mod-accent)','#7c3aed','#0284c7','#d97706','#16a34a','#dc2626','#e05a3a'];

  function openAddModal() {
    editingHabitId = null;
    newHabit = { name: '', emoji: '⭐', color: 'var(--mod-accent)', kind: 'build', completionType: 'binary', targetCount: 1, unit: '', frequency: 'daily', why: '' };
    showAddModal = true;
  }

  function openEditModal(h: Habit) {
    editingHabitId = h.id;
    newHabit = {
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      kind: h.kind,
      completionType: h.completionType,
      targetCount: h.targetCount,
      unit: h.unit,
      frequency: h.frequency,
      why: h.why,
    };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
    editingHabitId = null;
    newHabit = { name: '', emoji: '⭐', color: 'var(--mod-accent)', kind: 'build', completionType: 'binary', targetCount: 1, unit: '', frequency: 'daily', why: '' };
  }

  async function saveNewHabit() {
    if (!newHabit.name.trim()) return;
    try {
      await invoke('habits_save', {
        input: {
          ...(editingHabitId ? { id: editingHabitId } : {}),
          name: newHabit.name.trim(),
          emoji: newHabit.emoji,
          color: newHabit.color,
          kind: newHabit.kind,
          completionType: newHabit.completionType,
          targetCount: newHabit.targetCount,
          unit: newHabit.unit,
          frequency: newHabit.frequency,
          why: newHabit.why,
        },
      });
      closeAddModal();
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  // ── Heatmap ─────────────────────────────────────────────────────
  let heatmapHabitId: string | null = $state(null);
  let heatmapHabit = $derived(activeHabits.find(h => h.id === heatmapHabitId) ?? activeHabits[0]);
  function hmOpacity(i: number) { return (0.3 + 0.7 * (i / 89)).toFixed(2); }

  // ── Why modal ───────────────────────────────────────────────────
  let whyHabitId: string | null = $state(null);
  let whyHabit = $derived(activeHabits.find(h => h.id === whyHabitId));

  // ── Mood tagging ────────────────────────────────────────────────
  let habitMoods: Record<string, string> = $state({});

  // ── Settings toggles ────────────────────────────────────────────
  let notifyEndOfDay = $state(true);
  let notifyMilestones = $state(true);
  let notifyWeeklyReview = $state(true);
</script>

<main class="hb-workspace module-root" data-module="habits">

  {#if loading}
    <div class="hb-loading">
      <div class="hb-loading__orb"></div>
      <span>Loading your habits…</span>
    </div>

  {:else if loadError}
    <div class="hb-loading">
      <p>Could not load habits: {loadError}</p>
      <Button onclick={() => { location.reload(); }}>Retry</Button>
    </div>

  {:else}
  <!-- ════════════════════════════════════════ TODAY ════════════════════════════════════════ -->
  {#if selectedSection === "Today"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><TargetIcon size={13}/><span>Habits</span><Badge variant="outline">Today</Badge></div>
        <h1>Today's practice</h1>
        <p>One tap to log. No pressure, no judgment — just showing up is enough.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
        {#if activeHabits.length > 0}
          <Button variant="outline" onclick={() => whyHabitId = activeHabits[0]?.id ?? null}><SparklesIcon size={15}/>&nbsp;Your Why</Button>
        {/if}
      </div>
    </header>

    <!-- Hero: ring + glance -->
    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>{completedCount} of {totalHabits} done today</CardDescription>
        </CardHeader>
        <CardContent class="hb-ring-content">
          <div class="hb-ring-wrap">
            <PremiumRing
              size={140}
              thickness={11}
              segments={[{ value: progressPct, color: "var(--mod-accent)", label: "Done" }]}
              centerLabel="Today"
              centerValue={`${Math.round(progressPct)}%`}
              centerNote={`${completedCount}/${totalHabits}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>At a glance</CardTitle>
          <CardDescription>Your momentum, right now.</CardDescription>
        </CardHeader>
        <CardContent class="hb-glance">
          <article><span>Top streak</span><strong>{topStreak} days</strong></article>
          <article><span>90-day rate</span><strong>{avgRate}%</strong></article>
          <article><span>Best day</span><strong>{bestDay}s</strong></article>
          <article><span>Freeze tokens</span><strong>{availableFreezeTokens} left</strong></article>
        </CardContent>
      </Card>
    </section>

    <!-- Body: habit list + insights -->
    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>Your habits</CardTitle>
          <CardDescription>Tap to log. Tap name to remember your why.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h (h.id)}
            <article class="hb-habit-row" class:hb-done={h.completedToday} class:hb-skip={h.skippedToday} style="--hc:{h.color}">
              <button class="hb-check" class:hb-check-on={h.completedToday} onclick={() => toggleComplete(h.id)}>
                {#if h.completedToday}<CheckIcon size={14}/>{/if}
              </button>
              <button class="hb-identity" onclick={() => whyHabitId = h.id}>
                <span class="hb-emoji">{h.emoji}</span>
                <div>
                  <span class="hb-hname">{h.name}</span>
                  <span class="hb-kind">{h.kind === 'quit' ? 'reducing' : h.frequency}</span>
                </div>
              </button>
              {#if h.completionType !== 'binary'}
                <div class="hb-count-block">
                  <span>{h.currentCount}/{h.targetCount}&thinsp;{h.unit}</span>
                  {#if !h.completedToday && !h.skippedToday}
                    <button class="hb-inc" onclick={() => incrementCount(h.id)}>+1</button>
                  {/if}
                </div>
              {/if}
              <div class="hb-streak-pill" class:hb-frozen={h.frozenStreak} title={h.frozenStreak ? 'Frozen' : `Day ${h.streak}`}>
                <span>{h.streak}</span><span class="hb-streak-unit">d</span>
              </div>
              <div class="hb-row-actions">
                {#if !h.skippedToday && !h.completedToday}
                  <button class="hb-icon-btn hb-icon-btn--subtle" title="Skip today — no guilt" onclick={() => skipHabit(h.id)}>
                    <span class="hb-skip-icon">→</span>
                  </button>
                {/if}
                {#if !h.frozenStreak && !h.completedToday && availableFreezeTokens > 0}
                  <button class="hb-icon-btn hb-icon-btn--ice" title="Protect streak" onclick={() => freezeStreak(h.id)}>❄</button>
                {/if}
                {#if h.completedToday}
                  <div class="hb-mood-group">
                    {#each ['😤','😐','🙂','😊','🔥'] as mood}
                      <button class="hb-mood-btn" class:hb-mood-on={habitMoods[h.id] === mood}
                        onclick={() => habitMoods = {...habitMoods, [h.id]: mood}}>{mood}</button>
                    {/each}
                  </div>
                {/if}
              </div>
            </article>
          {/each}
          {#if activeHabits.length === 0}
            <div class="hb-empty">
              <span>🌱</span>
              <p>No habits yet. Start with one — small steps compound.</p>
              <button class="hb-add-inline" onclick={openAddModal}>+ Add your first habit</button>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Small nudges</CardTitle>
          <CardDescription>Quiet reminders for today.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each todayNudges as insight}
            <article class="hb-insight">
              <span class="hb-insight-emoji">{insight.emoji}</span>
              <p>{insight.message}</p>
            </article>
          {/each}
          {#if activeHabits.length > 0}
            <article class="hb-insight hb-insight--action">
              <span class="hb-insight-emoji">🎯</span>
              <p>Start with <strong>{sortedByStreak[0]?.name}</strong> — it's your strongest momentum today.</p>
            </article>
          {/if}
          {#if activeHabits.length > 0 && completedCount === totalHabits && totalHabits > 1}
            <article class="hb-insight hb-insight--celebration">
              <span class="hb-insight-emoji">🌟</span>
              <p>Everything done! Take a breath. You showed up fully today.</p>
            </article>
          {/if}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ STREAKS ════════════════════════════════════════ -->
  {:else if selectedSection === "Streaks"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><TrendingUpIcon size={13}/><span>Habits</span><Badge variant="outline">Streaks</Badge></div>
        <h1>Your rhythm</h1>
        <p>Streaks reflect consistency — not worth. Every day is a fresh start, and every restart is part of the journey.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
      </div>
    </header>

    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>Longest active streak</CardTitle>
          <CardDescription>{sortedByStreak[0]?.name ?? '—'}</CardDescription>
        </CardHeader>
        <CardContent class="hb-streak-hero-content">
          <div class="hb-big-number">{topStreak}</div>
          <div class="hb-big-label">days</div>
          {#if topStreak >= 7}
            <div class="hb-badge-milestone">✨ Two-week momentum building</div>
          {:else if topStreak >= 3}
            <div class="hb-badge-milestone">💪 First week — the hardest part is behind you</div>
          {:else}
            <div class="hb-badge-milestone">🌱 Every streak starts with day one</div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Freeze tokens</CardTitle>
          <CardDescription>Life happens. Use a token to protect a streak without pressure.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <div class="hb-token-display">
            {#each Array(freezeTokens) as _, i}
              <span class="hb-token" class:hb-token-spent={i < usedFreezeTokens}>❄️</span>
            {/each}
          </div>
          <article><span>Available</span><strong>{availableFreezeTokens} of {freezeTokens}</strong></article>
          <article class="hb-tip-small"><p>Tokens reset monthly. Apply one before the day ends to keep your streak safe.</p></article>
        </CardContent>
      </Card>
    </section>

    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>Streak board</CardTitle>
          <CardDescription>All habits by longest current run. Last 21 days shown.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each sortedByStreak as h (h.id)}
            <article class="hb-streak-row" style="--hc:{h.color}">
              <span class="hb-s-emoji">{h.emoji}</span>
              <div class="hb-s-info">
                <strong>{h.name}</strong>
                <div class="hb-chain">
                  {#each h.completionHistory.slice(-21) as day}
                    <div class="hb-dot" class:hb-dot-on={day}></div>
                  {/each}
                </div>
              </div>
              <div class="hb-s-nums">
                <span class="hb-s-cur">{h.streak}d</span>
                <span class="hb-s-best">best {h.longestStreak}d</span>
              </div>
              <div class="hb-s-actions">
                {#if !h.frozenStreak && availableFreezeTokens > 0}
                  <button class="hb-freeze-btn" onclick={() => freezeStreak(h.id)}>❄ Freeze</button>
                {:else if h.frozenStreak}
                  <span class="hb-frozen-lbl">❄️ Safe</span>
                {/if}
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habit strength</CardTitle>
          <CardDescription>Streak × consistency × recency — your real momentum.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each [...activeHabits].sort((a,b) => {
            const sa = (a.streak * 0.5) + (a.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (a.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
            const sb = (b.streak * 0.5) + (b.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (b.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
            return sb - sa;
          }) as h}
            {const score = Math.min(100, Math.round(
              (h.streak * 0.5) + (h.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) +
              (h.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100)
            ))}
            <article style="--hc:{h.color}">
              <span>{h.emoji}&thinsp;{h.name}</span>
              <div class="hb-strength-bar-wrap"><div class="hb-strength-bar" style="width:{score}%;background:{h.color}"></div></div>
              <strong>{score}</strong>
            </article>
          {/each}
          <article class="hb-tip-small"><p>Strength = Streak (50%) + 90-day rate (30%) + Last 7 days (20%).</p></article>
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ HEATMAP ════════════════════════════════════════ -->
  {:else if selectedSection === "Heatmap"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><Grid3x3Icon size={13}/><span>Habits</span><Badge variant="outline">Heatmap</Badge></div>
        <h1>90 days at a glance</h1>
        <p>Every cell is a day. Patterns emerge when you zoom out and look with kindness.</p>
      </div>
    </header>

    {#if heatmapHabit}
      <section class="hb-hero-grid hb-hero-grid--4">
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.completionHistory.filter(Boolean).length}</strong>
            <span>days completed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{Math.round(heatmapHabit.completionHistory.filter(Boolean).length / 90 * 100)}%</strong>
            <span>completion rate</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.streak}</strong>
            <span>current streak</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.longestStreak}</strong>
            <span>best ever</span>
          </CardContent>
        </Card>
      </section>
    {/if}

    <section class="hb-body">
      <Card>
        <CardHeader>
          <CardTitle>Activity heatmap</CardTitle>
          <CardDescription>Select a habit to explore its rhythm.</CardDescription>
        </CardHeader>
        <CardContent class="hb-hm-content">
          <div class="hb-hm-tabs">
            {#each activeHabits as h}
              <button class="hb-hm-tab" class:hb-hm-tab-on={heatmapHabit?.id === h.id}
                style="--hc:{h.color}" onclick={() => heatmapHabitId = h.id}>
                {h.emoji}&thinsp;{h.name}
              </button>
            {/each}
          </div>
          {#if heatmapHabit}
            <div class="hb-hm-grid" style="--hc:{heatmapHabit.color}">
              {#each heatmapHabit.completionHistory as day, i}
                <div class="hb-hm-cell" class:hb-hm-on={day}
                  style={day ? `opacity:${hmOpacity(i)}` : ''}
                  title="{new Date(Date.now()-(89-i)*86400000).toLocaleDateString()}: {day ? '✓' : '·'}"
                ></div>
              {/each}
            </div>
            <div class="hb-hm-legend">
              <span>Less</span>
              {#each [0.2,0.4,0.6,0.8,1] as op}
                <div class="hb-lgnd-cell" style="opacity:{op};background:{heatmapHabit.color}"></div>
              {/each}
              <span>More</span>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion rates</CardTitle>
          <CardDescription>All habits by 90-day performance.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h}
            {const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
            <article class="hb-perf-row">
              <span class="hb-perf-emoji">{h.emoji}</span>
              <span class="hb-perf-name">{h.name}</span>
              <div class="hb-perf-track"><div class="hb-perf-fill" style="width:{rate}%;background:{h.color}"></div></div>
              <span class="hb-perf-pct">{rate}%</span>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ REVIEW ════════════════════════════════════════ -->
  {:else if selectedSection === "Review"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><SearchIcon size={13}/><span>Habits</span><Badge variant="outline">Review</Badge></div>
        <h1>Gentle reflection</h1>
        <p>No scores, no grades. Just curiosity about what's working and what might need a gentler approach.</p>
      </div>
    </header>

    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <CardDescription>Completion across the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent class="hb-week-content">
          {#each ['M','T','W','T','F','S','S'] as d, i}
            {const dayTotal = activeHabits.reduce((s,h) => {
              const idx = 89 - (6 - i);
              return s + (h.completionHistory[idx] ? 1 : 0);
            }, 0)}
            {const pct = totalHabits > 0 ? dayTotal / totalHabits : 0}
            <div class="hb-week-col">
              <div class="hb-week-bar-wrap"><div class="hb-week-bar" style="height:{Math.max(pct * 100, 4)}%"></div></div>
              <span class="hb-week-day">{d}</span>
              <span class="hb-week-num">{dayTotal}</span>
            </div>
          {/each}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Your numbers, held gently.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article><span>Completions this week</span><strong>{thisWeekTotal}</strong></article>
          <article><span>90-day rate</span><strong>{avgRate}%</strong></article>
          <article><span>Best day</span><strong>{bestDay}s</strong></article>
          <article><span>Most consistent</span><strong>{bestHabit?.emoji} {bestHabit?.name}</strong></article>
        </CardContent>
      </Card>
    </section>

    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>Patterns that emerged from your practice.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each reviewInsights as insight}
            <article class="hb-insight-full">
              <span class="hb-insight-emoji-lg">{insight.emoji}</span>
              <p>{insight.message}</p>
            </article>
          {/each}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-habit view</CardTitle>
          <CardDescription>Streak, rate, and trajectory.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h}
            {const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
            <article class="hb-bd-row" style="--hc:{h.color}">
              <span>{h.emoji}</span>
              <div class="hb-bd-info">
                <strong>{h.name}</strong>
                <div class="hb-bd-bar"><div class="hb-bd-fill" style="width:{rate}%"></div></div>
              </div>
              <div class="hb-bd-nums">
                <span>{rate}%</span>
                <span class="hb-bd-streak">{h.streak}d</span>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ SETTINGS ════════════════════════════════════════ -->
  {:else if selectedSection === "Settings"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><SettingsIcon size={13}/><span>Habits</span><Badge variant="outline">Settings</Badge></div>
        <h1>Your practice, your way.</h1>
        <p>Adjust your habits, freeze tokens, and reminders to match your life.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
      </div>
    </header>

    <section class="hb-body hb-grid--3col">
      <Card>
        <CardHeader>
          <CardTitle>Active habits</CardTitle>
          <CardDescription>Manage what you're working on.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h (h.id)}
            <article style="--hc:{h.color}">
              <span class="hb-m-dot"></span>
              <span class="hb-m-emoji">{h.emoji}</span>
              <div class="hb-m-info">
                <strong>{h.name}</strong>
                <span>{h.kind === 'quit' ? 'Reducing' : 'Building'} · {h.frequency}</span>
              </div>
              <button class="hb-icon-btn" title="Edit" onclick={() => openEditModal(h)}>
                <PencilIcon size={13} style="opacity:0.5"/>
              </button>
              <button class="hb-icon-btn hb-icon-btn--archive" title="Archive — pause without losing progress" onclick={() => archiveHabit(h.id)}>
                <span style="font-size:13px;opacity:0.6">📦</span>
              </button>
            </article>
          {/each}
          <button class="hb-add-row" onclick={() => showAddModal = true}>+ Add habit</button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Freeze tokens</CardTitle>
          <CardDescription>Protect streaks when life gets in the way.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article>
            <span>Monthly allowance</span>
            <div class="hb-stepper">
              <button onclick={async () => { if (freezeTokens > 1) {
                const t = freezeTokens - 1;
                freezeTokens = t;
                await invoke('habits_save_freeze_state', { freezeTokens: t, usedFreezeTokens });
              }}}>−</button>
              <strong>{freezeTokens}</strong>
              <button onclick={async () => { if (freezeTokens < 5) {
                const t = freezeTokens + 1;
                freezeTokens = t;
                await invoke('habits_save_freeze_state', { freezeTokens: t, usedFreezeTokens });
              }}}>+</button>
            </div>
          </article>
          <article><span>Used this month</span><strong>{usedFreezeTokens} / {freezeTokens}</strong></article>
          <div class="hb-token-bar"><div class="hb-token-bar-fill" style="width:{freezeTokens > 0 ? (usedFreezeTokens/freezeTokens*100) : 0}%"></div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Gentle nudges, not alarms.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article class="hb-toggle-row">
            <div>
              <strong>Evening check-in</strong>
              <p>Gentle reminder if habits remain at 8pm.</p>
            </div>
            <input type="checkbox" bind:checked={notifyEndOfDay} class="hb-toggle"/>
          </article>
          <article class="hb-toggle-row">
            <div>
              <strong>Milestone celebrations</strong>
              <p>A quiet nod at 7, 14, 30, and 100 days.</p>
            </div>
            <input type="checkbox" bind:checked={notifyMilestones} class="hb-toggle"/>
          </article>
          <article class="hb-toggle-row">
            <div>
              <strong>Weekly reflection</strong>
              <p>Every Monday — look back with kindness.</p>
            </div>
            <input type="checkbox" bind:checked={notifyWeeklyReview} class="hb-toggle"/>
          </article>
        </CardContent>
      </Card>
    </section>

    <!-- Archived habits -->
    {#if habits.length > activeHabits.length}
      <Card>
        <CardHeader>
          <CardTitle>📦 Paused habits</CardTitle>
          <CardDescription>Habits you've set aside. They're waiting for you whenever you're ready.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each habits.filter(h => h.archived) as h}
            <article style="--hc:{h.color}">
              <span class="hb-m-emoji">{h.emoji}</span>
              <div class="hb-m-info">
                <strong>{h.name}</strong>
                <span>Paused — {h.streak}d streak saved</span>
              </div>
              <div class="hb-row-actions">
                <button class="hb-icon-btn" title="Resume" onclick={() => unarchiveHabit(h.id)}>
                  <span style="font-size:14px">↩</span>
                </button>
                <button class="hb-icon-btn" title="Delete permanently" onclick={() => deleteHabit(h.id)}>
                  <span style="font-size:13px;opacity:0.5">✕</span>
                </button>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    {/if}
  </section>
  {/if}

  {/if}
</main>

<!-- ══ ADD HABIT MODAL ══════════════════════════════════════════════ -->
{#if showAddModal}
<div class="hb-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAddModal(); }} role="dialog" aria-modal="true" tabindex="-1">
  <div class="hb-modal">
    <div class="hb-modal-head">
      <h3>{isEditing ? 'Edit habit' : 'New habit'}</h3>
      <button class="hb-icon-btn" onclick={closeAddModal}><span style="font-size:18px">✕</span></button>
    </div>
    <div class="hb-modal-body">
      <div class="hb-field">
        <label class="hb-lbl">What kind?</label>
        <div class="hb-chip-row">
          <button class="hb-chip" class:hb-chip-on={newHabit.kind === 'build'} onclick={() => newHabit.kind = 'build'}>🌱 Build a new habit</button>
          <button class="hb-chip" class:hb-chip-on={newHabit.kind === 'quit'} onclick={() => newHabit.kind = 'quit'}>🛑 Reduce a habit</button>
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Icon</label>
        <div class="hb-emoji-grid">
          {#each emojiOptions as e}
            <button class="hb-emoji-opt" class:hb-sel={newHabit.emoji === e} onclick={() => newHabit.emoji = e}>{e}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="nm">Habit name</label>
        <input id="nm" class="hb-input" type="text" bind:value={newHabit.name} placeholder={_t('moduleHabitsPlaceholderName')}/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="wy">Why does this matter?</label>
        <input id="wy" class="hb-input" type="text" bind:value={newHabit.why} placeholder="The reason that will keep you going..."/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">How to track</label>
        <div class="hb-chip-row">
          {#each ['binary','count','duration'] as t}
            <button class="hb-chip" class:hb-chip-on={newHabit.completionType === t}
              onclick={() => newHabit.completionType = t as CompletionType}>{t}</button>
          {/each}
        </div>
      </div>
      {#if newHabit.completionType !== 'binary'}
        <div class="hb-field-row">
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="tgt">Daily target</label>
            <input id="tgt" class="hb-input" type="number" min="1" bind:value={newHabit.targetCount}/>
          </div>
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="unt">Unit</label>
            <input id="unt" class="hb-input" type="text" bind:value={newHabit.unit} placeholder={newHabit.completionType === 'duration' ? 'min' : 'pages'}/>
          </div>
        </div>
      {/if}
      <div class="hb-field">
        <label class="hb-lbl">Frequency</label>
        <div class="hb-chip-row">
          {#each ['daily','weekdays','weekends'] as f}
            <button class="hb-chip" class:hb-chip-on={newHabit.frequency === f}
              onclick={() => newHabit.frequency = f as Frequency}>{f}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Colour</label>
        <div class="hb-color-row">
          {#each colorOptions as c}
            <button class="hb-swatch" class:hb-swatch-on={newHabit.color === c}
              style="background:{c}" onclick={() => newHabit.color = c}></button>
          {/each}
        </div>
      </div>
    </div>
    <div class="hb-modal-foot">
      <button class="hb-btn-ghost" onclick={closeAddModal}>Cancel</button>
      <button class="hb-btn-primary" onclick={saveNewHabit} disabled={!newHabit.name.trim()}>{isEditing ? 'Save changes' : 'Add habit'}</button>
    </div>
  </div>
</div>
{/if}

<!-- ══ WHY MODAL ════════════════════════════════════════════════════ -->
{#if whyHabitId && whyHabit}
<div class="hb-overlay" onclick={(e) => { if (e.target === e.currentTarget) whyHabitId = null; }} onkeydown={(e) => { if (e.key === 'Escape') whyHabitId = null; }} role="dialog" aria-modal="true" tabindex="-1">
  <div class="hb-why-modal" style="--hc:{whyHabit.color}">
    <button class="hb-icon-btn hb-why-close" onclick={() => whyHabitId = null}><span style="font-size:18px">✕</span></button>
    <div class="hb-why-emoji">{whyHabit.emoji}</div>
    <h3>{whyHabit.name}</h3>
    <p class="hb-why-lbl">Your reason</p>
    <p class="hb-why-text">"{whyHabit.why || 'No reason yet — add one in the settings.'}"</p>
    <p class="hb-why-kind">{whyHabit.kind === 'quit' ? '🛑 Reducing this habit' : '🌱 Building this habit'}</p>        {#if whyHabit.completionHistory.filter(Boolean).length > 0}
          <p class="hb-why-track-record">
            You've done this <strong>{whyHabit.completionHistory.filter(Boolean).length} out of 90</strong> days ({Math.round(whyHabit.completionHistory.filter(Boolean).length / 90 * 100)}%).
            {#if whyHabit.kind === 'quit'}
            Every resisted moment is growth.
            {/if}
          </p>
        {/if}
        <div class="hb-why-stats">
          <span>🔥 {whyHabit.streak}d streak</span>
          <span>🏆 Best: {whyHabit.longestStreak}d</span>
        </div>
  </div>
</div>
{/if}

<style>
/* ════════════════════════════════════════════════════════════════════
   HABITS MODULE — Rebuild
   Design: Health-module card system. No borders, no shadows.
   Calm, warm, spacious. Supportive language throughout.
   ════════════════════════════════════════════════════════════════════ */

:global(.hb-workspace) {
  --hb-bg: var(--background);
  --hb-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
  --hb-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
  --hb-border: color-mix(in srgb, var(--border) 86%, transparent);
  --hb-muted: var(--muted);
  --hb-accent: var(--primary);
  height: 100%;
  background: var(--hb-bg);
  color: var(--foreground);
  overflow: hidden;
  font-family: var(--font-body);
}

/* ── Page shell ──────────────────────────────────────────────────── */
:global(.hb-page) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px 30px 36px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  animation: hb-in .22s ease;
}
@keyframes hb-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

/* ── Header ──────────────────────────────────────────────────────── */
:global(.hb-page__header) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-shrink: 0;
}
:global(.hb-page__intro) { max-width: 56rem; }
:global(.hb-page__eyebrow) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--hb-muted);
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
:global(.hb-page__intro) h1 {
  margin: 0;
  font-size: clamp(1.7rem, 2.5vw, 2.6rem);
  line-height: 1.05;
  font-family: var(--font-display);
}
:global(.hb-page__intro) p {
  margin: 10px 0 0;
  max-width: 42rem;
  color: var(--hb-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}
:global(.hb-page__actions) {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* ── Grid layouts ────────────────────────────────────────────────── */
:global(.hb-hero-grid) {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  flex-shrink: 0;
}
:global(.hb-hero-grid--4) {
  grid-template-columns: repeat(4, 1fr);
}
:global(.hb-body) {
  flex: 1;
  min-height: 0;
}
:global(.hb-grid--2col) {
  display: grid;
  grid-template-columns: 1fr 0.9fr;
  gap: 16px;
}
:global(.hb-grid--3col) {
  display: grid;
  grid-template-columns: 1fr 260px 260px;
  gap: 16px;
}

/* ── Cards ───────────────────────────────────────────────────────── */
:global(.hb-page [data-slot="card"]) {
  background: var(--card);
  border: none;
  box-shadow: none;
}

/* ── Ring content ────────────────────────────────────────────────── */
:global(.hb-ring-content) {
  display: flex;
  justify-content: center;
  padding: 4px 0 12px;
}
:global(.hb-ring-wrap) {
  position: relative;
  width: 130px;
  height: 130px;
}

/* ── Glance stats ────────────────────────────────────────────────── */
:global(.hb-glance) {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
:global(.hb-glance article) {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--hb-surface-strong) 88%, transparent);
}
:global(.hb-glance article span) {
  font-size: 0.72rem;
  color: var(--hb-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
:global(.hb-glance article strong) {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
}

/* ── Lists ───────────────────────────────────────────────────────── */
:global(.hb-list) {
  display: flex;
  flex-direction: column;
  gap: 0;
}
:global(.hb-list article) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--hb-border) 50%, transparent);
  background: transparent;
  font-size: 0.88rem;
  min-height: 44px;
}
:global(.hb-list article:last-child) {
  border-bottom: none;
}
:global(.hb-list article > span:first-child) {
  color: var(--hb-muted);
  flex-shrink: 0;
}
:global(.hb-list article strong) {
  font-weight: 600;
  font-size: 0.9rem;
}

/* ── Habit rows ──────────────────────────────────────────────────── */
:global(.hb-habit-row) {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 12px !important;
  margin: 0 -12px !important;
  border-bottom: 1px solid color-mix(in srgb, var(--hb-border) 50%, transparent) !important;
  background: transparent !important;
  min-height: 48px !important;
  border-radius: 10px !important;
  transition: background .15s;
}
:global(.hb-habit-row:hover) {
  background: color-mix(in srgb, var(--foreground) 3%, transparent) !important;
}
:global(.hb-habit-row:last-child) {
  border-bottom: none !important;
}
:global(.hb-habit-row.hb-done:hover) {
  background: color-mix(in srgb, var(--hc) 4%, transparent) !important;
}
:global(.hb-done) { opacity: 0.6; }
:global(.hb-skip) { opacity: 0.4; }

:global(.hb-check) {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 2px solid var(--hc, var(--hb-accent));
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hc, var(--hb-accent));
  outline-offset: 2px;
  transition: background .15s;
}
:global(.hb-check:focus-visible) {
  outline: 2px solid var(--hc, var(--hb-accent));
}
:global(.hb-check-on) {
  background: var(--hc, var(--hb-accent)) !important;
  color: #fff !important;
}
:global(.hb-check:hover:not(.hb-check-on)) {
  background: color-mix(in srgb, var(--hc) 12%, transparent);
}

:global(.hb-identity) {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  outline-offset: 3px;
}
:global(.hb-identity:focus-visible) {
  outline: 2px solid var(--hb-accent);
  border-radius: 6px;
}
:global(.hb-emoji) { font-size: 1.2rem; flex-shrink: 0; }
:global(.hb-hname) {
  display: block;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.hb-kind) {
  display: block;
  font-size: 0.7rem;
  color: var(--hb-muted);
  margin-top: 1px;
  text-transform: capitalize;
}

:global(.hb-count-block) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--hb-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
:global(.hb-inc) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: color-mix(in srgb, var(--hc) 14%, transparent);
  color: var(--hc);
  font-size: 0.75rem;
  font-weight: 700;
}
:global(.hb-inc:focus-visible) {
  outline: 2px solid var(--hc);
  outline-offset: 2px;
}

/* Streak pill — gentle, not flashy */
:global(.hb-streak-pill) {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hc) 10%, transparent);
  color: var(--hc);
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1;
}
:global(.hb-streak-unit) {
  font-size: 0.65rem;
  font-weight: 400;
  opacity: 0.6;
}
:global(.hb-frozen) {
  background: color-mix(in srgb, #60a5fa 12%, transparent) !important;
  color: #60a5fa !important;
}

/* Row actions */
:global(.hb-row-actions) {
  display: flex;
  gap: 2px;
  align-items: center;
  flex-shrink: 0;
}
:global(.hb-icon-btn) {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hb-muted);
  flex-shrink: 0;
  transition: background .12s, color .12s;
}
:global(.hb-icon-btn:focus-visible) {
  outline: 2px solid var(--hb-accent);
  outline-offset: 1px;
}
:global(.hb-icon-btn--subtle) {
  opacity: 0.35;
}
:global(.hb-icon-btn--subtle:hover) {
  opacity: 0.7;
}
:global(.hb-icon-btn--ice) {
  color: #60a5fa;
}
:global(.hb-skip-icon) {
  font-size: 14px;
  line-height: 1;
}

/* Mood buttons (after completion) */
:global(.hb-mood-group) {
  display: flex;
  gap: 1px;
}
:global(.hb-mood-btn) {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
  transition: opacity .12s;
}
:global(.hb-mood-btn:focus-visible) {
  outline: 2px solid var(--hb-accent);
  outline-offset: 1px;
  opacity: 1;
}
:global(.hb-mood-on) {
  opacity: 1 !important;
  border-color: var(--hb-border) !important;
  background: color-mix(in srgb, var(--foreground) 6%, transparent) !important;
}

/* Empty state */
:global(.hb-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 0;
  color: var(--hb-muted);
  font-size: 0.86rem;
  text-align: center;
}
:global(.hb-empty span) { font-size: 2rem; }
:global(.hb-empty p) { margin: 0; }
:global(.hb-add-inline) {
  margin-top: 4px;
  padding: 7px 16px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--hb-accent);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

/* Insights */
:global(.hb-insight) {
  display: flex !important;
  align-items: flex-start !important;
  gap: 10px !important;
  padding: 12px 0 !important;
  border: none !important;
}
:global(.hb-insight--celebration) {
  background: color-mix(in srgb, var(--hb-accent) 6%, transparent) !important;
  border-radius: 10px !important;
  padding: 12px !important;
  margin: 0 -12px !important;
}
:global(.hb-insight-emoji) {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 1px;
  line-height: 1;
}
:global(.hb-insight p) {
  font-size: 0.82rem;
  margin: 0;
  line-height: 1.6;
  color: var(--foreground);
}

:global(.hb-insight-full) {
  display: flex !important;
  align-items: flex-start !important;
  gap: 12px !important;
  padding: 14px 0 !important;
}
:global(.hb-insight-emoji-lg) {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1.3;
}
:global(.hb-insight-full p) {
  font-size: 0.84rem;
  margin: 0;
  line-height: 1.6;
  color: var(--foreground);
}

/* ── Streak page ─────────────────────────────────────────────────── */
:global(.hb-streak-hero-content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 0 20px;
  text-align: center;
}
:global(.hb-big-number) {
  font-size: 3.6rem;
  font-weight: 900;
  line-height: 1;
  font-family: var(--font-display);
  letter-spacing: -0.04em;
}
:global(.hb-big-label) {
  font-size: 0.9rem;
  color: var(--hb-muted);
}
:global(.hb-badge-milestone) {
  font-size: 0.8rem;
  color: var(--hb-muted);
  margin-top: 4px;
  line-height: 1.4;
}

:global(.hb-token-display) {
  display: flex;
  gap: 8px;
  padding: 8px 0;
}
:global(.hb-token) { font-size: 1.3rem; }
:global(.hb-token-spent) { opacity: 0.2; filter: grayscale(1); }

:global(.hb-streak-row) {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 12px 0 !important;
}
:global(.hb-s-emoji) { font-size: 1.2rem; flex-shrink: 0; }
:global(.hb-s-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
:global(.hb-s-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-chain) {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
:global(.hb-dot) {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--hb-border) 80%, transparent);
}
:global(.hb-dot-on) {
  background: var(--hc, var(--hb-accent));
}
:global(.hb-s-nums) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
:global(.hb-s-cur) {
  font-size: 0.95rem;
  font-weight: 700;
}
:global(.hb-s-best) {
  font-size: 0.72rem;
  color: var(--hb-muted);
}
:global(.hb-s-actions) { flex-shrink: 0; }

:global(.hb-freeze-btn) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 30px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #60a5fa 25%, var(--hb-border));
  cursor: pointer;
  background: color-mix(in srgb, #60a5fa 8%, transparent);
  color: #60a5fa;
  font-size: 0.78rem;
  font-weight: 600;
}
:global(.hb-frozen-lbl) { font-size: 0.78rem; color: #60a5fa; }

:global(.hb-strength-bar-wrap) {
  flex: 1;
  height: 5px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
  margin: 0 8px;
}
:global(.hb-strength-bar) {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}

/* ── Heatmap ─────────────────────────────────────────────────────── */
:global(.hb-stat-box) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 6px;
}
:global(.hb-stat-box strong) {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  font-family: var(--font-display);
}
:global(.hb-stat-box span) {
  font-size: 0.72rem;
  color: var(--hb-muted);
  line-height: 1.4;
}

:global(.hb-hm-content) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
:global(.hb-hm-tabs) {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
:global(.hb-hm-tab) {
  min-height: 32px;
  padding: 5px 13px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--hb-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all .12s;
}
:global(.hb-hm-tab-on) {
  background: color-mix(in srgb, var(--hc) 12%, transparent) !important;
  border-color: color-mix(in srgb, var(--hc) 35%, var(--hb-border)) !important;
  color: var(--foreground) !important;
}
:global(.hb-hm-grid) {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
}
:global(.hb-hm-cell) {
  aspect-ratio: 1;
  border-radius: 3px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  transition: transform .1s;
}
:global(.hb-hm-cell:hover) { transform: scale(1.3); }
:global(.hb-hm-on) {
  background: var(--hc, var(--hb-accent));
}
:global(.hb-hm-legend) {
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-end;
}
:global(.hb-hm-legend span) { font-size: 0.7rem; color: var(--hb-muted); }
:global(.hb-lgnd-cell) { width: 11px; height: 11px; border-radius: 2px; }

:global(.hb-perf-row) {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 0 !important;
}
:global(.hb-perf-emoji) { font-size: 1.1rem; flex-shrink: 0; }
:global(.hb-perf-name) {
  font-size: 0.84rem;
  font-weight: 500;
  min-width: 90px;
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.hb-perf-track) {
  flex: 1;
  height: 5px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
:global(.hb-perf-fill) {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}
:global(.hb-perf-pct) {
  font-size: 0.78rem;
  font-weight: 700;
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Review ──────────────────────────────────────────────────────── */
:global(.hb-week-content) {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 120px;
  padding-bottom: 4px;
}
:global(.hb-week-col) {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}
:global(.hb-week-bar-wrap) {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
:global(.hb-week-bar) {
  width: 55%;
  min-height: 4px;
  border-radius: 3px 3px 0 0;
  background: var(--hb-accent);
  transition: height .4s ease;
}
:global(.hb-week-day) { font-size: 0.65rem; font-weight: 700; color: var(--hb-muted); text-transform: uppercase; }
:global(.hb-week-num) { font-size: 0.72rem; font-weight: 600; }

:global(.hb-bd-row) {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 11px 0 !important;
}
:global(.hb-bd-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
:global(.hb-bd-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-bd-bar) {
  height: 4px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
:global(.hb-bd-fill) {
  height: 100%;
  border-radius: 999px;
  background: var(--hc, var(--hb-accent));
  transition: width .4s ease;
}
:global(.hb-bd-nums) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
:global(.hb-bd-nums span) { font-size: 0.8rem; font-weight: 700; }
:global(.hb-bd-streak) {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--hb-muted);
}

/* ── Settings ────────────────────────────────────────────────────── */
:global(.hb-m-dot) {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hc, var(--hb-accent));
  flex-shrink: 0;
}
:global(.hb-m-emoji) { font-size: 1rem; flex-shrink: 0; }
:global(.hb-m-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
:global(.hb-m-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-m-info span) { font-size: 0.72rem; color: var(--hb-muted); }

:global(.hb-add-row) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 10px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--hb-accent);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
}

:global(.hb-stepper) {
  display: flex;
  align-items: center;
  gap: 10px;
}
:global(.hb-stepper button) {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--foreground);
}
:global(.hb-stepper strong) { font-size: 1rem; min-width: 24px; text-align: center; }

:global(.hb-token-bar) {
  height: 4px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 4px;
}
:global(.hb-token-bar-fill) {
  height: 100%;
  background: var(--hb-accent);
  border-radius: 999px;
  transition: width .3s;
}

:global(.hb-toggle-row) {
  justify-content: space-between !important;
  align-items: center !important;
  padding: 12px 0 !important;
}
:global(.hb-toggle-row > div) { display: flex; flex-direction: column; gap: 2px; }
:global(.hb-toggle-row > div strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-toggle-row > div p) { font-size: 0.76rem; margin: 0; color: var(--hb-muted); line-height: 1.4; }
:global(.hb-toggle) { width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--hb-accent); cursor: pointer; }

/* ── Modals ──────────────────────────────────────────────────────── */
:global(.hb-overlay) {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: color-mix(in srgb, var(--background) 55%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
:global(.hb-modal) {
  background: var(--card);
  border: none;
  border-radius: 20px;
  width: 460px;
  max-width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: none;
}
:global(.hb-modal-head) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--hb-border) 60%, transparent);
  flex-shrink: 0;
}
:global(.hb-modal-head h3) { font-size: 0.95rem; font-weight: 700; margin: 0; }
:global(.hb-modal-body) {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
:global(.hb-modal-foot) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 18px;
  border-top: 1px solid color-mix(in srgb, var(--hb-border) 60%, transparent);
  flex-shrink: 0;
}

:global(.hb-field) { display: flex; flex-direction: column; gap: 6px; }
:global(.hb-field-row) { display: flex; gap: 12px; }
:global(.hb-lbl) {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--hb-muted);
}
:global(.hb-input) {
  padding: 10px 13px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: color-mix(in srgb, var(--foreground) 3%, transparent);
  color: var(--foreground);
  font: inherit;
  font-size: 0.88rem;
  outline: none;
}
:global(.hb-input:focus) {
  border-color: var(--hb-accent);
  outline: 2px solid color-mix(in srgb, var(--hb-accent) 25%, transparent);
  outline-offset: 0;
}
:global(.hb-input::placeholder) { color: color-mix(in srgb, var(--hb-muted) 60%, transparent); }

:global(.hb-emoji-grid) { display: flex; flex-wrap: wrap; gap: 5px; }
:global(.hb-emoji-opt) {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
:global(.hb-sel) {
  border-color: var(--hb-accent) !important;
  background: color-mix(in srgb, var(--hb-accent) 10%, transparent) !important;
}

:global(.hb-chip-row) { display: flex; gap: 7px; flex-wrap: wrap; }
:global(.hb-chip) {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--hb-muted);
  text-transform: capitalize;
  transition: all .12s;
}
:global(.hb-chip-on) {
  background: color-mix(in srgb, var(--hb-accent) 12%, transparent) !important;
  border-color: color-mix(in srgb, var(--hb-accent) 45%, var(--hb-border)) !important;
  color: var(--foreground) !important;
}

:global(.hb-color-row) { display: flex; gap: 8px; }
:global(.hb-swatch) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  outline-offset: 3px;
}
:global(.hb-swatch-on) { outline: 2px solid var(--foreground) !important; }

:global(.hb-btn-ghost) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--foreground);
}
:global(.hb-btn-primary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 20px;
  border-radius: 999px;
  border: none;
  background: var(--hb-accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  color: #fff;
}
:global(.hb-btn-primary:disabled) { opacity: 0.38; cursor: not-allowed; }

/* Why modal */
:global(.hb-why-modal) {
  background: var(--card);
  border: none;
  border-radius: 20px;
  width: 340px;
  max-width: 100%;
  padding: 32px 28px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  box-shadow: none;
}
:global(.hb-why-close) { position: absolute; top: 12px; right: 12px; }
:global(.hb-why-emoji) { font-size: 2.8rem; line-height: 1; margin-bottom: 10px; }
:global(.hb-why-modal h3) { font-size: 1.1rem; font-weight: 700; margin: 0 0 14px; font-family: var(--font-display); }
:global(.hb-why-lbl) {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--hb-muted);
  margin: 0 0 6px;
}
:global(.hb-why-text) {
  font-size: 0.95rem;
  font-style: italic;
  line-height: 1.7;
  color: var(--foreground);
  border-left: 3px solid var(--hc, var(--hb-accent));
  padding: 2px 0 2px 14px;
  text-align: left;
  margin: 0 0 16px;
  width: 100%;
  box-sizing: border-box;
}
:global(.hb-why-track-record) {
  font-size: 0.82rem;
  color: var(--hb-muted);
  margin: 0 0 16px;
  line-height: 1.5;
  text-align: center;
}
:global(.hb-why-kind) {
  font-size: 0.78rem;
  color: var(--hb-muted);
  margin: 0 0 16px;
}
:global(.hb-why-stats) {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--hb-accent);
}
:global(.hb-why-stats span) { display: flex; align-items: center; gap: 4px; }

/* ── Tip small ───────────────────────────────────────────────────── */
:global(.hb-tip-small) {
  border: none !important;
  background: transparent !important;
  padding: 6px 0 !important;
  min-height: auto !important;
}
:global(.hb-tip-small p) {
  font-size: 0.78rem;
  color: var(--hb-muted);
  margin: 0;
  line-height: 1.58;
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  :global(.hb-hero-grid) { grid-template-columns: 1fr; }
  :global(.hb-grid--2col) { grid-template-columns: 1fr; }
  :global(.hb-grid--3col) { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 820px) {
  :global(.hb-page) { padding: 18px 16px 32px; gap: 16px; }
  :global(.hb-hero-grid--4) { grid-template-columns: repeat(2, 1fr); }
  :global(.hb-grid--3col) { grid-template-columns: 1fr; }
  :global(.hb-page__header) { flex-direction: column; gap: 12px; }
}
</style>
