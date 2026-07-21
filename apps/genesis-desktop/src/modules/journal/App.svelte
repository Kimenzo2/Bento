<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, FileText, Trash2, PenLine, BookHeart, Search, X } from 'lucide-svelte';
  import JournalEditor from './JournalEditor.svelte';
  import { editorStore } from '$lib/local-store/store';
  import JournalFontPreferencePanel from '$lib/components/JournalFontPreferencePanel.svelte';
  import { createJournalEntry, listJournalEntries, deleteJournalEntry, type JournalEntry } from '$lib/services/journal-service';
  import { time } from '$lib/utils/time';
  import { moduleSectionStore, getModuleSectionLabel, ensureModuleSection } from '$lib/stores/module-sections.store';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const moduleId = 'journal';
  const sectionLabels = ['Today', 'History'] as const;

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  let entries     = $state<JournalEntry[]>([]);
  let loading     = $state(true);
  let creating    = $state(false);
  let activeId    = $state<string | null>(null);
  let editorRev   = $state(0);
  let errorMsg    = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = null;

  let EditorComponent = $state<any>(null);
  let editorLoadPromise: Promise<void> | null = null;
  let showFontPref = $state(false);

  // ── Anytype-style Filter ───────────────────────────────────────────────
  let filterActive  = $state(false);
  let filterFocused = $state(false);
  let filterInputEl = $state<HTMLInputElement | null>(null);
  let searchQuery   = $state('');

  function onFilterIconClick() {
    filterActive = true;
    requestAnimationFrame(() => { filterInputEl?.focus(); });
    attachFilterClickAway();
    attachFilterEsc();
  }

  function onFilterHide() {
    filterActive  = false;
    filterFocused = false;
    searchQuery   = '';
    filterInputEl?.blur();
    removeFilterClickAway();
    removeFilterEsc();
  }

  function onFilterClear(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    searchQuery = '';
    filterInputEl?.focus();
  }

  let _filterMouseDown: ((e: MouseEvent) => void) | null = null;
  function attachFilterClickAway() {
    removeFilterClickAway();
    _filterMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.filter-wrap')) onFilterHide();
    };
    setTimeout(() => window.addEventListener('mousedown', _filterMouseDown!), 0);
  }
  function removeFilterClickAway() {
    if (_filterMouseDown) { window.removeEventListener('mousedown', _filterMouseDown); _filterMouseDown = null; }
  }

  let _filterKeydown: ((e: KeyboardEvent) => void) | null = null;
  function attachFilterEsc() {
    removeFilterEsc();
    _filterKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFilterHide(); }
    };
    window.addEventListener('keydown', _filterKeydown, true);
  }
  function removeFilterEsc() {
    if (_filterKeydown) { window.removeEventListener('keydown', _filterKeydown, true); _filterKeydown = null; }
  }

  // â”€â”€ Error helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function showError(msg: string) {
    if (errorTimer) clearTimeout(errorTimer);
    errorMsg = msg;
    errorTimer = setTimeout(() => { errorMsg = null; }, 5000);
  }

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  let selectedSection = $derived(
    getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels)
  );

  let todayStr = $derived(time.toISODate(time.now()));

  let filteredEntries = $derived(
    (selectedSection === 'Today'
      ? entries.filter(e => e.date === todayStr)
      : entries
    ).filter(e =>
      !searchQuery.trim() ||
      getEntryPreview(e).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getEntryLabel(e).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  let sortedEntries = $derived(
    [...filteredEntries].sort((a, b) => b.createdAt - a.createdAt)
  );

  let showingToday = $derived(selectedSection === 'Today');

  // â”€â”€ Lazy-load editor component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function ensureEditorLoaded() {
    if (EditorComponent) return;
    if (editorLoadPromise) return editorLoadPromise;

    editorLoadPromise = import('./JournalEditor.svelte')
      .then((mod) => {
        EditorComponent = mod.default;
      })
      .catch((err) => {
        console.error('[journal] editor load failed:', err);
        showError('Could not load editor. Backend unavailable.');
      })
      .finally(() => {
        editorLoadPromise = null;
      });

    return editorLoadPromise;
  }

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function loadLocalEntries(): JournalEntry[] {
    const result: JournalEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('journal:id:')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key)!);
          if (parsed && parsed.id) result.push(parsed);
        } catch { /* skip malformed */ }
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function loadEntries() {
    loading = true;
    try {
      const remote = await listJournalEntries(100);
      const local = loadLocalEntries();
      // Merge: remote (DB) first, then local (localStorage) â€” dedup by ID
      const merged = new Map<string, JournalEntry>();
      for (const e of remote) merged.set(e.id, e);
      for (const e of local) merged.set(e.id, e);
      entries = [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.warn('[journal] Tauri list failed, loading from localStorage only:', err);
      entries = loadLocalEntries();
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    void loadEntries();
  });

  // â”€â”€ Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function createLocalEntry(date: string) {
    const id = crypto.randomUUID();
    const now = time.now();
    const localEntry: JournalEntry = {
      id,
      date,
      blocks: '[]',
      wordCount: 0,
      mood: null,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(`journal:id:${id}`, JSON.stringify(localEntry));
    entries = [localEntry, ...entries];
    return localEntry;
  }

  async function createEntry() {
    if (creating) return;
    creating = true;
    try {
      await editorStore.flushPendingSaves();
      const today = time.toISODate(time.now());
      const created = await createJournalEntry(today);
      entries = [created, ...entries];
      activeId = created.id;
      void ensureEditorLoaded();
    } catch (err) {
      console.warn('[journal] Tauri create failed, falling back to localStorage:', err);
      const localEntry = createLocalEntry(time.toISODate(time.now()));
      activeId = localEntry.id;
      void ensureEditorLoaded();
    } finally {
      creating = false;
    }
  }

  // â”€â”€ Select â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function selectEntry(id: string) {
    await editorStore.flushPendingSaves();
    activeId = id;
    editorRev++;
    void ensureEditorLoaded();
  }

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleDelete(id: string) {
    // Clean up localStorage regardless of Tauri outcome
    localStorage.removeItem(`journal:id:${id}`);
    try {
      await deleteJournalEntry(id);
    } catch (err) {
      console.warn('[journal] Tauri delete failed (probably localStorage-only entry):', err);
    }
    const idx = entries.findIndex(e => e.id === id);
    entries = entries.filter(e => e.id !== id);
    if (activeId === id) {
      const next = entries[idx] ?? entries[idx - 1] ?? null;
      activeId = next?.id ?? null;
    }
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function formatDate(ts: number): string {
    const diff = time.now() - ts;
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return time.formatTime(ts, '12h', 'en-US');
    if (diff < 604_800_000) return time.formatCustom(ts, 'D', 'en-US');
    return time.formatCustom(ts, 'M j', 'en-US');
  }

  function getEntryPreview(entry: JournalEntry): string {
    try {
      const blocks: any[] = JSON.parse(entry.blocks);
      for (const b of blocks) {
        const ct = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
        const text = ct?.text?.trim();
        if (text && text.length > 0) {
          return text.length > 65 ? text.slice(0, 65) + 'â€¦' : text;
        }
      }
    } catch { /* ignore parse errors */ }
    return 'Empty entry';
  }

  function getEntryWordCount(entry: JournalEntry): string {
    const wc = entry.wordCount;
    if (wc < 1) return '';
    return `${wc} words`;
  }

  function getEntryLabel(entry: JournalEntry): string {
    const today = time.toISODate(time.now());
    const yStr = time.toISODate(time.now() - time.DAY);
    if (entry.date === today) return 'Today';
    if (entry.date === yStr) return 'Yesterday';
    const d = new Date(entry.date + 'T00:00:00');
    const now = time.now();
    if (d.getFullYear() === new Date(now).getFullYear()) {
      return time.formatCustom(d.getTime(), 'D, M j', 'en-US');
    }
    return time.formatCustom(d.getTime(), 'M j, Y', 'en-US');
  }

  // â”€â”€ Callbacks from editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function onEntryUpdated(event: CustomEvent<{ id: string; preview?: string }>) {
    const { id, preview } = event.detail;
    entries = entries.map(e =>
      e.id === id ? { ...e, updatedAt: time.now() } : e
    );
  }

  function onEntrySaved() {
    void loadEntries();
  }
