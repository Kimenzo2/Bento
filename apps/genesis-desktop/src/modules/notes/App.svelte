<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Plus, FileText, Search, X, MoreHorizontal, Archive, Trash2, Pin, RotateCcw, Copy, Command } from 'lucide-svelte';
  import { time } from '$lib/utils/time';
  import { editorStore } from '$lib/local-store/store';
  import NotesFontPreferencePanel from '$lib/components/NotesFontPreferencePanel.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import CalendarPalette from '$lib/components/CalendarPalette.svelte';

  import NotePropertiesPanel from '$lib/components/NotePropertiesPanel.svelte';
  import AllDocsView from '$lib/components/AllDocsView.svelte';
  import ActivityTimeline from '$lib/components/ActivityTimeline.svelte';
  import GettingStarted from '$lib/components/GettingStarted.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { moduleId = 'notes' } = $props();

  interface NoteSummary {
    id: string;
    title: string;
    icon: string | null;
    preview: string;
    tags: string[];
    pinned: boolean;
    isArchived: boolean;
    updatedAt: number;
    createdAt: number;
    blockCount: number;
  }

  interface NoteWithBlocks {
    note: {
      id: string;
      title: string;
      icon: string | null;
      cover: string | null;
      layout: string;
      pinned: boolean;
      tags: string[];
      isArchived: boolean;
      details: unknown;
      createdAt: number;
      updatedAt: number;
    };
    blocks: unknown[];
  }

  let notes       = $state<NoteSummary[]>([]);
  let loading     = $state(true);
  let creating    = $state(false);
  let searchQuery = $state('');
  let activeId    = $state<string | null>(null);
  let EditorComponent = $state<any>(null);
  let editorLoadPromise: Promise<void> | null = null;
  let contextMenu = $state<{ id: string; x: number; y: number } | null>(null);
  let errorMsg    = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = null;
  let showFontPref = $state(false);
  let showCommandPalette = $state(false);
  let showArchiveView = $state(false);
  let archivedNotes = $state<NoteSummary[]>([]);
  let loadingArchived = $state(false);
  let activeTagFilter = $state<string | null>(null);
  let showTemplatePicker = $state(false);
  let showCalendar = $state(false);

  let showProperties = $state(false);
  let showAllDocs = $state(false);
  let showActivity = $state(false);
  let openTabs = $state<{ id: string; title: string; icon: string | null }[]>([]);
  let tabHistory = $state<string[]>([]);
  let tabHistoryIndex = $state(-1);
  let templates = $state<any[]>([]);
  let loadingTemplates = $state(false);

  let filterActive  = $state(false);
  let filterFocused = $state(false);
  let filterInputEl = $state<HTMLInputElement | null>(null);

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

  function showError(msg: string) {
    if (errorTimer) clearTimeout(errorTimer);
    errorMsg = msg;
    errorTimer = setTimeout(() => { errorMsg = null; }, 5000);
  }

  function toggleCommandPalette() { showCommandPalette = !showCommandPalette; }
  function openCommandPalette() { showCommandPalette = true; }

  async function loadArchivedNotes() {
    loadingArchived = true;
    try {
      const result = await invoke<NoteSummary[]>('notes_list', {
        includeArchived: true, limit: 500, offset: 0,
      });
      archivedNotes = result.filter(n => n.isArchived).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      console.error('[notes] load archived failed:', err);
      showError('Could not load archived notes.');
    } finally {
      loadingArchived = false;
    }
  }

  function openArchiveView() {
    showArchiveView = true;
    void loadArchivedNotes();
  }

  function closeArchiveView() {
    showArchiveView = false;
    archivedNotes = [];
  }

  async function restoreNote(id: string) {
    try {
      await invoke('notes_object_update', { params: { id, isArchived: false } });
      archivedNotes = archivedNotes.filter(n => n.id !== id);
      const existing = notes.find(n => n.id === id);
      if (existing) {
        notes = notes.map(n => n.id === id ? { ...n, isArchived: false } : n);
      } else {
        await load();
      }
    } catch (err) {
      console.error('[notes] restore failed:', err);
      showError('Could not restore note.');
    }
  }

  async function permanentlyDeleteNote(id: string) {
    try {
      await invoke('notes_object_delete', { noteId: id });
      archivedNotes = archivedNotes.filter(n => n.id !== id);
    } catch (err) {
      console.error('[notes] permanent delete failed:', err);
      showError('Could not delete note permanently.');
    }
  }

  async function duplicateNote(id: string) {
    contextMenu = null;
    try {
      await invoke('notes_object_duplicate', { sourceId: id });
      await load();
    } catch (err) {
      console.error('[notes] duplicate failed:', err);
      showError('Could not duplicate note.');
    }
  }

  async function archiveNote(id: string) {
    contextMenu = null;
    try {
      await invoke('notes_object_update', { params: { id, isArchived: true } });
      notes = notes.filter(n => n.id !== id);
      if (activeId === id) {
        const next = notes[0] ?? null;
        activeId = next?.id ?? null;
      }
    } catch (err) {
      console.error('[notes] archive failed:', err);
      showError('Could not archive note.');
    }
  }

  async function addTagToNote(noteId: string, tag: string) {
    const note = notes.find(n => n.id === noteId);
    if (!note || note.tags.includes(tag)) return;
    const newTags = [...note.tags, tag];
    try {
      await invoke('notes_object_update', { params: { id: noteId, tags: newTags } });
      notes = notes.map(n => n.id === noteId ? { ...n, tags: newTags } : n);
    } catch (err) {
      console.error('[notes] add tag failed:', err);
    }
  }

  async function removeTagFromNote(noteId: string, tag: string) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const newTags = note.tags.filter(t => t !== tag);
    try {
      await invoke('notes_object_update', { params: { id: noteId, tags: newTags } });
      notes = notes.map(n => n.id === noteId ? { ...n, tags: newTags } : n);
    } catch (err) {
      console.error('[notes] remove tag failed:', err);
    }
  }

  $effect(() => {
    function handleToggleProperties() {
      showProperties = !showProperties;
    }
    window.addEventListener('command:toggle-properties', handleToggleProperties);
    function handleOpenNote(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        activeId = detail.id;
        void ensureEditorLoaded();
      }
    }
    window.addEventListener('command:open-note', handleOpenNote);
    return () => {
      window.removeEventListener('command:open-note', handleOpenNote);
      window.removeEventListener('command:toggle-properties', handleToggleProperties);
    };
  });

  $effect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (isMod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        void createNote();
        return;
      }
      if (isMod && e.key === 'c' && e.shiftKey) {
        e.preventDefault();
        showCalendar = !showCalendar;
        return;
      }

    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function toggleTheme() {
    window.dispatchEvent(new CustomEvent('command:toggle-theme'));
  }

  let filtered = $derived.by(() => {
    let list = notes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (activeTagFilter) {
      list = list.filter(n => n.tags.includes(activeTagFilter!));
    }
    return list;
  });

  let allUsedTags = $derived.by(() => {
    const tagSet = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags) tagSet.add(t);
    }
    return [...tagSet].sort();
  });

  let pinnedNotes = $derived(filtered.filter(n => n.pinned));
  let otherNotes  = $derived(filtered.filter(n => !n.pinned));
  let activeNote  = $derived(notes.find(n => n.id === activeId) ?? null);

  async function ensureEditorLoaded() {
    if (EditorComponent) return;
    if (editorLoadPromise) return editorLoadPromise;
    editorLoadPromise = import('./Editor.svelte')
      .then((mod: any) => { EditorComponent = mod.default || mod; })
      .catch((err: any) => { console.error('[notes] editor load failed:', err); showError('Could not load editor. Backend unavailable.'); })
      .finally(() => { editorLoadPromise = null; });
    return editorLoadPromise;
  }

  async function load() {
    loading = true;
    try {
      const result = await invoke<NoteSummary[]>('notes_list', {
        includeArchived: false, limit: 500, offset: 0,
      });
      notes = result.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
    } catch (err) {
      console.error('[notes] load failed:', err);
      showError('Could not load notes. Backend unavailable.');
    } finally {
      loading = false;
    }
  }

  let showGettingStarted = $state(false);

  onMount(async () => {
    await load();
    if (notes.length === 0 && !localStorage.getItem('getting-started-dismissed')) {
      showGettingStarted = true;
    }
  });

  async function createNote() {
    if (creating) return;
    creating = true;
    try {
      await editorStore.flushPendingSaves();
      const created = await invoke<NoteWithBlocks>('notes_object_create', {
        params: { title: '', icon: null, tags: [], pinned: false },
      });
      const newNote: NoteSummary = {
        id: created.note.id,
        title: '',
        icon: null,
        preview: '',
        tags: [],
        pinned: false,
        isArchived: false,
        updatedAt: created.note.updatedAt,
        createdAt: created.note.createdAt,
        blockCount: created.blocks.length,
      };
      notes = [newNote, ...notes];
      activeId = newNote.id;
      void ensureEditorLoaded();
    } catch (err) {
      console.error('[notes] create failed:', err);
      showError('Could not create note. Backend unavailable.');
    } finally {
      creating = false;
    }
  }

  async function deleteNote(id: string) {
    contextMenu = null;
    try {
      await invoke('notes_object_delete', { noteId: id });
      const idx = notes.findIndex(n => n.id === id);
      notes = notes.filter(n => n.id !== id);
      if (activeId === id) {
        const next = notes[idx] ?? notes[idx - 1] ?? null;
        activeId = next?.id ?? null;
      }
    } catch (err) {
      console.error('[notes] delete failed:', err);
      showError('Could not delete note. Backend unavailable.');
    }
  }

  async function openDailyNote() {
    try {
      await editorStore.flushPendingSaves();
      const note = await invoke<NoteWithBlocks>('notes_daily_note');
      const existing = notes.find(n => n.id === note.note.id);
      if (existing) {
        activeId = note.note.id;
      } else {
        notes = [{ id: note.note.id, title: note.note.title, icon: note.note.icon, preview: '', tags: note.note.tags, pinned: false, isArchived: false, updatedAt: note.note.updatedAt, createdAt: note.note.createdAt, blockCount: note.blocks.length }, ...notes];
        activeId = note.note.id;
      }
      void ensureEditorLoaded();
    } catch (err) {
      console.error('[notes] daily note failed:', err);
      showError('Could not open daily note.');
    }
  }

  async function loadTemplates() {
    loadingTemplates = true;
    try {
      templates = await invoke<any[]>('notes_templates_list');
    } catch (err) {
      console.error('[notes] load templates failed:', err);
    } finally {
      loadingTemplates = false;
    }
  }

  async function createTemplateFromNote(noteId: string) {
    contextMenu = null;
    const name = prompt('Template name:', notes.find(n => n.id === noteId)?.title || 'Untitled');
    if (!name) return;
    try {
      await invoke('notes_template_create', { name, description: '', icon: 'note-doc', sourceNoteId: noteId });
      showError('Template created!');
    } catch (err) {
      showError('Could not create template.');
    }
  }

  async function createNoteFromTemplate(templateId: string) {
    showTemplatePicker = false;
    try {
      await editorStore.flushPendingSaves();
      const note = await invoke<NoteWithBlocks>('notes_create_from_template', { templateId, title: '' });
      notes = [{ id: note.note.id, title: note.note.title, icon: note.note.icon, preview: '', tags: note.note.tags, pinned: false, isArchived: false, updatedAt: note.note.updatedAt, createdAt: note.note.createdAt, blockCount: note.blocks.length }, ...notes];
      activeId = note.note.id;
      void ensureEditorLoaded();
    } catch (err) {
      console.error('[notes] create from template failed:', err);
      showError('Could not create note from template.');
    }
  }

  function openTemplatePicker() {
    showTemplatePicker = true;
    void loadTemplates();
  }

  async function togglePin(id: string) {
    contextMenu = null;
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const pinned = !note.pinned;
    try {
      await invoke('notes_object_update', { params: { id, pinned } });
      notes = notes.map(n => n.id === id ? { ...n, pinned } : n)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
    } catch (err) {
      console.error('[notes] pin failed:', err);
      showError('Could not update note. Backend unavailable.');
    }
  }

  function onNoteUpdated(event: CustomEvent<{ id: string; title: string; preview?: string }>) {
    const { id, title, preview } = event.detail;
    notes = notes.map(n =>
      n.id === id ? { ...n, title, preview: preview ?? n.preview, updatedAt: time.now() } : n
    );
  }

  function openContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { id, x: e.clientX, y: e.clientY };
  }

  async function selectNote(id: string) {
    await editorStore.flushPendingSaves();
    if (!openTabs.find(t => t.id === id)) {
      const note = notes.find(n => n.id === id);
      openTabs = [...openTabs, { id, title: note?.title || '', icon: note?.icon || null }];
    }
    tabHistory = [...tabHistory.slice(0, tabHistoryIndex + 1), id];
    tabHistoryIndex = tabHistory.length - 1;
    activeId = id;
    void ensureEditorLoaded();
  }

  function closeTab(id: string) {
    openTabs = openTabs.filter(t => t.id !== id);
    if (activeId === id) {
      const remaining = openTabs;
      if (remaining.length > 0) {
        const last = remaining[remaining.length - 1];
        void selectNote(last.id);
      } else {
        activeId = null;
      }
    }
  }

  function goBackTab() {
    if (tabHistoryIndex > 0) {
      tabHistoryIndex--;
      void selectNote(tabHistory[tabHistoryIndex]);
    }
  }

  function goForwardTab() {
    if (tabHistoryIndex < tabHistory.length - 1) {
      tabHistoryIndex++;
      void selectNote(tabHistory[tabHistoryIndex]);
    }
  }

  let canGoBack = $derived(tabHistoryIndex > 0);
  let canGoForward = $derived(tabHistoryIndex < tabHistory.length - 1);

  function closeContextMenu() { contextMenu = null; }

  function formatDate(ts: number): string {
    const diff = time.now() - ts;
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return time.formatTime(ts, '12h', 'en-US');
    if (diff < 604_800_000) return time.formatCustom(ts, 'D', 'en-US');
    return time.formatCustom(ts, 'M j', 'en-US');
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '\u2026' : text;
  }
