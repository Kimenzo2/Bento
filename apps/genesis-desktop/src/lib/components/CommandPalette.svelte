<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Search, FileText, Plus, Star, Archive, PanelBottom, Sun } from 'lucide-svelte';

  interface Command {
    id: string;
    label: string;
    category: string;
    icon: any;
    shortcut?: string;
    action: () => void;
    searchTerms?: string[];
  }

  let { open = false, onClose = () => {}, onCreateNote = () => {}, onOpenArchive = () => {}, onToggleTheme = () => {}, onOpenDailyNote = () => {}, onOpenTemplatePicker = () => {}, onOpenCalendar = () => {}, onOpenAllDocs = () => {}, onOpenActivity = () => {} } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let searchResults = $state<{ id: string; title: string; preview: string }[]>([]);
  let isSearching = $state(false);
  let activeTab = $state<'commands' | 'search'>('commands');

  const commands: Command[] = [
    { id: 'new-note', label: 'New note', category: 'Notes', icon: Plus, shortcut: 'Ctrl+N', action: () => { onClose(); onCreateNote(); }, searchTerms: ['create', 'add'] },
    { id: 'archive', label: 'View archive', category: 'Notes', icon: Archive, action: () => { onClose(); onOpenArchive(); }, searchTerms: ['trash', 'deleted', 'bin'] },
    { id: 'toggle-theme', label: 'Toggle theme', category: 'Appearance', icon: Sun, action: () => { onClose(); onToggleTheme(); }, searchTerms: ['dark', 'light', 'mode'] },
    { id: 'find-in-page', label: 'Find in note', category: 'Editor', icon: Search, shortcut: 'Ctrl+F', action: () => { onClose(); window.dispatchEvent(new CustomEvent('command:find')); }, searchTerms: ['search', 'find'] },
    { id: 'toggle-sidebar', label: 'Toggle sidebar', category: 'View', icon: PanelBottom, action: () => { onClose(); window.dispatchEvent(new CustomEvent('command:toggle-sidebar')); }, searchTerms: ['panel', 'hide'] },
    { id: 'daily-note', label: 'Open daily note', category: 'Notes', icon: Star, shortcut: '', action: () => { onClose(); onOpenDailyNote(); }, searchTerms: ['today', 'journal', 'diary'] },
    { id: 'template-picker', label: 'Create from template', category: 'Notes', icon: FileText, action: () => { onClose(); onOpenTemplatePicker(); }, searchTerms: ['template', 'pattern', 'preset'] },
    { id: 'calendar', label: 'Open calendar', category: 'Navigation', icon: Star, shortcut: 'Ctrl+Shift+C', action: () => { onClose(); onOpenCalendar(); }, searchTerms: ['date', 'calendar', 'day'] },
    { id: 'all-docs', label: 'All notes gallery', category: 'Navigation', icon: FileText, action: () => { onClose(); onOpenAllDocs(); }, searchTerms: ['gallery', 'browse', 'all'] },
    { id: 'activity', label: 'Activity timeline', category: 'Navigation', icon: Star, action: () => { onClose(); onOpenActivity(); }, searchTerms: ['history', 'recent', 'timeline'] },
  ];

  let filteredCommands = $derived.by(() => {
    if (!query.trim()) return commands.filter(c => !c.id.startsWith('new-note') || true);
    const q = query.toLowerCase();
    return commands.filter(c => {
      const haystack = [c.label, c.category, ...(c.searchTerms ?? [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  });

  let itemCount = $derived(activeTab === 'commands' ? filteredCommands.length : searchResults.length);

  async function doSearch(q: string) {
    if (!q.trim() || activeTab !== 'search') { searchResults = []; return; }
    isSearching = true;
    try {
      const results = await invoke<any[]>('notes_search', { query: q, limit: 20 });
      searchResults = results.map((r: any) => ({
        id: r.id,
        title: r.title || 'Untitled',
        preview: r.preview || '',
      }));
    } catch {
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onQueryChange(val: string) {
    query = val;
    selectedIndex = 0;
    clearTimeout(searchTimeout);
    if (activeTab === 'search' && val.trim()) {
      searchTimeout = setTimeout(() => doSearch(val), 200);
    }
  }

  function switchTab(tab: 'commands' | 'search') {
    activeTab = tab;
    query = '';
    selectedIndex = 0;
    searchResults = [];
    requestAnimationFrame(() => inputEl?.focus());
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, Math.max(itemCount - 1, 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      switchTab(activeTab === 'commands' ? 'search' : 'commands');
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleSelect(index: number) {
    if (activeTab === 'commands') {
      const cmd = filteredCommands[index];
      if (cmd) cmd.action();
    } else {
      const result = searchResults[index];
      if (result) {
        onClose();
        window.dispatchEvent(new CustomEvent('command:open-note', { detail: { id: result.id } }));
      }
    }
  }

  let show = $derived(open);
</script>

{#if show}
  <div class="command-palette-overlay" onclick={() => onClose()} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
    <div class="command-palette" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
      <div class="cp-header">
        <div class="cp-input-wrap">
          {#if activeTab === 'search'}
            <Search size={16} class="cp-search-icon" />
          {/if}
          <input
            bind:this={inputEl}
            class="cp-input"
            type="text"
            placeholder={activeTab === 'commands' ? 'Search commands…' : 'Search notes…'}
            value={query}
            oninput={(e) => onQueryChange(e.currentTarget.value)}
            onkeydown={handleKeyDown}
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
          />
        </div>
      </div>

      <div class="cp-body">
        <div class="cp-list" bind:this={listEl}>
          {#if activeTab === 'commands'}
            {#if filteredCommands.length === 0}
              <div class="cp-empty">No commands found</div>
            {:else}
              {#each filteredCommands as cmd, i}
                <button
                  class="cp-item"
                  class:cp-selected={i === selectedIndex}
                  onclick={() => handleSelect(i)}
                  onmouseenter={() => { selectedIndex = i; }}
                >
                  <span class="cp-item-icon"><cmd.icon size={15} /></span>
                  <span class="cp-item-label">{cmd.label}</span>
                  <span class="cp-item-category">{cmd.category}</span>
                  {#if cmd.shortcut}
                    <span class="cp-item-shortcut">{cmd.shortcut}</span>
                  {/if}
                </button>
              {/each}
            {/if}
          {:else}
            {#if isSearching}
              <div class="cp-empty"><div class="cp-spinner"></div> Searching…</div>
            {:else if searchResults.length === 0}
              <div class="cp-empty">{query.trim() ? 'No results found' : 'Type to search notes…'}</div>
            {:else}
              {#each searchResults as result, i}
                <button
                  class="cp-item"
                  class:cp-selected={i === selectedIndex}
                  onclick={() => handleSelect(i)}
                  onmouseenter={() => { selectedIndex = i; }}
                >
                  <span class="cp-item-icon"><FileText size={15} /></span>
                  <span class="cp-item-label">{result.title || 'Untitled'}</span>
                  {#if result.preview}
                    <span class="cp-item-preview">{result.preview}</span>
                  {/if}
                </button>
              {/each}
            {/if}
          {/if}
        </div>
      </div>

      <div class="cp-footer">
        <kbd>Tab</kbd>
        <span>{activeTab === 'search' ? 'Commands' : 'Search notes'}</span>
        <span class="cp-footer-dot">·</span>
        <kbd>↑↓</kbd>
        <span>Navigate</span>
        <span class="cp-footer-dot">·</span>
        <kbd>Enter</kbd>
        <span>Select</span>
        <span class="cp-footer-dot">·</span>
        <kbd>Esc</kbd>
        <span>Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    background: color-mix(in srgb, var(--background) 60%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .command-palette {
    width: 100%;
    max-width: 580px;
    background: var(--background);
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .cp-header {
    padding: 10px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .cp-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border-radius: 10px;
    padding: 0 10px;
  }

  .cp-search-icon {
    flex-shrink: 0;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }

  .cp-input {
    flex: 1;
    height: 36px;
    background: transparent;
    border: none;
    color: var(--foreground);
    font: inherit;
    font-size: 14px;
    outline: none;
  }

  .cp-input::placeholder {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  .cp-body {
    max-height: 380px;
    overflow-y: auto;
    padding: 6px;
  }

  .cp-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .cp-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 80ms ease;
  }

  .cp-item.cp-selected {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .cp-item:hover {
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  .cp-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    color: color-mix(in srgb, var(--foreground) 50%, transparent);
    flex-shrink: 0;
  }

  .cp-item-label {
    flex: 1;
    font-weight: 500;
  }

  .cp-item-category {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    margin-right: 8px;
  }

  .cp-item-shortcut {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    font-family: inherit;
  }

  .cp-item-preview {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .cp-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    font-size: 13px;
  }

  .cp-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-top-color: color-mix(in srgb, var(--foreground) 50%, transparent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .cp-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }

  .cp-footer kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground) 45%, transparent);
  }

  .cp-footer-dot {
    margin: 0 2px;
    color: color-mix(in srgb, var(--foreground) 20%, transparent);
  }
</style>
