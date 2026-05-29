<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // JournalEditor.svelte
  // The Anytype-ported Editor surface adapted for Journal.
  // Wraps Editor.svelte (from notes) with journal-specific chrome:
  //  • Today header + streak pill
  //  • Mood picker
  //  • Word / char count footer
  //  • Save / Clear actions wired to journal-service
  // ════════════════════════════════════════════════════════════════════
  import { onMount, onDestroy } from 'svelte';
  import { editorStore, rootBlocks, isEditorLoading } from '$lib/local-store/store';
  import { TextStyle } from '$lib/local-store/block';
  import { saveJournalEntry, getJournalEntry } from '$lib/services/journal-service';

  let {
    objectId = '',        // journal entry date string used as objectId
    todayLabel = '',
    dayOfYear = 0,
    streak = 0,
    isSaving = $bindable(false),
    saved = $bindable(false),
    selectedMood = $bindable<string>(''),
    t = (k: string) => k,
    onsave = () => {},
  }: {
    objectId?: string;
    todayLabel?: string;
    dayOfYear?: number;
    streak?: number;
    isSaving?: boolean;
    saved?: boolean;
    selectedMood?: string;
    t?: (k: string) => string;
    onsave?: () => void;
  } = $props();

  // ── Local editor state (mirror from store) ───────────────────────
  let blocks = $derived($rootBlocks);
  let loading = $derived($isEditorLoading);

  let wordCount = $derived(
    blocks.map(b => (b.content as any)?.text ?? '').join(' ').trim().split(/\s+/).filter(Boolean).length
  );
  let charCount = $derived(
    blocks.reduce((acc, b) => acc + ((b.content as any)?.text?.length ?? 0), 0)
  );

  // ── Mood picker ──────────────────────────────────────────────────
  const moods = [
    { id: 'great', emoji: '🤩', label: 'Great', color: '#8b5cf6' },
    { id: 'good',  emoji: '😊', label: 'Good',  color: '#22c55e' },
    { id: 'okay',  emoji: '😐', label: 'Okay',  color: '#eab308' },
    { id: 'low',   emoji: '😔', label: 'Low',   color: '#f97316' },
    { id: 'awful', emoji: '😩', label: 'Awful', color: '#ef4444' },
  ];

  // ── Init editor from backend ─────────────────────────────────────
  onMount(async () => {
    if (objectId) {
      await editorStore.init(objectId, 'journal');
    }
  });

  // ── Save to journal service ──────────────────────────────────────
  async function handleSave() {
    isSaving = true;
    try {
      // CRITICAL: Flush live text cache into the store so blocks reflect
      // what the user actually typed (not stale store content).
      // The editor uses _liveTextContent to avoid render freezes.
      for (const block of blocks) {
        if (block.id) editorStore.syncBlockTextToStore(block.id);
      }
      // Re-read blocks AFTER flushing live text
      const freshBlocks = blocks;
      const blocksJson = JSON.stringify(
        freshBlocks.map(b => ({
          id: b.id,
          type: b.type,
          content: b.content,
        }))
      );
      const textContent = freshBlocks.map(b => (b.content as any)?.text ?? '').join('\n').trim();
      const wc = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;

      try {
        // Try Tauri backend first
        await saveJournalEntry({
          date: objectId,
          blocks: blocksJson,
          wordCount: wc,
          mood: selectedMood || null,
        });
      } catch {
        // Fallback to localStorage if Tauri backend not available
        const key = `journal:${objectId}`;
        const existing = JSON.parse(localStorage.getItem(key) || 'null');
        const entry = {
          id: existing?.id ?? crypto.randomUUID(),
          date: objectId,
          blocks: blocksJson,
          wordCount: wc,
          mood: selectedMood || null,
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(entry));
      }

      saved = true;
      onsave();
    } catch (err) {
      console.error('[JournalEditor] save failed:', err);
    } finally {
      isSaving = false;
      setTimeout(() => { saved = false; }, 2500);
    }
  }

  function handleClear() {
    editorStore.clearBlocks();
    selectedMood = '';
    saved = false;
  }

  // ── Slash commands (same as Notes Editor) ───────────────────────
  import { Plus, Heading1, Heading2, Heading3, List, ListOrdered,
           Quote, Code2, CheckSquare, Minus } from 'lucide-svelte';
  import { BlockRenderer } from '../notes/components/blocks/index';
  import { tick } from 'svelte';

  let showSlashMenu = $state(false);
  let slashMenuStyle = $state({ top: '0px', left: '0px' });
  let slashQuery = $state('');
  let slashMenuIndex = $state(0);
  let slashAnchorBlockId = $state<string | null>(null);
  let editorEl: HTMLDivElement | undefined = $state();

  const SLASH_COMMANDS = [
    { type: 'paragraph', icon: Plus,          label: 'Text',          style: TextStyle.Paragraph },
    { type: 'h1',        icon: Heading1,       label: 'Heading 1',     style: TextStyle.Header1 },
    { type: 'h2',        icon: Heading2,       label: 'Heading 2',     style: TextStyle.Header2 },
    { type: 'h3',        icon: Heading3,       label: 'Heading 3',     style: TextStyle.Header3 },
    { type: 'bullet',    icon: List,           label: 'Bullet list',   style: TextStyle.Bulleted },
    { type: 'numbered',  icon: ListOrdered,    label: 'Numbered list', style: TextStyle.Numbered },
    { type: 'todo',      icon: CheckSquare,    label: 'To-do',         style: TextStyle.Checkbox },
    { type: 'quote',     icon: Quote,          label: 'Quote',         style: TextStyle.Quote },
    { type: 'code',      icon: Code2,          label: 'Code block',    style: TextStyle.Code },
    { type: 'divider',   icon: Minus,          label: 'Divider',       style: null },
  ];

  let filteredCommands = $derived(
    slashQuery
      ? SLASH_COMMANDS.filter(c => c.label.toLowerCase().includes(slashQuery.toLowerCase()))
      : SLASH_COMMANDS
  );

  async function focusBlock(blockId: string, pos = 0) {
    await tick();
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .editable`);
    if (el) { el.focus(); }
  }

  function handleUpdate(blockId: string, text: string, marks: any[]) {
    // Store update is intentionally NOT called on every keystroke —
    // only persist to backend (debounced) and cache in live text map.
    // This prevents cascading derived-store re-evaluations (freeze).
    editorStore.persistBlockText(blockId, text, marks);
  }

  async function handleKeyDown(e: any, value: string, marks: any[], range: any, props: any) {
    const blockId = props.block?.id;
    if (!blockId) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = value.slice(0, range.from);
      const after = value.slice(range.from);
      await editorStore.persistBlockText(blockId, before);
      editorStore.syncBlockTextToStore(blockId);
      const newId = await editorStore.addBlock(blockId, after, (props.block.content as any)?.style);
      if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
      return;
    }

    if (e.key === 'Backspace' && value === '' && range.from === 0) {
      e.preventDefault();
      if (blocks.length <= 1) return;
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx <= 0) return;
      const prev = blocks[idx - 1];
      await editorStore.deleteBlock(blockId);
      editorStore.focusBlock(prev.id!);
      focusBlock(prev.id!);
      return;
    }

    if (e.key === 'ArrowUp' && range.from === 0) {
      e.preventDefault();
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx > 0) focusBlock(blocks[idx - 1].id!, 999);
      return;
    }

    if (e.key === 'ArrowDown' && range.from >= value.length) {
      e.preventDefault();
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx < blocks.length - 1) focusBlock(blocks[idx + 1].id!, 0);
      return;
    }

    if (e.key === 'Escape') { showSlashMenu = false; return; }
  }

  function handleKeyUp(e: any, value: string, marks: any[], range: any, props: any) {
    const blockId = props.block?.id;
    if (!blockId) return;
    if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (el && editorEl) {
        const rect = el.getBoundingClientRect();
        const edRect = editorEl.getBoundingClientRect();
        slashMenuStyle = { top: `${rect.top - edRect.top + rect.height}px`, left: '24px' };
      }
      showSlashMenu = true;
      slashQuery = '';
      slashMenuIndex = 0;
      slashAnchorBlockId = blockId;
    }
    if (showSlashMenu && slashAnchorBlockId === blockId) {
      const before = value.slice(0, range.from);
      const si = before.lastIndexOf('/');
      if (si >= 0) slashQuery = before.slice(si + 1);
    }
  }

  async function handleSlashSelect(cmd: typeof SLASH_COMMANDS[0]) {
    if (!slashAnchorBlockId) return;
    if (cmd.style !== null) {
      await editorStore.convertBlockStyle(slashAnchorBlockId, cmd.style);
    } else {
      const newId = await editorStore.addBlock(slashAnchorBlockId, '');
      if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
    }
    showSlashMenu = false;
    slashAnchorBlockId = null;
  }

  async function addBlockBelow(blockId?: string) {
    const targetId = blockId ?? blocks[blocks.length - 1]?.id;
    if (!targetId) return;
    const newId = await editorStore.addBlock(targetId);
    if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
  }

  function handleToggle() {}
  function handleStyleConvert(blockId: string, style: TextStyle) {
    editorStore.convertBlockStyle(blockId, style);
  }

  // Close slash menu on outside click
  function handleGlobalMouseDown(e: MouseEvent) {
    if (showSlashMenu) {
      const el = document.querySelector('.je-slash-menu');
      if (el && !el.contains(e.target as Node)) showSlashMenu = false;
    }
  }

  onMount(() => document.addEventListener('mousedown', handleGlobalMouseDown));
  onDestroy(() => document.removeEventListener('mousedown', handleGlobalMouseDown));
</script>

<div class="journal-editor" bind:this={editorEl}>

  <!-- ── Minimal header ─────────────────────────────────────────── -->
  <div class="je-header">
    <div class="je-header-left">
      <h2 class="je-title">{todayLabel}</h2>
      <p class="je-sub">{t('moduleJournalDayOfYear')} {dayOfYear}</p>
    </div>
    <div class="je-streak-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="je-streak-icon"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      {streak} {t('moduleJournalDayStreak')}
    </div>
  </div>

  <!-- ── Mood picker ─────────────────────────────────────────────── -->
  <div class="je-mood-row" role="group" aria-label="How are you feeling?">
    <span class="je-mood-label">{t('moduleJournalMoodToday')}</span>
    {#each moods as mood}
      <button
        class="je-mood-btn"
        class:je-mood-btn--active={selectedMood === mood.id}
        style="--mood-color: {mood.color}"
        onclick={() => { selectedMood = selectedMood === mood.id ? '' : mood.id; }}
        title={mood.label}
        aria-label={mood.label}
        aria-pressed={selectedMood === mood.id}
      >
        {mood.emoji}
      </button>
    {/each}
  </div>

  <!-- ── Editor surface ─────────────────────────────────────────── -->
  {#if loading}
    <div class="je-loading">
      <div class="je-spinner"></div>
      <p>Loading…</p>
    </div>
  {:else}
    <div class="je-blocks">
      {#each blocks as block, i (block.id)}
        <div class="je-block-wrap">
          <BlockRenderer
            {block}
            rootId={objectId}
            blockIndex={i}
            onUpdate={handleUpdate}
            onFocus={() => {}}
            onBlur={() => {}}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onToggle={handleToggle}
            onStyleConvert={handleStyleConvert}
          />
          <button class="je-add-btn" onclick={() => addBlockBelow(block.id)} aria-label="Add block below">
            <Plus size={13} />
          </button>
        </div>
      {/each}

      {#if blocks.length === 0}
        <div class="je-empty">
          <p>Press <kbd>/</kbd> for commands or just start typing…</p>
        </div>
      {/if}
    </div>

    <!-- Slash menu -->
    {#if showSlashMenu}
      <div class="je-slash-menu" style="top:{slashMenuStyle.top}; left:{slashMenuStyle.left};" role="listbox" tabindex="0">
        <div class="je-slash-header">Blocks</div>
        {#each filteredCommands as cmd, i}
          <button
            class="je-slash-item"
            class:je-slash-item--active={i === slashMenuIndex}
            onclick={() => handleSlashSelect(cmd)}
          >
            <span class="je-slash-icon"><svelte:component this={cmd.icon} size={15} /></span>
            <span>{cmd.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- ── Footer ─────────────────────────────────────────────────── -->
  <div class="je-footer">
    <span class="je-stats">{wordCount} {t('moduleJournalWords')} · {charCount} {t('moduleJournalChars')}</span>
    <div class="je-actions">
      <button class="je-btn" onclick={handleClear} title={t('commonClear')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="je-btn-icon"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <button
        class="je-btn je-btn--save"
        class:je-btn--saved={saved}
        onclick={handleSave}
        disabled={isSaving}
      >
        {#if isSaving}
          <span class="je-spinner je-spinner--sm"></span>
          {t('moduleJournalSaving')}
        {:else if saved}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="je-btn-icon"><polyline points="20 6 9 17 4 12"/></svg>
          {t('moduleJournalSaved')}
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="je-btn-icon"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {t('moduleJournalSaveEntry')}
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .journal-editor {
    display: flex;
    flex-direction: column;
    max-width: 740px;
    margin: 0 auto;
    width: 100%;
    padding: 32px 24px 48px;
    gap: 0;
    position: relative;
    min-height: calc(100vh - 140px);
  }

  /* ── Header ───────────────────────────────────────────────────── */
  .je-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }

  .je-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .je-sub {
    margin: 4px 0 0;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .je-streak-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .je-streak-icon { width: 14px; height: 14px; }

  /* ── Mood picker ──────────────────────────────────────────────── */
  .je-mood-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }

  .je-mood-label {
    font-size: 0.82rem;
    color: var(--muted);
    font-weight: 500;
    white-space: nowrap;
    margin-right: 4px;
  }

  .je-mood-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    font-size: 1.25rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.14s;
    line-height: 1;
  }

  .je-mood-btn:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    transform: scale(1.1);
  }

  .je-mood-btn--active {
    border-color: var(--mood-color);
    background: color-mix(in srgb, var(--mood-color) 12%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mood-color) 20%, transparent);
    transform: scale(1.08);
  }

  /* ── Block area ───────────────────────────────────────────────── */
  .je-blocks {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 240px;
  }

  .je-block-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    width: 100%;
  }

  .je-add-btn {
    position: absolute;
    left: -32px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: opacity 0.12s, background 0.12s;
  }

  .je-block-wrap:hover .je-add-btn { opacity: 0.4; }
  .je-add-btn:hover { opacity: 1 !important; background: color-mix(in srgb, var(--foreground) 6%, transparent); }

  .je-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: var(--muted);
    font-size: 0.92rem;
    text-align: center;
  }

  .je-empty kbd {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    font-family: inherit;
    font-size: 0.82rem;
  }

  /* ── Slash menu ───────────────────────────────────────────────── */
  .je-slash-menu {
    position: absolute;
    z-index: 200;
    width: 240px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    overflow: hidden;
  }

  .je-slash-header {
    padding: 8px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--border);
  }

  .je-slash-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 0;
    font-size: 0.88rem;
    color: var(--foreground);
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
    transition: background 0.1s;
  }

  .je-slash-item:hover,
  .je-slash-item--active { background: color-mix(in srgb, var(--foreground) 6%, transparent); }

  .je-slash-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    color: var(--muted);
    flex-shrink: 0;
  }

  /* ── Footer ───────────────────────────────────────────────────── */
  .je-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 32px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .je-stats {
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 500;
  }

  .je-actions { display: flex; gap: 8px; align-items: center; }

  .je-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .je-btn:hover { background: var(--muted-surface); }

  .je-btn--save {
    background: #818cf8;
    border-color: #818cf8;
    color: #fff;
  }

  .je-btn--save:hover { opacity: 0.9; }
  .je-btn--saved { background: #22c55e; border-color: #22c55e; }
  .je-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .je-btn-icon { width: 15px; height: 15px; }

  /* ── Spinners ─────────────────────────────────────────────────── */
  .je-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 24px;
    color: var(--muted);
  }

  .je-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border);
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: je-spin 0.7s linear infinite;
    display: inline-block;
  }

  .je-spinner--sm {
    width: 14px;
    height: 14px;
    border-width: 2px;
    border-color: rgba(255,255,255,0.3);
    border-top-color: #fff;
  }

  @keyframes je-spin { to { transform: rotate(360deg); } }

  /* ── Body text uses Instrument Serif (same as Notes editor) ──── */
  .je-blocks :global([contenteditable]) {
    font-family: 'Instrument Serif', serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.78;
  }

  .je-blocks :global(code), .je-blocks :global(pre) {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 13px;
  }

  @media (max-width: 720px) {
    .journal-editor { padding: 20px 16px 40px; }
    .je-header { flex-direction: column; align-items: flex-start; }
    .je-footer { flex-direction: column; gap: 10px; align-items: flex-start; }
  }
</style>