</script>

<div class="notes-root" onclick={closeContextMenu} role="presentation">

  {#if showArchiveView}
    <aside class="notes-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-header-actions" style="justify-content: space-between;">
          <span class="archive-header-title">Archive</span>
          <button class="new-note-btn" onclick={closeArchiveView} aria-label="Back to notes" type="button" use:tooltip={{ text: "Back to notes" }}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <div class="note-list" role="listbox" aria-label="Archived notes">
        {#if loadingArchived}
          <div class="sidebar-loading"><div class="spinner"></div><span>Loading…</span></div>
        {:else if archivedNotes.length === 0}
          <div class="sidebar-empty">No archived notes</div>
        {:else}
          {#each archivedNotes as note (note.id)}
            <div class="note-row" role="option" aria-selected={false} tabindex="0">
              <div class="note-row-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 1.5C3.5 1.22 3.72 1 4 1H10.5L12.5 3V4.5H12C11.72 4.5 11.5 4.72 11.5 5V14.5H4C3.72 14.5 3.5 14.28 3.5 14V1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 1V3H12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 6.5H10M5.5 9H10M5.5 11.5H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              </div>
              <div class="note-row-body">
                <span class="note-row-title">{note.title.trim() || 'Untitled'}</span>
                <span class="note-row-date">{formatDate(note.updatedAt)}</span>
              </div>
              <div class="archive-actions">
                <button class="archive-action-btn" onclick={() => restoreNote(note.id)} aria-label="Restore" use:tooltip={{ text: "Restore" }}>
                  <RotateCcw size={13} />
                </button>
                <button class="archive-action-btn danger" onclick={() => permanentlyDeleteNote(note.id)} aria-label="Delete permanently" use:tooltip={{ text: "Delete permanently" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </aside>
  {:else}
    <aside class="notes-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-header-actions">
          <div class="filter-wrap" class:filter-active={filterActive} class:filter-has-value={searchQuery.length > 0} role="search" aria-label="Search notes">
            <button class="filter-icon-btn" onclick={onFilterIconClick} aria-label="Search" tabindex="0" type="button" use:tooltip={{ text: "Search notes" }}>
              <Search size={14} strokeWidth={2} />
            </button>
            <div class="filter-input-wrap">
              <input bind:this={filterInputEl} class="filter-input" type="text" placeholder="Search notes…" bind:value={searchQuery} onfocus={() => { filterFocused = true; }} onblur={() => { filterFocused = false; }} aria-label="Search notes" tabindex={filterActive ? 0 : -1} />
            </div>
            {#if searchQuery.length > 0}
              <button class="filter-clear-btn" type="button" aria-label="Clear search" onmousedown={onFilterClear} use:tooltip={{ text: "Clear search" }}><X size={12} strokeWidth={2.5} /></button>
            {/if}
          </div>
          <button class="new-note-btn" onclick={openDailyNote} aria-label="Daily note" type="button" use:tooltip={{ text: "Daily note" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="position:relative;top:-1px;" aria-hidden="true"><path d="M2 3.5C2 3.22 2.22 3 2.5 3H13.5C13.78 3 14 3.22 14 3.5V13C14 13.28 13.78 13.5 13.5 13.5H2.5C2.22 13.5 2 13.28 2 13V3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 6H14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 1.5V4.5M10.5 1.5V4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="10" r="1.2" stroke="currentColor" stroke-width="1.4"/></svg>
          </button>
          <button class="new-note-btn" onclick={openTemplatePicker} aria-label="Templates" type="button" use:tooltip={{ text: "Create from template" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          </button>
          <button class="new-note-btn" onclick={createNote} disabled={creating} aria-label="New note" type="button" use:tooltip={{ text: "New note (Ctrl+N)" }}>
            <Plus size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {#if allUsedTags.length > 0}
        <div class="tag-filter-bar">
          <button class="tag-chip" class:tag-active={activeTagFilter === null} onclick={() => activeTagFilter = null} type="button">All</button>
          {#each allUsedTags as tag}
            <button class="tag-chip" class:tag-active={activeTagFilter === tag} onclick={() => activeTagFilter = activeTagFilter === tag ? null : tag} type="button">#{tag}</button>
          {/each}
        </div>
      {/if}

      {#if errorMsg}
        <div class="notes-error-banner" role="alert">{errorMsg}</div>
      {/if}

      <div class="note-list" role="listbox" aria-label="Notes">
        {#if loading}
          <div class="sidebar-loading"><div class="spinner"></div><span>Loading…</span></div>
        {:else if filtered.length === 0 && searchQuery}
          <div class="sidebar-empty">No results for "{searchQuery}"</div>
        {:else if notes.length === 0}
          <div class="sidebar-empty">
            <p>No notes yet.</p>
            <button class="empty-create-btn" onclick={createNote}><Plus size={14} /> Create note</button>
          </div>
        {:else}
          {#if pinnedNotes.length > 0}
            <div class="list-group-label">Pinned</div>
            {#each pinnedNotes as note (note.id)}
              <div class="note-row" class:active={activeId === note.id} role="option" aria-selected={activeId === note.id} tabindex="0" onclick={() => selectNote(note.id)} onkeydown={(e) => e.key === 'Enter' && selectNote(note.id)} oncontextmenu={(e) => openContextMenu(e, note.id)}>
                <div class="note-row-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 1.5C3.5 1.22 3.72 1 4 1H10.5L12.5 3V4.5H12C11.72 4.5 11.5 4.72 11.5 5V14.5H4C3.72 14.5 3.5 14.28 3.5 14V1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 1V3H12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 6.5H10M5.5 9H10M5.5 11.5H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
                <div class="note-row-body">
                  <span class="note-row-title">{note.title.trim() || 'Untitled'}</span>
                  <span class="note-row-sub">
                    <span class="note-row-date">{formatDate(note.updatedAt)}</span>
                    {#if note.preview}<span class="note-row-preview">{truncate(note.preview, 40)}</span>{/if}
                  </span>
                  {#if note.tags.length > 0}
                    <span class="note-row-tags">
                      {#each note.tags as tag}<span class="note-tag">{tag}</span>{/each}
                    </span>
                  {/if}
                </div>
                <button class="note-row-menu" onclick={(e) => openContextMenu(e, note.id)} aria-label="Note options" use:tooltip={{ text: "Note options" }}><MoreHorizontal size={14} /></button>
              </div>
            {/each}
          {/if}
          {#if otherNotes.length > 0}
            {#if pinnedNotes.length > 0}<div class="list-group-label">All Notes</div>{/if}
            {#each otherNotes as note (note.id)}
              <div class="note-row" class:active={activeId === note.id} role="option" aria-selected={activeId === note.id} tabindex="0" onclick={() => selectNote(note.id)} onkeydown={(e) => e.key === 'Enter' && selectNote(note.id)} oncontextmenu={(e) => openContextMenu(e, note.id)}>
                <div class="note-row-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 1.5C3.5 1.22 3.72 1 4 1H10.5L12.5 3V4.5H12C11.72 4.5 11.5 4.72 11.5 5V14.5H4C3.72 14.5 3.5 14.28 3.5 14V1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 1V3H12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 6.5H10M5.5 9H10M5.5 11.5H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
                <div class="note-row-body">
                  <span class="note-row-title">{note.title.trim() || 'Untitled'}</span>
                  <span class="note-row-sub">
                    <span class="note-row-date">{formatDate(note.updatedAt)}</span>
                    {#if note.preview}<span class="note-row-preview">{truncate(note.preview, 40)}</span>{/if}
                  </span>
                  {#if note.tags.length > 0}
                    <span class="note-row-tags">
                      {#each note.tags as tag}<span class="note-tag">{tag}</span>{/each}
                    </span>
                  {/if}
                </div>
                <button class="note-row-menu" onclick={(e) => openContextMenu(e, note.id)} aria-label="Note options" use:tooltip={{ text: "Note options" }}><MoreHorizontal size={14} /></button>
              </div>
            {/each}
          {/if}
        {/if}
      </div>

      <div class="sidebar-footer">
        <button class="sidebar-footer-btn" onclick={() => showFontPref = true} aria-label="Change editor font" use:tooltip={{ text: "Editor font" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
          <span>Font</span>
        </button>
        <button class="sidebar-footer-btn" onclick={openArchiveView} aria-label="Archive" use:tooltip={{ text: "View archive" }}>
          <Archive size={14} /><span>Archive</span>
        </button>
        <button class="sidebar-footer-btn" onclick={() => showActivity = true} aria-label="Activity" use:tooltip={{ text: "Activity timeline" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>Activity</span>
        </button>
        <button class="sidebar-footer-btn" onclick={() => showAllDocs = true} aria-label="All notes" use:tooltip={{ text: "All notes" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          <span>All Notes</span>
        </button>

        <button class="sidebar-footer-btn" onclick={openCommandPalette} aria-label="Commands" use:tooltip={{ text: "Commands (Ctrl+K)" }}>
          <Command size={14} /><span>Commands</span>
        </button>
      </div>
    </aside>
  {/if}

  {#if showFontPref}
    <NotesFontPreferencePanel onclose={() => showFontPref = false} />
  {/if}

  <main class="notes-editor-pane">
    {#if openTabs.length > 0}
      <TabBar
        tabs={openTabs}
        activeTabId={activeId ?? ''}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onSelectTab={(id: string) => selectNote(id)}
        onCloseTab={(id: string) => closeTab(id)}
        onNewTab={createNote}
        onGoBack={goBackTab}
        onGoForward={goForwardTab}
      />
    {/if}
    {#if activeId}
      {#if EditorComponent}
        <div class="editor-with-props">
          <div class="editor-main">
            <EditorComponent objectId={activeId}
              onTitleChange={(id: string, title: string) => {
                notes = notes.map(n => n.id === id ? { ...n, title, updatedAt: time.now() } : n);
              }}
            />
          </div>
          {#if showProperties}
            <aside class="properties-sidebar">
              <NotePropertiesPanel noteId={activeId} onClose={() => showProperties = false} />
            </aside>
          {/if}
        </div>
      {:else}
        <div class="editor-loading"><div class="spinner"></div><span>Loading editor…</span></div>
      {/if}
    {:else}
      <div class="editor-empty">
        <div class="editor-empty-icon"><FileText size={48} strokeWidth={1} /></div>
        <h2 class="editor-empty-title">Select a note</h2>
        <p class="editor-empty-sub">Choose a note from the list, or create a new one.</p>
        <div class="editor-empty-actions">
          <button class="editor-empty-btn" onclick={createNote} disabled={creating}><Plus size={15} /> New note</button>
          <button class="editor-empty-btn secondary" onclick={openCommandPalette}><Command size={15} /> Commands</button>
        </div>
        <div class="editor-empty-shortcuts">
          <span><kbd>Ctrl+N</kbd> New note</span>
          <span><kbd>Ctrl+K</kbd> Commands</span>
          <span><kbd>Ctrl+F</kbd> Find in note</span>
        </div>
      </div>
    {/if}
  </main>
</div>

<CommandPalette
  open={showCommandPalette}
  onClose={() => showCommandPalette = false}
  onCreateNote={() => { showCommandPalette = false; void createNote(); }}
  onOpenArchive={() => { showCommandPalette = false; openArchiveView(); }}
  onToggleTheme={toggleTheme}
  onOpenDailyNote={() => { showCommandPalette = false; void openDailyNote(); }}
  onOpenTemplatePicker={() => { showCommandPalette = false; openTemplatePicker(); }}
  onOpenCalendar={() => { showCommandPalette = false; showCalendar = true; }}
  onOpenAllDocs={() => { showCommandPalette = false; showAllDocs = true; }}
  onOpenActivity={() => { showCommandPalette = false; showActivity = true; }}
/>

{#if showGettingStarted}
  <GettingStarted
    onDismiss={() => showGettingStarted = false}
    onCreateNote={() => { showGettingStarted = false; void createNote(); }}
    onOpenCommandPalette={() => { showGettingStarted = false; openCommandPalette(); }}
    onOpenDailyNote={() => { showGettingStarted = false; void openDailyNote(); }}
  />
{/if}

{#if showActivity}
  <ActivityTimeline
    onClose={() => showActivity = false}
    onOpenNote={(id: string) => { showActivity = false; selectNote(id); void ensureEditorLoaded(); }}
  />
{/if}

<CalendarPalette
  open={showCalendar}
  onClose={() => showCalendar = false}
  onOpenNote={(id: string) => { showCalendar = false; selectNote(id); void ensureEditorLoaded(); }}
  onOpenDailyNote={(_date: string) => { showCalendar = false; void openDailyNote(); }}
/>

{#if showAllDocs}
  <AllDocsView
    notes={notes}
    onClose={() => showAllDocs = false}
    onOpenNote={(id: string) => { showAllDocs = false; selectNote(id); void ensureEditorLoaded(); }}
  />
{/if}

{#if showTemplatePicker}
  <div class="modal-overlay" onclick={() => showTemplatePicker = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose template">
      <div class="modal-header">
        <h3 class="modal-title">Create from template</h3>
        <button class="modal-close-btn" onclick={() => showTemplatePicker = false} aria-label="Close" type="button" use:tooltip={{ text: "Close" }}><X size={14} /></button>
      </div>
      <div class="modal-body">
        {#if loadingTemplates}
          <div class="sidebar-loading"><div class="spinner"></div><span>Loading…</span></div>
        {:else if templates.length === 0}
          <div class="modal-empty">
            <p>No templates yet.</p>
            <p class="modal-empty-hint">Create a template from any note via the context menu or command palette.</p>
          </div>
        {:else}
          <div class="template-list">
            {#each templates as tpl (tpl.id)}
              <button class="template-item" onclick={() => createNoteFromTemplate(tpl.id)} type="button">
                <span class="template-icon">{tpl.icon}</span>
                <div class="template-info">
                  <span class="template-name">{tpl.name}</span>
                  {#if tpl.description}<span class="template-desc">{tpl.description}</span>{/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if contextMenu}
  <div class="ctx-menu" style="left:{contextMenu.x}px; top:{contextMenu.y}px;" role="menu" onmousedown={(e) => e.stopPropagation()}>
    <button class="ctx-item" role="menuitem" onclick={() => { const id = contextMenu!.id; closeContextMenu(); togglePin(id); }}>
      <Pin size={13} />
      {notes.find(n => n.id === contextMenu?.id)?.pinned ? 'Unpin' : 'Pin to top'}
    </button>
    <button class="ctx-item" role="menuitem" onclick={() => { const id = contextMenu!.id; closeContextMenu(); duplicateNote(id); }}>
      <Copy size={13} />
      Duplicate
    </button>
    <button class="ctx-item" role="menuitem" onclick={() => { const id = contextMenu!.id; closeContextMenu(); createTemplateFromNote(id); }}>
      <FileText size={13} />
      Create template
    </button>
    <div class="ctx-sep"></div>
    <button class="ctx-item" role="menuitem" onclick={() => { const id = contextMenu!.id; closeContextMenu(); archiveNote(id); }}>
      <Archive size={13} />
      Archive
    </button>
    <button class="ctx-item ctx-danger" role="menuitem" onclick={() => { const id = contextMenu!.id; deleteNote(id); }}>
      <Trash2 size={13} />
      Delete
    </button>
  </div>
{/if}

<style>
  .notes-root { display: grid; grid-template-columns: 260px 1fr; height: 100%; width: 100%; min-width: 0; overflow: hidden; border-radius: 18px; background: var(--background); color: var(--foreground); font-size: 13px; padding: 8px; gap: 0; box-sizing: border-box; }
  .notes-sidebar { display: flex; flex-direction: column; height: 100%; overflow: hidden; border-radius: 10px; background: color-mix(in srgb, var(--foreground) 2%, var(--background)); }
  .sidebar-header { display: flex; align-items: center; padding: 12px 10px 8px 10px; flex-shrink: 0; }
  .sidebar-header-actions { display: flex; align-items: center; gap: 2px; width: 100%; }
  .archive-header-title { font-size: 14px; font-weight: 600; color: var(--foreground); }
  .filter-wrap { display: flex; align-items: center; flex-direction: row; height: 28px; border-radius: 14px; overflow: hidden; transition: background 140ms ease; flex: 1; min-width: 28px; }
  .filter-icon-btn { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border: none; border-radius: 14px; background: transparent; color: color-mix(in srgb, var(--foreground) 45%, transparent); cursor: pointer; transition: color 140ms ease; padding: 0; }
  .filter-icon-btn:hover { color: var(--foreground); }
  .filter-input-wrap { width: 0; overflow: hidden; transition: width 200ms cubic-bezier(0.55, 0, 1, 0.45); flex-shrink: 0; }
  .filter-input { display: block; height: 28px; width: 158px; padding: 0 2px 0 0; border: none; background: transparent; color: var(--foreground); font: inherit; font-size: 12.5px; outline: none; white-space: nowrap; }
  .filter-input::placeholder { color: color-mix(in srgb, var(--foreground) 30%, transparent); }
  .filter-clear-btn { display: grid; place-items: center; flex-shrink: 0; width: 20px; height: 20px; border: none; border-radius: 50%; background: transparent; color: color-mix(in srgb, var(--foreground) 55%, transparent); cursor: pointer; padding: 0; margin-right: 4px; transition: color 120ms ease; }
  .filter-clear-btn:hover { color: var(--foreground); }
  .filter-wrap.filter-active { background: color-mix(in srgb, var(--foreground) 8%, transparent); }
  .filter-wrap.filter-active .filter-icon-btn { color: var(--foreground); }
  .filter-wrap.filter-active .filter-input-wrap { width: 158px; }
  .filter-wrap.filter-active:hover { background: color-mix(in srgb, var(--foreground) 11%, transparent); }
  .new-note-btn { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: color-mix(in srgb, var(--foreground) 50%, transparent); cursor: pointer; transition: background 120ms ease, color 120ms ease; flex-shrink: 0; }
  .new-note-btn:hover { background: color-mix(in srgb, var(--foreground) 8%, transparent); color: var(--foreground); }
  .new-note-btn:active { transform: scale(0.93); }
  .new-note-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .tag-filter-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 10px 8px; flex-shrink: 0; }
  .tag-chip { display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent); border-radius: 12px; background: transparent; color: color-mix(in srgb, var(--foreground) 55%, transparent); font: inherit; font-size: 11px; cursor: pointer; transition: background 120ms ease, color 120ms ease, border-color 120ms ease; white-space: nowrap; }
  .tag-chip:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); color: var(--foreground); }
  .tag-chip.tag-active { background: color-mix(in srgb, var(--primary) 15%, transparent); border-color: color-mix(in srgb, var(--primary) 30%, transparent); color: var(--primary); }
  .note-list { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 2px 6px 16px; scrollbar-width: none; }
  .note-list::-webkit-scrollbar { display: none; }
  .notes-error-banner { margin: 0 10px 8px; padding: 8px 12px; border-radius: 8px; background: color-mix(in srgb, var(--destructive) 10%, transparent); border: 1px solid color-mix(in srgb, var(--destructive) 20%, transparent); color: var(--destructive); font-size: 12px; font-weight: 500; text-align: center; flex-shrink: 0; animation: error-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes error-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  .list-group-label { padding: 8px 8px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: color-mix(in srgb, var(--foreground) 30%, transparent); }
  .note-row { display: flex; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 10px; cursor: pointer; position: relative; transition: background 100ms ease; min-width: 0; }
  .note-row:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .note-row:hover .note-row-menu { opacity: 1; }
  .note-row.active { background: color-mix(in srgb, var(--foreground) 9%, transparent); }
  .note-row-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; text-align: center; color: var(--muted); }
  .note-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .note-row-title { font-size: 13px; font-weight: 500; color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
  .note-row-sub { display: flex; align-items: center; gap: 5px; min-width: 0; }
  .note-row-date { font-size: 11px; color: color-mix(in srgb, var(--foreground) 35%, transparent); flex-shrink: 0; }
  .note-row-preview { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note-row-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
  .note-tag { display: inline-flex; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: color-mix(in srgb, var(--primary) 70%, transparent); font-size: 11px; font-weight: 500; line-height: 1.3; }
  .note-row-menu { flex-shrink: 0; display: grid; place-items: center; width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: color-mix(in srgb, var(--foreground) 55%, transparent); cursor: pointer; opacity: 0; transition: background 100ms ease, opacity 100ms ease; }
  .note-row-menu:hover { background: color-mix(in srgb, var(--foreground) 10%, transparent); }
  .archive-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .archive-action-btn { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: color-mix(in srgb, var(--foreground) 55%, transparent); cursor: pointer; transition: background 100ms ease, color 100ms ease; }
  .archive-action-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .archive-action-btn.danger:hover { background: color-mix(in srgb, var(--destructive) 10%, transparent); color: var(--destructive); }
  .sidebar-footer { flex-shrink: 0; padding: 6px 10px; border-top: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent); display: flex; flex-direction: column; gap: 2px; }
  .sidebar-footer-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; border-radius: 8px; background: transparent; color: color-mix(in srgb, var(--foreground) 55%, transparent); font: inherit; font-size: 14px; font-weight: 470; cursor: pointer; transition: background 120ms ease, color 120ms ease; }
  .sidebar-footer-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .sidebar-loading, .sidebar-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; color: color-mix(in srgb, var(--foreground) 35%, transparent); font-size: 12px; text-align: center; }
  .spinner { width: 18px; height: 18px; border: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent); border-top-color: color-mix(in srgb, var(--foreground) 50%, transparent); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-create-btn { display: flex; align-items: center; gap: 5px; padding: 5px 12px; border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent); border-radius: 8px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; }
  .empty-create-btn:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .notes-editor-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; min-width: 0; background: var(--background); }
  .editor-with-props { display: flex; flex: 1; overflow: hidden; }
  .editor-main { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
  .properties-sidebar { width: 220px; border-left: 1px solid var(--border); background: var(--background); overflow: hidden; }
  .editor-loading { display: flex; align-items: center; justify-content: center; gap: 10px; height: 100%; color: color-mix(in srgb, var(--foreground) 50%, transparent); font-size: 13px; }
  .editor-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 14px; color: color-mix(in srgb, var(--foreground) 35%, transparent); }
  .editor-empty-icon { opacity: 0.25; }
  .editor-empty-title { margin: 0; font-size: 20px; font-weight: 600; color: color-mix(in srgb, var(--foreground) 60%, transparent); }
  .editor-empty-sub { margin: 0; font-size: 13px; color: color-mix(in srgb, var(--foreground) 35%, transparent); }
  .editor-empty-actions { display: flex; gap: 8px; }
  .editor-empty-btn { display: flex; align-items: center; gap: 6px; padding: 8px 18px; border: none; border-radius: 10px; background: var(--foreground); color: var(--background); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 120ms ease; }
  .editor-empty-btn:hover { opacity: 0.88; }
  .editor-empty-btn.secondary { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .editor-empty-btn.secondary:hover { background: color-mix(in srgb, var(--foreground) 10%, transparent); }
  .editor-empty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .editor-empty-shortcuts { display: flex; gap: 12px; margin-top: 12px; font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, transparent); }
  .editor-empty-shortcuts kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; padding: 1px 5px; border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); border-radius: 4px; background: color-mix(in srgb, var(--foreground) 3%, transparent); font-family: inherit; font-size: 11px; font-weight: 600; color: color-mix(in srgb, var(--foreground) 45%, transparent); margin-right: 3px; }
  .ctx-menu { position: fixed; z-index: 9999; min-width: 160px; border-radius: 13px; background: var(--background); border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent); box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 5px; display: flex; flex-direction: column; gap: 1px; animation: ctx-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes ctx-in { from { opacity: 0; transform: scale(0.95) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .ctx-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: none; border-radius: 8px; background: transparent; color: var(--foreground); font: inherit; font-size: 13px; cursor: pointer; text-align: left; width: 100%; transition: background 100ms ease; }
  .ctx-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .ctx-item.ctx-danger { color: var(--destructive); }
  .ctx-item.ctx-danger:hover { background: color-mix(in srgb, var(--destructive) 8%, transparent); }
  .ctx-sep { height: 1px; margin: 3px 6px; background: color-mix(in srgb, var(--foreground) 8%, transparent); }
  .modal-overlay { position: fixed; inset: 0; z-index: 9998; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--background) 60%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); animation: fade-in 0.12s ease; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  .modal { width: 360px; max-height: 480px; border-radius: 14px; background: var(--background); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .modal-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--foreground); }
  .modal-close-btn { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .modal-close-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .modal-body { flex: 1; overflow-y: auto; padding: 8px; }
  .modal-empty { padding: 32px 16px; text-align: center; color: var(--muted); font-size: 13px; }
  .modal-empty-hint { font-size: 11px; margin-top: 4px; color: color-mix(in srgb, var(--foreground) 30%, transparent); }
  .template-list { display: flex; flex-direction: column; gap: 2px; }
  .template-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: 8px; background: transparent; color: var(--foreground); cursor: pointer; text-align: left; width: 100%; font: inherit; transition: background 100ms ease; }
  .template-item:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .template-icon { font-size: 22px; flex-shrink: 0; }
  .template-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .template-name { font-size: 14px; font-weight: 500; }
  .template-desc { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
