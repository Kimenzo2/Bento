<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import SearchIcon from "lucide-svelte/icons/search";
  import XIcon from "lucide-svelte/icons/x";
  import FilterIcon from "lucide-svelte/icons/filter";
  import CheckCircle2Icon from "lucide-svelte/icons/check-circle-2";
  import CircleIcon from "lucide-svelte/icons/circle";
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

  let query = $state('');
  let priorityFilter = $state('all');
  let statusFilter = $state('all');
  let projectFilter = $state('');
  let allTasks = $state<TaskEntry[]>([]);
  let loading = $state(true);
  let searchInputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (open && searchInputEl) {
      searchInputEl.focus();
    }
  });

  let projects = $derived([...new Set(allTasks.map(t => t.project).filter(Boolean))]);

  // Derived filtered results
  let results = $derived.by(() => {
    let filtered = allTasks;
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.tags ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (statusFilter === 'done') {
      filtered = filtered.filter(t => t.done);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(t => !t.done);
    }
    if (projectFilter) {
      filtered = filtered.filter(t => t.project === projectFilter);
    }
    return filtered.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  });

  function highlightText(text: string, q: string): string {
    if (!q) return text;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark class="ts-highlight">$1</mark>');
  }

  function formatPriority(p: string): string {
    const labels: Record<string, string> = { high: '🔴', medium: '🟡', low: '⚪' };
    return labels[p] ?? '⚪';
  }

  $effect(() => { if (open) loadAll(); });

  async function loadAll() {
    loading = true;
    try {
      allTasks = await listTasks({ limit: 10000 });
    } catch {
      allTasks = [];
    } finally {
      loading = false;
    }
  }

  function clearFilters() {
    query = '';
    priorityFilter = 'all';
    statusFilter = 'all';
    projectFilter = '';
  }

  let hasFilters = $derived(query || priorityFilter !== 'all' || statusFilter !== 'all' || projectFilter);
</script>

