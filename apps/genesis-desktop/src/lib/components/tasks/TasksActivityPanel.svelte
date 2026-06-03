<script lang="ts">
  import HistoryIcon from "lucide-svelte/icons/history";
  import XIcon from "lucide-svelte/icons/x";
  import CheckCircleIcon from "lucide-svelte/icons/circle-check";
  import PlusCircleIcon from "lucide-svelte/icons/plus-circle";
  import ClockIcon from "lucide-svelte/icons/clock";
  import ArchiveIcon from "lucide-svelte/icons/archive";
  import RefreshCwIcon from "lucide-svelte/icons/refresh-cw";
  import type { TaskEntry } from "$lib/services/task-service";
  import { listTasks } from "$lib/services/task-service";

  let {
    open,
    onClose,
    onNavigate,
  }: {
    open: boolean;
    onClose: () => void;
    onNavigate?: (taskId: string) => void;
  } = $props();

  let tasks = $state<TaskEntry[]>([]);
  let loading = $state(true);

  interface ActivityEvent {
    id: string;
    taskId: string;
    taskTitle: string;
    timestamp: number;
    type: 'completed' | 'created' | 'updated' | 'archived' | 'recurrence';
    description: string;
  }

  let events = $derived.by(() => {
    const list: ActivityEvent[] = [];
    for (const task of tasks) {
      if (task.completedAt) {
        list.push({
          id: `completed-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: task.completedAt,
          type: 'completed',
          description: 'Completed task',
        });
      }
      if (task.createdAt) {
        list.push({
          id: `created-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: task.createdAt,
          type: 'created',
          description: 'Created task',
        });
      }
      if (task.recurrenceRule && task.updatedAt > task.createdAt) {
        list.push({
          id: `recur-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: task.updatedAt,
          type: 'recurrence',
          description: `Recurrence set: ${task.recurrenceRule}`,
        });
      }
      if (task.archived && task.updatedAt > task.createdAt) {
        list.push({
          id: `archived-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: task.updatedAt,
          type: 'archived',
          description: 'Archived task',
        });
      }
    }
    // Default "updated" events for tasks updated after creation that aren't captured above
    for (const task of tasks) {
      if (task.updatedAt > task.createdAt) {
        const alreadyCovered = list.some(
          e => e.taskId === task.id && Math.abs(e.timestamp - task.updatedAt) < 1000
        );
        if (!alreadyCovered) {
          list.push({
            id: `updated-${task.id}`,
            taskId: task.id,
            taskTitle: task.title,
            timestamp: task.updatedAt,
            type: 'updated',
            description: 'Modified task',
          });
        }
      }
    }
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  });

  let completedCount = $derived(tasks.filter(t => t.done).length);
  let createdToday = $derived.by(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return tasks.filter(t => t.createdAt >= todayStart.getTime()).length;
  });

  $effect(() => { if (open) loadActivity(); });

  async function loadActivity() {
    loading = true;
    try {
      tasks = await listTasks({ limit: 10000 });
    } catch {
      tasks = [];
    } finally {
      loading = false;
    }
  }

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function typeColor(type: string): string {
    const colors: Record<string, string> = {
      completed: 'hsl(142, 70%, 55%)',
      created: 'hsl(217, 90%, 60%)',
      updated: 'hsl(35, 90%, 55%)',
      archived: 'hsl(0, 0%, 45%)',
      recurrence: 'hsl(190, 80%, 55%)',
    };
    return colors[type] ?? 'rgba(255,255,255,0.3)';
  }
</script>

