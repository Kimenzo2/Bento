<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import type { TaskDraft } from "$lib/ai/client";

  let { task }: { task: TaskDraft } = $props();

  const priorityColors: Record<string, string> = {
    urgent: "#ef4444",
    high: "#f59e0b",
    medium: "#3b82f6",
    none: "var(--muted-foreground)",
  };

  const priorityLabels: Record<string, string> = {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    none: "None",
  };

  function formatDueDate(ms?: number): string {
    if (!ms) return "";
    const d = new Date(ms);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isOverdue(ms?: number): boolean {
    if (!ms || task.done) return false;
    return new Date(ms) < new Date();
  }
</script>

<div
  class="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--muted)]/40"
>
  <div
    class="mt-0.5 size-4 shrink-0 rounded-full border-2 {task.done
      ? 'border-[var(--primary)] bg-[var(--primary)]'
      : 'border-[var(--muted-foreground)]/30'}"
    style={task.done ? "" : ""}
  >
    {#if task.done}
      <svg viewBox="0 0 16 16" class="size-full text-[var(--primary-foreground)]">
        <path d="M4 8l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </div>
  <div class="min-w-0 flex-1">
    <p class="text-sm font-medium {task.done ? 'text-[var(--muted-foreground)] line-through' : 'text-[var(--foreground)]'}">
      {task.title}
    </p>
    <div class="mt-1 flex flex-wrap items-center gap-2">
      {#if task.priority && task.priority !== "none"}
        <span class="text-xs font-medium" style="color: {priorityColors[task.priority] ?? priorityColors.none}">
          {priorityLabels[task.priority] ?? task.priority}
        </span>
      {/if}
      {#if task.project}
        <span class="text-xs text-[var(--muted-foreground)]">{task.project}</span>
      {/if}
      {#if formatDueDate(task.dueAt)}
        <span class="text-xs {isOverdue(task.dueAt)
          ? 'text-red-500'
          : 'text-[var(--muted-foreground)]'}">
          {formatDueDate(task.dueAt)}
        </span>
      {/if}
    </div>
  </div>
</div>
