<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import { time } from '$lib/utils/time';

  let _t = $derived.by(() => createTranslator($activeBundle));

  let t = (key: string, fallback?: string) => _t(key, fallback);

  type WaterLog = {
    id: string;
    amount: number;
    unit: string;
    timestamp: number;
  };

  type DayEntry = {
    date: string;
    total: number;
    logs: WaterLog[];
  };

  let logs = $state<WaterLog[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let dailyGoal = $state(8);
  let customAmount = $state(0);
  let showHistory = $state(false);

  const STORAGE_KEY = "bento_water";
  const presets = [
    { label: "Glass", amount: 1, icon: "🥛" },
    { label: "Bottle", amount: 2.5, icon: "🧴" },
    { label: "Large", amount: 5, icon: "🫗" },
  ];

  function load() {
    try {
      const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) logs = JSON.parse(raw);
      else logs = [];
    } catch {
      error = _t("moduleWaterErrorLoad", "Failed to load water data");
      logs = [];
    } finally {
      loading = false;
    }
  }

  function save() {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }

  function addLog(amount: number) {
    logs = [
      { id: crypto.randomUUID(), amount, unit: "cups", timestamp: time.now() },
      ...logs,
    ];
    save();
  }

  function deleteLog(id: string) {
    logs = logs.filter((l) => l.id !== id);
    save();
  }

  function getToday() {
    return time.toISODate(time.now());
  }

  const today = $derived(getToday());
  const todayLogs = $derived(logs.filter((l) => time.toISODate(l.timestamp) === today));
  const todayTotal = $derived(todayLogs.reduce((s, l) => s + l.amount, 0));
  const progress = $derived(Math.min(todayTotal / dailyGoal, 1));
  const progressPercent = $derived(Math.round(progress * 100));
  const remaining = $derived(Math.max(dailyGoal - todayTotal, 0));

  // Group by day for history
  const historyDays = $derived.by(() => {
    const map = new Map<string, WaterLog[]>();
    for (const log of logs) {
      const d = time.toISODate(log.timestamp);
      const arr = map.get(d) || [];
      arr.push(log);
      map.set(d, arr);
    }
    return Array.from(map.entries())
      .map(([date, lgs]) => ({ date, total: lgs.reduce((s, l) => s + l.amount, 0), logs: lgs }))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  onMount(() => load());
</script>

<div class="water-shell module-root" data-module="water">
  <!-- Header -->
  <div class="water-header">
    <div class="water-header-left">
      <span class="water-icon">💧</span>
      <div>
        <h1 class="water-title">{_t("moduleWaterTitle", "Hydration")}</h1>
        <p class="water-subtitle">{_t("moduleWaterGoal", "Goal")}: {dailyGoal} {_t("moduleWaterCupsDay", "cups/day")}</p>
      </div>
    </div>
    <button class="water-btn water-btn-ghost" onclick={() => (showHistory = !showHistory)}>
      {showHistory ? _t("moduleWaterToday", "Today") : _t("moduleWaterHistory", "History")}
    </button>
  </div>

  <!-- Progress Ring -->
  <div class="water-progress" transition:fade>
    <div class="water-ring-container">
      <PremiumRing
        size={148}
        thickness={12}
        segments={[{ value: progressPercent, color: "var(--accent, #3b82f6)", label: "Hydration" }]}
        centerLabel={_t("moduleWaterProgressPercent", "{p}% of daily goal").replace("{p}", String(progressPercent))}
        centerValue={String(todayTotal)}
        centerNote={_t("moduleWaterOf", "of") + ` ${dailyGoal}`}
      />
    </div>
    <div class="water-progress-info">
      <span class="water-progress-label">{_t("moduleWaterProgressPercent", "{p}% of daily goal").replace("{p}", String(progressPercent))}</span>
      {#if remaining > 0}
        <span class="water-progress-remaining">{_t("moduleWaterRemaining", "{n} cups remaining").replace("{n}", String(remaining))}</span>
      {:else}
        <span class="water-progress-done">✅ {_t("moduleWaterGoalReached", "Goal reached!")}</span>
      {/if}
    </div>
  </div>

  <!-- Quick Log -->
  {#if !showHistory}
    <div class="water-presets" transition:fade>
      <p class="water-section-label">{_t("moduleWaterQuickAdd", "Quick add")}</p>
      <div class="water-preset-grid">
        {#each presets as preset}
          <button class="water-preset-btn" onclick={() => addLog(preset.amount)}>
            <span class="water-preset-icon">{preset.icon}</span>
            <span class="water-preset-label">{preset.label}</span>
            <span class="water-preset-amount">{preset.amount} cups</span>
          </button>
        {/each}
      </div>
      <div class="water-custom">
        <input type="number" class="water-input water-input--small" bind:value={customAmount} min="0" step="0.5" placeholder={_t("moduleWaterCustom", "Custom")} />
        <button class="water-btn water-btn-primary" disabled={!customAmount || customAmount <= 0} onclick={() => { addLog(customAmount); customAmount = 0; }}>{_t("moduleWaterAdd", "Add")}</button>
      </div>
    </div>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="water-loading" transition:fade>
      {#each [1, 2, 3] as _}
        <div class="water-skeleton"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="water-state" transition:fade>
      <span class="water-state-icon">⚠️</span>
      <p>{error}</p>
      <button class="water-btn water-btn-secondary" onclick={() => { error = null; load(); }}>{_t("commonRetry", "Retry")}</button>
    </div>
  {/if}

  <!-- Today's Logs -->
  {#if !loading && !error && !showHistory}
    <div class="water-logs" transition:fade>
      <p class="water-section-label">{_t("moduleWaterTodayEntries", "Today's entries")}</p>
      {#if todayLogs.length === 0}
        <div class="water-empty">
          <span class="water-empty-icon">🫗</span>
          <p>{_t("moduleWaterNoEntries", "No water logged today. Tap a button above!")}</p>
        </div>
      {:else}
        <div class="water-log-list">
          {#each todayLogs as log (log.id)}
            <div class="water-log-row" transition:slide={{ duration: 100 }}>
              <span class="water-log-amount">{log.amount} cups</span>
              <span class="water-log-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <button class="water-btn-icon water-btn-icon--danger" onclick={() => deleteLog(log.id)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- History -->
  {#if showHistory}
    <div class="water-history" transition:fade>
      <p class="water-section-label">{_t("moduleWaterHistory", "History")}</p>
      {#if historyDays.length === 0}
        <div class="water-empty">
          <p>{_t("moduleWaterNoHistory", "No history yet.")}</p>
        </div>
      {:else}
        {#each historyDays as day}
          <div class="water-day" transition:slide={{ duration: 100 }}>
            <div class="water-day-header">
              <span class="water-day-date">{new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span class="water-day-total" class:water-day-total--done={day.total >= dailyGoal}>
                {day.total} cups
              </span>
            </div>
            <div class="water-day-bar">
              <div class="water-day-fill" style="width: {Math.min((day.total / dailyGoal) * 100, 100)}%"></div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .water-shell {
    padding: 24px;
    max-width: 500px;
    margin: 0 auto;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .water-header { display: flex; align-items: center; justify-content: space-between; }
  .water-header-left { display: flex; align-items: center; gap: 12px; }
  .water-icon { font-size: 28px; line-height: 1; }
  .water-title { font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary, #1a1a2e); }
  .water-subtitle { font-size: 13px; color: var(--text-secondary, #6b7280); margin: 2px 0 0 0; }

  .water-btn {
    padding: 8px 18px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .water-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .water-btn-primary { background: var(--accent, #3b82f6); color: #fff; }
  .water-btn-primary:not(:disabled):hover { opacity: 0.9; }
  .water-btn-secondary { background: var(--bg-secondary, rgba(0,0,0,0.06)); color: var(--text-primary); }
  .water-btn-ghost { background: transparent; color: var(--text-secondary, #6b7280); }
  .water-btn-ghost:hover { background: var(--bg-secondary, rgba(0,0,0,0.06)); }

  .water-btn-icon {
    width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 11px;
    background: transparent; transition: all 0.15s;
  }
  .water-btn-icon:hover { background: var(--bg-secondary, rgba(0,0,0,0.06)); }
  .water-btn-icon--danger { color: var(--danger, #ef4444); }

  .water-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 20px;
    background: var(--card);
    border: none;
    box-shadow: none;
  }

  .water-ring-container { position: relative; width: 120px; height: 120px; }
  .water-ring { width: 100%; height: 100%; }
  .water-ring-text {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .water-ring-value { font-size: 28px; font-weight: 700; color: var(--accent, #3b82f6); line-height: 1; }
  .water-ring-label { font-size: 12px; color: var(--text-secondary, #6b7280); }

  .water-progress-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .water-progress-label { font-size: 15px; font-weight: 600; color: var(--text-primary, #1a1a2e); }
  .water-progress-remaining { font-size: 13px; color: var(--text-secondary, #6b7280); }
  .water-progress-done { font-size: 13px; color: #22c55e; font-weight: 600; }

  .water-section-label { font-size: 13px; font-weight: 600; color: var(--text-secondary, #6b7280); margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }

  .water-presets { display: flex; flex-direction: column; gap: 12px; }
  .water-preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

  .water-preset-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 14px 8px; border-radius: 20px; border: none;
    background: var(--card); cursor: pointer; transition: all 0.15s;
  }
  .water-preset-btn:hover { background: rgba(255,255,255,0.08); transform: translateY(-2px); }
  .water-preset-icon { font-size: 24px; }
  .water-preset-label { font-size: 12px; font-weight: 600; color: var(--text-primary, #1a1a2e); }
  .water-preset-amount { font-size: 11px; color: var(--text-secondary, #6b7280); }

  .water-custom { display: flex; gap: 8px; }
  .water-input {
    flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border, rgba(0,0,0,0.1));
    background: var(--input-bg, #fff); color: var(--text-primary, #1a1a2e); font-size: 14px; outline: none;
  }
  .water-input:focus { border-color: var(--accent, #3b82f6); }
  .water-input--small { max-width: 120px; }

  .water-loading { display: flex; flex-direction: column; gap: 8px; }
  .water-skeleton { height: 48px; border-radius: 10px; background: var(--skeleton-bg, rgba(0,0,0,0.06)); animation: water-pulse 1.5s infinite; }
  @keyframes water-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .water-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; }
  .water-state-icon { font-size: 24px; }

  .water-empty {
    display: flex; align-items: center; gap: 8px; justify-content: center;
    padding: 24px; border-radius: 10px; background: var(--bg-secondary, rgba(0,0,0,0.03));
    color: var(--text-secondary, #6b7280); font-size: 13px;
  }
  .water-empty-icon { font-size: 20px; }

  .water-logs, .water-history { display: flex; flex-direction: column; gap: 8px; }

  .water-log-list { display: flex; flex-direction: column; gap: 4px; }

  .water-log-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-radius: 20px; background: var(--card); border: none;
  }
  .water-log-amount { flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary); }
  .water-log-time { font-size: 12px; color: var(--text-secondary, #6b7280); }

  .water-day {
    padding: 10px 12px; border-radius: 20px; background: var(--card); border: none;
    display: flex; flex-direction: column; gap: 6px;
    box-shadow: none;
  }
  .water-day-header { display: flex; justify-content: space-between; align-items: center; }
  .water-day-date { font-size: 13px; font-weight: 500; color: var(--text-primary); }
  .water-day-total { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
  .water-day-total--done { color: #22c55e; }

  .water-day-bar { height: 6px; border-radius: 3px; background: var(--bg-secondary, rgba(0,0,0,0.06)); overflow: hidden; }
  .water-day-fill { height: 100%; border-radius: 3px; background: var(--accent, #3b82f6); transition: width 0.3s; }
</style>
