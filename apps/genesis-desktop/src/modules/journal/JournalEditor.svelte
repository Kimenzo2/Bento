<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // JournalEditor.svelte — Emotional Redesign
  // The writing surface must feel like a private diary, not a text field.
  // ════════════════════════════════════════════════════════════════════
  import { time } from '$lib/utils/time';
  import { onMount, onDestroy } from 'svelte';
  import { editorStore, getRootBlocks, getIsEditorLoading } from '$lib/local-store/store';
  import { TextStyle } from '$lib/local-store/block';
  import { getJournalEntry, saveJournalEntry } from '$lib/services/journal-service';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let {
    objectId = '',
    isSaving = $bindable(false),
    saved = $bindable(false),
    t = (k: string) => k,
    onsaved = () => {},
  }: {
    objectId?: string;
    isSaving?: boolean;
    saved?: boolean;
    t?: (k: string) => string;
    onsaved?: () => void;
  } = $props();

  // ── Entry date (fetched from backend) ────────────────────────────
  let entryDate = $state<string>('');
  let entryLabel = $state<string>('');
  let entryYear = $state<string>('');
  let entryTimeLabel = $state<string>('');

  // ── Mood, weather, word count ──────────────────────────────────
  const MOODS = [
    { id: 'great',  color: '#E8A838', label: 'Great' },
    { id: 'good',   color: '#6BBF59', label: 'Good' },
    { id: 'okay',   color: '#7B8CDE', label: 'Okay' },
    { id: 'low',    color: '#B088D6', label: 'Low' },
    { id: 'sad',    color: '#D47A9E', label: 'Sad' },
  ];

  let selectedMood = $state<string | null>(null);

  // Weather icons as inline SVGs — no emojis
  const WEATHER = [
    { id: 'sun',   label: 'Sunny' },
    { id: 'cloud', label: 'Cloudy' },
    { id: 'rain',  label: 'Rainy' },
    { id: 'wind',  label: 'Windy' },
    { id: 'night', label: 'Night' },
  ];

  let selectedWeather = $state<string | null>(null);

  let wordCount = $derived(
    getRootBlocks().map((b: any) => (b.content as any)?.text ?? '').join(' ').trim().split(/\s+/).filter(Boolean).length
  );
  let charCount = $derived(
    getRootBlocks().reduce((acc: number, b: any) => acc + ((b.content as any)?.text?.length ?? 0), 0)
  );

  // ── Auto-save (debounced) ─────────────────────────────────────
  let dirty = $state(false);
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let isSavingNow = $state(false);

  function scheduleAutoSave() {
    dirty = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (dirty && !isSavingNow) {
        await handleSave();
      }
    }, 1200);
  }

  // ── Dark mode detection ──────────────────────────────────────────
  let isDark = $state(false);

  // ── Focus writing mode ──────────────────────────────────────────
  let focusMode = $state(false);
  let lastActivity = $state(0);
  let focusFocusedBlockId = $state<string | null>(null);
  let focusTimer: ReturnType<typeof setInterval> | null = null;    import { get } from 'svelte/store';
  import { journalFontVariationId, applyJournalFont } from '$lib/stores/journal-font.store';

  // ── Init editor from backend ────────────────────────────────────
  onMount(async () => {
    // Detect dark mode
    isDark = document.documentElement.classList.contains('dark') ||
             document.documentElement.classList.contains('theme-dark');
    const darkObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark') ||
               document.documentElement.classList.contains('theme-dark');
    });
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Apply Journal font CSS variables to :root (cascades into this editor)
    applyJournalFont(get(journalFontVariationId));

    // Fetch the entry to get its date for display
    try {
      const entry = await getJournalEntry(objectId);
      if (entry) {
        entryDate = entry.date;
        entryLabel = formatEntryDate(entry.date);
        entryYear = formatEntryYear(entry.date);
        if (entry.mood) selectedMood = entry.mood;
        if (entry.weather) selectedWeather = entry.weather;
      }
    } catch {
      // getJournalEntry failed entirely (network, backend down, etc.)
    }

    // If backend didn't return an entry, try localStorage fallback
    if (!entryLabel) {
      try {
        const raw = localStorage.getItem(`journal:id:${objectId}`);
        if (raw) {
          const fallback = JSON.parse(raw);
          if (fallback?.date) {
            entryDate = fallback.date;
            entryLabel = formatEntryDate(fallback.date);
            entryYear = formatEntryYear(fallback.date);
          }
          if (fallback?.mood) selectedMood = fallback.mood;
        }
      } catch { /* ignore */ }
    }

    // If still no date, fallback to now
    if (!entryLabel) {
      const now = time.toISODate(time.now());
      entryLabel = formatEntryDate(now);
      entryYear = formatEntryYear(now);
    }

    // Set time label
    entryTimeLabel = formatTimeLabel();

    await editorStore.init(objectId, 'journal');
    // Auto-focus the first block
    await tick();
    const blocks = getRootBlocks();
    if (blocks[0]?.id) {
      editorStore.focusBlock(blocks[0].id);
      focusBlock(blocks[0].id, 0);
    }

    // Start focus mode timer
    focusTimer = setInterval(() => {
      if (lastActivity > 0) {
        const elapsed = Date.now() - lastActivity;
        if (elapsed > 3000 && !focusMode) {
          focusMode = true;
        } else if (elapsed > 8000 && focusMode) {
          focusMode = false;
        }
      }
    }, 500);

    // Cleanup observer, timers, and flush pending save
    onDestroy(() => {
      darkObserver.disconnect();
      if (focusTimer) clearInterval(focusTimer);
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      if (dirty) {
        handleSave();
      }
    });
  });

  function formatEntryDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${dayNames[d.getDay()]}, ${d.getDate()}${ordinalSuffix(d.getDate())} ${monthNames[d.getMonth()]}`;
  }

  function formatEntryYear(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return String(d.getFullYear());
  }

  function ordinalSuffix(n: number): string {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function formatTimeLabel(): string {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
    return `Written at ${hours}:${minStr} ${ampm}`;
  }

  // ── Save to journal service ──────────────────────────────────────
  async function handleSave() {
    if (isSavingNow) return;
    isSavingNow = true;
    try {
      // Sync all blocks from the live text cache before serializing,
      // so saved data reflects the user's latest typing.
      const rootBlockIds = getRootBlocks().map(b => b.id).filter(Boolean) as string[];
      for (const id of rootBlockIds) {
        editorStore.syncBlockTextToStore(id);
      }
      // Re-read blocks after syncing — the store replaced the objects
      const syncedBlocks = getRootBlocks();
      const textContent = syncedBlocks.map(b => {
        if (b.id) {
          const el = document.querySelector<HTMLElement>(`[data-block-id="${b.id}"] .editable`);
          if (el) {
            return el.innerText || '';
          }
        }
        return (b.content as any)?.text ?? '';
      }).join('\n').trim();
      const wc = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;
      const blocksJson = JSON.stringify(
        syncedBlocks.map(b => ({
          id: b.id,
          type: b.type,
          content: b.content,
        }))
      );


      try {
        await saveJournalEntry(objectId, entryDate || time.toISODate(time.now()), blocksJson, wc, selectedMood, selectedWeather);
        // Clear any stale localStorage entry now that DB save succeeded
        localStorage.removeItem(`journal:id:${objectId}`);
      } catch {
        // Fallback to localStorage if Tauri backend not available
        const existingRaw = localStorage.getItem(`journal:id:${objectId}`);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;
        localStorage.setItem(`journal:id:${objectId}`, JSON.stringify({
          id: objectId,
          date: entryDate || time.toISODate(time.now()),
          blocks: blocksJson,
          wordCount: wc,
          mood: selectedMood,
          createdAt: existing?.createdAt ?? time.now(),
          updatedAt: time.now(),
        }));
      }

      saved = true;
      onsaved();
    } catch (err) {
      console.error('[JournalEditor] save failed:', err);
    } finally {
      isSavingNow = false;
      dirty = false;
      setTimeout(() => { saved = false; }, 2500);
    }
  }

  function handleClear() {
    editorStore.clearBlocks();
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
  let blocksContainerEl: HTMLDivElement | undefined = $state();

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
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let charIndex = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const nextIndex = charIndex + node.textContent!.length;
      if (charIndex <= pos && pos <= nextIndex) {
        range.setStart(node, pos - charIndex);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      charIndex = nextIndex;
    }
    range.selectNodeContents(el);
    range.collapse(pos > 0);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleUpdate(blockId: string, text: string, marks: any[]) {
    editorStore.persistBlockText(blockId, text, marks);
    // Track typing activity for focus mode
    lastActivity = Date.now();
    scheduleAutoSave();
  }

  async function handleKeyDown(e: any, value: string, marks: any[], range: any, props: any) {
    const blockId = props.block?.id;
    if (!blockId) return;

    // Track activity for focus mode
    lastActivity = Date.now();
    focusFocusedBlockId = blockId;
    if (focusMode) focusMode = false; // Reset briefly while actively typing

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = value.slice(0, range.from);
      const after = value.slice(range.from);
      await editorStore.persistBlockText(blockId, before);
      editorStore.syncBlockTextToStore(blockId);
      const newId = await editorStore.addBlock(blockId, after, (props.block.content as any)?.style);
      if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
      scheduleAutoSave();
      return;
    }

    if (e.key === 'Backspace' && value === '' && range.from === 0) {
      e.preventDefault();
      if (getRootBlocks().length <= 1) return;
      const idx = getRootBlocks().findIndex((b: any) => b.id === blockId);
      if (idx <= 0) return;
      const prev = getRootBlocks()[idx - 1];
      const prevText = (prev.content as any)?.text ?? '';
      await editorStore.deleteBlock(blockId);
      editorStore.focusBlock(prev.id!);
      focusBlock(prev.id!, prevText.length);
      scheduleAutoSave();
      return;
    }

    if (e.key === 'ArrowUp' && range.from === 0) {
      e.preventDefault();
      const idx = getRootBlocks().findIndex((b: any) => b.id === blockId);
      if (idx > 0) focusBlock(getRootBlocks()[idx - 1].id!, 999);
      return;
    }

    if (e.key === 'ArrowDown' && range.from >= value.length) {
      e.preventDefault();
      const idx = getRootBlocks().findIndex((b: any) => b.id === blockId);
      if (idx < getRootBlocks().length - 1) focusBlock(getRootBlocks()[idx + 1].id!, 0);
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
        slashMenuStyle = { top: `${rect.top - edRect.top + rect.height}px`, left: '76px' };
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
    if (cmd.type === 'divider') {
      const anchorIdx = getRootBlocks().findIndex((b: any) => b.id === slashAnchorBlockId);
      const afterId = anchorIdx > 0 ? getRootBlocks()[anchorIdx - 1].id : undefined;
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, { blockType: 'div', content: { style: 0 } });
      if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
    } else if (cmd.style !== null) {
      await editorStore.convertBlockStyle(slashAnchorBlockId, cmd.style);
    } else {
      const newId = await editorStore.addBlock(slashAnchorBlockId, '');
      if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
    }
    showSlashMenu = false;
    slashAnchorBlockId = null;
  }

  async function addBlockBelow(blockId?: string) {
    const rbs = getRootBlocks();
    const targetId = blockId ?? rbs[rbs.length - 1]?.id;
    const newId = await editorStore.addBlock(targetId);
    if (newId) { editorStore.focusBlock(newId); focusBlock(newId, 0); }
    scheduleAutoSave();
  }

  function handleToggle() {}
  function handleStyleConvert(blockId: string, style: TextStyle) {
    editorStore.convertBlockStyle(blockId, style);
    scheduleAutoSave();
  }

  // Close slash menu on outside click
  function handleGlobalMouseDown(e: MouseEvent) {
    if (showSlashMenu) {
      const el = document.querySelector('.je-slash-menu');
      if (el && !el.contains(e.target as Node)) showSlashMenu = false;
    }
  }

  // Detect focus on blocks
  function handleBlockFocus(blockId: string) {
    focusFocusedBlockId = blockId;
  }

  onMount(() => document.addEventListener('mousedown', handleGlobalMouseDown));
  onDestroy(() => document.removeEventListener('mousedown', handleGlobalMouseDown));

  // ── Weather SVG icons ────────────────────────────────────────────
  function weatherSvg(id: string): string {
    switch (id) {
      case 'sun':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
      case 'cloud':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`;
      case 'rain':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><path d="M9 19l-2 3M15 19l-2 3M12 19l-2 3"/></svg>`;
      case 'wind':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M6 16H2M8.5 12H2M18.59 4.59A2 2 0 0 0 14 4.54V8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5.5a2 2 0 0 0-1.41-1.91z"/><path d="M22 16a2 2 0 0 1-2 2H12"/></svg>`;
      case 'night':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`;
      default:
        return '';
    }
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════
     JOURNAL EDITOR — The Paper Surface
     The background is warm cream / leather-bound journal brown-black.
     The page shadow suggests a physical page lifted from the desktop.
══════════════════════════════════════════════════════════════════════ -->
<div
  class="journal-editor"
  class:je-dark={isDark}
  class:je-focus-mode={focusMode}
  bind:this={editorEl}
  role="region"
  aria-label="Journal editor"
>

  <!-- ── Content wrapper (max-width centered reading area) ──────── -->
  <div class="je-content-wrap">

  <!-- ── Loading state ──────────────────────────────────────────── -->
  {#if getIsEditorLoading()}
    <div class="je-loading">
      <div class="je-spinner"></div>
      <p>{t('moduleJournalLoading') || 'Loading…'}</p>
    </div>

  {:else}

    <!-- ═══════════════════════════════════════════════════════════════
         ENTRY HEADER — A personal record of the moment
         "Monday, 19th May" in heading font, year below, time beside.
         Mood, weather, and word count tokens below the date.
    ══════════════════════════════════════════════════════════════════ -->
    <header class="je-entry-header">

      <div class="je-date-primary-row">
        <div class="je-date-block">
          <span class="je-date-day">{entryLabel || 'Journal Entry'}</span>
          {#if entryYear}
            <span class="je-date-year">{entryYear}</span>
          {/if}
        </div>
        {#if entryTimeLabel}
          <span class="je-time-label">{entryTimeLabel}</span>
        {/if}
      </div>

      <!-- Personal tokens: mood, weather, word count -->
      <div class="je-token-row">
        <!-- Mood selector — 5 small coloured circles -->
        <div class="je-mood-group" role="radiogroup" aria-label="Select your mood">
          {#each MOODS as mood}
            <button
              class="je-mood-dot"
              class:je-mood-dot--selected={selectedMood === mood.id}
              style="--mood-color: {mood.color}"
              onclick={() => { selectedMood = selectedMood === mood.id ? null : mood.id; scheduleAutoSave(); }}
              aria-label={mood.label}
              aria-pressed={selectedMood === mood.id}
              use:tooltip={{ text: mood.label }}
            ></button>
          {/each}
        </div>

        <span class="je-token-sep"></span>

        <!-- Weather selector -->
        <div class="je-weather-group">
          {#each WEATHER as w}
            <button
              class="je-weather-btn"
              class:je-weather-btn--selected={selectedWeather === w.id}
              onclick={() => { selectedWeather = selectedWeather === w.id ? null : w.id; scheduleAutoSave(); }}
              aria-label={w.label}
              use:tooltip={{ text: w.label }}
            >
              {@html weatherSvg(w.id)}
            </button>
          {/each}
        </div>

        <span class="je-token-sep"></span>

        <!-- Word count — visible but quiet -->
        <span class="je-wc-token" aria-label="Word count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════════
         WRITING AREA — Ruled lines + red margin line
         The ruled lines run across the full width, matching line-height.
         The red margin line sits 52px from the left edge.
         All body text begins to the right of the margin line.
    ══════════════════════════════════════════════════════════════════ -->
    <div class="je-body" class:je-body--no-rules={getRootBlocks().length === 0}>

      <!-- Red margin line — the signature visual of a physical notebook -->
      <div class="je-margin-line" aria-hidden="true"></div>

      <!-- Left margin space — for mood accent, word count, etc. -->
      <div class="je-margin-space" aria-hidden="true">
        {#if selectedMood}
          {const mood = MOODS.find(m => m.id === selectedMood)}
          {#if mood}
            <span class="je-margin-mood" style="background: {mood.color}" title={mood.label}></span>
          {/if}
        {/if}
        {#if wordCount > 0}
          <span class="je-margin-wc">{wordCount}</span>
        {/if}
      </div>

      <!-- Blocks container — offset to the right of the margin line -->
      <div class="je-blocks" bind:this={blocksContainerEl}>
        {#each getRootBlocks() as block, i (block.id)}
          <div
            class="je-block-wrap"
            class:je-block-wrap--muted={focusMode && focusFocusedBlockId && block.id !== focusFocusedBlockId}
          >
            <BlockRenderer
              {block}
              rootId={objectId}
              blockIndex={i}
              softEnter={true}
              onUpdate={handleUpdate}
              onFocus={() => { if (block.id) handleBlockFocus(block.id); }}
              onBlur={() => {}}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onToggle={handleToggle}
              onStyleConvert={handleStyleConvert}
            />
            <button class="je-add-btn" onclick={() => addBlockBelow(block.id)} aria-label="Add block below" use:tooltip={{ text: "Add block" }}>
              <Plus size={13} />
            </button>
          </div>
        {/each}

        {#if getRootBlocks().length === 0}
          <div class="je-empty">
            <div class="je-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <p>{t('moduleJournalEmptyPrompt') || 'Start writing your thoughts…'}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Bottom stacked pages effect ──────────────────────────── -->
    <div class="je-bottom-pages" aria-hidden="true">
      <div class="je-bottom-page je-bottom-page--1"></div>
      <div class="je-bottom-page je-bottom-page--2"></div>
    </div>

    <!-- Slash menu -->
    {#if showSlashMenu}
      <div class="je-slash-menu" style="top:{slashMenuStyle.top}; left:{slashMenuStyle.left};" role="listbox" tabindex="0"
        onkeydown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); slashMenuIndex = (slashMenuIndex + 1) % filteredCommands.length; }
          else if (e.key === 'ArrowUp') { e.preventDefault(); slashMenuIndex = (slashMenuIndex - 1 + filteredCommands.length) % filteredCommands.length; }
          else if (e.key === 'Enter') { e.preventDefault(); handleSlashSelect(filteredCommands[slashMenuIndex]); }
          else if (e.key === 'Escape') { e.preventDefault(); showSlashMenu = false; }
        }}>
        <div class="je-slash-header">Blocks</div>
        {#each filteredCommands as cmd, i}
          <button
            class="je-slash-item"
            class:je-slash-item--active={i === slashMenuIndex}
            role="option"
            aria-selected={i === slashMenuIndex}
            onclick={() => handleSlashSelect(cmd)}
          >
            <span class="je-slash-icon"><cmd.icon size={15} /></span>
            <span>{cmd.label}</span>
          </button>
        {/each}
      </div>
    {/if}

  {/if}

  </div><!-- /je-content-wrap -->
</div>

<!-- ═══════════════════════════════════════════════════════════════════
     STYLES — Emotional redesign: paper, ruled lines, margin, focus
══════════════════════════════════════════════════════════════════════ -->

<style>
  /* ══════════════════════════════════════════════════════════════════
     DIARY COLOR TOKENS — Light mode default
     The background is warm cream. Ink is warm dark brown.
  ══════════════════════════════════════════════════════════════════ */

  .journal-editor {
    --je-bg: #F9F3EA;
    --je-ink: #3C2A1A;
    --je-ruled: rgba(155, 163, 180, 0.22);
    --je-ruled-hard: rgba(155, 163, 180, 0.30);
    --je-margin: rgba(170, 90, 70, 0.45);
    --je-margin-dot: #B06A50;
    --je-caret: #C8923E;
    --je-selection: rgba(180, 140, 80, 0.25);
    --je-shadow-bottom: rgba(130, 100, 75, 0.07);
    --je-focus-dim: 0.65;
    --je-header-ink: #4A3828;
    --je-muted-ink: #8A7A6A;
    --je-token-sep: rgba(140, 120, 100, 0.20);
  }

  /* Dark mode — warm brown-black like a leather-bound journal */
  .journal-editor.je-dark {
    --je-bg: #1C1814;
    --je-ink: #D4C5B0;
    --je-ruled: rgba(175, 145, 100, 0.11);
    --je-ruled-hard: rgba(175, 145, 100, 0.18);
    --je-margin: rgba(155, 95, 75, 0.35);
    --je-margin-dot: #A0806A;
    --je-selection: rgba(180, 140, 80, 0.18);
    --je-shadow-bottom: rgba(0, 0, 0, 0.20);
    --je-header-ink: #C8B8A4;
    --je-muted-ink: #8F8476;
    --je-token-sep: rgba(180, 160, 130, 0.12);
  }

  /* ══════════════════════════════════════════════════════════════════
     ROOT — The paper surface
     Warm background, page shadow on all four sides.
  ══════════════════════════════════════════════════════════════════ */

  .journal-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    flex: 1;
    padding: 0;
    position: relative;
    background: var(--je-bg);
    color: var(--je-ink);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ══════════════════════════════════════════════════════════════════
     ENTRY HEADER
     "Monday, 19th May" — prominent, warm, personal.
     Time sits beside the date. Mood/weather/words sit below.
  ══════════════════════════════════════════════════════════════════ */

  /* ── Content wrapper: max-width centered reading area ─────────
       Uses flex: none + min-height: 100% so it fills the viewport when content is
       short but expands freely beyond it when content is long (e.g. 20K words).
       This is THE critical fix — without it, the flex chain constrains .je-body's
       height to the visible area and the ruled lines background vanishes on scroll.
    */
  .je-content-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: none;
    min-height: 100%;
  }

  .je-entry-header {
    padding: 40px 24px 0 52px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .je-date-primary-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .je-date-block {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .je-date-day {
    font-family: var(--je-heading-font, var(--font-display, 'Bricolage Grotesque Variable', system-ui, sans-serif));
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: var(--je-header-ink);
  }

  .je-date-year {
    font-family: var(--je-heading-font, var(--font-display, 'Bricolage Grotesque Variable', system-ui, sans-serif));
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--je-muted-ink);
    letter-spacing: 0.02em;
  }

  .je-time-label {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--je-muted-ink);
    font-style: italic;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  /* ── Token row ─────────────────────────────────────────────────── */

  .je-token-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .je-token-sep {
    width: 1px;
    height: 16px;
    background: var(--je-token-sep);
    flex-shrink: 0;
  }

  /* Mood: 5 small coloured circles */
  .je-mood-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .je-mood-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--mood-color);
    opacity: 0.35;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .je-mood-dot:hover {
    opacity: 0.7;
  }

  .je-mood-dot--selected {
    opacity: 1;
    border-color: var(--je-margin-dot);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--mood-color) 20%, transparent);
  }

  /* Weather icons */
  .je-weather-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .je-weather-btn {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--je-muted-ink);
    cursor: pointer;
    padding: 0;
    opacity: 0.45;
  }

  .je-weather-btn:hover {
    opacity: 0.8;
    background: color-mix(in srgb, var(--je-ink) 6%, transparent);
  }

  .je-weather-btn--selected {
    opacity: 1;
    color: var(--je-ink);
    background: color-mix(in srgb, var(--je-ink) 8%, transparent);
  }

  /* Word count token */
  .je-wc-token {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--je-muted-ink);
    line-height: 1;
    white-space: nowrap;
  }

  /* ══════════════════════════════════════════════════════════════════
     BODY — Ruled lines + red margin line
     The ruled lines are a repeating gradient matched to line-height.
     The red margin line sits 52px from the left edge.
  ══════════════════════════════════════════════════════════════════ */

  /* ═════ THE CRITICAL FIX: font-size: 17px on .je-body ═══════=
     The ruled lines use --je-lh-px: calc(1.7 * 1em). Without font-size set,
     1em inherits from the parent (typically 16px browser default), giving
     1.7 × 16 = 27.2px per ruled line. But the block text contenteditable
     renders at 17px × 1.7 = 28.9px per line. The 1.7px gap accumulates —
     after 17 lines the ruled line sits between text rows instead of under them.
     Setting font-size: 17px here makes 1em = 17px, so --je-lh-px = 28.9px,
     exactly matching every text row in every block. Lines stay aligned
     indefinitely, across any block type, with any content length.
  ═══════════════════════════════════════════════════════════════════════ */

  .je-body {
    position: relative;
    flex: 1 0 auto;
    display: flex;
    min-height: 320px;
    font-size: 17px;
    --je-lh: 1.7;
    --je-lh-px: calc(var(--je-lh) * 1em);

    /* Ruled lines — repeating linear gradient at line-height intervals. */
    background-image: repeating-linear-gradient(
      to bottom,
      transparent,
      transparent calc(var(--je-lh-px) - 1px),
      var(--je-ruled) calc(var(--je-lh-px) - 1px),
      var(--je-ruled) var(--je-lh-px)
    );
    background-position: 52px 0;
    background-repeat: repeat;
    background-size: 100% var(--je-lh-px);
  }

  /* Remove ruled lines when there's no content (empty state) */
  .je-body--no-rules {
    background-image: none;
  }

  /* ── Red margin line — now unconstrained alongside .je-body, so it
       extends the full height of the content without vanishing on scroll. ──── */
  .je-margin-line {
    position: absolute;
    left: 52px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--je-margin);
    pointer-events: none;
  }

  /* ── Left margin space ──────────────────────────────────────────── */
  .je-margin-space {
    width: 52px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-top: 4px;
    position: relative;
  }

  .je-margin-mood {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: block;
    flex-shrink: 0;
  }

  .je-margin-wc {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--je-muted-ink);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  /* ── Blocks container ───────────────────────────────────────────── */
  .je-blocks {
    flex: 1 0 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 24px 24px 16px;
  }

  .je-block-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    width: 100%;
  }

  /* Focus mode: non-active paragraphs dim */
  .je-focus-mode .je-block-wrap:not(.je-block-wrap--muted) {
    opacity: 1;
  }

  .je-focus-mode .je-block-wrap--muted {
    opacity: var(--je-focus-dim);
  }

  .je-add-btn {
    position: absolute;
    left: -28px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--je-muted-ink);
    opacity: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .je-block-wrap:hover .je-add-btn { opacity: 0.35; }
  .je-add-btn:hover { opacity: 1 !important; background: color-mix(in srgb, var(--je-ink) 8%, transparent); }

  .je-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px 48px;
    color: var(--je-muted-ink);
    font-size: 0.95rem;
    text-align: center;
    gap: 10px;
  }

  .je-empty-icon {
    opacity: 0.3;
    line-height: 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     TYPOGRAPHY ON THE PAGE
     Instrument Serif on warm cream = the closest screen to a diary.
     Warm dark brown ink. Generous line-height. Larger font.
  ══════════════════════════════════════════════════════════════════ */

  .je-blocks :global([contenteditable]) {
    font-family: var(--je-body-font, 'Instrument Serif', serif);
    font-size: 17px;
    font-weight: 400;
    line-height: var(--je-lh);
    color: var(--je-ink);
    caret-color: var(--je-caret);
  }

  /* Selection highlight — warm sepia */
  .je-blocks :global([contenteditable])::selection,
  .je-blocks :global([contenteditable] ::selection) {
    background: var(--je-selection);
  }

  /* Code/mono blocks */
  .je-blocks :global(code),
  .je-blocks :global(pre) {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 14px;
  }





  /* ── Block architecture: strip padding/min-height so each block
        sits flush at exactly one ruled line interval (28.9px per line).
        The ruled lines then flow continuously through the writing surface. ─── */
  .je-blocks :global(.block-renderer) {
    min-height: 0 !important;
  }

  .je-blocks :global(.block-text) {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    min-height: 0 !important;
  }

  /* ══════════════════════════════════════════════════════════════════
     BOTTOM PAGES — Stacked pages suggesting more pages below
  ══════════════════════════════════════════════════════════════════ */

  .je-bottom-pages {
    position: relative;
    z-index: 1;
    height: 24px;
    margin: 0 24px;
    overflow: hidden;
    pointer-events: none;
  }

  .je-bottom-page {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: 0 0 2px 2px;
    background: var(--je-bg);
  }

  .je-bottom-page--1 {
    bottom: 6px;
    height: 6px;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--je-shadow-bottom) 60%, transparent),
      0 2px 6px -2px var(--je-shadow-bottom);
    z-index: 1;
  }

  .je-bottom-page--2 {
    bottom: 0;
    height: 8px;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--je-shadow-bottom) 40%, transparent),
      0 3px 8px -2px var(--je-shadow-bottom);
    z-index: 0;
    margin: 0 1px;
  }

  /* ══════════════════════════════════════════════════════════════════
     SLASH MENU
  ══════════════════════════════════════════════════════════════════ */

  .je-slash-menu {
    position: absolute;
    z-index: 200;
    width: 240px;
    background: var(--je-bg);
    border: 1px solid var(--je-ruled-hard);
    border-radius: 10px;
    box-shadow:
      0 4px 24px rgba(0,0,0,0.10),
      inset 0 0 0 1px rgba(140, 110, 80, 0.04);
    overflow: hidden;
  }

  .je-dark .je-slash-menu {
    box-shadow: 0 4px 24px rgba(0,0,0,0.35);
  }

  .je-slash-header {
    padding: 8px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--je-muted-ink);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--je-ruled-hard);
  }

  .je-slash-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 0;
    font-size: 0.88rem;
    color: var(--je-ink);
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
  }

  .je-slash-item:hover,
  .je-slash-item--active { background: color-mix(in srgb, var(--je-ink) 6%, transparent); }

  .je-slash-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--je-ink) 5%, transparent);
    color: var(--je-muted-ink);
    flex-shrink: 0;
  }



  /* ══════════════════════════════════════════════════════════════════
     LOADING / SPINNER
  ══════════════════════════════════════════════════════════════════ */

  .je-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 80px 24px;
    color: var(--je-muted-ink);
    min-height: 300px;
  }

  .je-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid var(--je-ruled-hard);
    border-top-color: var(--je-caret);
    border-radius: 50%;
    display: inline-block;
  }

  .je-spinner--sm {
    width: 14px;
    height: 14px;
    border-width: 2px;
    border-color: color-mix(in srgb, var(--je-ink) 20%, transparent);
    border-top-color: var(--je-ink);
  }

  /* ══════════════════════════════════════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════════════════════════════════════ */

  @media (max-width: 720px) {
    .je-entry-header { padding: 24px 16px 0 16px; }
    .je-date-primary-row { flex-direction: column; gap: 4px; }
    .je-date-day { font-size: 1.25rem; }
    .je-body { background-position: 16px 0; }
    .je-margin-line { left: 16px; }
    .je-margin-space { width: 16px; }
    .je-blocks { padding: 0 16px 16px 12px; }
    .je-bottom-pages { margin: 0 16px; }
    .je-slash-menu { left: 16px !important; }
  }
</style>
