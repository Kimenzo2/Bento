<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Plus, FileText, Star, Clock, Search, MoreHorizontal, Archive, Trash2, Pin } from 'lucide-svelte';
  import { time } from '$lib/utils/time';
  import { editorStore } from '$lib/local-store/store';

  let { moduleId = 'notes' } = $props();

  // ── Types ──────────────────────────────────────────────────────────────

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

  // ── State ──────────────────────────────────────────────────────────────

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

  function showError(msg: string) {
    if (errorTimer) clearTimeout(errorTimer);
    errorMsg = msg;
    errorTimer = setTimeout(() => { errorMsg = null; }, 5000);
  }

  // ── Derived ────────────────────────────────────────────────────────────

  let filtered = $derived(
    searchQuery.trim()
      ? notes.filter(n =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.preview.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : notes
  );

  let pinnedNotes = $derived(filtered.filter(n => n.pinned));
  let otherNotes  = $derived(filtered.filter(n => !n.pinned));
  let activeNote  = $derived(notes.find(n => n.id === activeId) ?? null);

  async function ensureEditorLoaded() {
    if (EditorComponent) return;
    if (editorLoadPromise) return editorLoadPromise;

    editorLoadPromise = import('./Editor.svelte')
      .then((mod) => {
        EditorComponent = mod.default;
      })
      .catch((err) => {
        console.error('[notes] editor load failed:', err);
        showError('Could not load editor. Backend unavailable.');
      })
      .finally(() => {
        editorLoadPromise = null;
      });

    return editorLoadPromise;
  }

  // ── Load ───────────────────────────────────────────────────────────────

  async function load() {
    loading = true;
    try {
      const result = await invoke<NoteSummary[]>('notes_list', {
        includeArchived: false, limit: 500, offset: 0,
      });
      // Sort: pinned first, then by updatedAt desc
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

  onMount(load);

  // ── Create ─────────────────────────────────────────────────────────────

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

  // ── Delete ─────────────────────────────────────────────────────────────

  async function deleteNote(id: string) {
    contextMenu = null;
    try {
      await invoke('notes_object_delete', { noteId: id });
      const idx = notes.findIndex(n => n.id === id);
      notes = notes.filter(n => n.id !== id);
      if (activeId === id) {
        // Select adjacent note
        const next = notes[idx] ?? notes[idx - 1] ?? null;
        activeId = next?.id ?? null;
      }
    } catch (err) {
      console.error('[notes] delete failed:', err);
      showError('Could not delete note. Backend unavailable.');
    }
  }

  // ── Pin ────────────────────────────────────────────────────────────────

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

  // ── Note updated from editor ────────────────────────────────────────────

  function onNoteUpdated(event: CustomEvent<{ id: string; title: string; preview?: string }>) {
    const { id, title, preview } = event.detail;
    notes = notes.map(n =>
      n.id === id ? { ...n, title, preview: preview ?? n.preview, updatedAt: time.now() } : n
    );
  }

  // ── Context menu ───────────────────────────────────────────────────────

  function openContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { id, x: e.clientX, y: e.clientY };
  }

  async function selectNote(id: string) {
    await editorStore.flushPendingSaves();
    activeId = id;
    void ensureEditorLoaded();
  }

  function closeContextMenu() { contextMenu = null; }

  // ── Helpers ────────────────────────────────────────────────────────────

  function formatDate(ts: number): string {
    const d = new Date(ts);
    const diff = time.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diff < 604_800_000) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════
     ROOT — Anytype-style two-panel: narrow note list + full editor
════════════════════════════════════════════════════════════════════════ -->
<div class="notes-root" onclick={closeContextMenu} role="presentation">

  <!-- ── Panel 1: Note list sidebar ──────────────────────────────────── -->
  <aside class="notes-sidebar">

    <!-- Header + New Note button -->
    <div class="sidebar-header">
      <span class="sidebar-title">Notes</span>
      <button
        class="new-note-btn"
        onclick={createNote}
        disabled={creating}
        aria-label="New note"
        title="New note (Ctrl+N)"
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>
    </div>

    <!-- Search -->
    <div class="sidebar-search">
      <Search size={13} class="search-icon" />
      <input
        class="search-input"
        type="text"
        placeholder="Search notes…"
        bind:value={searchQuery}
        aria-label="Search notes"
      />
    </div>

    <!-- Error banner -->
    {#if errorMsg}
      <div class="notes-error-banner" role="alert">{errorMsg}</div>
    {/if}

    <!-- Note list -->
    <div class="note-list" role="listbox" aria-label="Notes">
      {#if loading}
        <div class="sidebar-loading">
          <div class="spinner"></div>
          <span>Loading…</span>
        </div>

      {:else if filtered.length === 0 && searchQuery}
        <div class="sidebar-empty">No results for "{searchQuery}"</div>

      {:else if notes.length === 0}
        <div class="sidebar-empty">
          <p>No notes yet.</p>
          <button class="empty-create-btn" onclick={createNote}>
            <Plus size={14} /> Create note
          </button>
        </div>

      {:else}
        <!-- Pinned group -->
        {#if pinnedNotes.length > 0}
          <div class="list-group-label">Pinned</div>
          {#each pinnedNotes as note (note.id)}
            <div
              class="note-row"
              class:active={activeId === note.id}
              role="option"
              aria-selected={activeId === note.id}
              tabindex="0"
              onclick={() => selectNote(note.id)}
              onkeydown={(e) => e.key === 'Enter' && selectNote(note.id)}
              oncontextmenu={(e) => openContextMenu(e, note.id)}
            >
              <div class="note-row-icon">{note.icon ?? '📄'}</div>
              <div class="note-row-body">
                <span class="note-row-title">
                  {note.title.trim() || 'Untitled'}
                </span>
                <span class="note-row-sub">
                  <span class="note-row-date">{formatDate(note.updatedAt)}</span>
                  {#if note.preview}
                    <span class="note-row-preview">{truncate(note.preview, 40)}</span>
                  {/if}
                </span>
              </div>
              <button
                class="note-row-menu"
                onclick={(e) => openContextMenu(e, note.id)}
                aria-label="Note options"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          {/each}
        {/if}

        <!-- Other notes -->
        {#if otherNotes.length > 0}
          {#if pinnedNotes.length > 0}
            <div class="list-group-label">All Notes</div>
          {/if}
          {#each otherNotes as note (note.id)}
            <div
              class="note-row"
              class:active={activeId === note.id}
              role="option"
              aria-selected={activeId === note.id}
              tabindex="0"
              onclick={() => selectNote(note.id)}
              onkeydown={(e) => e.key === 'Enter' && selectNote(note.id)}
              oncontextmenu={(e) => openContextMenu(e, note.id)}
            >
              <div class="note-row-icon">{note.icon ?? '📄'}</div>
              <div class="note-row-body">
                <span class="note-row-title">
                  {note.title.trim() || 'Untitled'}
                </span>
                <span class="note-row-sub">
                  <span class="note-row-date">{formatDate(note.updatedAt)}</span>
                  {#if note.preview}
                    <span class="note-row-preview">{truncate(note.preview, 40)}</span>
                  {/if}
                </span>
              </div>
              <button
                class="note-row-menu"
                onclick={(e) => openContextMenu(e, note.id)}
                aria-label="Note options"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  </aside>

  <!-- ── Panel 2: Editor ─────────────────────────────────────────────── -->
  <main class="notes-editor-pane">
    {#if activeId}
      {#if EditorComponent}
        <svelte:component
          this={EditorComponent}
          objectId={activeId}
          onTitleChange={(id: string, title: string) => {
            notes = notes.map(n => n.id === id ? { ...n, title, updatedAt: time.now() } : n);
          }}
        />
      {:else}
        <div class="editor-loading">
          <div class="spinner"></div>
          <span>Loading editor…</span>
        </div>
      {/if}
    {:else}
      <!-- Empty state — no note selected -->
      <div class="editor-empty">
        <div class="editor-empty-icon">
          <FileText size={48} strokeWidth={1} />
        </div>
        <h2 class="editor-empty-title">Select a note</h2>
        <p class="editor-empty-sub">Choose a note from the list, or create a new one.</p>
        <button class="editor-empty-btn" onclick={createNote} disabled={creating}>
          <Plus size={15} />
          New note
        </button>
      </div>
    {/if}
  </main>
</div>

<!-- ── Context menu ───────────────────────────────────────────────────── -->
{#if contextMenu}
  <div
    class="ctx-menu"
    style="left:{contextMenu.x}px; top:{contextMenu.y}px;"
    role="menu"
    onmousedown={(e) => e.stopPropagation()}
  >
    <button class="ctx-item" role="menuitem" onclick={() => { const id = contextMenu!.id; closeContextMenu(); togglePin(id); }}>
      <Pin size={13} />
      {notes.find(n => n.id === contextMenu?.id)?.pinned ? 'Unpin' : 'Pin to top'}
    </button>
    <div class="ctx-sep"></div>
    <button class="ctx-item ctx-danger" role="menuitem" onclick={() => { const id = contextMenu!.id; deleteNote(id); }}>
      <Trash2 size={13} />
      Delete
    </button>
  </div>
{/if}

<style>
  /* ══════════════════════════════════════════════════════════════════════
     ROOT — fills the module host completely
  ══════════════════════════════════════════════════════════════════════ */

  .notes-root {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100%;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--background);
    color: var(--foreground);
    font-size: 13px;
  }

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR — narrow note list, Anytype-style
  ══════════════════════════════════════════════════════════════════════ */

  .notes-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-right: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
  }

  /* Header */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 14px 10px;
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: color-mix(in srgb, var(--foreground) 40%, transparent);
  }

  .new-note-btn {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 50%, transparent);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .new-note-btn:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .new-note-btn:active { transform: scale(0.93); }
  .new-note-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Search */
  .sidebar-search {
    position: relative;
    padding: 0 10px 8px;
    flex-shrink: 0;
  }

  :global(.search-icon) {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-60%);
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 30px;
    padding: 0 10px 0 30px;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    color: var(--foreground);
    font: inherit;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .search-input::placeholder { color: color-mix(in srgb, var(--foreground) 30%, transparent); }
  .search-input:focus {
    border-color: color-mix(in srgb, var(--foreground) 18%, transparent);
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  /* Note list scroll area */
  .note-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2px 6px 16px;
    scrollbar-width: none;
  }
  .note-list::-webkit-scrollbar { display: none; }

  /* Error banner */
  .notes-error-banner {
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

  /* Group labels */
  .list-group-label {
    padding: 8px 8px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  /* Note row — Anytype-style */
  .note-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 10px;
    cursor: pointer;
    position: relative;
    transition: background 100ms ease;
    min-width: 0;
  }

  .note-row:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .note-row:hover .note-row-menu { opacity: 1; }

  .note-row.active {
    background: color-mix(in srgb, var(--foreground) 9%, transparent);
  }

  .note-row-icon {
    font-size: 16px;
    flex-shrink: 0;
    line-height: 1;
    width: 20px;
    text-align: center;
  }

  .note-row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .note-row-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .note-row-sub {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .note-row-date {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    flex-shrink: 0;
  }

  .note-row-preview {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-row-menu {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 40%, transparent);
    cursor: pointer;
    opacity: 0;
    transition: background 100ms ease, opacity 100ms ease;
  }

  .note-row-menu:hover { background: color-mix(in srgb, var(--foreground) 10%, transparent); }

  /* Loading / empty states in sidebar */
  .sidebar-loading, .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 32px 16px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    font-size: 12px;
    text-align: center;
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

  .empty-create-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .empty-create-btn:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }

  /* ══════════════════════════════════════════════════════════════════════
     EDITOR PANE — fills remaining width
  ══════════════════════════════════════════════════════════════════════ */

  .notes-editor-pane {
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

  /* Empty / no-selection state */
  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 14px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }

  .editor-empty-icon {
    opacity: 0.25;
  }

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

  /* ══════════════════════════════════════════════════════════════════════
     CONTEXT MENU
  ══════════════════════════════════════════════════════════════════════ */

  .ctx-menu {
    position: fixed;
    z-index: 9999;
    min-width: 160px;
    border-radius: 12px;
    background: var(--background);
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    animation: ctx-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes ctx-in {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 100ms ease;
  }

  .ctx-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .ctx-item.ctx-danger { color: #ef4444; }
  .ctx-item.ctx-danger:hover { background: color-mix(in srgb, #ef4444 8%, transparent); }

  .ctx-sep {
    height: 1px;
    margin: 3px 6px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }
</style>