{#if open}
  <div class="ts-flyout-scrim" onclick={onClose} role="presentation"></div>
  <div class="ts-flyout-panel" role="dialog" aria-label="Activity">
    <div class="ts-flyout-header">
      <div class="ts-flyout-title-row">
        <HistoryIcon size={16} />
        <span class="ts-flyout-title">Activity</span>
      </div>
      <button class="ts-flyout-close" onclick={onClose} type="button"><XIcon size={16} /></button>
    </div>

    <div class="ts-flyout-stats">
      <div class="ts-stat-chip"><CheckCircleIcon size={12} /><span>{completedCount} done</span></div>
      <div class="ts-stat-chip"><PlusCircleIcon size={12} /><span>{createdToday} today</span></div>
    </div>

    <div class="ts-flyout-list">
      {#if loading}
        <div class="ts-flyout-loading"><div class="ts-spinner"></div></div>
      {:else if events.length === 0}
        <div class="ts-flyout-empty">
          <HistoryIcon size={28} />
          <p>No activity yet</p>
          <span>Create or complete tasks to see your activity here</span>
        </div>
      {:else}
        {#each events as event (event.id)}
          <div class="ts-activity-row" role="button" tabindex="0"
            onclick={() => { onNavigate?.(event.taskId); onClose(); }}
            onkeydown={(e) => { if (e.key === 'Enter') { onNavigate?.(event.taskId); onClose(); } }}
          >
            <div class="ts-activity-dot" style="background: {typeColor(event.type)}">
              {#if event.type === 'completed'}
                <CheckCircleIcon size={10} />
              {:else if event.type === 'created'}
                <PlusCircleIcon size={10} />
              {:else if event.type === 'updated'}
                <ClockIcon size={10} />
              {:else if event.type === 'archived'}
                <ArchiveIcon size={10} />
              {:else}
                <RefreshCwIcon size={10} />
              {/if}
            </div>
            <div class="ts-activity-content">
              <span class="ts-activity-title">{event.description}</span>
              <span class="ts-activity-task">{event.taskTitle}</span>
            </div>
            <span class="ts-activity-time">{formatTime(event.timestamp)}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .ts-flyout-scrim { position: fixed; top: 0; right: 0; bottom: 0; z-index: 89; background: transparent; left: var(--sidebar-actual-width, 240px); }
  .ts-flyout-panel {
    position: fixed; z-index: 90;
    top: var(--flyout-target-top, calc(72px + var(--desktop-sidebar-top, 54px)));
    left: calc(var(--sidebar-actual-width, 240px) + 12px);
    width: min(calc(100vw - var(--sidebar-actual-width, 240px) - 1.5rem), 340px);
    max-height: min(75vh, 520px);
    display: flex; flex-direction: column; overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border);
    background: var(--popover);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: none;
    pointer-events: auto;    animation: ts-fade-in 0.12s ease-out;
  }

  @keyframes ts-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .ts-flyout-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ts-flyout-title-row { display: flex; align-items: center; gap: 8px; color: var(--foreground); }
  .ts-flyout-title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .ts-flyout-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: color-mix(in srgb, var(--foreground) 45%, var(--background)); cursor: pointer; transition: background .15s,color .15s; }
  .ts-flyout-close:hover { background: color-mix(in srgb, var(--foreground) 8%, var(--background)); color: color-mix(in srgb, var(--foreground) 80%, var(--background)); }
  .ts-flyout-stats { display: flex; gap: 8px; padding: 8px 14px 4px; flex-shrink: 0; }
  .ts-stat-chip { display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); padding: 3px 8px; border-radius: 6px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-stat-chip svg { opacity: 0.5; }
  .ts-flyout-list { flex: 1; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 1px; }
  .ts-flyout-loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
  .ts-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.08); border-top-color: color-mix(in srgb, var(--foreground) 50%, var(--background)); border-radius: 50%; animation: tspin .6s linear infinite; }
  @keyframes tspin { to { transform: rotate(360deg); } }
  .ts-flyout-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 20px; text-align: center; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); gap: 6px; }
  .ts-flyout-empty p { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); margin: 0; }
  .ts-flyout-empty span { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); }
  .ts-activity-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 8px; border-radius: 10px; transition: background .12s; }
  .ts-activity-row:hover { background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-activity-dot { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; margin-top: 1px; color: color-mix(in srgb, var(--foreground) 60%, var(--background)); }
  .ts-activity-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .ts-activity-title { font-size: 12px; font-weight: 500; color: color-mix(in srgb, var(--foreground) 80%, var(--background)); line-height: 1.3; }
  .ts-activity-task { font-size: 10.5px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ts-activity-time { font-size: 10px; color: color-mix(in srgb, var(--foreground) 20%, var(--background)); white-space: nowrap; flex-shrink: 0; padding-top: 2px; font-variant-numeric: tabular-nums; }
</style>