</script>

<!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     ROOT â€” two-panel: narrow sidebar + full editor (same as Notes)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
<div class="journal-root">

  <!-- â”€â”€ Panel 1: Entry list sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <aside class="journal-sidebar">

    <!-- Header + Filter + New Entry -->
    <div class="sidebar-header">
      <div class="sidebar-header-actions">
        <div
          class="filter-wrap"
          class:filter-active={filterActive}
          role="search"
          aria-label="Search entries"
        >
          <button
            class="filter-icon-btn"
            onclick={onFilterIconClick}
            aria-label="Search"
            tabindex="0"
            type="button"
            use:tooltip={{ text: "Search entries" }}
          >
            <Search size={14} strokeWidth={2} />
          </button>
          <div class="filter-input-wrap">
            <input
              bind:this={filterInputEl}
              class="filter-input"
              type="text"
              placeholder="Search entries…"
              bind:value={searchQuery}
              onfocus={() => { filterFocused = true; }}
              onblur={() => { filterFocused = false; }}
              tabindex={filterActive ? 0 : -1}
            />
          </div>
          {#if searchQuery.length > 0}
            <button
              class="filter-clear-btn"
              type="button"
              aria-label="Clear search"
              onmousedown={onFilterClear}
              use:tooltip={{ text: "Clear search" }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          {/if}
        </div>
        <button
          class="new-entry-btn"
          onclick={createEntry}
          disabled={creating}
          aria-label="New entry"
          title="New entry"
          type="button"
        >
          <Plus size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>

    <!-- Error banner -->
    {#if errorMsg}
      <div class="journal-error-banner" role="alert">{errorMsg}</div>
    {/if}

    <!-- Entry list -->
    <div class="entry-list" role="listbox" aria-label="Journal entries">
      {#if loading}
        <div class="sidebar-loading">
          <div class="spinner"></div>
          <span>Loadingâ€¦</span>
        </div>

      {:else if sortedEntries.length === 0}
        <div class="sidebar-empty">
          {#if showingToday}
            <p>No entries for today.</p>
            <p class="sidebar-empty-sub">Write about your day</p>
          {:else}
            <BookHeart size={28} strokeWidth={1} class="sidebar-empty-icon" />
            <p>No entries yet.</p>
            <p class="sidebar-empty-sub">Write your first journal entry</p>
          {/if}
          {#if !showingToday}
            <button class="sidebar-empty-btn" onclick={createEntry} disabled={creating}>
              <Plus size={14} /> Write first entry
            </button>
          {/if}
        </div>

      {:else}
        {#each sortedEntries as entry (entry.id)}
          <div
            class="entry-row"
            class:active={activeId === entry.id}
            role="option"
            aria-selected={activeId === entry.id}
            tabindex="0"
            onclick={() => selectEntry(entry.id)}
            onkeydown={(e) => e.key === 'Enter' && selectEntry(entry.id)}
          >
            <div class="entry-row-icon">
              <PenLine size={14} strokeWidth={1.8} />
            </div>
            <div class="entry-row-body">
              <span class="entry-row-title">{getEntryLabel(entry)}</span>
              <span class="entry-row-sub">
                <span class="entry-row-date">{formatDate(entry.createdAt)}</span>
                <span class="entry-row-preview">{getEntryPreview(entry)}</span>
              </span>
            </div>
            <div class="entry-row-meta">
              {#if entry.wordCount > 0}
                <span class="entry-row-words">{entry.wordCount}w</span>
              {/if}
              <button
                class="entry-row-delete"
                onclick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                aria-label="Delete entry"
                title="Delete entry"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
    <!-- â”€â”€ Font preference button at bottom of sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <div class="sidebar-footer">
      <button class="sidebar-font-btn" onclick={() => showFontPref = true} aria-label="Change editor font" title="Editor font">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
        <span>Font</span>
      </button>
    </div>
  </aside>

  {#if showFontPref}
    <JournalFontPreferencePanel onclose={() => showFontPref = false} />
  {/if}

  <!-- â”€â”€ Panel 2: Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <main class="journal-editor-pane">
    {#if activeId}
      {#key `${activeId}-${editorRev}`}
        {#if EditorComponent}
          <EditorComponent objectId={activeId} onsaved={onEntrySaved} />
        {:else}
          <div class="editor-loading">
            <div class="spinner"></div>
            <span>Loading editorâ€¦</span>
          </div>
        {/if}
      {/key}
    {:else}
      <div class="editor-empty">
        <div class="editor-empty-icon">
          <FileText size={48} strokeWidth={1} />
        </div>
        <h2 class="editor-empty-title">Select an entry</h2>
        <p class="editor-empty-sub">Choose an entry from the list, or create a new one.</p>
        <button class="editor-empty-btn" onclick={createEntry} disabled={creating}>
          <Plus size={15} />
          New entry
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .journal-root {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100%;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border-radius: 18px;
    background: var(--background);
    color: var(--foreground);
    font-size: 13px;
  }

  .journal-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-radius: 18px;
    border-right: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    padding: 12px 10px 8px 10px;
    flex-shrink: 0;
  }

  .sidebar-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
  }

  /* ── Anytype Filter ─────────────────────────────────────────────── */
  .filter-wrap {
    display: flex;
    align-items: center;
    flex-direction: row;
    height: 28px;
    border-radius: 14px;
    overflow: hidden;
    transition: background 140ms ease;
    flex: 1;
    min-width: 28px;
  }

  .filter-icon-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 45%, transparent);
    cursor: pointer;
    transition: color 140ms ease;
    padding: 0;
  }

  .filter-icon-btn:hover { color: var(--foreground); }

  .filter-input-wrap {
    width: 0;
    overflow: hidden;
    transition: width 200ms cubic-bezier(0.55, 0, 1, 0.45);
    flex-shrink: 0;
  }

  .filter-input {
    display: block;
    height: 28px;
    width: 158px;
    padding: 0 2px 0 0;
    border: none;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 12.5px;
    outline: none;
    white-space: nowrap;
  }

  .filter-input::placeholder {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  .filter-clear-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    cursor: pointer;
    padding: 0;
    margin-right: 4px;
    transition: color 120ms ease;
  }

  .filter-clear-btn:hover { color: var(--foreground); }

  .filter-wrap.filter-active {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .filter-wrap.filter-active .filter-icon-btn { color: var(--foreground); }
  .filter-wrap.filter-active .filter-input-wrap { width: 158px; }
  .filter-wrap.filter-active:hover { background: color-mix(in srgb, var(--foreground) 11%, transparent); }

  /* ── New entry button ───────────────────────────────────────────── */
  .new-entry-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 50%, transparent);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
    flex-shrink: 0;
  }

  .new-entry-btn:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .new-entry-btn:active { transform: scale(0.93); }
  .new-entry-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Entry list ─────────────────────────────────────────────────── */
  .entry-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2px 6px 16px;
    scrollbar-width: none;
  }
  .entry-list::-webkit-scrollbar { display: none; }

  .journal-error-banner {
    margin: 0 10px 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, #ef4444 10%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 20%, transparent);
    color: #ef4444;
    font-size: 12px;
    font-weight: 500;
    text-align: center;
    flex-shrink: 0;
    animation: error-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes error-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .entry-row {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 100ms ease;
    min-width: 0;
  }

  .entry-row:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .entry-row:hover .entry-row-delete { opacity: 1; }
  .entry-row.active { background: color-mix(in srgb, var(--foreground) 9%, transparent); }

  .entry-row-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
    line-height: 1;
  }

  .entry-row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .entry-row-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.3;
  }

  .entry-row-sub {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .entry-row-date {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    flex-shrink: 0;
  }

  .entry-row-preview {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-row-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .entry-row-words {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 25%, transparent);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entry-row-delete {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 20%, transparent);
    cursor: pointer;
    opacity: 0;
    transition: opacity 100ms ease, color 100ms ease, background 100ms ease;
  }

  .entry-row-delete:hover {
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .sidebar-loading, .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 16px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    font-size: 12px;
    text-align: center;
  }

  .sidebar-empty-icon { opacity: 0.3; }

  .sidebar-empty-sub {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 25%, transparent);
    margin-top: -4px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-top-color: color-mix(in srgb, var(--foreground) 50%, transparent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .sidebar-empty-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    padding: 6px 14px;
    border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: background 100ms ease;
  }

  .sidebar-empty-btn:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .sidebar-empty-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .sidebar-footer {
    flex-shrink: 0;
    padding: 6px 10px;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .sidebar-font-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .sidebar-font-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  /* ── Editor pane ────────────────────────────────────────────────── */
  .journal-editor-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    min-width: 0;
    background: var(--background);
  }

  .editor-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    color: color-mix(in srgb, var(--foreground) 50%, transparent);
    font-size: 13px;
  }

  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 14px;
  }

  .editor-empty-icon { opacity: 0.25; }

  .editor-empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground) 60%, transparent);
  }

  .editor-empty-sub {
    margin: 0;
    font-size: 13px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }

  .editor-empty-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    padding: 8px 18px;
    border: none;
    border-radius: 10px;
    background: var(--foreground);
    color: var(--background);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .editor-empty-btn:hover { opacity: 0.88; }
  .editor-empty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