{#if open}
  <div class="ts-flyout-scrim" onclick={onClose} role="presentation"></div>
  <div class="ts-flyout-panel" role="dialog" aria-label="Search">
    <div class="ts-flyout-header">
      <div class="ts-flyout-title-row">
        <SearchIcon size={16} />
        <span class="ts-flyout-title">Search</span>
      </div>
      <button class="ts-flyout-close" onclick={onClose} type="button"><XIcon size={16} /></button>
    </div>

    <div class="ts-search-bar">
      <SearchIcon size={14} style="opacity:0.3;flex-shrink:0" />
      <input
        class="ts-search-input"
        type="text"
        placeholder="Search tasks, tags, notes..."
        bind:value={query}
        bind:this={searchInputEl}
      />
      {#if hasFilters}
        <button class="ts-search-clear" onclick={clearFilters} type="button"><XIcon size={12} /></button>
      {/if}
    </div>

    <div class="ts-search-filters">
      <select class="ts-search-select" bind:value={priorityFilter}>
        <option value="all">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select class="ts-search-select" bind:value={statusFilter}>
        <option value="all">All status</option>
        <option value="pending">Pending</option>
        <option value="done">Completed</option>
      </select>
      {#if projects.length > 0}
        <select class="ts-search-select" bind:value={projectFilter}>
          <option value="">All projects</option>
          {#each projects as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      {/if}
    </div>

    <div class="ts-flyout-count">
      {results.length} of {allTasks.length} task{allTasks.length === 1 ? '' : 's'}
    </div>

    <div class="ts-flyout-list">
      {#if loading}
        <div class="ts-flyout-loading"><div class="ts-spinner"></div></div>
      {:else if results.length === 0}
        <div class="ts-flyout-empty">
          <SearchIcon size={28} />
          <p>{hasFilters ? 'No results match your search' : 'No tasks found'}</p>
          <span>{hasFilters ? 'Try adjusting your filters or search query' : 'Create a task to get started'}</span>
        </div>
      {:else}
        {#each results as task (task.id)}
          <div class="ts-result-row" role="button" tabindex="0"
            onclick={() => { onNavigate?.(task.id); onClose(); }}
            onkeydown={(e) => { if (e.key === 'Enter') { onNavigate?.(task.id); onClose(); } }}
          >
            <div class="ts-result-icon">
              {#if task.done}
                <CheckCircle2Icon size={16} style="color:oklch(0.819 0.127 194.951)" />
              {:else}
                <CircleIcon size={16} class="ts-circle-icon" />
              {/if}
            </div>
            <div class="ts-result-body">
              <span class="ts-result-title">{@html highlightText(task.title, query)}</span>
              <div class="ts-result-meta">
                {#if task.project}
                  <span class="ts-result-tag">{task.project}</span>
                {/if}
                {#if task.dueAt}
                  <span class="ts-result-date">{new Date(task.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                {/if}
                {#if task.priority && task.priority !== 'medium'}
                  <span>{formatPriority(task.priority)}</span>
                {/if}
              </div>
              {#if task.tags && task.tags !== '[]' && task.tags !== ''}
                {const tags: string[] = (() => { try { return JSON.parse(task.tags); } catch { return []; } })()}
                {#if tags.length > 0}
                  <div class="ts-result-tags">
                    {#each tags.slice(0, 3) as tag}
                      <span class="ts-result-tag-item">{@html highlightText(tag, query)}</span>
                    {/each}
                    {#if tags.length > 3}
                      <span class="ts-result-tag-item">+{tags.length - 3}</span>
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
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
    width: min(calc(100vw - var(--sidebar-actual-width, 240px) - 1.5rem), 360px);
    max-height: min(80vh, 560px);
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

  .ts-search-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ts-search-input { flex: 1; font-size: 13px; padding: 0; border: none; background: transparent; color: var(--foreground); outline: none; min-width: 0; }
  .ts-search-input::placeholder { color: color-mix(in srgb, var(--foreground) 20%, var(--background)); }
  .ts-search-clear { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; border: none; background: transparent; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); cursor: pointer; }
  .ts-search-clear:hover { color: color-mix(in srgb, var(--foreground) 50%, var(--background)); }

  .ts-search-filters { display: flex; gap: 6px; padding: 6px 12px 8px; flex-wrap: wrap; flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .ts-search-select { font-size: 10.5px; padding: 3px 6px; border-radius: 6px; border: 1px solid var(--border); background: color-mix(in srgb, var(--foreground) 4%, var(--background)); color: color-mix(in srgb, var(--foreground) 50%, var(--background)); outline: none; cursor: pointer; min-width: 0; }
  .ts-search-select:focus { border-color: var(--border); }
  .ts-search-select option { background: var(--popover); color: color-mix(in srgb, var(--foreground) 70%, var(--background)); }

  .ts-flyout-count { padding: 6px 14px 4px; font-size: 10.5px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); letter-spacing: .02em; flex-shrink: 0; }
  .ts-flyout-list { flex: 1; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 2px; }
  .ts-flyout-loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
  .ts-spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: color-mix(in srgb, var(--foreground) 50%, var(--background)); border-radius: 50%; animation: tspin .6s linear infinite; }
  @keyframes tspin { to { transform: rotate(360deg); } }
  .ts-flyout-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 20px; text-align: center; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); gap: 6px; }
  .ts-flyout-empty p { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); margin: 0; }
  .ts-flyout-empty span { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); }

  .ts-result-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 8px; border-radius: 10px; cursor: pointer; transition: background .12s; }
  .ts-result-row:hover { background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-result-icon { flex-shrink: 0; margin-top: 2px; }
  .ts-result-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ts-result-title { font-size: 12.5px; font-weight: 500; color: var(--foreground); line-height: 1.3; overflow-wrap: break-word; }
  .ts-result-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); }
  .ts-result-tag { padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); color: color-mix(in srgb, var(--foreground) 35%, var(--background)); font-size: 11px; }
  .ts-result-date { font-variant-numeric: tabular-nums; }
  .ts-result-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
  .ts-result-tag-item { font-size: 11px; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); color: color-mix(in srgb, var(--foreground) 40%, var(--background)); }
  :global(.ts-highlight) { background: color-mix(in srgb, var(--foreground) 12%, var(--background)); color: var(--foreground); border-radius: 2px; padding: 0 2px; }
  .ts-circle-icon { color: color-mix(in srgb, var(--foreground) 15%, var(--background)); }
</style>
