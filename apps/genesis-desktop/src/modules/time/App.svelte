<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Play, Square, Tag, MoreHorizontal, Clock, Calendar, BarChart2 } from 'lucide-svelte';
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import {
    Card,
    CardContent,
  } from "$lib/components/ui/card/index.js";

  let { moduleId, settings = {} }: { moduleId: string; settings?: any } = $props();
  void moduleId;
  void settings;

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ─── Real Timer State ───
  let isTracking = $state(false);
  let currentTask = $state('');
  let timerStartMs = $state<number | null>(null);
  let timerElapsed = $state(0);
  let currentTimer = $state('00:00:00');
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let hydrateTimer: ReturnType<typeof setTimeout> | null = null;

  const TIMER_KEY = 'bento_time_timer';
  const ENTRIES_KEY = 'bento_time_entries';

  // ─── Entry Types ───
  interface TimeEntry {
    id: string;
    task: string;
    project: string;
    duration: number; // seconds
    date: string; // YYYY-MM-DD
    tag: string;
  }

  let timeEntries = $state<TimeEntry[]>([]);
  let todayLoggedSeconds = $state(0);
  let weekLoggedSeconds = $state(0);
  let projects = $state<{ id: string; name: string; color: string }[]>([
    { id: 'bento', name: 'Bento Desktop', color: '#3b82f6' },
    { id: 'internal', name: 'Internal', color: '#a855f7' },
    { id: 'admin', name: 'Admin', color: '#71717a' },
  ]);

  // ─── Persistence ───
  function loadTimerState() {
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.isTracking && state.startMs) {
          timerStartMs = state.startMs;
          timerElapsed = state.elapsed + (time.now() - state.savedAt);
          isTracking = true;
        }
      }
    } catch { /* ignore */ }
  }

  function saveTimerState() {
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      isTracking,
      startMs: timerStartMs,
      elapsed: timerElapsed,
      savedAt: time.now(),
    }));
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(ENTRIES_KEY);
      timeEntries = raw ? JSON.parse(raw) : [];
    } catch { timeEntries = []; }
  }

  function saveEntries() {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(timeEntries));
  }

  // ─── Timer Control ───
  function startTimer() {
    stopInterval();
    isTracking = true;
    timerStartMs = time.now();
    startInterval();
    saveTimerState();
  }

  function stopInterval() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function startInterval() {
    stopInterval();
    timerInterval = setInterval(() => {
      if (!timerStartMs) return;
      timerElapsed = time.now() - timerStartMs;
      currentTimer = formatDuration(timerElapsed / 1000);
    }, 250);
  }

  function stopTimer() {
    stopInterval();
    isTracking = false;
    const totalSec = Math.floor(timerElapsed / 1000);
    currentTimer = formatDuration(totalSec);
    saveTimerState();

    // If there's a task name, save as entry
    if (currentTask.trim() && totalSec > 0) {
      const entry: TimeEntry = {
        id: crypto.randomUUID(),
        task: currentTask.trim(),
        project: projects[0].id,
        duration: totalSec,
        date: time.dateKey(),
        tag: 'bg-blue-500',
      };
      timeEntries = [entry, ...timeEntries];
      saveEntries();
      updateWeekData();
    }
    timerElapsed = 0;
  }

  function toggleTimer() {
    if (isTracking) stopTimer();
    else startTimer();
  }

  function formatDuration(totalSec: number): string {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function durationToHuman(totalSec: number): string {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }

  // ─── Today's Total ───
  let todayTotal = $derived.by(() => {
    const running = isTracking ? Math.floor(timerElapsed / 1000) : 0;
    return durationToHuman(todayLoggedSeconds + running);
  });

  // ─── Week Data ───
  let weekDays: { day: string; hours: number; height: string; active: boolean }[] = $state([]);

  function updateWeekData() {
    const nowMs = time.now();
    const now = new Date(nowMs);
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const days: { day: string; hours: number; height: string; active: boolean }[] = [];
    const totalsByDate = new Map<string, number>();
    let maxHours = 0;
    let nextWeekLoggedSeconds = 0;
    let nextTodayLoggedSeconds = 0;
    const today = time.dateKey(nowMs);

    for (const entry of timeEntries) {
      totalsByDate.set(entry.date, (totalsByDate.get(entry.date) ?? 0) + entry.duration);
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = time.dateKey(d.getTime());
      const totalSec = totalsByDate.get(dateStr) ?? 0;
      const hours = +(totalSec / 3600).toFixed(1);
      nextWeekLoggedSeconds += totalSec;
      if (dateStr === today) nextTodayLoggedSeconds = totalSec;
      days.push({ day: dayNames[i], hours, height: '0%', active: dateStr === today });
      if (hours > maxHours) maxHours = hours;
    }

    for (const d of days) {
      d.height = maxHours > 0 ? `${(d.hours / maxHours) * 100}%` : '0%';
    }

    weekDays = days;
    weekLoggedSeconds = nextWeekLoggedSeconds;
    todayLoggedSeconds = nextTodayLoggedSeconds;
  }

  // ─── Recent Entries (live from storage) ───
  let recentEntries = $derived(timeEntries.slice(0, 10));

  // ─── Week total (live) ───
  let weekTotal = $derived(durationToHuman(weekLoggedSeconds));

  // ─── Init ───
  function hydrateFromStorage() {
    loadTimerState();
    loadEntries();
    updateWeekData();
    if (isTracking && timerStartMs) {
      timerElapsed = time.now() - timerStartMs;
      currentTimer = formatDuration(timerElapsed / 1000);
      startInterval();
    } else {
      currentTimer = '00:00:00';
    }
  }

  onMount(() => {
    hydrateTimer = setTimeout(hydrateFromStorage, 0);
  });

  onDestroy(() => {
    if (hydrateTimer) clearTimeout(hydrateTimer);
    hydrateTimer = null;
    stopInterval();
  });

  // ─── Delete entry ───
  function deleteEntry(id: string) {
    timeEntries = timeEntries.filter(e => e.id !== id);
    saveEntries();
    updateWeekData();
  }

  // ─── Edit entry ───
  let editingEntry = $state<string | null>(null);
  let editTask = $state('');
  let editDuration = $state(0);

  function startEdit(entry: TimeEntry) {
    editingEntry = entry.id;
    editTask = entry.task;
    editDuration = entry.duration;
  }

  function saveEdit(entry: TimeEntry) {
    timeEntries = timeEntries.map(e =>
      e.id === entry.id
        ? { ...e, task: editTask.trim() || e.task, duration: Math.max(1, editDuration) }
        : e
    );
    saveEntries();
    updateWeekData();
    editingEntry = null;
  }

  function cancelEdit() {
    editingEntry = null;
  }

  // ─── Manual entry ───
  let showManualEntry = $state(false);
  let manualTask = $state('');
  let manualDuration = $state(0);

  function addManualEntry() {
    const task = manualTask.trim();
    if (!task || manualDuration <= 0) return;
    timeEntries = [{
      id: crypto.randomUUID(),
      task,
      project: projects[0].id,
      duration: manualDuration * 60, // convert minutes to seconds
      date: time.dateKey(),
      tag: 'bg-blue-500',
    }, ...timeEntries];
    saveEntries();
    updateWeekData();
    manualTask = '';
    manualDuration = 0;
    showManualEntry = false;
  }
</script>

<div class="time-app-container module-root" data-module="time">
  
  <!-- Top Action Bar -->
  <div class="time-header">
    <div class="header-left">
      <h1>{_t("moduleTimeTitle", "Time Tracker")}</h1>
      <p class="subtitle">{_t("moduleTimeToday", "Today")}: {todayTotal}</p>
    </div>
    <div class="header-right">
      <button class="nav-icon active"><Clock size={20} /></button>
      <button class="nav-icon"><Calendar size={20} /></button>
      <button class="nav-icon"><BarChart2 size={20} /></button>
    </div>
  </div>

  <!-- Hero Timer Section -->
  <div class="hero-timer-section">
    <div class="hero-solid-panel {isTracking ? 'is-tracking' : ''}">
      <!-- Input -->
      <div class="task-input-wrapper">
        <input 
          type="text" 
          placeholder={_t("moduleTimePlaceholder", "What are you working on?")}
          bind:value={currentTask}
          class="huge-task-input"
        />
        <button class="tag-project-btn">
          <Tag size={16} /> {_t("moduleTimeAddProject", "Add Project")}
        </button>
      </div>

      <!-- Mono Counter -->
      <div class="ticker-display">
        <span class="mono-time">{currentTimer}</span>
      </div>

      <!-- Play/Stop Control -->
      <div class="timer-controls">
        <button 
          class="main-toggle-btn {isTracking ? 'btn-stop' : 'btn-start'}" 
          onclick={toggleTimer}
        >
          {#if isTracking}
            <Square size={28} fill="currentColor" />
          {:else}
            <Play size={28} fill="currentColor" class="ml-1" />
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Proportional Week Strip -->
  <div class="week-strip-section">
    <div class="section-title">
      <h2>{_t("moduleTimeThisWeek", "This Week")}</h2>
      <span>{_t("moduleTimeTotal", "Total")}: {weekTotal}</span>
    </div>
    <div class="week-chart">
      {#each weekDays as day}
        <div class="day-col">
          <div class="bar-container">
            <div class="bar-fill {day.active ? 'bar-today' : ''}" style="height: {day.height}"></div>
          </div>
          <span class="day-label {day.active ? 'text-white' : ''}">{day.day}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Recent Entries -->
  <div class="recent-section">
    <div class="section-title">
      <h2>{_t("moduleTimeRecentEntries", "Recent Time Entries")}</h2>
      <button class="text-btn" onclick={() => showManualEntry = true}>+ {_t("moduleTimeAddManual", "Add Manual")}</button>
    </div>
    
    <div class="entries-list">
      {#each recentEntries as entry (entry.id)}
        {#if editingEntry === entry.id}
          <Card size="sm">
            <CardContent>
              <div class="entry-edit-form">
                <input type="text" bind:value={editTask} class="entry-edit-input" placeholder="Task name" />
                <div class="entry-edit-duration">
                  <input type="number" bind:value={editDuration} min="1" class="entry-edit-input entry-edit-num" />
                  <span class="entry-edit-label">sec</span>
                </div>
                <div class="entry-edit-actions">
                  <button class="entry-edit-save" onclick={() => saveEdit(entry)}>Save</button>
                  <button class="entry-edit-cancel" onclick={cancelEdit}>Cancel</button>
                </div>
              </div>
            </CardContent>
          </Card>
        {:else}
          <Card size="sm">
            <CardContent>
              <div class="time-entry-card-inner">
                <div class="entry-left">
                  <div class="project-dot" style="background: {projects.find(p => p.id === entry.project)?.color || '#71717a'}"></div>
                  <div class="entry-details">
                    <h3>{entry.task}</h3>
                    <p>{projects.find(p => p.id === entry.project)?.name || entry.project}</p>
                  </div>
                </div>
                <div class="entry-right">
                  <span class="entry-duration">{formatDuration(entry.duration)}</span>
                  <button class="entry-action" onclick={() => startEdit(entry)} title="Edit">
                    <MoreHorizontal size={18} />
                  </button>
                  <button class="entry-action entry-action--delete" onclick={() => deleteEntry(entry.id)} title="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        {/if}
      {/each}
    </div>
  </div>
</div>

<!-- Manual Entry Overlay -->
{#if showManualEntry}
  <div class="time-overlay" onclick={() => showManualEntry = false} role="presentation" transition:fade></div>
  <div class="time-manual-panel" transition:fade={{ duration: 150 }}>
    <h2 class="time-manual-title">Add Manual Entry</h2>
    <div class="time-manual-group">
      <label class="time-manual-label">Task</label>
      <input type="text" class="time-manual-input" bind:value={manualTask} placeholder="What did you work on?" />
    </div>
    <div class="time-manual-group">
      <label class="time-manual-label">Duration (minutes)</label>
      <input type="number" class="time-manual-input" bind:value={manualDuration} min="1" placeholder="e.g. 30" />
    </div>
    <div class="time-manual-actions">
      <button class="time-manual-btn time-manual-btn--primary" onclick={addManualEntry} disabled={!manualTask.trim() || manualDuration <= 0}>Add Entry</button>
      <button class="time-manual-btn" onclick={() => showManualEntry = false}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  :global(.time-app-container) {
    --time-ink: var(--foreground);
    --time-muted: var(--muted);
    --time-accent: var(--primary);
    --time-accent-hover: color-mix(in srgb, var(--primary) 80%, #000);
    --time-destructive: var(--destructive);
    --time-destructive-hover: color-mix(in srgb, var(--destructive) 80%, #000);
    --time-tracking: #22c55e;
    --time-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --time-border-subtle: color-mix(in srgb, var(--border) 86%, transparent);
  }

  .time-app-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    color: var(--time-ink);
    font-family: inherit;
    overflow-y: auto;
    padding-bottom: 60px;
    scrollbar-width: none;
  }
  .time-app-container::-webkit-scrollbar { display: none; }

  .time-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 32px 32px 24px;
  }

  .header-left h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .header-left .subtitle {
    margin: 4px 0 0 0;
    color: var(--time-muted);
    font-size: 15px;
  }

  .header-right {
    display: flex;
    gap: 12px;
    background: var(--card);
    padding: 6px;
    border-radius: 100px;
    border: 1px solid var(--time-border-subtle);
  }

  .nav-icon {
    width: 40px; height: 40px;
    border-radius: 20px;
    border: none;
    background: transparent;
    color: var(--time-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav-icon.active {
    background: var(--time-surface);
    color: var(--time-ink);
  }

  /* Hero Section */
  .hero-timer-section {
    padding: 0 32px;
    margin-bottom: 40px;
  }

  .hero-solid-panel {
    position: relative;
    background: var(--card);
    border-radius: 32px;
    padding: 40px;
    border: 1px solid var(--time-border-subtle);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }

  .hero-solid-panel.is-tracking {
    border-color: var(--time-tracking);
  }

  .task-input-wrapper, .ticker-display, .timer-controls {
    position: relative;
    z-index: 10;
    width: 100%;
  }

  .task-input-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }

  .huge-task-input {
    background: transparent;
    border: none;
    color: var(--time-ink);
    font-size: 24px;
    font-weight: 500;
    text-align: center;
    width: 100%;
    outline: none;
  }
  .huge-task-input::placeholder {
    color: color-mix(in srgb, var(--time-muted) 90%, transparent);
  }

  .tag-project-btn {
    background: var(--time-surface);
    border: 1px solid var(--time-border-subtle);
    color: color-mix(in srgb, var(--time-ink) 90%, var(--time-muted));
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .ticker-display {
    margin-bottom: 40px;
  }
  .mono-time {
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 84px;
    font-weight: 700;
    letter-spacing: -0.05em;
    color: var(--time-ink);
    line-height: 1;
  }

  .timer-controls {
    display: flex;
    justify-content: center;
  }

  .main-toggle-btn {
    width: 80px; height: 80px;
    border-radius: 40px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .btn-start {
    background: var(--time-accent);
  }
  .btn-stop {
    background: var(--time-destructive);
  }
  .ml-1 { margin-left: 4px; }

  /* Week Strip */
  .week-strip-section {
    padding: 0 32px;
    margin-bottom: 40px;
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 20px;
  }
  .section-title h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: color-mix(in srgb, var(--time-ink) 90%, var(--time-muted));
  }
  .section-title span {
    font-size: 14px;
    color: var(--time-muted);
  }
  .text-btn {
    background: transparent;
    border: none;
    color: var(--time-accent);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .week-chart {
    display: flex;
    justify-content: space-between;
    height: 120px;
    background: var(--card);
    border: 1px solid var(--time-border-subtle);
    border-radius: 20px;
    padding: 20px 24px;
  }

  .day-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    height: 100%;
  }

  .bar-container {
    width: 32px;
    flex-grow: 1;
    background: var(--time-surface);
    border-radius: 16px;
    display: flex;
    align-items: flex-end;
    padding: 4px;
  }

  .bar-fill {
    width: 100%;
    background: var(--time-muted);
    border-radius: 12px;
  }
  .bar-today {
    background: var(--time-accent);
  }

  .day-label {
    font-size: 12px;
    font-weight: 600;
    color: color-mix(in srgb, var(--time-muted) 90%, transparent);
  }
  :global(.time-day-active) { color: var(--time-ink); }

  /* Recent Entries */
  .recent-section {
    padding: 0 32px;
  }

  .entries-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Card-style entry inner layout */
  .time-entry-card-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .entry-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .project-dot {
    width: 12px; height: 12px;
    border-radius: 6px;
  }

  .entry-details h3 {
    margin: 0 0 4px 0;
    font-size: 15px;
    font-weight: 500;
  }
  .entry-details p {
    margin: 0;
    font-size: 13px;
    color: var(--time-muted);
  }

  .entry-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .entry-duration {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    color: color-mix(in srgb, var(--time-ink) 90%, var(--time-muted));
  }

  .entry-action {
    background: transparent;
    border: none;
    color: var(--time-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
  }
  .entry-action:hover {
    color: var(--time-ink);
  }

  /* ── Entry Edit / Delete ──────────────────────────────────────────── */
  .entry-action--delete:hover {
    color: var(--time-destructive) !important;
  }



  .entry-edit-form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .entry-edit-input {
    background: var(--time-surface);
    border: 1px solid var(--time-border-subtle);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--time-ink);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    flex: 1;
    min-width: 120px;
  }
  .entry-edit-input:focus {
    border-color: var(--time-accent);
  }

  .entry-edit-num {
    width: 80px;
    flex: none;
  }

  .entry-edit-duration {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .entry-edit-label {
    font-size: 13px;
    color: var(--time-muted);
  }

  .entry-edit-actions {
    display: flex;
    gap: 6px;
  }

  .entry-edit-save,
  .entry-edit-cancel {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .entry-edit-save {
    background: var(--time-accent);
    color: white;
  }
  .entry-edit-save:hover {
    background: var(--time-accent-hover);
  }

  .entry-edit-cancel {
    background: var(--time-surface);
    color: var(--time-muted);
  }
  .entry-edit-cancel:hover {
    color: var(--time-ink);
  }

  /* ── Manual Entry Overlay ─────────────────────────────────────────── */
  .time-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, #000 40%, transparent);
    z-index: 100;
  }

  .time-manual-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--card);
    border: 1px solid var(--time-border-subtle);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(380px, 90vw);
  }

  .time-manual-title {
    font-size: 17px;
    font-weight: 700;
    margin: 0;
  }

  .time-manual-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .time-manual-label {
    font-size: 13px;
    font-weight: 600;
  }

  .time-manual-input {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--time-border-subtle);
    background: var(--time-surface);
    color: var(--time-ink);
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }
  .time-manual-input:focus {
    border-color: var(--time-accent);
  }

  .time-manual-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .time-manual-btn {
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid var(--time-border-subtle);
    background: var(--time-surface);
    color: var(--time-ink);
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .time-manual-btn--primary {
    background: var(--time-accent);
    color: white;
    border-color: var(--time-accent);
  }
  .time-manual-btn--primary:hover {
    background: var(--time-accent-hover);
  }
  .time-manual-btn--primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>


