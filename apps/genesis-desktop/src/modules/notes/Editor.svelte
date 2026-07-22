<script lang="ts">
  import { tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Plus, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, CheckSquare, Minus, Bold, Italic, Underline, Strikethrough, Link2, GripVertical, Trash2, Copy, RotateCcw, RotateCw, Search, Link as LinkIcon, Image, Video, AudioLines, Bookmark, Code, Tv, Frame } from 'lucide-svelte';
  import { BlockRenderer } from './components/blocks/index.js';
  import { editorStore, getRootBlocks, getTitleBlock, getFocusedBlock, getBlock, getIsEditorLoading, getObjectId } from '$lib/local-store/store.js';
  import FindInPage from '$lib/components/FindInPage.svelte';
  import BacklinksPanel from '$lib/components/BacklinksPanel.svelte';
  import ExportNote from '$lib/components/ExportNote.svelte';

  let rootBlocks = $derived(getRootBlocks());
  let titleBlock = $derived(getTitleBlock());
  let focusedBlock = $derived(getFocusedBlock());
  let isEditorLoading = $derived(getIsEditorLoading());
  let wordCount = $derived(rootBlocks.reduce((acc, b) => {
    const text = typeof b.content?.text === 'string' ? b.content.text : '';
    return acc + (text.trim() ? text.trim().split(/\s+/).length : 0);
  }, 0));
  let charCount = $derived(rootBlocks.reduce((acc, b) => {
    const text = typeof b.content?.text === 'string' ? b.content.text : '';
    return acc + text.length;
  }, 0));
  import { TextStyle, MarkType, FileType, FileState, BookmarkState, EmbedProcessor } from '$lib/local-store/block.js';
  import type { Block, ContentText, Mark, TextRange } from '$lib/local-store/block.js';
  import { isTextBlock, isTextCode, isTextTitle, isTextDescription, isTextHeader, canHaveMarks } from '$lib/local-store/block.js';

  let { objectId = '', onTitleChange = undefined }: {
    objectId?: string;
    onTitleChange?: (id: string, title: string) => void;
  } = $props();

  import { tooltip } from "$lib/components/Tooltip.svelte";

  // ── Floating UI state ────────────────────────────────────────────
  let showBlockActions = $state<string | null>(null);
  let actionMenuStyle = $state({ top: '0px', left: '0px' });
  let showFormatToolbar = $state(false);
  let formatToolbarStyle = $state({ top: '0px', left: '0px' });
  let formatBlockId = $state<string | null>(null);
  let showColorPicker = $state(false);
  let showHighlightPicker = $state(false);

  const TEXT_COLORS = [
    { id: 'gray', label: 'Gray', color: '#626f86' },
    { id: 'brown', label: 'Brown', color: '#9f6b53' },
    { id: 'orange', label: 'Orange', color: '#d9730d' },
    { id: 'yellow', label: 'Yellow', color: '#cb912f' },
    { id: 'green', label: 'Green', color: '#448361' },
    { id: 'blue', label: 'Blue', color: '#0c66e4' },
    { id: 'purple', label: 'Purple', color: '#7e5bef' },
    { id: 'red', label: 'Red', color: '#e03e3e' },
  ];

  const HIGHLIGHT_COLORS = [
    { id: 'yellow', label: 'Yellow', color: '#f0b429' },
    { id: 'blue', label: 'Blue', color: '#3b9bdc' },
    { id: 'green', label: 'Green', color: '#3ccf8e' },
    { id: 'red', label: 'Red', color: '#f97066' },
  ];
  let showSlashMenu = $state(false);
  let slashMenuStyle = $state({ top: '0px', left: '0px' });
  let slashQuery = $state('');
  let slashMenuIndex = $state(0);
  let slashAnchorBlockId = $state<string | null>(null);
  let showLinkDialog = $state(false);
  let linkUrl = $state('');
  let editorEl = $state<HTMLDivElement>();

  // ── Find in Page state ─────────────────────────────────────────
  let showFindBar = $state(false);
  let findQuery = $state('');
  let findMatches = $state<{ blockId: string; start: number; end: number }[]>([]);
  let findCurrentIndex = $state(0);

  function openFindBar() {
    showFindBar = true;
    findQuery = '';
    findMatches = [];
    findCurrentIndex = 0;
  }

  function closeFindBar() {
    showFindBar = false;
    findQuery = '';
    findMatches = [];
    findCurrentIndex = 0;
    clearFindHighlights();
  }

  async function handleReplace(replaceText: string) {
    if (findMatches.length === 0 || findCurrentIndex < 0) return;
    const match = findMatches[findCurrentIndex];
    const block = getBlock(match.blockId);
    if (!block || !isTextBlock(block)) return;
    const ct = block.content as ContentText;
    const text = ct.text;
    const newText = text.slice(0, match.start) + replaceText + text.slice(match.end);
    const offset = replaceText.length - (match.end - match.start);

    const marks: Mark[] = (ct.marks ?? []).map(m => {
      const { from, to } = m.range;
      if (to <= match.start) return m;
      if (from >= match.end) return { ...m, range: { from: from + offset, to: to + offset } };
      if (from >= match.start && to <= match.end) return null;
      if (from < match.start && to > match.end) return { ...m, range: { from, to: to + offset } };
      if (from < match.start) return { ...m, range: { from, to: match.start } };
      return { ...m, range: { from: match.end + offset, to: to + offset } };
    }).filter(Boolean) as Mark[];

    await editorStore.setBlockText(match.blockId, newText, marks);
    editorStore.syncBlockTextToStore(match.blockId);
    handleFind(findQuery);
    findCurrentIndex = Math.min(findCurrentIndex, findMatches.length - 1);
    if (findMatches.length > 0) scrollToMatch(findCurrentIndex);
  }

  async function handleReplaceAll(replaceText: string) {
    if (findMatches.length === 0) return;
    let lastBlockId = '';
    for (let i = findMatches.length - 1; i >= 0; i--) {
      const match = findMatches[i];
      if (match.blockId !== lastBlockId) {
        editorStore.syncBlockTextToStore(match.blockId);
        lastBlockId = match.blockId;
      }
      const block = getBlock(match.blockId);
      if (!block || !isTextBlock(block)) continue;
      const ct = block.content as ContentText;
      const text = ct.text;
      const queryLen = findQuery.length;
      const newText = text.slice(0, match.start) + replaceText + text.slice(match.end);
      const offset = replaceText.length - queryLen;

      const marks: Mark[] = (ct.marks ?? []).map(m => {
        const { from, to } = m.range;
        if (to <= match.start) return m;
        if (from >= match.end) return { ...m, range: { from: from + offset, to: to + offset } };
        if (from >= match.start && to <= match.end) return null;
        if (from < match.start && to > match.end) return { ...m, range: { from, to: to + offset } };
        if (from < match.start) return { ...m, range: { from, to: match.start } };
        return { ...m, range: { from: match.end + offset, to: to + offset } };
      }).filter(Boolean) as Mark[];

      await editorStore.setBlockText(match.blockId, newText, marks);
    }
    editorStore.syncBlockTextToStore(lastBlockId);
    handleFind(findQuery);
    findCurrentIndex = -1;
  }

  function handleFind(query: string) {
    findQuery = query;
    if (!query.trim()) {
      findMatches = [];
      findCurrentIndex = 0;
      clearFindHighlights();
      return;
    }
    const q = query.toLowerCase();
    const matches: { blockId: string; start: number; end: number }[] = [];

    function collectBlocks(ids: string[]) {
      for (const id of ids) {
        const block = editorStore.getBlock(id);
        if (!block) continue;
        const text = (block.content as ContentText)?.text ?? '';
        const lower = text.toLowerCase();
        let idx = 0;
        while (true) {
          const pos = lower.indexOf(q, idx);
          if (pos === -1) break;
          matches.push({ blockId: block.id!, start: pos, end: pos + q.length });
          idx = pos + 1;
        }
        if (block.childrenIds?.length) collectBlocks(block.childrenIds);
      }
    }
    collectBlocks(rootBlocks.map(b => b.id!).filter(Boolean));

    findMatches = matches;
    findCurrentIndex = matches.length > 0 ? 0 : -1;
    highlightMatches(q);
    if (matches.length > 0) scrollToMatch(0);
  }

  function highlightMatches(query: string) {
    document.querySelectorAll('.find-highlight').forEach(el => {
      const span = el as HTMLSpanElement;
      const parent = span.parentNode;
      if (parent) {
        const text = document.createTextNode(span.textContent || '');
        parent.replaceChild(text, span);
        parent.normalize();
      }
    });
    if (!query) return;
    const blocks = document.querySelectorAll('[data-block-id] .editable');
    blocks.forEach(el => {
      const blockId = el.closest('[data-block-id]')?.getAttribute('data-block-id');
      if (!blockId) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) textNodes.push(node);
      for (const textNode of textNodes) {
        const content = textNode.textContent || '';
        const lower = content.toLowerCase();
        let idx = 0;
        const fragments: (string | HTMLSpanElement)[] = [];
        while (true) {
          const pos = lower.indexOf(query.toLowerCase(), idx);
          if (pos === -1) { fragments.push(content.slice(idx)); break; }
          fragments.push(content.slice(idx, pos));
          const mark = document.createElement('span');
          mark.className = 'find-highlight';
          mark.textContent = content.slice(pos, pos + query.length);
          fragments.push(mark);
          idx = pos + query.length;
        }
        if (fragments.some(f => typeof f !== 'string')) {
          const parent = textNode.parentNode;
          if (!parent) continue;
          const range = document.createRange();
          range.selectNode(textNode);
          range.deleteContents();
          for (const frag of fragments) {
            if (typeof frag === 'string') {
              parent.appendChild(document.createTextNode(frag));
            } else {
              parent.appendChild(frag);
            }
          }
          parent.normalize();
        }
      }
    });
    highlightCurrentMatch();
  }

  function clearFindHighlights() {
    document.querySelectorAll('.find-highlight').forEach(el => {
      const span = el as HTMLSpanElement;
      const parent = span.parentNode;
      if (parent) {
        const text = document.createTextNode(span.textContent || '');
        parent.replaceChild(text, span);
        parent.normalize();
      }
    });
    document.querySelectorAll('.find-highlight-current').forEach(el => {
      el.classList.remove('find-highlight-current');
    });
  }

  function highlightCurrentMatch() {
    document.querySelectorAll('.find-highlight-current').forEach(el => el.classList.remove('find-highlight-current'));
    const match = findMatches[findCurrentIndex];
    if (!match) return;
    const highlights = document.querySelectorAll('.find-highlight');
    let idx = 0;

    function walk(ids: string[]) {
      for (const id of ids) {
        const block = editorStore.getBlock(id);
        if (!block) continue;
        const text = (block.content as ContentText)?.text ?? '';
        const lower = text.toLowerCase();
        let pos = 0;
        while (true) {
          const p = lower.indexOf(findQuery.toLowerCase(), pos);
          if (p === -1) break;
          if (block.id === match.blockId && p === match.start) {
            highlights[idx]?.classList.add('find-highlight-current');
            return true;
          }
          idx++;
          pos = p + 1;
        }
        if (block.childrenIds?.length) {
          if (walk(block.childrenIds)) return true;
        }
      }
      return false;
    }
    walk(rootBlocks.map(b => b.id!).filter(Boolean));
  }

  function scrollToMatch(index: number) {
    const match = findMatches[index];
    if (!match) return;
    const el = document.querySelector(`[data-block-id="${match.blockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function findNext() {
    if (findMatches.length === 0) return;
    findCurrentIndex = (findCurrentIndex + 1) % findMatches.length;
    highlightCurrentMatch();
    scrollToMatch(findCurrentIndex);
  }

  function findPrevious() {
    if (findMatches.length === 0) return;
    findCurrentIndex = (findCurrentIndex - 1 + findMatches.length) % findMatches.length;
    highlightCurrentMatch();
    scrollToMatch(findCurrentIndex);
  }

  // ── Backlinks panel state ────────────────────────────────────
  let showBacklinks = $state(false);

  function toggleBacklinks() {
    showBacklinks = !showBacklinks;
  }

  function handleBacklinkNavigate(id: string) {
    showBacklinks = false;
    // Reload the editor with the target note
    window.dispatchEvent(new CustomEvent('command:open-note', { detail: { id } }));
  }

  // ── Wiki link indexing ────────────────────────────────────────
  async function indexWikilinks() {
    if (!objectId) return;
    try {
      await invoke('notes_index_wikilinks', { noteId: objectId });
    } catch (err) {
      // Non-critical, links will be resolved on next save
    }
  }

  // ── Undo/Redo ──────────────────────────────────────────────────
  async function handleUndo() {
    if (!objectId) return;
    try {
      await invoke('notes_undo', { noteId: objectId });
      await editorStore.init(objectId, 'notes', false, true);
    } catch (err) {
      console.error('[notes] undo failed:', err);
    }
  }

  async function handleRedo() {
    if (!objectId) return;
    try {
      await invoke('notes_redo', { noteId: objectId });
      await editorStore.init(objectId, 'notes', false, true);
    } catch (err) {
      console.error('[notes] redo failed:', err);
    }
  }

  // ── Drag reorder state ──────────────────────────────────────────
  let dragBlockId = $state<string | null>(null);
  let dragOverBlockId = $state<string | null>(null);
  let dragOverPos = $state<'top' | 'bottom'>('bottom');

  function onDragStart(e: DragEvent, blockId: string) {
    dragBlockId = blockId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);
    }
  }

  function onDragOver(e: DragEvent, blockId: string) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    dragOverBlockId = blockId;
    const el = (e.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    dragOverPos = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
  }

  function onDragLeave() {
    dragOverBlockId = null;
  }

  async function onDrop(e: DragEvent, targetBlockId: string) {
    e.preventDefault();
    const sourceId = dragBlockId;
    dragBlockId = null;
    dragOverBlockId = null;
    if (!sourceId || sourceId === targetBlockId) return;

    // Compute new index
    const ids = rootBlocks.map(b => b.id!);
    const fromIdx = ids.indexOf(sourceId);
    let toIdx = ids.indexOf(targetBlockId);
    if (dragOverPos === 'bottom') toIdx += 1;
    if (fromIdx === -1 || toIdx === -1) return;
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
    await editorStore.moveBlock(sourceId, adjusted);
  }

  function onDragEnd() {
    dragBlockId = null;
    dragOverBlockId = null;
  }

  // ── Slash command definitions ────────────────────────────────────
  const SLASH_COMMANDS = [
    { type: 'paragraph', icon: Plus, label: 'Text', style: TextStyle.Paragraph },
    { type: 'h1', icon: Heading1, label: 'Heading 1', style: TextStyle.Header1 },
    { type: 'h2', icon: Heading2, label: 'Heading 2', style: TextStyle.Header2 },
    { type: 'h3', icon: Heading3, label: 'Heading 3', style: TextStyle.Header3 },
    { type: 'h4', icon: Heading3, label: 'Heading 4', style: TextStyle.Header4 },
    { type: 'bullet', icon: List, label: 'Bulleted list', style: TextStyle.Bulleted },
    { type: 'numbered', icon: ListOrdered, label: 'Numbered list', style: TextStyle.Numbered },
    { type: 'todo', icon: CheckSquare, label: 'To-do list', style: TextStyle.Checkbox },
    { type: 'toggle', icon: CheckSquare, label: 'Toggle', style: TextStyle.Toggle },
    { type: 'quote', icon: Quote, label: 'Quote', style: TextStyle.Quote },
    { type: 'callout', icon: Quote, label: 'Callout', style: TextStyle.Callout },
    { type: 'code', icon: Code2, label: 'Code block', style: TextStyle.Code },
    { type: 'divider', icon: Minus, label: 'Divider', style: null },
    { type: 'table', icon: List, label: 'Table', style: null },
    { type: 'image', icon: Image, label: 'Image', style: null },
    { type: 'video', icon: Video, label: 'Video', style: null },
    { type: 'audio', icon: AudioLines, label: 'Audio', style: null },
    { type: 'bookmark', icon: Bookmark, label: 'Bookmark', style: null },
    { type: 'embed', icon: Code, label: 'LaTeX equation', style: null },
    { type: 'mermaid', icon: Frame, label: 'Mermaid diagram', style: null },
    { type: 'youtube', icon: Tv, label: 'YouTube video', style: null },
  ];

  let filteredCommands = $derived.by(() => {
    if (!slashQuery) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().includes(slashQuery.toLowerCase()));
  });

  let loadedObjectId = '';

  // Anytype pattern (page.tsx useEffect([rootId])): re-init whenever objectId
  // changes to a value the store doesn't already hold.
  $effect(() => {
    const id = objectId;
    if (!id) return;
    const storeId = getObjectId();
    if (id === loadedObjectId && storeId === id) return;
    loadedObjectId = id;
    showBlockActions = null;
    showFormatToolbar = false;
    formatBlockId = null;
    showSlashMenu = false;
    slashQuery = '';
    slashMenuIndex = 0;
    slashAnchorBlockId = null;
    showFindBar = false;
    findQuery = '';
    findMatches = [];
    void editorStore.init(id);
  });

  // ── Global keyboard shortcuts ──────────────────────────────────
  $effect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'f' && !e.shiftKey) {
        if (objectId) {
          e.preventDefault();
          openFindBar();
        }
        return;
      }
      if (isMod && e.key === 'z' && !e.shiftKey) {
        if (objectId) {
          e.preventDefault();
          void handleUndo();
        }
        return;
      }
      if (isMod && e.key === 'z' && e.shiftKey) {
        if (objectId) {
          e.preventDefault();
          void handleRedo();
        }
        return;
      }
      if (isMod && e.key === 'y') {
        if (objectId) {
          e.preventDefault();
          void handleRedo();
        }
        return;
      }
    }

    function handleCommandFind() {
      if (objectId) openFindBar();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('command:find', handleCommandFind);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('command:find', handleCommandFind);
    };
  });

  // ── DOM focus helper ──────────────────────────────────────────────
  async function focusBlockElement(blockId: string, cursorPos: number = 0) {
    await tick();
    const el = document.querySelector<HTMLElement>(
      `[data-block-id="${blockId}"] .editable`,
    );
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
      if (charIndex <= cursorPos && cursorPos <= nextIndex) {
        range.setStart(node, cursorPos - charIndex);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      charIndex = nextIndex;
    }
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleEditorMouseDown(e: MouseEvent) {
    const target = e.target as Element;
    if (!editorEl?.contains(target)) {
      if (showSlashMenu) showSlashMenu = false;
      if (showBlockActions) showBlockActions = null;
      if (showFormatToolbar) showFormatToolbar = false;
      return;
    }
    if (showSlashMenu && !target.closest?.('.slash-menu')) showSlashMenu = false;
    if (showBlockActions && !target.closest?.('.block-actions')) showBlockActions = null;
    if (showFormatToolbar && !target.closest?.('.format-toolbar')) showFormatToolbar = false;
  }

  function handlePopupKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showSlashMenu = false;
      showBlockActions = null;
      showFormatToolbar = false;
      e.stopPropagation();
    }
  }

  function handleFocus(e?: any) {}

  function handleBlur() {
    editorStore.blurBlock();
  }

  function handleUpdate(blockId: string, text: string, marks: Mark[]) {
    if (!blockId) return;
    editorStore.persistBlockText(blockId, text, marks);
    if (titleBlock?.id === blockId && onTitleChange) {
      onTitleChange(objectId, text);
      void invoke('notes_object_update', { params: { id: objectId, title: text } })
        .catch((err) => console.error('[notes] title update failed:', err));
    }
  }

  function handleStyleConvert(blockId: string, style: TextStyle) {
    if (!blockId) return;
    editorStore.convertBlockStyle(blockId, style);
  }

  async function handleKeyDown(
    e: any,
    value: string,
    marks: any[],
    range: TextRange,
    props: { block: Block; rootId: string; readonly: boolean },
  ) {
    const { block } = props;
    const blockId = block.id;
    if (!blockId) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = value.slice(0, range.from);
      const after = value.slice(range.from);
      await editorStore.persistBlockText(blockId, before);
      editorStore.syncBlockTextToStore(blockId);
      const newId = await editorStore.addBlock(blockId, after, (block.content as ContentText)?.style);
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
      return;
    }

    if (e.key === 'Backspace' && value === '' && range.from === 0) {
      e.preventDefault();
      if (rootBlocks.length <= 1) return;
      const idx = rootBlocks.findIndex((b) => b.id === blockId);
      if (idx <= 0) return;
      const prev = rootBlocks[idx - 1];
      const prevId = prev.id;
      if (!prevId) return;
      editorStore.syncBlockTextToStore(prevId);
      const freshPrev = editorStore.getBlock(prevId);
      const prevText = (freshPrev?.content as ContentText)?.text ?? '';
      await editorStore.persistBlockText(prevId, prevText + value);
      editorStore.syncBlockTextToStore(prevId);
      await editorStore.deleteBlock(blockId);
      editorStore.focusBlock(prevId);
      focusBlockElement(prevId);
      return;
    }

    if (e.key === 'ArrowUp' && range.from === 0) {
      e.preventDefault();
      const idx = rootBlocks.findIndex((b) => b.id === blockId);
      if (idx > 0) {
        const prevId = rootBlocks[idx - 1].id;
        if (prevId) { editorStore.focusBlock(prevId); focusBlockElement(prevId, ((rootBlocks[idx - 1].content as ContentText)?.text ?? '').length); }
      }
      return;
    }

    if (e.key === 'ArrowDown' && range.from >= value.length) {
      e.preventDefault();
      const idx = rootBlocks.findIndex((b) => b.id === blockId);
      if (idx < rootBlocks.length - 1) {
        const nextId = rootBlocks[idx + 1].id;
        if (nextId) { editorStore.focusBlock(nextId); focusBlockElement(nextId, 0); }
      }
      return;
    }

    if (e.key === 'Escape') {
      if (showSlashMenu) { showSlashMenu = false; return; }
      if (showBlockActions) { showBlockActions = null; return; }
      if (showFormatToolbar) { showFormatToolbar = false; return; }
    }
  }

  function handleKeyUp(e: any, value: string, marks: any[], range: TextRange, props: any) {
    const blockId = props.block?.id;
    if (!blockId) return;
    if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const menuHeight = 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < menuHeight ? `${rect.top - menuHeight - 4}px` : `${rect.bottom + 4}px`;
        slashMenuStyle = { top, left: `${Math.max(8, rect.left)}px` };
      }
      showSlashMenu = true; slashQuery = ''; slashMenuIndex = 0; slashAnchorBlockId = blockId;
      return;
    }
    if (showSlashMenu && slashAnchorBlockId === blockId) {
      const before = value.slice(0, range.from);
      const si = before.lastIndexOf('/');
      if (si >= 0) slashQuery = before.slice(si + 1);
    }
  }

  async function handleSlashSelect(command: typeof SLASH_COMMANDS[0]) {
    if (!slashAnchorBlockId) return;

    // Capture the anchor's position before deleting it
    const anchorIdx = rootBlocks.findIndex(b => b.id === slashAnchorBlockId);
    const afterId = anchorIdx > 0 ? rootBlocks[anchorIdx - 1].id : undefined;

    if (command.type === 'divider') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, { blockType: 'div', content: { style: 0 } });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'table') {
      const defaultCols = [
        { id: 'col-0', width: 160 },
        { id: 'col-1', width: 160 },
        { id: 'col-2', width: 160 },
      ];
      const content = {
        columns: defaultCols,
        rows: [
          { id: 'row-header', isHeader: true, cells: { 'col-0': { text: '' }, 'col-1': { text: '' }, 'col-2': { text: '' } } },
          { id: 'row-0', cells: { 'col-0': { text: '' }, 'col-1': { text: '' }, 'col-2': { text: '' } } },
        ],
      };
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, { blockType: 'table', content });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'image') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'file',
        content: { state: FileState.Empty, type: FileType.Image, targetObjectId: '', name: '', size: 0, mime: '', style: 0 },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'video') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'file',
        content: { state: FileState.Empty, type: FileType.Video, targetObjectId: '', name: '', size: 0, mime: '', style: 0 },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'audio') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'file',
        content: { state: FileState.Empty, type: FileType.Audio, targetObjectId: '', name: '', size: 0, mime: '', style: 0 },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'bookmark') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'bookmark',
        content: { state: BookmarkState.Empty, url: '', targetObjectId: '' },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'embed') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'latex',
        content: { text: '', processor: EmbedProcessor.Latex },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'mermaid') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'latex',
        content: { text: 'graph TD\n    A[Start] --> B[End]', processor: EmbedProcessor.Mermaid },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.type === 'youtube') {
      await editorStore.deleteBlock(slashAnchorBlockId);
      const newId = await editorStore.addBlock(afterId, '', 0, {
        blockType: 'latex',
        content: { text: '', processor: EmbedProcessor.Youtube },
      });
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else if (command.style !== null) {
      const block = editorStore.getBlock(slashAnchorBlockId);
      const content = block && isTextBlock(block) ? (block.content as ContentText).text.replace(/\/.*$/, '').trim() : '';
      if (content === '') {
        await editorStore.convertBlockStyle(slashAnchorBlockId, command.style);
      } else {
        const newId = await editorStore.addBlock(slashAnchorBlockId, '', command.style);
        if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
      }
    } else {
      const newId = await editorStore.addBlock(slashAnchorBlockId, '');
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    }
    showSlashMenu = false; slashAnchorBlockId = null;
  }

  function openBlockActions(blockId: string, e: MouseEvent) {
    e.stopPropagation();
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (el && editorEl) {
      const rect = el.getBoundingClientRect();
      const edRect = editorEl.getBoundingClientRect();
      actionMenuStyle = { top: `${rect.top - edRect.top}px`, left: '-8px' };
    }
    showBlockActions = blockId;
  }

  async function handleDuplicateBlock(blockId: string) {
    await editorStore.duplicateBlock(blockId);
    showBlockActions = null;
  }

  async function handleDeleteBlock(blockId: string) {
    await editorStore.deleteBlock(blockId);
    showBlockActions = null;
  }

  function handleTextSelection(blockId: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !editorEl) { showFormatToolbar = false; return; }
    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
    if (!el) { showFormatToolbar = false; return; }
    if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) {
      showFormatToolbar = false;
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.toString().trim().length === 0) { showFormatToolbar = false; return; }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) { showFormatToolbar = false; return; }
    const toolbarW = 380;
    let left = rect.left + (rect.width / 2) - (toolbarW / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarW - 8));
    formatToolbarStyle = { top: `${rect.top - 48}px`, left: `${left}px` };
    formatBlockId = blockId;
    showFormatToolbar = true;
  }

  let selTimeout: ReturnType<typeof setTimeout>;
  function onSelectionChange() {
    clearTimeout(selTimeout);
    selTimeout = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { showFormatToolbar = false; return; }
      const editable = (sel.anchorNode?.parentElement ?? sel.focusNode?.parentElement)?.closest('.editable');
      if (!editable) { showFormatToolbar = false; return; }
      const blockId = editable.closest('[data-block-id]')?.getAttribute('data-block-id');
      if (!blockId) { showFormatToolbar = false; return; }
      handleTextSelection(blockId);
    }, 100);
  }

  $effect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  });

  async function handleFormatAction(markType: MarkType) {
    if (!formatBlockId) return;
    await editorStore.applyMarkToSelection(formatBlockId, markType);
    showFormatToolbar = false;
  }

  async function handleToolbarFormatAction(markType: MarkType) {
    if (!focusedBlock || !isTextBlock(focusedBlock) || !focusedBlock.id) return;
    // Save selection before focusing the editable
    const savedSel = window.getSelection();
    if (!savedSel || savedSel.isCollapsed || !savedSel.rangeCount) return;
    const savedRange = savedSel.getRangeAt(0);
    const el = document.querySelector(`[data-block-id="${focusedBlock.id}"] .editable`) as HTMLElement | null;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    await editorStore.applyMarkToSelection(focusedBlock.id, markType);
  }

  async function handleColorAction(markType: MarkType, param: string) {
    if (!formatBlockId) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const el = document.querySelector(`[data-block-id="${formatBlockId}"] .editable`);
    if (!el) return;
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    const from = pre.toString().length;
    const to = from + r.toString().length;
    if (from === to) return;
    await editorStore.toggleMark(formatBlockId, markType, { from, to }, param);
    showFormatToolbar = false;
    showColorPicker = false;
    showHighlightPicker = false;
  }

  async function addBlockBelow(blockId?: string) {
    const targetId = blockId ?? rootBlocks[rootBlocks.length - 1]?.id;
    // When targetId is undefined (empty doc), addBlock creates the first block
    const newId = await editorStore.addBlock(targetId);
    if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
  }

  function handleToggle(blockId?: string) {
    if (!blockId) return;
    editorStore.setToggleOpen(blockId, !editorStore.isToggleOpen(blockId));
  }
</script>

<div
  class="notes-editor"
  bind:this={editorEl}
  role="presentation"
  onmousedown={handleEditorMouseDown}
>
  {#if isEditorLoading}
    <div class="editor-loading" style="flex:1;">
      <div class="loading-spinner"></div>
      <p>Loading document...</p>
    </div>
  {:else}
    <div class="editor-scroll">
    <div class="editor-header">
      {#if titleBlock}
        <BlockRenderer block={titleBlock} rootId="root" blockIndex={0}
          onUpdate={handleUpdate} onFocus={handleFocus} onBlur={handleBlur}
          onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}
          onToggle={handleToggle} onStyleConvert={handleStyleConvert} />
      {/if}
    </div>

    {#if showFindBar}
      <FindInPage
        show={showFindBar}
        query={findQuery}
        matchCount={findMatches.length}
        currentMatch={findCurrentIndex}
        onClose={closeFindBar}
        onFind={handleFind}
        onNext={findNext}
        onPrevious={findPrevious}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
      />
    {/if}

    <div class="editor-toolbar">
      <button class="toolbar-btn" onclick={handleUndo} disabled={!objectId} aria-label="Undo" type="button" use:tooltip={{ text: "Undo (Ctrl+Z)" }}>
        <RotateCcw size={14} />
      </button>
      <button class="toolbar-btn" onclick={handleRedo} disabled={!objectId} aria-label="Redo" type="button" use:tooltip={{ text: "Redo (Ctrl+Shift+Z)" }}>
        <RotateCw size={14} />
      </button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onclick={openFindBar} disabled={!objectId} aria-label="Find in note" type="button" use:tooltip={{ text: "Find in note (Ctrl+F)" }}>
        <Search size={14} />
      </button>
      <div class="toolbar-sep"></div>
      {#if focusedBlock && isTextBlock(focusedBlock)}
        <button class="toolbar-btn" type="button" aria-label="Bold" onclick={() => handleToolbarFormatAction(MarkType.Bold)} use:tooltip={{ text: "Bold (Ctrl+B)" }}><Bold size={14} /></button>
        <button class="toolbar-btn" type="button" aria-label="Italic" onclick={() => handleToolbarFormatAction(MarkType.Italic)} use:tooltip={{ text: "Italic (Ctrl+I)" }}><Italic size={14} /></button>
        <button class="toolbar-btn" type="button" aria-label="Underline" onclick={() => handleToolbarFormatAction(MarkType.Underline)} use:tooltip={{ text: "Underline (Ctrl+U)" }}><Underline size={14} /></button>
        <button class="toolbar-btn" type="button" aria-label="Strikethrough" onclick={() => handleToolbarFormatAction(MarkType.Strike)} use:tooltip={{ text: "Strikethrough" }}><Strikethrough size={14} /></button>
        <div class="toolbar-sep"></div>
        <button class="toolbar-btn" type="button" aria-label="Code" onclick={() => handleToolbarFormatAction(MarkType.Code)} use:tooltip={{ text: "Inline Code" }}><Code2 size={14} /></button>
        <button class="toolbar-btn" type="button" aria-label="Link" onclick={() => handleToolbarFormatAction(MarkType.Link)} use:tooltip={{ text: "Link (Ctrl+K)" }}><Link2 size={14} /></button>
        <div class="toolbar-sep"></div>
      {/if}
      <button class="toolbar-btn" onclick={toggleBacklinks} class:active={showBacklinks} disabled={!objectId} aria-label="Backlinks" type="button" use:tooltip={{ text: "Backlinks" }}>
        <LinkIcon size={14} />
      </button>
      <div class="toolbar-sep"></div>
      <ExportNote {objectId} />
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onclick={() => window.dispatchEvent(new CustomEvent('command:toggle-properties'))} disabled={!objectId} aria-label="Properties" type="button" use:tooltip={{ text: "Note properties" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </button>
    </div>

    <div class="editor-blocks">
      {#each rootBlocks as block, i (block.id)}
          <div
            class="block-wrapper"
            class:is-dragging={dragBlockId === block.id}
            class:drag-over-top={dragOverBlockId === block.id && dragOverPos === 'top'}
            class:drag-over-bottom={dragOverBlockId === block.id && dragOverPos === 'bottom'}
            role="listitem"
            aria-label={`Block ${i + 1}`}
            draggable={true}
            ondragstart={(e) => onDragStart(e, block.id!)}
            ondragover={(e) => onDragOver(e, block.id!)}
            ondragleave={onDragLeave}
            ondrop={(e) => onDrop(e, block.id!)}
            ondragend={onDragEnd}
          >
            <div class="block-controls">
              <button class="block-grip" aria-label="Drag to reorder" tabindex="-1" use:tooltip={{ text: "Drag to reorder" }}>
                <GripVertical size={14} />
              </button>
              <button class="block-add-button" onclick={(e) => { e.stopPropagation(); addBlockBelow(block.id); }} aria-label="Add block below" use:tooltip={{ text: "Add block" }}>
                <Plus size={14} />
              </button>
            </div>
            <BlockRenderer {block} rootId="root" blockIndex={i}
              onUpdate={handleUpdate} onFocus={handleFocus} onBlur={handleBlur}
              onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}
              onToggle={handleToggle} onStyleConvert={handleStyleConvert} />
          </div>
      {/each}

      {#if rootBlocks.length === 0}
        <div class="editor-empty">
          <p>Press <kbd>Enter</kbd> to start writing, or use <kbd>/</kbd> for commands</p>
        </div>
      {/if}
    </div>

    </div>

    <div class="editor-footer">
      <span class="editor-stats">{wordCount} words · {charCount} characters</span>
    </div>

    {#if showBacklinks}
      <div class="backlinks-sidebar">
        <BacklinksPanel noteId={objectId} onNavigateTo={handleBacklinkNavigate} onClose={() => showBacklinks = false} />
      </div>
    {/if}

    {#if showSlashMenu}
      <div class="slash-menu" style="top: {slashMenuStyle.top}; left: {slashMenuStyle.left};"
        onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}
        tabindex="0" role="listbox" aria-label="Block type menu">
        <div class="slash-menu-header">Basic Blocks</div>
        <div class="slash-menu-items">
          {#each filteredCommands as cmd, i}
            {const Icon = cmd.icon}
            <button class="slash-menu-item" class:active={i === slashMenuIndex} type="button" onclick={() => handleSlashSelect(cmd)}>
              <span class="slash-menu-item-icon"><Icon size={16} /></span>
              <span class="slash-menu-item-label">{cmd.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if showFormatToolbar}
      <div class="format-toolbar" style="top: {formatToolbarStyle.top}; left: {formatToolbarStyle.left};"
        class:show={showFormatToolbar}
        onclick={(e) => e.stopPropagation()}
        onkeydown={handlePopupKeydown}
        onmousedown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label="Text formatting"
        tabindex="0">
        <button class="format-toolbar-btn" type="button" aria-label="Bold" onclick={() => handleFormatAction(MarkType.Bold)} use:tooltip={{ text: "Bold" }}><Bold size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Italic" onclick={() => handleFormatAction(MarkType.Italic)} use:tooltip={{ text: "Italic" }}><Italic size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Underline" onclick={() => handleFormatAction(MarkType.Underline)} use:tooltip={{ text: "Underline" }}><Underline size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Strikethrough" onclick={() => handleFormatAction(MarkType.Strike)} use:tooltip={{ text: "Strikethrough" }}><Strikethrough size={14} /></button>
        <div class="format-toolbar-sep"></div>
        <button class="format-toolbar-btn" type="button" aria-label="Subscript" onclick={() => handleFormatAction(MarkType.Subscript)} use:tooltip={{ text: "Subscript" }}>X<sub style="font-size:10px">2</sub></button>
        <button class="format-toolbar-btn" type="button" aria-label="Superscript" onclick={() => handleFormatAction(MarkType.Superscript)} use:tooltip={{ text: "Superscript" }}>X<sup style="font-size:10px">2</sup></button>
        <div class="format-toolbar-sep"></div>
        <button class="format-toolbar-btn" type="button" aria-label="Code" onclick={() => handleFormatAction(MarkType.Code)} use:tooltip={{ text: "Code" }}><Code2 size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Link" onclick={() => handleFormatAction(MarkType.Link)} use:tooltip={{ text: "Link" }}><Link2 size={14} /></button>
        <div class="format-toolbar-sep"></div>
        <div class="color-btn-wrap">
          <button class="format-toolbar-btn" type="button" aria-label="Text color" onclick={() => { showColorPicker = !showColorPicker; showHighlightPicker = false; }} use:tooltip={{ text: "Text color" }}>
            <span style="width:14px;height:14px;display:grid;place-items:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M12 3L5.5 21M12 3l6.5 18M8.5 15h7"/></svg></span>
          </button>
          {#if showColorPicker}
            <div class="color-picker-popup">
              {#each TEXT_COLORS as c}
                <button class="color-swatch" style="background:{c.color}" title={c.label} onclick={() => handleColorAction(MarkType.Color, c.id)} type="button"></button>
              {/each}
              <button class="color-swatch" style="background:transparent;border:1px dashed var(--muted);" title="Remove color" onclick={() => handleColorAction(MarkType.Color, '')} type="button"><span style="color:var(--muted);font-size:10px;">✕</span></button>
            </div>
          {/if}
        </div>
        <div class="color-btn-wrap">
          <button class="format-toolbar-btn" type="button" aria-label="Highlight" onclick={() => { showHighlightPicker = !showHighlightPicker; showColorPicker = false; }} use:tooltip={{ text: "Highlight" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M3 21l2-2 3-3 4-4 4-4 3-3-2-2-3 3-4 4-4 4-3 3z"/></svg>
          </button>
          {#if showHighlightPicker}
            <div class="color-picker-popup">
              {#each HIGHLIGHT_COLORS as c}
                <button class="color-swatch" style="background:{c.color}" title={c.label} onclick={() => handleColorAction(MarkType.BgColor, c.id)} type="button"></button>
              {/each}
              <button class="color-swatch" style="background:transparent;border:1px dashed var(--muted);" title="Remove highlight" onclick={() => handleColorAction(MarkType.BgColor, '')} type="button"><span style="color:var(--muted);font-size:10px;">✕</span></button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if showBlockActions}
      <div class="block-actions" style="top: {actionMenuStyle.top}; left: {actionMenuStyle.left};"
        onclick={(e) => e.stopPropagation()}
        onkeydown={handlePopupKeydown}
        onmousedown={(e) => e.preventDefault()}
        role="menu"
        aria-label="Block actions"
        tabindex="0">
        <button class="block-actions-btn" type="button" onclick={() => handleDuplicateBlock(showBlockActions!)}>
          <Copy size={14} /><span>Duplicate</span>
        </button>
        <button class="block-actions-btn danger" type="button" onclick={() => handleDeleteBlock(showBlockActions!)}>
          <Trash2 size={14} /><span>Delete</span>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .notes-editor {
    display: flex;
    flex-direction: row;
    gap: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .editor-scroll {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
    max-width: 740px;
    margin: 0 auto;
    padding: 40px 32px 120px 80px;
    overflow-y: auto;
    height: 100%;
  }

  .backlinks-sidebar {
    width: 240px;
    flex-shrink: 0;
    border-left: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    overflow-y: auto;
    animation: slide-in-right 0.15s ease;
  }

  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .editor-header { margin-bottom: 8px; }
  .editor-description { margin-bottom: 16px; opacity: 0.7; }
  .editor-blocks { display: flex; flex-direction: column; gap: 2px; }
  .block-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    width: 100%;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .block-wrapper.is-dragging { opacity: 0.4; }
  .block-wrapper.drag-over-top { box-shadow: 0 -2px 0 var(--primary); }
  .block-wrapper.drag-over-bottom { box-shadow: 0 2px 0 var(--primary); }
  .block-controls {
    position: absolute;
    left: -56px;
    top: 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    opacity: 0;
    transition: opacity 0.12s;
    pointer-events: none;
  }
  .block-wrapper:hover .block-controls { opacity: 1; pointer-events: all; }
  .block-grip {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 5px; border: none;
    background: transparent; color: var(--muted); cursor: grab;
    transition: background 0.12s, color 0.12s;
  }
  .block-grip:active { cursor: grabbing; }
  .block-grip:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .block-add-button {
    display: flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 4px; border: none;
    background: transparent; color: color-mix(in srgb, var(--foreground) 35%, transparent); cursor: pointer;
    transition: background 0.12s, color 0.12s;
    opacity: 0.5;
  }
  .block-add-button:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); opacity: 1; }
  .editor-empty { display: flex; align-items: center; justify-content: center; padding: 60px 24px; color: var(--muted); font-size: 0.95rem; text-align: center; }
  .editor-empty kbd { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); font-family: inherit; font-size: 0.85rem; color: var(--foreground); }
  .editor-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; gap: 16px; color: var(--muted); }
  .loading-spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
    .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .toolbar-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .toolbar-btn:disabled { opacity: 0.3; cursor: default; }
  .toolbar-btn.active { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
  .toolbar-sep { width: 1px; height: 18px; background: color-mix(in srgb, var(--foreground) 6%, transparent); margin: 0 4px; }

  .editor-blocks :global([contenteditable]) { font-family: var(--notes-body-font, 'Instrument Serif', serif); font-size: 16px; font-weight: 400; line-height: 1.75; }
  .editor-blocks :global(code), .editor-blocks :global(pre) { font-family: var(--font-mono, 'JetBrains Mono Variable', ui-monospace, monospace); font-size: 13px; }
  .editor-blocks :global(.find-highlight) { background: color-mix(in srgb, var(--primary) 30%, transparent); border-radius: 2px; }
  .editor-blocks :global(.find-highlight-current) { background: color-mix(in srgb, var(--primary) 60%, transparent); }
  .slash-menu { position: fixed; z-index: 9999; width: 260px; background: var(--background); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
  .slash-menu-header { padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid var(--border); }
  .slash-menu-items { display: flex; flex-direction: column; padding: 4px; max-height: 300px; overflow-y: auto; scrollbar-width: thin; }
  .slash-menu-items::-webkit-scrollbar { width: 4px; }
  .slash-menu-items::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--foreground) 15%, transparent); border-radius: 2px; }
  .slash-menu-item { all: unset; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; cursor: default; font-size: 13px; color: var(--foreground); transition: background 120ms ease; }
  .slash-menu-item:hover, .slash-menu-item.active { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .slash-menu-item-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: color-mix(in srgb, var(--foreground) 4%, transparent); color: var(--muted); flex-shrink: 0; }
  .slash-menu-item-label { flex: 1; }
  .format-toolbar { position: fixed; z-index: 9999; display: flex; align-items: center; gap: 2px; padding: 4px 6px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateX(-50%); }
  .format-toolbar-btn { all: unset; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 4px; cursor: default; color: var(--muted); transition: background 120ms ease, color 120ms ease; }
  .format-toolbar-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .format-toolbar-sep { width: 1px; height: 20px; background: var(--border); margin: 0 2px; }
  .color-btn-wrap { position: relative; }
  .color-picker-popup { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; display: flex; gap: 2px; padding: 4px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 10; }
  .color-swatch { width: 20px; height: 20px; border: none; border-radius: 4px; cursor: pointer; display: grid; place-items: center; transition: transform 80ms ease; }
  .color-swatch:hover { transform: scale(1.2); }
  .block-actions { position: absolute; z-index: 100; display: flex; flex-direction: column; gap: 2px; padding: 4px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); min-width: 120px; }
  .block-actions-btn { all: unset; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 4px; cursor: default; font-size: 13px; color: var(--foreground); transition: background 120ms ease; }
  .block-actions-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .block-actions-btn.danger { color: var(--destructive); }
  .block-actions-btn.danger:hover { background: color-mix(in srgb, var(--destructive) 10%, transparent); }
  .editor-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; padding: 4px 16px; border-top: 1px solid color-mix(in srgb, var(--foreground) 4%, transparent); }
  .editor-stats { font-size: 11px; color: color-mix(in srgb, var(--foreground) 30%, transparent); }
</style>
