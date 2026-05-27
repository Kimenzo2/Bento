<script lang="ts">
  import { Check, Flame, Plus, BarChart3, Download, TrendingUp,
    Zap, Target, SkipForward, Trash2, X, ChevronRight,
    Award, Clock, Sparkles, Snowflake } from "lucide-svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import { onMount } from "svelte";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import {
    getModuleSectionLabel, ensureModuleSection, moduleSectionStore,
  } from '$lib/stores/module-sections.store';

  type CompletionType = 'binary' | 'count' | 'duration';
  type Frequency    = 'daily' | 'weekdays' | 'weekends';
  type Habit = {
    id: string; name: string; emoji: string; color: string;
    streak: number; longestStreak: number;
    completedToday: boolean; skippedToday: boolean; frozenStreak: boolean;
    completionType: CompletionType; targetCount: number; currentCount: number; unit: string;
    frequency: Frequency; why: string; completionHistory: boolean[];
  };

  let { moduleId = 'habits', settings = {} } = $props();
  $effect(() => { void settings; });

  const sectionLabels = ["Today", "Streaks", "Heatmap", "Review", "Settings"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  // ── Seed data ─────────────────────────────────────────────────────────────
  let habits: Habit[] = $state([
    { id:"1", name:"Morning Run",    emoji:"🏃", color:"var(--mod-accent)", streak:14, longestStreak:28,
      completedToday:false, skippedToday:false, frozenStreak:false,
      completionType:'duration', targetCount:30, currentCount:0, unit:'min', frequency:'daily',
      why:"I want to feel energised and clear-headed every single day.",
      completionHistory: Array.from({length:90}, () => Math.random() > 0.28) },
    { id:"2", name:"Read 10 Pages",  emoji:"📖", color:"#7c3aed",            streak:7,  longestStreak:21,
      completedToday:true,  skippedToday:false, frozenStreak:false,
      completionType:'count', targetCount:10, currentCount:10, unit:'pages', frequency:'daily',
      why:"Reading sharpens my thinking and keeps me growing.",
      completionHistory: Array.from({length:90}, () => Math.random() > 0.35) },
    { id:"3", name:"Drink 2L Water", emoji:"💧", color:"#0284c7",            streak:21, longestStreak:45,
      completedToday:false, skippedToday:false, frozenStreak:false,
      completionType:'count', targetCount:8, currentCount:4, unit:'glasses', frequency:'daily',
      why:"Hydration is the simplest form of self-care.",
      completionHistory: Array.from({length:90}, () => Math.random() > 0.20) },
    { id:"4", name:"Meditate",       emoji:"🧘", color:"#d97706",            streak:5,  longestStreak:12,
      completedToday:false, skippedToday:false, frozenStreak:false,
      completionType:'duration', targetCount:10, currentCount:0, unit:'min', frequency:'weekdays',
      why:"Stillness gives me clarity that nothing else can.",
      completionHistory: Array.from({length:90}, () => Math.random() > 0.45) },
    { id:"5", name:"Write Code",     emoji:"💻", color:"#16a34a",            streak:3,  longestStreak:8,
      completedToday:false, skippedToday:false, frozenStreak:false,
      completionType:'duration', targetCount:60, currentCount:0, unit:'min', frequency:'daily',
      why:"Every line of code is a step toward mastery.",
      completionHistory: Array.from({length:90}, () => Math.random() > 0.40) },
  ]);

  let freezeTokens    = $state(2);
  let usedFreezeTokens = $state(0);
  let availableFreezeTokens = $derived(freezeTokens - usedFreezeTokens);

  // ── Derived ───────────────────────────────────────────────────────────────
  let completedCount = $derived(habits.filter(h => h.completedToday).length);
  let totalHabits    = $derived(habits.length);
  let progressPct    = $derived(totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0);
  let topStreak      = $derived(Math.max(...habits.map(h => h.streak), 0));
  let avgRate        = $derived(habits.length > 0
    ? Math.round(habits.reduce((s,h) => s + h.completionHistory.filter(Boolean).length / 90, 0) / habits.length * 100) : 0);
  let sortedByStreak = $derived([...habits].sort((a,b) => b.streak - a.streak));
  let bestHabit      = $derived([...habits].sort((a,b) =>
    b.completionHistory.filter(Boolean).length - a.completionHistory.filter(Boolean).length)[0]);
  let thisWeekTotal  = $derived(habits.reduce((s,h) => s + h.completionHistory.slice(-7).filter(Boolean).length, 0));
  let bestDay = $derived.by(() => {
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = [0,0,0,0,0,0,0];
    const today  = new Date();
    habits.forEach(h => h.completionHistory.forEach((done,i) => {
      if (done) { const d = new Date(today); d.setDate(today.getDate()-(89-i)); counts[d.getDay()]++; }
    }));
    return days[counts.indexOf(Math.max(...counts))];
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  function toggleComplete(id: string) {
    saveSnapshot();
    habits = habits.map(h => {
      if (h.id !== id) return h;
      const nowDone = !h.completedToday;
      return { ...h, completedToday: nowDone,
        skippedToday: nowDone ? false : h.skippedToday,
        currentCount: nowDone ? h.targetCount : 0,
        streak: nowDone ? h.streak + 1 : Math.max(0, h.streak - 1),
        longestStreak: nowDone ? Math.max(h.longestStreak, h.streak + 1) : h.longestStreak };
    });
  }
  function skipHabit(id: string) {
    habits = habits.map(h => h.id !== id ? h : { ...h, skippedToday:true, completedToday:false });
  }
  function freezeStreak(id: string) {
    if (availableFreezeTokens <= 0) return;
    habits = habits.map(h => h.id !== id ? h : { ...h, frozenStreak:true });
    usedFreezeTokens++;
  }
  function incrementCount(id: string) {
    habits = habits.map(h => {
      if (h.id !== id) return h;
      const nc     = Math.min(h.currentCount + 1, h.targetCount);
      const nowDone = nc >= h.targetCount;
      return { ...h, currentCount: nc, completedToday: nowDone,
        streak: nowDone && !h.completedToday ? h.streak + 1 : h.streak,
        longestStreak: nowDone && !h.completedToday ? Math.max(h.longestStreak, h.streak+1) : h.longestStreak };
    });
  }
  function deleteHabit(id: string) { habits = habits.filter(h => h.id !== id); }

  // ── Add modal ─────────────────────────────────────────────────────────────
  let showAddModal = $state(false);
  let newHabit = $state({
    name:'', emoji:'⭐', color:'var(--mod-accent)',
    completionType:'binary' as CompletionType,
    targetCount:1, unit:'', frequency:'daily' as Frequency, why:''
  });
  const emojiOptions  = ['⭐','🏃','📖','💧','🧘','💻','🎯','💪','🥗','😴','🎨','🎵','✍️','🌿','🧠'];
  const colorOptions  = ['var(--mod-accent)','#7c3aed','#0284c7','#d97706','#16a34a','#dc2626'];

  function closeAddModal() {
    showAddModal = false;
    newHabit = { name:'', emoji:'⭐', color:'var(--mod-accent)', completionType:'binary', targetCount:1, unit:'', frequency:'daily', why:'' };
  }
  function saveNewHabit() {
    if (!newHabit.name.trim()) return;
    habits = [...habits, {
      id: time.now().toString(), name: newHabit.name.trim(), emoji: newHabit.emoji, color: newHabit.color,
      streak:0, longestStreak:0, completedToday:false, skippedToday:false, frozenStreak:false,
      completionType: newHabit.completionType, targetCount: newHabit.targetCount, currentCount:0,
      unit: newHabit.unit, frequency: newHabit.frequency, why: newHabit.why,
      completionHistory: Array.from({length:90}, () => false),
    }];
    closeAddModal();
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  let heatmapHabitId: string | null = null;
  let heatmapHabit = $derived(habits.find(h => h.id === heatmapHabitId) ?? habits[0]);
  function hmOpacity(i: number) { return (0.3 + 0.7 * (i / 89)).toFixed(2); }

  // ── Why modal ─────────────────────────────────────────────────────────────
  let whyHabitId: string | null = $state(null);
  let whyHabit = $derived(habits.find(h => h.id === whyHabitId));

  // ── Mood tagging ──────────────────────────────────────────────────────────
  let habitMoods: Record<string, string> = $state({});

  // ── Undo last action ──────────────────────────────────────────────────────
  let lastHabitsSnapshot: Habit[] | null = $state(null);
  function saveSnapshot() { lastHabitsSnapshot = JSON.parse(JSON.stringify(habits)); }
  function undoLast() { if (lastHabitsSnapshot) { habits = lastHabitsSnapshot; lastHabitsSnapshot = null; } }

  // ── Vacation mode ─────────────────────────────────────────────────────────
  let vacationActive  = $state(false);
  let vacationDays    = $state(7);
  let vacationDaysLeft = $state(0);

  // ── Settings toggles ──────────────────────────────────────────────────────
  let notifyEndOfDay     = $state(true);
  let notifyMilestones   = $state(true);
  let notifyWeeklyReview = $state(true);
</script>

<!-- ══════════════════════════════════════════════════════════════════
     ROOT — single wrapper, no shared chrome between pages
     ══════════════════════════════════════════════════════════════════ -->
<main class="hb-root module-root" data-module="habits">

<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  PAGE: TODAY                                                ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{#if selectedSection === 'Today'}
<section class="hb-page">

  <!-- Page header -->
  <header class="hb-page-header">
    <div class="hb-page-intro">
      <div class="hb-eyebrow"><span>Habits</span><Badge variant="outline">Today</Badge></div>
      <h1>Your habits for today.</h1>
      <p>One tap to log. No friction, no excuses. Protect the chain.</p>
    </div>
    <div class="hb-page-actions">
      {#if lastHabitsSnapshot}
        <Button variant="outline" onclick={undoLast}>↩ Undo</Button>
      {/if}
      <Button variant="outline" onclick={() => showAddModal = true}>
        <Plus size={15}/>&nbsp;New Habit
      </Button>
      <Button onclick={() => whyHabitId = habits[0]?.id ?? null}>
        <Sparkles size={15}/>&nbsp;Your Why
      </Button>
    </div>
  </header>

  <!-- Hero row: ring + glance stats -->
  <div class="hb-hero-row">
    <Card class="hb-card hb-ring-card">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
        <CardDescription>{completedCount} of {totalHabits} complete today</CardDescription>
      </CardHeader>
      <CardContent class="hb-ring-content">
        <div class="hb-ring-wrap">
          <PremiumRing
            size={136}
            thickness={11}
            segments={[{ value: progressPct, color: "var(--mod-accent)", label: "Complete" }]}
            centerLabel="Today"
            centerValue={`${Math.round(progressPct)}%`}
            centerNote={`${completedCount}/${totalHabits}`}
          />
        </div>
      </CardContent>
    </Card>

    <Card class="hb-card hb-glance-card">
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
        <CardDescription>Your momentum right now.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article><span>Top streak</span><strong>🔥 {topStreak} days</strong></article>
        <article><span>90-day avg</span><strong>{avgRate}% completion</strong></article>
        <article><span>Freeze tokens</span><strong>❄️ {availableFreezeTokens} left</strong></article>
        <article><span>Best day</span><strong>📅 {bestDay}s</strong></article>
      </CardContent>
    </Card>
  </div>

  <!-- Body: habit list + tips -->
  <div class="hb-body-row">
    <Card class="hb-card hb-habits-card">
      <CardHeader>
        <CardTitle>Habit List</CardTitle>
        <CardDescription>Tap the circle to log. Tap the name to see your why.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        {#each habits as h (h.id)}
          <article class="hb-habit-row" class:hb-done={h.completedToday} class:hb-skip={h.skippedToday} style="--hc:{h.color}">
            <button class="hb-check" class:hb-check-on={h.completedToday} onclick={() => toggleComplete(h.id)}>
              {#if h.completedToday}<Check size={14}/>{/if}
            </button>
            <button class="hb-identity" onclick={() => whyHabitId = h.id}>
              <span>{h.emoji}</span>
              <div>
                <span class="hb-hname">{h.name}</span>
                <span class="hb-hfreq">{h.frequency}</span>
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
            <div class="hb-pill" class:hb-pill-frozen={h.frozenStreak}>
              <Flame size={11}/><span>{h.streak}</span>
            </div>
            <div class="hb-row-btns">
              {#if !h.skippedToday && !h.completedToday}
                <button class="hb-icon-btn" title="Skip" onclick={() => skipHabit(h.id)}><SkipForward size={13}/></button>
              {/if}
              {#if !h.frozenStreak && !h.completedToday && availableFreezeTokens > 0}
                <button class="hb-icon-btn hb-ice" title="Freeze" onclick={() => freezeStreak(h.id)}><Snowflake size={13}/></button>
              {/if}
              {#if h.completedToday}
                {#each ['😤','😐','🙂','😊','🔥'] as mood}
                  <button
                    class="hb-mood-btn"
                    class:hb-mood-on={habitMoods[h.id] === mood}
                    onclick={() => habitMoods = {...habitMoods, [h.id]: mood}}
                    title="How did it feel?"
                  >{mood}</button>
                {/each}
              {/if}
              <button class="hb-icon-btn hb-del" title="Delete" onclick={() => deleteHabit(h.id)}><Trash2 size={13}/></button>
            </div>
          </article>
        {/each}
        {#if habits.length === 0}
          <div class="hb-empty"><span>🌱</span><p>No habits yet. Add your first one.</p></div>
        {/if}
      </CardContent>
    </Card>

    <Card class="hb-card hb-tips-card">
      <CardHeader>
        <CardTitle>Daily Tips</CardTitle>
        <CardDescription>Science-backed micro-nudges.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article class="hb-tip"><span class="hb-tip-n">01</span><p>Attach new habits to ones you already do automatically — this is habit stacking.</p></article>
        <article class="hb-tip"><span class="hb-tip-n">02</span><p>Missing once is an accident. Missing twice is the start of a new (bad) habit.</p></article>
        <article class="hb-tip"><span class="hb-tip-n">03</span><p>Make it obvious, make it attractive, make it easy, make it satisfying.</p></article>
        <article class="hb-tip"><span class="hb-tip-n">04</span><p>The best time to log is right after the cue you already follow every day.</p></article>
      </CardContent>
    </Card>
  </div>

</section>


<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  PAGE: STREAKS                                              ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{:else if selectedSection === 'Streaks'}
<section class="hb-page">

  <header class="hb-page-header">
    <div class="hb-page-intro">
      <div class="hb-eyebrow"><span>Habits</span><Badge variant="outline">Streaks</Badge></div>
      <h1>Don't break the chain.</h1>
      <p>Every dot is a day you showed up. Keep the run going.</p>
    </div>
    <div class="hb-page-actions">
      <Button variant="outline" onclick={() => showAddModal = true}>
        <Plus size={15}/>&nbsp;New Habit
      </Button>
    </div>
  </header>

  <!-- Hero: top streak card + freeze tokens -->
  <div class="hb-hero-row">
    <Card class="hb-card hb-streak-hero">
      <CardHeader>
        <CardTitle>Top Streak</CardTitle>
        <CardDescription>Your longest active chain right now.</CardDescription>
      </CardHeader>
      <CardContent class="hb-streak-hero-content">
        <div class="hb-big-flame">🔥</div>
        <strong class="hb-big-num">{topStreak}</strong>
        <span class="hb-big-lbl">days — {sortedByStreak[0]?.name ?? '—'}</span>
      </CardContent>
    </Card>

    <Card class="hb-card hb-freeze-card">
      <CardHeader>
        <CardTitle>Freeze Tokens</CardTitle>
        <CardDescription>Life happens. Use these to protect your streak.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <div class="hb-token-display">
          {#each Array(freezeTokens) as _,i}
            <span class="hb-token" class:hb-token-spent={i < usedFreezeTokens}>❄️</span>
          {/each}
        </div>
        <article><span>{availableFreezeTokens} of {freezeTokens} tokens left this month</span></article>
        <article class="hb-tip-small"><p>A frozen streak won't reset if you miss a day. Apply it before the day ends.</p></article>
      </CardContent>
    </Card>
  </div>

  <!-- Body: full streak board + stacking card -->
  <div class="hb-body-row">
    <Card class="hb-card hb-board-card">
      <CardHeader>
        <CardTitle>Streak Board</CardTitle>
        <CardDescription>All habits ranked by current streak. Last 21 days shown.</CardDescription>
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
              <span class="hb-s-cur"><Flame size={13}/>{h.streak}</span>
              <span class="hb-s-best">best {h.longestStreak}</span>
            </div>
            <div class="hb-s-action">
              {#if !h.frozenStreak && availableFreezeTokens > 0}
                <button class="hb-freeze-btn" onclick={() => freezeStreak(h.id)}>
                  <Snowflake size={12}/>&nbsp;Freeze
                </button>
              {:else if h.frozenStreak}
                <span class="hb-frozen-lbl">❄️ Frozen</span>
              {/if}
            </div>
          </article>
        {/each}
      </CardContent>
    </Card>

    <Card class="hb-card hb-stack-card">
      <CardHeader>
        <CardTitle>Habit Strength Scores</CardTitle>
        <CardDescription>Streak × consistency × recency. Your real momentum.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        {#each [...habits].sort((a,b) => {
          const scoreA = (a.streak * 0.5) + (a.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (a.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
          const scoreB = (b.streak * 0.5) + (b.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (b.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
          return scoreB - scoreA;
        }) as h}
          {@const score = Math.min(100, Math.round(
            (h.streak * 0.5) +
            (h.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) +
            (h.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100)
          ))}
          <article style="--hc:{h.color}">
            <span>{h.emoji}&thinsp;{h.name}</span>
            <div class="hb-strength-bar-wrap">
              <div class="hb-strength-bar" style="width:{score}%;background:{h.color}"></div>
            </div>
            <strong style="color:{h.color}">{score}</strong>
          </article>
        {/each}
        <article class="hb-tip-small"><p>Score = streak weight (50%) + 90-day rate (30%) + last 7 days (20%).</p></article>
      </CardContent>
    </Card>
  </div>

</section>


<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  PAGE: HEATMAP                                              ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{:else if selectedSection === 'Heatmap'}
<section class="hb-page">

  <header class="hb-page-header">
    <div class="hb-page-intro">
      <div class="hb-eyebrow"><span>Habits</span><Badge variant="outline">Heatmap</Badge></div>
      <h1>90 days of your life, visualised.</h1>
      <p>Every cell is a day. Green means you showed up. Gaps tell the real story.</p>
    </div>
  </header>

  <!-- Hero: 4 stat tiles for selected habit -->
  {#if heatmapHabit}
  <div class="hb-hero-row hb-hero-row-4">
    <Card class="hb-card hb-stat-card">
      <CardContent class="hb-stat-content">
        <strong>{heatmapHabit.completionHistory.filter(Boolean).length}</strong>
        <span>days completed</span>
      </CardContent>
    </Card>
    <Card class="hb-card hb-stat-card">
      <CardContent class="hb-stat-content">
        <strong>{Math.round(heatmapHabit.completionHistory.filter(Boolean).length / 90 * 100)}%</strong>
        <span>completion rate</span>
      </CardContent>
    </Card>
    <Card class="hb-card hb-stat-card">
      <CardContent class="hb-stat-content">
        <strong>🔥 {heatmapHabit.streak}</strong>
        <span>current streak</span>
      </CardContent>
    </Card>
    <Card class="hb-card hb-stat-card">
      <CardContent class="hb-stat-content">
        <strong>🏆 {heatmapHabit.longestStreak}</strong>
        <span>best ever</span>
      </CardContent>
    </Card>
  </div>
  {/if}

  <!-- Body: heatmap + completion rates -->
  <div class="hb-body-col">
    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
        <CardDescription>Select a habit below to explore its pattern.</CardDescription>
      </CardHeader>
      <CardContent class="hb-hm-content">
        <div class="hb-hm-tabs">
          {#each habits as h}
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
                title="{new Date(time.now()-(89-i)*86400000).toLocaleDateString()}: {day?'✓ Done':'✗ Missed'}"
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

    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Completion Rates — All Habits</CardTitle>
        <CardDescription>90-day performance ranked.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        {#each habits as h}
          {@const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
          <article class="hb-perf-row">
            <span>{h.emoji}</span>
            <span class="hb-perf-name">{h.name}</span>
            <div class="hb-perf-track"><div class="hb-perf-fill" style="width:{rate}%;background:{h.color}"></div></div>
            <span class="hb-perf-pct">{rate}%</span>
          </article>
        {/each}
      </CardContent>
    </Card>
  </div>

</section>


<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  PAGE: REVIEW                                               ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{:else if selectedSection === 'Review'}
<section class="hb-page">

  <header class="hb-page-header">
    <div class="hb-page-intro">
      <div class="hb-eyebrow"><span>Habits</span><Badge variant="outline">Review</Badge></div>
      <h1>Weekly review.</h1>
      <p>Your performance distilled. What's working, what needs attention, and where to push next.</p>
    </div>
    <div class="hb-page-actions">
      <Button variant="outline"><Download size={15}/>&nbsp;Export CSV</Button>
      <Button variant="outline"><BarChart3 size={15}/>&nbsp;Export JSON</Button>
    </div>
  </header>

  <!-- Hero: week strip + two KPI cards — DISTINCT from Heatmap -->
  <div class="hb-hero-row">
    <Card class="hb-card">
      <CardHeader>
        <CardTitle>This Week</CardTitle>
        <CardDescription>Mon – Sun completion at a glance.</CardDescription>
      </CardHeader>
      <CardContent class="hb-week-content">
        {#each ['M','T','W','T','F','S','S'] as d, i}
          {@const dayTotal = habits.reduce((s,h) => {
            const idx = 89 - (6 - i);
            return s + (h.completionHistory[idx] ? 1 : 0);
          }, 0)}
          {@const pct = totalHabits > 0 ? dayTotal / totalHabits : 0}
          <div class="hb-week-col">
            <div class="hb-week-bar-wrap">
              <div class="hb-week-bar" style="height:{Math.max(pct * 100, 4)}%"></div>
            </div>
            <span class="hb-week-day">{d}</span>
            <span class="hb-week-num">{dayTotal}</span>
          </div>
        {/each}
      </CardContent>
    </Card>

    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Your numbers in one place.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article><span>Completions this week</span><strong>{thisWeekTotal}</strong></article>
        <article><span>90-day avg rate</span><strong>{avgRate}%</strong></article>
        <article><span>Best day of week</span><strong>📅 {bestDay}s</strong></article>
        <article><span>Most consistent habit</span><strong>{bestHabit?.emoji} {bestHabit?.name}</strong></article>
      </CardContent>
    </Card>
  </div>

  <!-- Body: insights + breakdown -->
  <div class="hb-body-row">
    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Insights</CardTitle>
        <CardDescription>Patterns hiding in your data.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article class="hb-insight">
          <Zap size={14} class="hb-ins-icon"/>
          <p><strong>{bestHabit?.name}</strong> leads at {Math.round((bestHabit?.completionHistory.filter(Boolean).length ?? 0) / 90 * 100)}% over 90 days.</p>
        </article>
        <article class="hb-insight">
          <Clock size={14} class="hb-ins-icon"/>
          <p>You perform best on <strong>{bestDay}s</strong>. Front-load your hardest habits then.</p>
        </article>
        <article class="hb-insight">
          <TrendingUp size={14} class="hb-ins-icon"/>
          <p>At current pace you'll hit <strong>{habits.reduce((s,h)=>s+h.streak+7,0)} combined streak-days</strong> by next week.</p>
        </article>
        <article class="hb-insight">
          <Award size={14} class="hb-ins-icon"/>
          <p>Low-streak habits share one pattern: no anchor trigger to stack against.</p>
        </article>
      </CardContent>
    </Card>

    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Per-Habit Breakdown</CardTitle>
        <CardDescription>Streak, rate, and momentum side by side.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        {#each habits as h}
          {@const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
          <article class="hb-bd-row" style="--hc:{h.color}">
            <span>{h.emoji}</span>
            <div class="hb-bd-info">
              <strong>{h.name}</strong>
              <div class="hb-bd-bar"><div class="hb-bd-fill" style="width:{rate}%"></div></div>
            </div>
            <div class="hb-bd-nums">
              <span>{rate}%</span>
              <span class="hb-bd-streak"><Flame size={10}/>{h.streak}</span>
            </div>
          </article>
        {/each}
      </CardContent>
    </Card>
  </div>

</section>


<!-- ╔══════════════════════════════════════════════════════════════╗
     ║  PAGE: SETTINGS                                             ║
     ╚══════════════════════════════════════════════════════════════╝ -->
{:else if selectedSection === 'Settings'}
<section class="hb-page">

  <header class="hb-page-header">
    <div class="hb-page-intro">
      <div class="hb-eyebrow"><span>Habits</span><Badge variant="outline">Settings</Badge></div>
      <h1>Configure your habits.</h1>
      <p>Manage your list, set freeze token budget, and control reminder behaviour.</p>
    </div>
    <div class="hb-page-actions">
      <Button onclick={() => showAddModal = true}>
        <Plus size={15}/>&nbsp;New Habit
      </Button>
    </div>
  </header>

  <!-- Body: 3 cards side by side -->
  <div class="hb-body-row hb-settings-row">
    <Card class="hb-card hb-settings-wide">
      <CardHeader>
        <CardTitle>Manage Habits</CardTitle>
        <CardDescription>Add, review, or remove habits from your list.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        {#each habits as h (h.id)}
          <article style="--hc:{h.color}">
            <span class="hb-m-dot"></span>
            <span class="hb-m-emoji">{h.emoji}</span>
            <div class="hb-m-info">
              <strong>{h.name}</strong>
              <span>{h.frequency} · {h.completionType}{h.completionType !== 'binary' ? ` · ${h.targetCount} ${h.unit}` : ''}</span>
            </div>
            <button class="hb-icon-btn hb-del" onclick={() => deleteHabit(h.id)}><Trash2 size={13}/></button>
          </article>
        {/each}
        <button class="hb-add-row" onclick={() => showAddModal = true}>
          <Plus size={13}/>&nbsp;Add New Habit
        </button>
      </CardContent>
    </Card>

    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Streak Freeze Tokens</CardTitle>
        <CardDescription>Protect streaks when life gets in the way.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article>
          <span>Monthly tokens</span>
          <div class="hb-token-ctrl">
            <button onclick={() => { if(freezeTokens>1) freezeTokens--; }}>−</button>
            <strong>{freezeTokens}</strong>
            <button onclick={() => { if(freezeTokens<5) freezeTokens++; }}>+</button>
          </div>
        </article>
        <article><span>Used this month</span><strong>{usedFreezeTokens} / {freezeTokens}</strong></article>
        <div class="hb-token-bar">
          <div class="hb-token-bar-fill" style="width:{freezeTokens > 0 ? (usedFreezeTokens/freezeTokens*100) : 0}%"></div>
        </div>
      </CardContent>
    </Card>

    <Card class="hb-card">
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <CardDescription>Smart nudges at the right moment.</CardDescription>
      </CardHeader>
      <CardContent class="hb-list">
        <article class="hb-toggle-row">
          <div><strong>End-of-day nudge</strong><p>Fires if habits remain at 8 pm.</p></div>
          <input type="checkbox" bind:checked={notifyEndOfDay} class="hb-toggle"/>
        </article>
        <article class="hb-toggle-row">
          <div><strong>Milestone alerts</strong><p>Celebrate 7, 14, 30 and 100-day streaks.</p></div>
          <input type="checkbox" bind:checked={notifyMilestones} class="hb-toggle"/>
        </article>
        <article class="hb-toggle-row">
          <div><strong>Weekly review prompt</strong><p>Every Monday morning.</p></div>
          <input type="checkbox" bind:checked={notifyWeeklyReview} class="hb-toggle"/>
        </article>
      </CardContent>
    </Card>
  </div>

  <!-- Vacation mode — full width below -->
  <Card class="hb-card">
    <CardHeader>
      <CardTitle>🏖️ Vacation Mode</CardTitle>
      <CardDescription>Pause all habits without breaking your streaks. All chains are frozen for the duration.</CardDescription>
    </CardHeader>
    <CardContent class="hb-list">
      <article>
        <span>Pause duration</span>
        <div class="hb-token-ctrl">
          <button onclick={() => { if(vacationDays>1) vacationDays--; }}>−</button>
          <strong>{vacationDays} day{vacationDays !== 1 ? 's' : ''}</strong>
          <button onclick={() => { if(vacationDays<30) vacationDays++; }}>+</button>
        </div>
      </article>
      <article>
        <span>Status</span>
        <strong style="color:{vacationActive ? '#60a5fa' : 'var(--mod-accent)'}">
          {vacationActive ? `🏖️ Active — ${vacationDaysLeft} day${vacationDaysLeft!==1?'s':''} left` : 'Not active'}
        </strong>
      </article>
      <article>
        <span>What happens</span>
        <span style="font-size:11px;color:var(--hb-muted)">Streaks freeze, reminders pause, no missed days recorded.</span>
      </article>
      <div style="display:flex;gap:10px;padding:4px 0">
        {#if !vacationActive}
          <button class="hb-btn-primary" onclick={() => { vacationActive = true; vacationDaysLeft = vacationDays; }}>
            Start Vacation
          </button>
        {:else}
          <button class="hb-btn-ghost" onclick={() => { vacationActive = false; vacationDaysLeft = 0; }}>
            End Vacation Early
          </button>
        {/if}
      </div>
    </CardContent>
  </Card>

</section>
{/if}

</main>

<!-- ══ ADD HABIT MODAL ══════════════════════════════════════════════ -->
{#if showAddModal}
<div class="hb-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAddModal(); }} role="dialog" aria-modal="true" tabindex="-1">
  <div class="hb-modal">
    <div class="hb-modal-head">
      <h3>New Habit</h3>
      <button class="hb-icon-btn" onclick={closeAddModal}><X size={18}/></button>
    </div>
    <div class="hb-modal-body">
      <div class="hb-field">
        <label class="hb-lbl">Icon</label>
        <div class="hb-emoji-grid">
          {#each emojiOptions as e}
            <button class="hb-emoji-opt" class:hb-sel={newHabit.emoji===e} onclick={()=>newHabit.emoji=e}>{e}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="nm">Habit name</label>
        <input id="nm" class="hb-input" type="text" bind:value={newHabit.name} placeholder={_t('moduleHabitsPlaceholderName')}/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="wy">Why does this matter?</label>
        <input id="wy" class="hb-input" type="text" bind:value={newHabit.why} placeholder={_t('moduleHabitsPlaceholderWhy')}/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Completion type</label>
        <div class="hb-chip-row">
          {#each ['binary','count','duration'] as t}
            <button class="hb-chip" class:hb-chip-on={newHabit.completionType===t}
              onclick={()=>newHabit.completionType=t as CompletionType}>{t}</button>
          {/each}
        </div>
      </div>
      {#if newHabit.completionType !== 'binary'}
        <div class="hb-field-row">
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="tgt">Target</label>
            <input id="tgt" class="hb-input" type="number" min="1" bind:value={newHabit.targetCount}/>
          </div>
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="unt">Unit</label>
            <input id="unt" class="hb-input" type="text" bind:value={newHabit.unit} placeholder="{newHabit.completionType==='duration'?'min':'glasses'}"/>
          </div>
        </div>
      {/if}
      <div class="hb-field">
        <label class="hb-lbl">Frequency</label>
        <div class="hb-chip-row">
          {#each ['daily','weekdays','weekends'] as f}
            <button class="hb-chip" class:hb-chip-on={newHabit.frequency===f}
              onclick={()=>newHabit.frequency=f as Frequency}>{f}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Colour</label>
        <div class="hb-color-row">
          {#each colorOptions as c}
            <button class="hb-swatch" class:hb-swatch-on={newHabit.color===c}
              style="background:{c}" onclick={()=>newHabit.color=c}></button>
          {/each}
        </div>
      </div>
    </div>
    <div class="hb-modal-foot">
      <button class="hb-btn-ghost" onclick={closeAddModal}>Cancel</button>
      <button class="hb-btn-primary" onclick={saveNewHabit} disabled={!newHabit.name.trim()}>Add Habit</button>
    </div>
  </div>
</div>
{/if}

<!-- ══ WHY MODAL ═══════════════════════════════════════════════════ -->
{#if whyHabitId && whyHabit}
<div class="hb-overlay" onclick={(e) => { if (e.target === e.currentTarget) whyHabitId = null; }} onkeydown={(e) => { if (e.key === 'Escape') whyHabitId = null; }} role="dialog" aria-modal="true" tabindex="-1">
  <div class="hb-why-modal" style="--hc:{whyHabit.color}">
    <button class="hb-icon-btn hb-why-close" onclick={()=>whyHabitId=null}><X size={18}/></button>
    <div class="hb-why-emoji">{whyHabit.emoji}</div>
    <h3>{whyHabit.name}</h3>
    <p class="hb-why-lbl">Your reason</p>
    <p class="hb-why-text">"{whyHabit.why || 'No reason set yet — add one in Settings.'}"</p>
    <div class="hb-why-stats">
      <span><Flame size={13}/>&thinsp;{whyHabit.streak} day streak</span>
      <span><Award size={13}/>&thinsp;Best: {whyHabit.longestStreak}</span>
    </div>
  </div>
</div>
{/if}

<style>
/* ════════════════════════════════════════════════════════════════════
   HABITS CSS — card system mirrors Focus 1:1
   Cards  → linear-gradient surface + real border
   Articles inside → individual bordered sub-cards (border-radius 20px)
   Lists  → display:grid + gap:12px  (NO flex, NO border-bottom)
   ════════════════════════════════════════════════════════════════════ */

:global(.hb-root) {
  --hb-surface:        color-mix(in srgb, var(--surface, var(--card)) 96%, var(--background));
  --hb-surface-strong: color-mix(in srgb, var(--surface, var(--card)) 88%, var(--background));
  --hb-border:         color-mix(in srgb, var(--border) 86%, transparent);
  --hb-muted:          var(--muted-foreground, var(--muted));
  height: 100%;
  overflow-y: auto;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-body, system-ui, sans-serif);
}

/* ── Page shell ──────────────────────────────────────────────────── */
:global(.hb-page) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px 30px 36px;
  animation: hb-in .22s ease;
}
@keyframes hb-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

:global(.hb-page-header) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}
:global(.hb-eyebrow) {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--muted-foreground);
  margin-bottom: 10px;
}
:global(.hb-page-intro h1) {
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 6px;
}
:global(.hb-page-intro p) {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0;
  max-width: 520px;
}
:global(.hb-page-actions) {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* ── Row layouts ─────────────────────────────────────────────────── */
:global(.hb-hero-row) {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  align-items: start;
}
:global(.hb-hero-row-4) {
  grid-template-columns: repeat(4, 1fr);
}
:global(.hb-body-row) {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
}
:global(.hb-body-col) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}
:global(.hb-settings-row) {
  grid-template-columns: 1fr 260px 260px;
  align-items: start;
}


/* ── Cards — Focus-identical gradient + border ───────────────────── */
:global(.hb-card) {
  border-color: var(--hb-border) !important;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--hb-surface) 98%, var(--background)),
    color-mix(in srgb, var(--hb-surface) 86%, var(--background))
  ) !important;
  border-radius: 20px !important;
  box-shadow: none !important;
}

/* ── List — Focus pattern: grid + individual sub-card articles ───── */
:global(.hb-list) {
  display: grid;
  gap: 10px;
  padding: 0;
}
:global(.hb-list article) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 90%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--hb-surface-strong) 90%, transparent);
  font-size: 13px;
}
:global(.hb-list article span:first-child:not(.hb-tip-n):not(.hb-s-emoji):not(.hb-m-emoji)) {
  color: var(--hb-muted);
}
:global(.hb-list article strong) { font-weight: 600; }

/* ── Ring card ───────────────────────────────────────────────────── */
:global(.hb-ring-content) {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}
:global(.hb-ring-wrap) {
  position: relative;
  width: 130px;
  height: 130px;
}
:global(.hb-ring-svg) { width: 100%; height: 100%; }
:global(.hb-ring-label) {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
:global(.hb-ring-label strong) { font-size: 26px; font-weight: 800; color: var(--mod-accent); }
:global(.hb-ring-label small)  { font-size: 11px; color: var(--muted-foreground); }

/* ── KPI / stat card ─────────────────────────────────────────────── */
:global(.hb-stat-card .hb-stat-content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 4px;
}
:global(.hb-stat-content strong) {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.hb-stat-content span) {
  font-size: 11px;
  color: var(--muted-foreground);
}

/* ── Habit rows — inside sub-cards, no border-bottom needed ──────── */
:global(.hb-habit-row) {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 10px !important;
  padding: 10px 14px !important;
  border: none !important;
  background: transparent !important;
  border-radius: 12px !important;
}
:global(.hb-done) { opacity: .65; }
:global(.hb-skip) { opacity: .45; }

/* Check button */
:global(.hb-check) {
  width: 28px; height: 28px;
  border: 2px solid var(--hc);
  border-radius: 8px;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  color: var(--hc);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
:global(.hb-check-on) {
  background: var(--hc) !important;
  color: #fff !important;
}
:global(.hb-check:hover:not(.hb-check-on)) {
  background: color-mix(in srgb, var(--hc) 18%, transparent);
}

/* Identity button */
:global(.hb-identity) {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font-size: inherit;
}
:global(.hb-hname) { display: block; font-size: 13px; font-weight: 600; color: var(--foreground); }
:global(.hb-hfreq) { display: block; font-size: 11px; color: var(--muted-foreground); margin-top: 1px; }

/* Count stepper */
:global(.hb-count-block) { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted-foreground); }
:global(.hb-count-block span) { white-space: nowrap; }
:global(.hb-inc) {
  padding: 2px 8px; border-radius: 999px; border: none; cursor: pointer;
  background: color-mix(in srgb, var(--hc) 18%, transparent);
  color: var(--hc); font-size: 11px; font-weight: 700;
}

/* Streak pill */
:global(.hb-pill) {
  display: flex; align-items: center; gap: 3px;
  padding: 3px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--hc) 14%, transparent);
  color: var(--hc); font-size: 12px; font-weight: 700;
  flex-shrink: 0;
}
:global(.hb-pill-frozen) {
  background: color-mix(in srgb, #60a5fa 14%, transparent) !important;
  color: #60a5fa !important;
}

/* Row icon buttons */
:global(.hb-row-btns) { display: flex; gap: 3px; }
:global(.hb-icon-btn) {
  width: 26px; height: 26px; border-radius: 7px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted-foreground);
  transition: background .12s, color .12s;
}
:global(.hb-icon-btn:hover) { background: color-mix(in srgb, var(--foreground) 8%, transparent); color: var(--foreground); }
:global(.hb-ice:hover) { color: #60a5fa; }
:global(.hb-del:hover) { color: var(--destructive, #dc2626); }

/* Empty state */
:global(.hb-empty) {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 40px 0; color: var(--muted-foreground); font-size: 13px;
}
:global(.hb-empty span) { font-size: 32px; }

/* Tips */
:global(.hb-tip) { align-items: flex-start !important; gap: 14px !important; }
:global(.hb-tip-n) {
  font-size: 10px; font-weight: 800; color: var(--mod-accent);
  letter-spacing: .05em; min-width: 18px; padding-top: 2px; flex-shrink: 0;
}
:global(.hb-tip p) { font-size: 12px; line-height: 1.6; margin: 0; color: var(--muted-foreground); }

/* ── Streak page ─────────────────────────────────────────────────── */
:global(.hb-streak-hero-content) {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 4px; padding: 8px 0 16px;
}
:global(.hb-big-flame) { font-size: 40px; line-height: 1; }
:global(.hb-big-num)   { font-size: 52px; font-weight: 900; color: var(--mod-accent); line-height: 1; }
:global(.hb-big-lbl)   { font-size: 12px; color: var(--muted-foreground); }

:global(.hb-token-display) { display: flex; gap: 8px; padding: 4px 0; }
:global(.hb-token)         { font-size: 22px; }
:global(.hb-token-spent)   { opacity: .2; filter: grayscale(1); }
:global(.hb-tip-small)     { border: none !important; background: transparent !important; padding: 6px 0 !important; }
:global(.hb-tip-small p)   { font-size: 12px; color: var(--muted-foreground); margin: 0; line-height: 1.55; }

:global(.hb-streak-row) {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 12px !important;
  border: none !important;
  background: transparent !important;
}
:global(.hb-s-emoji) { font-size: 20px; flex-shrink: 0; }
:global(.hb-s-info)  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
:global(.hb-s-info strong) { font-size: 13px; font-weight: 600; }

:global(.hb-chain)   { display: flex; gap: 3px; flex-wrap: wrap; }
:global(.hb-dot)     { width: 7px; height: 7px; border-radius: 2px; background: var(--border); }
:global(.hb-dot-on)  { background: var(--hc, var(--mod-accent)); }

:global(.hb-s-nums)  { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
:global(.hb-s-cur)   { display: flex; align-items: center; gap: 3px; font-size: 15px; font-weight: 700; color: var(--mod-accent); }
:global(.hb-s-best)  { font-size: 11px; color: var(--muted-foreground); }
:global(.hb-s-action){ flex-shrink: 0; }

:global(.hb-freeze-btn) {
  display: flex; align-items: center; gap: 3px;
  padding: 4px 10px; border-radius: 999px; border: none; cursor: pointer;
  background: color-mix(in srgb, #60a5fa 14%, transparent);
  color: #60a5fa; font-size: 11px; font-weight: 600;
  transition: background .12s;
}
:global(.hb-freeze-btn:hover) { background: color-mix(in srgb, #60a5fa 24%, transparent); }
:global(.hb-frozen-lbl) { font-size: 11px; color: #60a5fa; }

:global(.hb-stack-pair) {
  display: flex !important; align-items: center !important;
  gap: 8px !important; border: none !important;
  background: transparent !important; padding: 4px 0 !important;
}
:global(.hb-stack-chip) {
  flex: 1; padding: 7px 10px; border-radius: 10px; text-align: center;
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
  font-size: 12px; font-weight: 600;
}

/* ── Heatmap page ────────────────────────────────────────────────── */
:global(.hb-hm-content) { display: flex; flex-direction: column; gap: 18px; }

:global(.hb-hm-tabs) { display: flex; gap: 7px; flex-wrap: wrap; }
:global(.hb-hm-tab) {
  padding: 5px 12px; border-radius: 999px;
  border: 1px solid var(--border); background: transparent; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--muted-foreground);
  transition: all .14s;
}
:global(.hb-hm-tab-on) {
  background: color-mix(in srgb, var(--hc) 18%, transparent) !important;
  border-color: var(--hc) !important;
  color: var(--foreground) !important;
}

:global(.hb-hm-grid) {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 5px;
}
:global(.hb-hm-cell) {
  aspect-ratio: 1; border-radius: 4px;
  background: var(--border);
  cursor: default;
  transition: transform .1s;
}
:global(.hb-hm-cell:hover) { transform: scale(1.35); }
:global(.hb-hm-on) { background: var(--hc, var(--mod-accent)); }

:global(.hb-hm-legend) { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
:global(.hb-hm-legend span) { font-size: 11px; color: var(--muted-foreground); }
:global(.hb-lgnd-cell) { width: 12px; height: 12px; border-radius: 3px; }

:global(.hb-perf-row) {
  display: flex !important; align-items: center !important;
  gap: 10px !important; border: none !important; background: transparent !important;
}
:global(.hb-perf-name) { font-size: 13px; min-width: 100px; font-weight: 500; }
:global(.hb-perf-track) { flex: 1; height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; }
:global(.hb-perf-fill)  { height: 100%; border-radius: 999px; transition: width .4s ease; }
:global(.hb-perf-pct)   { font-size: 12px; font-weight: 700; min-width: 34px; text-align: right; }

/* ── Review page ─────────────────────────────────────────────────── */
:global(.hb-insight) {
  display: flex !important; align-items: flex-start !important;
  gap: 10px !important;
}
:global(.hb-ins-icon) { color: var(--mod-accent); flex-shrink: 0; margin-top: 2px; }
:global(.hb-insight p) { font-size: 12px; margin: 0; line-height: 1.6; }

:global(.hb-bd-row) {
  display: flex !important; align-items: center !important;
  gap: 12px !important; border: none !important; background: transparent !important;
}
:global(.hb-bd-info) { flex: 1; display: flex; flex-direction: column; gap: 5px; }
:global(.hb-bd-info strong) { font-size: 13px; font-weight: 600; }
:global(.hb-bd-bar)  { height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; }
:global(.hb-bd-fill) { height: 100%; border-radius: 999px; background: var(--hc, var(--mod-accent)); transition: width .4s; }
:global(.hb-bd-nums) { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; font-size: 12px; font-weight: 700; }
:global(.hb-bd-streak) { display: flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 500; color: var(--muted-foreground); }

/* ── Settings page ───────────────────────────────────────────────── */
:global(.hb-m-dot) {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--hc, var(--mod-accent)); flex-shrink: 0;
}
:global(.hb-m-emoji) { font-size: 17px; flex-shrink: 0; }
:global(.hb-m-info)  { flex: 1; display: flex; flex-direction: column; gap: 2px; }
:global(.hb-m-info strong) { font-size: 13px; font-weight: 600; }
:global(.hb-m-info span)   { font-size: 11px; color: var(--muted-foreground); }

:global(.hb-add-row) {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 9px 0;
  border: none; background: transparent; cursor: pointer;
  color: var(--mod-accent); font-size: 13px; font-weight: 600;
}
:global(.hb-add-row:hover) { opacity: .75; }

:global(.hb-token-ctrl) { display: flex; align-items: center; gap: 10px; }
:global(.hb-token-ctrl button) {
  width: 26px; height: 26px; border-radius: 999px;
  border: 1px solid var(--border); background: transparent;
  cursor: pointer; font-size: 14px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  color: var(--foreground);
}
:global(.hb-token-ctrl strong) { font-size: 16px; min-width: 18px; text-align: center; }

:global(.hb-token-bar) {
  height: 4px; background: var(--border); border-radius: 999px;
  overflow: hidden; margin-top: 2px;
}
:global(.hb-token-bar-fill) { height: 100%; background: var(--mod-accent); border-radius: 999px; transition: width .3s; }

:global(.hb-toggle-row) {
  justify-content: space-between !important;
  align-items: center !important;
}
:global(.hb-toggle-row div) { display: flex; flex-direction: column; gap: 2px; }
:global(.hb-toggle-row div strong) { font-size: 13px; font-weight: 600; }
:global(.hb-toggle-row div p)      { font-size: 11px; margin: 0; color: var(--muted-foreground); }
:global(.hb-toggle) { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--mod-accent); cursor: pointer; }

/* ── Add / Why modals ────────────────────────────────────────────── */
:global(.hb-overlay) {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center;
}
:global(.hb-modal) {
  background: var(--card);
  border-radius: 20px;
  width: 460px; max-width: calc(100vw - 32px);
  max-height: 85vh; overflow-y: auto;
  display: flex; flex-direction: column;
  animation: hb-in .18s ease;
}
:global(.hb-modal-head) {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 22px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
:global(.hb-modal-head h3) { font-size: 15px; font-weight: 700; margin: 0; }
:global(.hb-modal-body) { padding: 20px 22px; display: flex; flex-direction: column; gap: 16px; }
:global(.hb-modal-foot) {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 22px 20px;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

:global(.hb-field)     { display: flex; flex-direction: column; gap: 6px; }
:global(.hb-field-row) { display: flex; gap: 12px; }
:global(.hb-lbl) {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .07em; color: var(--muted-foreground);
}
:global(.hb-input) {
  padding: 9px 12px; border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  color: var(--foreground); font-size: 13px;
  font-family: inherit; outline: none;
}
:global(.hb-input:focus) { border-color: var(--mod-accent); }

:global(.hb-emoji-grid) { display: flex; flex-wrap: wrap; gap: 5px; }
:global(.hb-emoji-opt) {
  width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  cursor: pointer; font-size: 17px;
  display: flex; align-items: center; justify-content: center;
}
:global(.hb-sel) {
  border-color: var(--mod-accent) !important;
  background: color-mix(in srgb, var(--mod-accent) 14%, transparent) !important;
}

:global(.hb-chip-row) { display: flex; gap: 7px; }
:global(.hb-chip) {
  padding: 5px 14px; border-radius: 999px;
  border: 1px solid var(--border); background: transparent;
  cursor: pointer; font-size: 12px; font-weight: 600;
  color: var(--muted-foreground); text-transform: capitalize;
  transition: all .12s;
}
:global(.hb-chip-on) {
  background: color-mix(in srgb, var(--mod-accent) 18%, transparent) !important;
  border-color: var(--mod-accent) !important;
  color: var(--foreground) !important;
}

:global(.hb-color-row) { display: flex; gap: 8px; }
:global(.hb-swatch) {
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
}
:global(.hb-swatch-on) { border-color: var(--foreground) !important; }

:global(.hb-btn-ghost) {
  padding: 8px 18px; border-radius: 999px;
  border: 1px solid var(--border); background: transparent;
  cursor: pointer; font-size: 13px; font-weight: 600; color: var(--foreground);
}
:global(.hb-btn-primary) {
  padding: 8px 20px; border-radius: 999px; border: none;
  background: var(--mod-accent); cursor: pointer;
  font-size: 13px; font-weight: 700; color: #1a2a00;
  transition: filter .12s;
}
:global(.hb-btn-primary:disabled)        { opacity: .4; cursor: not-allowed; }
:global(.hb-btn-primary:hover:not(:disabled)) { filter: brightness(1.08); }

/* Why modal */
:global(.hb-why-modal) {
  background: var(--card);
  border-radius: 20px;
  width: 340px; max-width: calc(100vw - 32px);
  padding: 32px 28px 28px;
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  position: relative;
  animation: hb-in .18s ease;
}
:global(.hb-why-close) { position: absolute; top: 14px; right: 14px; }
:global(.hb-why-emoji) { font-size: 44px; line-height: 1; margin-bottom: 8px; }
:global(.hb-why-modal h3) { font-size: 18px; font-weight: 700; margin: 0 0 14px; }
:global(.hb-why-lbl) {
  font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
  color: var(--muted-foreground); margin: 0 0 5px;
}
:global(.hb-why-text) {
  font-size: 13px; font-style: italic; line-height: 1.65;
  color: var(--muted-foreground);
  border-left: 3px solid var(--mod-accent);
  padding-left: 10px; text-align: left; margin: 0 0 18px;
}
:global(.hb-why-stats) {
  display: flex; gap: 16px;
  font-size: 12px; font-weight: 600; color: var(--mod-accent);
}
:global(.hb-why-stats span) { display: flex; align-items: center; gap: 4px; }

/* ── Week bar chart (Review page) ────────────────────────────────── */
:global(.hb-week-content) {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 130px;
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
  width: 60%;
  min-height: 4px;
  border-radius: 999px;
  background: var(--mod-accent);
  transition: height .4s ease;
}
:global(.hb-week-day) { font-size: 10px; font-weight: 700; color: var(--hb-muted); }
:global(.hb-week-num) { font-size: 11px; font-weight: 600; }

/* ── Mood buttons (Today) ────────────────────────────────────────── */
:global(.hb-mood-btn) {
  width: 22px; height: 22px; border-radius: 6px; border: 1px solid transparent;
  background: transparent; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  opacity: .5; transition: opacity .12s, border-color .12s;
}
:global(.hb-mood-btn:hover) { opacity: 1; }
:global(.hb-mood-on) {
  opacity: 1 !important;
  border-color: var(--hb-border) !important;
  background: color-mix(in srgb, var(--foreground) 7%, transparent) !important;
}

/* ── Habit strength bar (Streaks page) ───────────────────────────── */
:global(.hb-strength-bar-wrap) {
  flex: 1; height: 5px; background: var(--hb-border);
  border-radius: 999px; overflow: hidden; margin: 0 8px;
}
:global(.hb-strength-bar) {
  height: 100%; border-radius: 999px; transition: width .4s ease;
}
</style>
