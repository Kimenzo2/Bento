<script lang="ts">
  import TagsIcon from "lucide-svelte/icons/tags";
  import XIcon from "lucide-svelte/icons/x";
  import type { TaskEntry } from "$lib/services/task-service";
  import { listTasks } from "$lib/services/task-service";

  let {
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  let tasks = $state<TaskEntry[]>([]);
  let loading = $state(true);
  let selectedTag = $state<string | null>(null);

  interface TagEntry {
    name: string;
    count: number;
    color: string;
  }

  const tagColors = [
    'oklch(0.776 0.193 327.239)',
    'oklch(0.819 0.127 194.951)',
    'oklch(0.937 0.192 109.589)',
    'oklch(0.871 0.048 66.097)',
    'oklch(0.824 0.054 249.345)',
    'oklch(0.679 0.236 327.794)',
    'oklch(0.871 0.172 109.496)',
    'oklch(0.9 0.156 109.169)',
  ];

  function tagColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return tagColors[Math.abs(hash) % tagColors.length];
  }

  let tagEntries = $derived.by(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      const raw = task.tags ?? '[]';
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const tag of parsed) {
            if (typeof tag === 'string' && tag.trim()) {
              map.set(tag.trim().toLowerCase(), (map.get(tag.trim().toLowerCase()) ?? 0) + 1);
            }
          }
        }
      } catch { /* skip corrupt tags */ }
    }
    const entries: TagEntry[] = [];
    for (const [name, count] of map) {
      entries.push({ name, count, color: tagColor(name) });
    }
    return entries.sort((a, b) => b.count - a.count);
  });

  let tagCount = $derived(tagEntries.length);
  let filteredEntries = $derived(
    selectedTag
      ? tagEntries.filter(t => t.name === selectedTag)
      : tagEntries
  );

  $effect(() => { if (open) loadTags(); });

  async function loadTags() {
    loading = true;
    try {
      tasks = await listTasks({ limit: 10000 });
    } catch {
      tasks = [];
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <div class="ts-flyout-scrim" onclick={onClose} role="presentation"></div>
  <div class="ts-flyout-panel" role="dialog" aria-label="Tags">
    <div class="ts-flyout-header">
      <div class="ts-flyout-title-row">
        <TagsIcon size={16} />
        <span class="ts-flyout-title">Tags</span>
      </div>
      <button class="ts-flyout-close" onclick={onClose} type="button"><XIcon size={16} /></button>
    </div>

    <div class="ts-flyout-stats">
      <div class="ts-stat-chip"><TagsIcon size={12} /><span>{tagCount} tag{tagCount === 1 ? '' : 's'}</span></div>
      {#if selectedTag}
        <button class="ts-stat-chip ts-stat-chip--action" onclick={() => selectedTag = null} type="button">
          <XIcon size={10} /> Clear filter
        </button>
      {/if}
    </div>

    <div class="ts-flyout-list">
      {#if loading}
        <div class="ts-flyout-loading"><div class="ts-spinner"></div></div>
      {:else if tagEntries.length === 0}
        <div class="ts-flyout-empty">
          <TagsIcon size={28} />
          <p>No tags yet</p>
          <span>Add tags to your tasks using #tagname to see them here</span>
        </div>
      {:else}
        {#each filteredEntries as entry (entry.name)}
          <div
            class="ts-tag-row"
            class:ts-tag-row--active={selectedTag === entry.name}
            role="button"
            tabindex="0"
            onclick={() => { selectedTag = selectedTag === entry.name ? null : entry.name; }}
            onkeydown={(e) => { if (e.key === 'Enter') { selectedTag = selectedTag === entry.name ? null : entry.name; } }}
          >
            <span class="ts-tag-dot" style="background: {entry.color}"></span>
            <span class="ts-tag-name">{entry.name}</span>
            <span class="ts-tag-count">{entry.count}</span>
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
    width: min(calc(100vw - var(--sidebar-actual-width, 240px) - 1.5rem), 320px);
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
  .ts-flyout-stats { display: flex; gap: 8px; padding: 8px 14px 4px; flex-shrink: 0; flex-wrap: wrap; }
  .ts-stat-chip { display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); padding: 3px 8px; border-radius: 6px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-stat-chip svg { opacity: 0.5; }
  .ts-stat-chip--action { cursor: pointer; transition: background .15s,color .15s; border: none; }
  .ts-stat-chip--action:hover { background: color-mix(in srgb, var(--foreground) 8%, var(--background)); color: color-mix(in srgb, var(--foreground) 70%, var(--background)); }
  .ts-flyout-list { flex: 1; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 1px; }
  .ts-flyout-loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
  .ts-spinner { width: 20px; height: 20px; border: 2px solid oklch(1 0 89.876 / 0.08); border-top-color: color-mix(in srgb, var(--foreground) 50%, var(--background)); border-radius: 50%; animation: tspin .6s linear infinite; }
  @keyframes tspin { to { transform: rotate(360deg); } }
  .ts-flyout-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 20px; text-align: center; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); gap: 6px; }
  .ts-flyout-empty p { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); margin: 0; }
  .ts-flyout-empty span { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); }
  .ts-tag-row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 10px; cursor: pointer; transition: background .12s; }
  .ts-tag-row:hover { background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-tag-row--active { background: color-mix(in srgb, var(--foreground) 6%, var(--background)); }
  .ts-tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .ts-tag-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ts-tag-count { font-size: 11px; font-weight: 600; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); padding: 1px 7px; border-radius: 6px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); min-width: 20px; text-align: center; }
</style>
