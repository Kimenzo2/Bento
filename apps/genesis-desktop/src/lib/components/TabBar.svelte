<script lang="ts">
  import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-svelte';

  interface Tab {
    id: string;
    title: string;
    icon: string | null;
  }

  let {
    tabs = [] as Tab[],
    activeTabId = '',
    canGoBack = false,
    canGoForward = false,
    onSelectTab = (id: string) => {},
    onCloseTab = (id: string) => {},
    onNewTab = () => {},
    onGoBack = () => {},
    onGoForward = () => {},
  } = $props();

  function tabLabel(tab: Tab): string {
    return tab.title?.trim() || 'Untitled';
  }

  function handleClose(e: MouseEvent, id: string) {
    e.stopPropagation();
    onCloseTab(id);
  }
</script>

<div class="tab-bar">
  <div class="tab-nav">
    <button class="tab-nav-btn" disabled={!canGoBack} onclick={() => onGoBack()} type="button" aria-label="Go back"><ChevronLeft size={14} /></button>
    <button class="tab-nav-btn" disabled={!canGoForward} onclick={() => onGoForward()} type="button" aria-label="Go forward"><ChevronRight size={14} /></button>
  </div>

  <div class="tab-strip">
    {#each tabs as tab (tab.id)}
      <button class="tab-item" class:active={tab.id === activeTabId} onclick={() => onSelectTab(tab.id)} type="button" role="tab" aria-selected={tab.id === activeTabId}>
        <span class="tab-icon">{tab.icon ?? '\u{1F4C4}'}</span>
        <span class="tab-label">{tabLabel(tab)}</span>
        <span class="tab-close" onclick={(e) => handleClose(e, tab.id)} role="button" tabindex="0" aria-label="Close tab">
          <X size={12} />
        </span>
      </button>
    {/each}
    <button class="tab-new-btn" onclick={() => onNewTab()} type="button" aria-label="New tab" title="New tab">
      <Plus size={14} />
    </button>
  </div>
</div>

<style>
  .tab-bar { display: flex; align-items: center; gap: 4px; padding: 0 8px; height: 32px; background: color-mix(in srgb, var(--foreground) 2%, var(--background)); border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent); flex-shrink: 0; overflow: hidden; }
  .tab-nav { display: flex; gap: 2px; flex-shrink: 0; }
  .tab-nav-btn { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; }
  .tab-nav-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .tab-nav-btn:disabled { opacity: 0.3; cursor: default; }
  .tab-strip { display: flex; align-items: center; gap: 2px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; padding: 0 4px; }
  .tab-strip::-webkit-scrollbar { display: none; }
    .tab-item { display: flex; align-items: center; gap: 4px; padding: 3px 4px 3px 8px; border: none; border-radius: 6px; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; max-width: 160px; transition: background 100ms ease, color 100ms ease; }
  .tab-item:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); color: var(--foreground); }
  .tab-item.active { background: var(--background); color: var(--foreground); font-weight: 500; }
  .tab-icon { font-size: 13px; flex-shrink: 0; }
  .tab-label { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tab-close { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; opacity: 0.3; transition: opacity 100ms ease, background 100ms ease; }
  .tab-item:hover .tab-close, .tab-item.active .tab-close { opacity: 1; }
  .tab-item.active .tab-close { opacity: 0.5; }
  .tab-close:hover { background: color-mix(in srgb, var(--foreground) 10%, transparent); }
  .tab-new-btn { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; flex-shrink: 0; }
  .tab-new-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
</style>
