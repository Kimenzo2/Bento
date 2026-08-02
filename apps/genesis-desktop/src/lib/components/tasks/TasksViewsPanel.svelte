<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import EyeIcon from "lucide-svelte/icons/eye";
  import XIcon from "lucide-svelte/icons/x";
  import Trash2Icon from "lucide-svelte/icons/trash-2";
  import ClockIcon from "lucide-svelte/icons/clock";
  import ListIcon from "lucide-svelte/icons/list";
  import LayoutGridIcon from "lucide-svelte/icons/layout-grid";
  import CalendarDaysIcon from "lucide-svelte/icons/calendar-days";
  import Columns3Icon from "lucide-svelte/icons/columns-3";
  import HistoryIcon from "lucide-svelte/icons/history";
  import TargetIcon from "lucide-svelte/icons/target";
  import GitBranchIcon from "lucide-svelte/icons/git-branch";

  const SAVED_VIEWS_KEY = "bento:tasks:savedViews";

  interface SavedView {
    id: string;
    name: string;
    viewFilter: string;
    viewMode: string;
    priorityFilter?: string;
    projectFilter?: string;
    query?: string;
    createdAt: number;
  }

  let {
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  let savedViews = $state<SavedView[]>([]);
  let editingIndex = $state<number | null>(null);
  let editName = $state('');
  let renameInputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (editingIndex !== null && renameInputEl) {
      renameInputEl.focus();
    }
  });

  function loadViews() {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        savedViews = Array.isArray(parsed) ? parsed : [];
      } else {
        savedViews = [];
      }
    } catch {
      savedViews = [];
    }
  }

  function persistViews() {
    try {
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
    } catch { /* quota exceeded, silently fail */ }
  }

  function deleteView(id: string) {
    savedViews = savedViews.filter(v => v.id !== id);
    persistViews();
  }

  function startRename(index: number) {
    editingIndex = index;
    editName = savedViews[index].name;
  }

  function commitRename() {
    if (editingIndex !== null && editName.trim()) {
      savedViews = savedViews.map((v, i) =>
        i === editingIndex ? { ...v, name: editName.trim() } : v
      );
      persistViews();
    }
    editingIndex = null;
    editName = '';
  }

  function cancelRename() {
    editingIndex = null;
    editName = '';
  }

  function applyView(view: SavedView) {
    window.dispatchEvent(new CustomEvent('bento:tasks-apply-view', {
      detail: {
        viewFilter: view.viewFilter,
        viewMode: view.viewMode,
        priorityFilter: view.priorityFilter ?? 'all',
        projectFilter: view.projectFilter ?? 'all',
        query: view.query ?? '',
      },
    }));
    onClose();
  }

  function formatDate(ts: number): string {
    const diff = Date.now() - ts;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function viewModeIcon(mode: string) {
    const icons: Record<string, typeof ListIcon> = {
      list: ListIcon,
      board: Columns3Icon,
      calendar: CalendarDaysIcon,
      table: LayoutGridIcon,
      timeline: HistoryIcon,
      focus: TargetIcon,
      mind: GitBranchIcon,
    };
    return icons[mode] ?? ListIcon;
  }

  $effect(() => { if (open) loadViews(); });
</script>

{#if open}
  <div class="ts-flyout-scrim" onclick={onClose} role="presentation"></div>
  <div class="ts-flyout-panel" role="dialog" aria-label="Views">
    <div class="ts-flyout-header">
      <div class="ts-flyout-title-row">
        <EyeIcon size={16} />
        <span class="ts-flyout-title">Saved Views</span>
      </div>
      <button class="ts-flyout-close" onclick={onClose} type="button"><XIcon size={16} /></button>
    </div>

    <div class="ts-flyout-stats">
      <div class="ts-stat-chip"><EyeIcon size={12} /><span>{savedViews.length} view{savedViews.length === 1 ? '' : 's'}</span></div>
    </div>

    <div class="ts-flyout-list">
      {#if savedViews.length === 0}
        <div class="ts-flyout-empty">
          <EyeIcon size={28} />
          <p>No saved views yet</p>
          <span>Use the "Save View" button in the Tasks panel to save your current view</span>
        </div>
      {:else}
        {#each savedViews as view, i (view.id)}
          {const Icon = viewModeIcon(view.viewMode)}
          <div class="ts-view-row">
            <div
              class="ts-view-row-main"
              role="button"
              tabindex="0"
              onclick={() => applyView(view)}
              onkeydown={(e) => { if (e.key === 'Enter') applyView(view); }}
            >
              <div class="ts-view-row-icon">
                <Icon size={14} />
              </div>
              <div class="ts-view-row-info">
                {#if editingIndex === i}
                  <input
                    class="ts-view-rename-input"
                    type="text"
                    bind:value={editName}
                    onblur={commitRename}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    bind:this={renameInputEl}
                    onclick={(e) => e.stopPropagation()}
                  />
                {:else}
                  <span class="ts-view-row-name">{view.name}</span>
                {/if}
                <span class="ts-view-row-meta">
                  <ClockIcon size={10} />
                  {formatDate(view.createdAt)}
                  &middot;
                  {view.viewFilter}
                  {#if view.viewMode !== 'list'}
                    &middot; {view.viewMode}
                  {/if}
                </span>
              </div>
            </div>
            <div class="ts-view-row-actions">
              <button
                class="ts-view-row-btn"
                onclick={(e) => { e.stopPropagation(); startRename(i); }}
                title="Rename view"
                aria-label="Rename view"
                type="button"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
              <button
                class="ts-view-row-btn ts-view-row-btn--danger"
                onclick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                title="Delete view"
                aria-label="Delete view"
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
  .ts-flyout-list { flex: 1; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 1px; }
  .ts-flyout-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 20px; text-align: center; color: color-mix(in srgb, var(--foreground) 25%, var(--background)); gap: 6px; }
  .ts-flyout-empty p { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--foreground) 50%, var(--background)); margin: 0; }
  .ts-flyout-empty span { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); }
  .ts-view-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 10px; transition: background .12s; cursor: default; }
  .ts-view-row:hover { background: color-mix(in srgb, var(--foreground) 4%, var(--background)); }
  .ts-view-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 3px 0; }
  .ts-view-row-icon { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 8px; background: color-mix(in srgb, var(--foreground) 4%, var(--background)); color: color-mix(in srgb, var(--foreground) 40%, var(--background)); flex-shrink: 0; }
  .ts-view-row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .ts-view-row-name { font-size: 12.5px; font-weight: 500; color: var(--foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ts-view-row-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); }
  .ts-view-row-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; opacity: 0; transition: opacity .12s; }
  .ts-view-row:hover .ts-view-row-actions { opacity: 1; }
  .ts-view-row-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent; color: color-mix(in srgb, var(--foreground) 30%, var(--background)); cursor: pointer; transition: background .12s,color .12s; }
  .ts-view-row-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, var(--background)); color: color-mix(in srgb, var(--foreground) 60%, var(--background)); }
  .ts-view-row-btn--danger:hover { background: oklch(0.637 0.208 25.331 / 0.15); color: oklch(0.637 0.208 25.331); }
  .ts-view-rename-input { font-size: 12.5px; font-weight: 500; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); background: color-mix(in srgb, var(--foreground) 4%, var(--background)); color: var(--foreground); outline: none; width: 100%; box-sizing: border-box; }
</style>
