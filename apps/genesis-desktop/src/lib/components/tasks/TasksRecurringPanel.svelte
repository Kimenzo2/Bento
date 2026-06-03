<script lang="ts">
  import Repeat2Icon from "lucide-svelte/icons/repeat-2";
  import XIcon from "lucide-svelte/icons/x";
  import ChevronRightIcon from "lucide-svelte/icons/chevron-right";
  import CalendarDaysIcon from "lucide-svelte/icons/calendar-days";
  import Trash2Icon from "lucide-svelte/icons/trash-2";
  import type { TaskEntry } from "$lib/services/task-service";
  import { listTasks, updateTask } from "$lib/services/task-service";
  import { time } from "$lib/utils/time";

  type RecurrenceValue = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

  let {
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  let tasks = $state<TaskEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let recurringTasks = $derived(tasks.filter(t => t.recurrenceRule));

  $effect(() => {
    if (open) loadTasks();
  });

  async function loadTasks() {
    loading = true;
    error = null;
    try {
      tasks = await listTasks({ limit: 10000 });
    } catch (err) {
      error = typeof err === 'string' ? err : 'Failed to load tasks';
      tasks = [];
    } finally {
      loading = false;
    }
  }

  const recurrenceOptions: { value: RecurrenceValue | ''; label: string }[] = [
    { value: '', label: 'No recurring' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Every weekday' },
    { value: 'weekends', label: 'Every weekend' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  function nextDueDate(task: TaskEntry): number | null {
    if (!task.recurrenceRule || !task.dueAt) return null;
    const now = time.now();
    const todayMs = time.dayStart(now);
    const dayMs = 86_400_000;

    const baseDue = task.completedAt ?? (task.dueAt < now ? now : task.dueAt);
    const baseDay = time.dayStart(baseDue);

    switch (task.recurrenceRule) {
      case 'daily':
        return baseDay + dayMs;
      case 'weekdays': {
        let d = new Date(baseDay + dayMs);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        return d.getTime();
      }
      case 'weekends': {
        let d = new Date(baseDay + dayMs);
        while (d.getDay() !== 0 && d.getDay() !== 6) d.setDate(d.getDate() + 1);
        return d.getTime();
      }
      case 'weekly':
        return baseDay + 7 * dayMs;
      case 'biweekly':
        return baseDay + 14 * dayMs;
      case 'monthly': {
        const d = new Date(baseDay);
        d.setMonth(d.getMonth() + 1);
        return d.getTime();
      }
      case 'yearly': {
        const d = new Date(baseDay);
        d.setFullYear(d.getFullYear() + 1);
        return d.getTime();
      }
      default:
        return null;
    }
  }

  function formatNextDue(ts: number | null): string {
    if (!ts) return '--';
    const now = time.now();
    const diff = Math.round((ts - now) / 86_400_000);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return time.formatCustom(ts, 'D');
    return time.formatCustom(ts, 'M j');
  }

  function isOverdue(ts: number | null): boolean {
    return ts !== null && ts < time.now();
  }

  async function handleRecurrenceChange(taskId: string, rule: string | null) {
    try {
      const updated = await updateTask({ id: taskId, recurrenceRule: rule });
      tasks = tasks.map(t => t.id === taskId ? updated : t);
    } catch (err) {
      console.error('Failed to update recurrence:', err);
    }
  }

  async function handleSkipNext(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const next = nextDueDate(task);
    if (next) {
      try {
        const updated = await updateTask({ id: taskId, dueAt: next + 86_400_000 });
        tasks = tasks.map(t => t.id === taskId ? updated : t);
      } catch (err) {
        console.error('Failed to skip occurrence:', err);
      }
    }
  }

  async function handleRemoveRecurrence(taskId: string) {
    await handleRecurrenceChange(taskId, null);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="tasks-recurring-scrim"
    onclick={onClose}
    role="presentation"
  ></div>

  <div
    class="tasks-recurring-panel"
    role="dialog"
    aria-label="Recurring tasks"
  >
    <!-- Header -->
    <div class="tasks-recurring-panel-header">
      <div class="tasks-recurring-panel-title-row">
        <Repeat2Icon size={16} />
        <span class="tasks-recurring-panel-title">Recurring Tasks</span>
      </div>
      <button
        class="tasks-recurring-panel-close"
        onclick={onClose}
        aria-label="Close recurring panel"
        type="button"
      >
        <XIcon size={16} />
      </button>
    </div>

    <!-- Count -->
    <div class="tasks-recurring-panel-count">
      {#if !loading}
        <span>{recurringTasks.length} task{recurringTasks.length === 1 ? '' : 's'} with recurrence</span>
      {/if}
    </div>

    <!-- Content -->
    <div class="tasks-recurring-panel-list">
      {#if loading}
        <div class="tasks-recurring-panel-loading">
          <div class="tasks-recurring-panel-spinner"></div>
        </div>
      {:else if error}
        <div class="tasks-recurring-panel-error">
          <p>{error}</p>
          <button class="tasks-recurring-panel-retry-btn" onclick={loadTasks}>Retry</button>
        </div>
      {:else if recurringTasks.length === 0}
        <div class="tasks-recurring-panel-empty">
          <Repeat2Icon size={28} />
          <p>No recurring tasks yet</p>
          <span>Set a recurrence on any task to see it here</span>
        </div>
      {:else}
        {#each recurringTasks as task (task.id)}
          {@const nextDue = nextDueDate(task)}
          <div class="tasks-recurring-panel-row">
            <!-- Left: task info -->
            <div class="tasks-recurring-panel-row-main">
              <span class="tasks-recurring-panel-row-title">{task.title}</span>
              <span class="tasks-recurring-panel-row-meta">
                <CalendarDaysIcon size={11} />
                <span class:tasks-recurring-panel-row-overdue={nextDue ? isOverdue(nextDue) : false}>
                  {formatNextDue(nextDue)}
                </span>
              </span>
            </div>

            <!-- Right: recurrence pattern selector -->
            <div class="tasks-recurring-panel-row-actions">
              <select
                class="tasks-recurring-panel-select"
                value={task.recurrenceRule ?? ''}
                onchange={(e) => {
                  const val = (e.target as HTMLSelectElement).value;
                  handleRecurrenceChange(task.id, val || null);
                }}
                aria-label="Recurrence pattern"
              >
                {#each recurrenceOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
              <button
                class="tasks-recurring-panel-row-btn"
                onclick={(e) => { e.stopPropagation(); handleSkipNext(task.id); }}
                title="Skip next occurrence"
                aria-label="Skip next occurrence"
                type="button"
              >
                <ChevronRightIcon size={13} />
              </button>
              <button
                class="tasks-recurring-panel-row-btn tasks-recurring-panel-row-btn--danger"
                onclick={(e) => { e.stopPropagation(); handleRemoveRecurrence(task.id); }}
                title="Remove recurrence"
                aria-label="Remove recurrence"
                type="button"
              >
                <Trash2Icon size={13} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Scrim (light dismiss) ── */
  .tasks-recurring-scrim {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 89;
    background: transparent;
    left: var(--sidebar-actual-width, 240px);
  }

  /* ── Panel (Avnac-style flyout) ── */
  .tasks-recurring-panel {
    position: fixed;
    z-index: 90;
    top: var(--flyout-target-top, calc(72px + var(--desktop-sidebar-top, 54px)));
    left: calc(var(--sidebar-actual-width, 240px) + 12px);
    width: min(calc(100vw - 4rem), 320px);
    max-height: min(70vh, 480px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border);
    background: var(--popover);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: none;
    pointer-events: auto;
    animation: tasks-recurring-fade 0.12s ease-out;
  }

  @keyframes tasks-recurring-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Header ── */
  .tasks-recurring-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tasks-recurring-panel-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--foreground);
  }

  .tasks-recurring-panel-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .tasks-recurring-panel-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 45%, var(--background));
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tasks-recurring-panel-close:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    color: rgba(255, 255, 255, 0.8);
  }

  /* ── Count ── */
  .tasks-recurring-panel-count {
    padding: 8px 14px 4px;
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 35%, var(--background));
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  /* ── List ── */
  .tasks-recurring-panel-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Loading ── */
  .tasks-recurring-panel-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  .tasks-recurring-panel-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.08);
    border-top-color: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    animation: tasks-spin 0.6s linear infinite;
  }

  @keyframes tasks-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Error ── */
  .tasks-recurring-panel-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    text-align: center;
    gap: 10px;
  }

  .tasks-recurring-panel-error p {
    font-size: 12px;
    color: #ef4444;
    margin: 0;
  }

  .tasks-recurring-panel-retry-btn {
    font-size: 11px;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    color: color-mix(in srgb, var(--foreground) 60%, var(--background));
    cursor: pointer;
    transition: background 0.12s;
  }

  .tasks-recurring-panel-retry-btn:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
  }

  /* ── Empty state ── */
  .tasks-recurring-panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    text-align: center;
    color: color-mix(in srgb, var(--foreground) 25%, var(--background));
    gap: 6px;
  }

  .tasks-recurring-panel-empty p {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  .tasks-recurring-panel-empty span {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* ── Row ── */
  .tasks-recurring-panel-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
    transition: background 0.12s;
  }

  .tasks-recurring-panel-row:hover {
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }

  .tasks-recurring-panel-row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    padding: 0;
  }

  .tasks-recurring-panel-row-title {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tasks-recurring-panel-row-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: color-mix(in srgb, var(--foreground) 35%, var(--background));
  }

  .tasks-recurring-panel-row-overdue {
    color: #ef4444;
  }

  /* ── Row actions ── */
  .tasks-recurring-panel-row-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .tasks-recurring-panel-select {
    appearance: none;
    -webkit-appearance: none;
    background: color-mix(in srgb, var(--foreground) 6%, var(--background));
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 20px 3px 6px;
    font-size: 10.5px;
    color: color-mix(in srgb, var(--foreground) 70%, var(--background));
    cursor: pointer;
    outline: none;
    min-width: 80px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 4px center;
  }

  .tasks-recurring-panel-select:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .tasks-recurring-panel-select option {
    background: var(--popover);
    color: var(--foreground);
  }

  .tasks-recurring-panel-row-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 35%, var(--background));
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .tasks-recurring-panel-row-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, var(--background));
    color: color-mix(in srgb, var(--foreground) 70%, var(--background));
  }

  .tasks-recurring-panel-row-btn--danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
</style>
