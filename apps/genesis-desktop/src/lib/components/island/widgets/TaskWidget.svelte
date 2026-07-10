<script lang="ts">
  import { onMount } from "svelte";
  import { invokeWithTimeout } from "$lib/ipc";
  import { getIcon } from "../island-icons";

  interface Task {
    id: string;
    title: string;
    done: boolean;
    priority: string;
    project: string;
    dueAt: number | null;
    createdAt: number;
  }

  let tasks = $state<Task[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let taskIslandEl = $state<HTMLDivElement | null>(null);
  let taskIslandClip = $state("inset(0 round 44px)");

  const CheckIcon = getIcon("check");
  const SquareIcon = getIcon("square");

  function appleCornerPath({
    width,
    height,
    radius,
    smoothing = 60,
  }: {
    width: number;
    height: number;
    radius: number;
    smoothing?: number;
  }): string {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const w = Math.max(0, width);
    const h = Math.max(0, height);
    const r = clamp(radius, 0, Math.min(w, h) / 2);
    const s = clamp(smoothing, 0, 100) / 100;

    if (!w || !h) return "";
    if (!r) return `M0 0H${w}V${h}H0Z`;

    if (s <= 0.001) {
      const c = r * 0.5522847498307936;
      return `M${r} 0H${w - r}C${w - r + c} 0 ${w} ${r - c} ${w} ${r}V${h - r}C${w} ${h - r + c} ${w - r + c} ${h} ${w - r} ${h}H${r}C${r - c} ${h} 0 ${h - r + c} 0 ${h - r}V${r}C0 ${r - c} ${r - c} 0 ${r} 0Z`;
    }

    const exponent = 2 + s * 3.35;
    const steps = 24;
    const points: [number, number][] = [];

    const corner = (cx: number, cy: number, a0: number, a1: number) => {
      for (let i = 0; i <= steps; i += 1) {
        const a = a0 + (a1 - a0) * (i / steps);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const x = cx + r * Math.sign(cos) * Math.abs(cos) ** (2 / exponent);
        const y = cy + r * Math.sign(sin) * Math.abs(sin) ** (2 / exponent);
        points.push([+x.toFixed(3), +y.toFixed(3)]);
      }
    };

    points.push([r, 0], [w - r, 0]);
    corner(w - r, r, -Math.PI / 2, 0);
    points.push([w, h - r]);
    corner(w - r, h - r, 0, Math.PI / 2);
    points.push([r, h]);
    corner(r, h - r, Math.PI / 2, Math.PI);
    points.push([0, r]);
    corner(r, r, Math.PI, Math.PI * 1.5);

    const deduped = points.filter((point, index, all) => {
      if (index === 0) return true;
      const prev = all[index - 1];
      return point[0] !== prev[0] || point[1] !== prev[1];
    });

    return `M${deduped.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
  }

  async function fetchTasks() {
    loading = true;
    error = null;
    try {
      const result = await invokeWithTimeout<Task[]>(
        "list_tasks",
        {
          project: null,
          priority: null,
          done: false,
          dueBefore: null,
          dueAfter: null,
          archived: false,
          limit: 20,
        },
        3_000
      );
      tasks = result ?? [];
    } catch (e) {
      error = "Unable to load tasks";
    } finally {
      loading = false;
    }
  }

  async function toggleTask(id: string) {
    try {
      const updated = await invokeWithTimeout<Task>("toggle_task", { id }, 3_000);
      if (updated) {
        if (updated.done) {
          tasks = tasks.filter((t) => t.id !== id);
        } else {
          tasks = tasks.map((t) => (t.id === id ? updated : t));
        }
      }
    } catch (e) {
      // Silently fail during IPC congestion.
    }
  }

  function formatDue(dueAt: number | null): string {
    if (!dueAt) return "";
    const now = Date.now();
    const diff = dueAt - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return `${days}d`;
    return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "urgent":
        return "rgba(239, 68, 68, 0.8)";
      case "high":
        return "rgba(251, 146, 60, 0.8)";
      case "medium":
        return "rgba(250, 204, 21, 0.8)";
      default:
        return "rgba(255, 255, 255, 0.2)";
    }
  }

  onMount(fetchTasks);

  onMount(() => {
    const updateClip = () => {
      if (!taskIslandEl) return;
      const rect = taskIslandEl.getBoundingClientRect();
      const radius = Math.min(52, Math.min(rect.width, rect.height) / 2);
      taskIslandClip = `path("${appleCornerPath({ width: rect.width, height: rect.height, radius, smoothing: 60 })}")`;
    };

    updateClip();
    const ro = new ResizeObserver(updateClip);
    if (taskIslandEl) ro.observe(taskIslandEl);

    return () => ro.disconnect();
  });
</script>

<div
  class="task-island"
  bind:this={taskIslandEl}
  style:clip-path={taskIslandClip}
  role="region"
  aria-label="Tasks"
>
  <div class="task-list">
    {#if loading}
      <div class="task-empty">Loading tasks...</div>
    {:else if error}
      <div class="task-empty task-error">{error}</div>
    {:else if tasks.length === 0}
      <div class="task-empty">No pending tasks</div>
    {:else}
      {#each tasks.slice(0, 3) as task (task.id)}
        <button
          class="task-item"
          class:task-item--done={task.done}
          onclick={() => toggleTask(task.id)}
        >
          <span class="task-check" style="color: {getPriorityColor(task.priority)}">
            {#if task.done}
              <CheckIcon size={14} strokeWidth={2}></CheckIcon>
            {:else}
              <SquareIcon size={14} strokeWidth={1.5}></SquareIcon>
            {/if}
          </span>
          <span class="task-title">{task.title}</span>
          {#if task.dueAt}
            <span class="task-due" class:task-due--overdue={task.dueAt < Date.now()}>
              {formatDue(task.dueAt)}
            </span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .task-island {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 10px 20px;
    background: #0b0b0b;
    border-radius: 0;
    overflow: hidden;
    will-change: clip-path;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .task-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10.5px;
    color: rgba(255, 255, 255, 0.25);
    padding: 12px 8px;
  }

  .task-error {
    color: rgba(239, 68, 68, 0.6);
  }

  .task-item {
    display: flex;
    align-items: center;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) max-content;
    column-gap: 12px;
    min-height: 0;
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    color: rgba(255, 255, 255, 0.84);
    transition: background 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .task-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .task-item:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .task-item--done {
    opacity: 0.42;
  }

  .task-check {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  .task-title {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 450;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-item--done .task-title {
    text-decoration: line-through;
    color: rgba(255, 255, 255, 0.35);
  }

  .task-due {
    flex-shrink: 0;
    font-size: 10.5px;
    font-weight: 450;
    color: rgba(255, 255, 255, 0.3);
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    white-space: nowrap;
  }

  .task-due--overdue {
    color: rgba(239, 68, 68, 0.7);
    background: rgba(239, 68, 68, 0.08);
  }
</style>
