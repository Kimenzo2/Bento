<script lang="ts">
  import type { Block, BlockType, TextMark } from '$lib/editor-block';
  import { emptyBlock, uid } from '$lib/editor-block';

  // ── Props ───────────────────────────────────────────────────────
  let {
    blocks = $bindable([emptyBlock()]),
    streak = 0,
    todayLabel = '',
    dayOfYear = 0,
    isSaving = $bindable(false),
    saved = $bindable(false),
    t = (k: string) => k,
    onsave = () => {},
    onclear = () => {},
  }: {
    blocks?: Block[];
    streak?: number;
    todayLabel?: string;
    dayOfYear?: number;
    isSaving?: boolean;
    saved?: boolean;
    t?: (key: string) => string;
    onsave?: () => void;
    onclear?: () => void;
  } = $props();

  // ── Internal state ──────────────────────────────────────────────
  let blockRefs = $state<Map<string, HTMLDivElement>>(new Map());

  // Floating toolbar
  let showToolbar = $state(false);
  let toolbarPos = $state({ top: 0, left: 0 });

  // Slash menu
  let showSlash = $state(false);
  let slashIdx = $state(0);
  let slashBlockId = $state<string | null>(null);
  let slashPos = $state({ top: 0, left: 0 });
  let slashSearch = $state('');

  // Composition (IME) state
  let isComposing = $state(false);

  // Draft auto-save
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let draftSaved = $state(false);

  // ── Slash menu items ────────────────────────────────────────────
  const slashItems = [
    { type: 'p' as const, label: 'Text', icon: 'A', desc: 'Plain paragraph' },
    { type: 'h1' as const, label: 'Heading 1', icon: 'H1', desc: 'Large heading' },
    { type: 'h2' as const, label: 'Heading 2', icon: 'H2', desc: 'Medium heading' },
    { type: 'h3' as const, label: 'Heading 3', icon: 'H3', desc: 'Small heading' },
    { type: 'bullet' as const, label: 'Bullet List', icon: '•', desc: 'Bulleted list' },
    { type: 'number' as const, label: 'Numbered List', icon: '1.', desc: 'Numbered list' },
    { type: 'toggle' as const, label: 'Toggle', icon: '▸', desc: 'Collapsible item' },
    { type: 'quote' as const, label: 'Quote', icon: '"', desc: 'Blockquote' },
    { type: 'code' as const, label: 'Code', icon: '<>', desc: 'Code block' },
    { type: 'checkbox' as const, label: 'Checkbox', icon: '☐', desc: 'Task item' },
    { type: 'divider' as const, label: 'Divider', icon: '—', desc: 'Horizontal rule' },
  ];

  let filteredSlashItems = $derived(
    slashSearch
      ? slashItems.filter(i => i.label.toLowerCase().includes(slashSearch.toLowerCase()))
      : slashItems
  );

  // ── Word / char count ─────────────────────────────────────────────
  let wordCount = $derived.by(() => {
    const text = blocks.map(b => b.text).join(' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
  });
  let charCount = $derived(blocks.reduce((a, b) => a + b.text.length, 0));

  // ── HTML utilities ──────────────────────────────────────────────
  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function markTag(m: TextMark, close: boolean): string {
    if (close) {
      switch (m.type) {
        case 'B': return '</strong>';
        case 'I': return '</em>';
        case 'U': return '</u>';
        case 'S': return '</s>';
        case 'A': return '</a>';
      }
    }
    switch (m.type) {
      case 'B': return '<strong>';
      case 'I': return '<em>';
      case 'U': return '<u>';
      case 'S': return '<s>';
      case 'A': return `<a href="${escHtml(m.href || '')}" rel="noopener" target="_blank">`;
    }
  }

  // ── Render text + marks → HTML ──────────────────────────────────
  function renderBlockText(text: string, marks: TextMark[]): string {
    if (!text) return '';
    if (!marks.length) return escHtml(text);

    const sorted = [...marks].sort((a, b) => a.from - b.from || b.to - a.to);

    const events: Array<{ pos: number; mark: TextMark; type: 'open' | 'close' }> = [];
    for (const m of sorted) {
      if (m.from < m.to) {
        events.push({ pos: m.from, mark: m, type: 'open' });
        events.push({ pos: m.to, mark: m, type: 'close' });
      }
    }
    events.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

    let html = '';
    let pos = 0;
    const stack: TextMark[] = [];

    for (const ev of events) {
      if (ev.pos > pos) {
        html += escHtml(text.slice(pos, ev.pos));
        pos = ev.pos;
      }
      if (ev.type === 'open') {
        stack.push(ev.mark);
        html += markTag(ev.mark, false);
      } else {
        const idx = stack.findIndex(m => m === ev.mark);
        if (idx !== -1) {
          const above = stack.splice(idx + 1);
          const current = stack.pop()!;
          for (const am of above) html += markTag(am, true);
          html += markTag(current, true);
          for (const am of above) html += markTag(am, false);
          for (const am of above) stack.push(am);
        }
      }
    }

    if (pos < text.length) html += escHtml(text.slice(pos));
    for (const m of [...stack].reverse()) html += markTag(m, true);
    return html;
  }

  // ── Extract text + marks from DOM ───────────────────────────────
  function extractTextAndMarks(el: HTMLElement): { text: string; marks: TextMark[] } {
    let text = '';
    const marks: TextMark[] = [];

    function walk(node: Node, offset: number): number {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent || '';
        text += content;
        return offset + content.length;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tag = element.tagName.toLowerCase();
        const startOff = offset;
        for (const child of element.childNodes) offset = walk(child, offset);
        const mt = tag === 'strong' || tag === 'b' ? 'B' as const :
                   tag === 'em' || tag === 'i' ? 'I' as const :
                   tag === 'u' ? 'U' as const :
                   tag === 's' || tag === 'strike' ? 'S' as const :
                   tag === 'a' ? 'A' as const : null;
        if (mt && offset > startOff) {
          const href = tag === 'a' ? (element as HTMLAnchorElement).href : undefined;
          marks.push({ from: startOff, to: offset, type: mt, ...(href ? { href } : {}) });
        }
      }
      return offset;
    }

    walk(el, 0);

    // Merge adjacent identical marks
    const merged: TextMark[] = [];
    for (const m of marks) {
      const prev = merged[merged.length - 1];
      if (prev && prev.type === m.type && prev.to === m.from && prev.href === m.href) {
        prev.to = m.to;
      } else {
        merged.push({ ...m });
      }
    }

    return { text, marks: merged };
  }

  // ── Cursor offset utilities ─────────────────────────────────────
  function domToTextOffset(el: HTMLElement, node: Node, offset: number): number {
    let total = 0;
    let found = false;
    function walk(n: Node): void {
      if (found) return;
      if (n.nodeType === Node.TEXT_NODE) {
        const len = (n.textContent || '').length;
        if (n === node) { total += Math.min(offset, len); found = true; }
        else total += len;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        for (const child of n.childNodes) { walk(child); if (found) return; }
      }
    }
    walk(el);
    return total;
  }

  function textOffsetsToSelection(el: HTMLElement, from: number, to: number): void {
    let acc = 0;
    let found = false;
    function walk(n: Node): boolean {
      if (found) return true;
      if (n.nodeType === Node.TEXT_NODE) {
        const len = (n.textContent || '').length;
        const next = acc + len;
        if (from <= next && to >= acc) {
          const range = document.createRange();
          range.setStart(n, Math.max(0, Math.min(from - acc, len)));
          range.setEnd(n, Math.max(0, Math.min(to - acc, len)));
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          found = true; return true;
        }
        acc = next;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        for (const child of n.childNodes) { if (walk(child)) return true; }
      }
      return false;
    }
    walk(el);
  }

  function selectEnd(el: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
  }

  // ── Toggle a mark at given text offsets ─────────────────────────
  function toggleMark(block: Block, type: TextMark['type'], from: number, to: number, href?: string): Block {
    if (from >= to) return block;

    const existing = block.marks.findIndex(m => m.from === from && m.to === to && m.type === type && m.href === href);
    if (existing !== -1) {
      return { ...block, marks: block.marks.filter((_, i) => i !== existing) };
    }

    let marks = block.marks.filter(m => !(m.type === type && m.from >= from && m.to <= to));
    marks.push({ from, to, type, ...(href ? { href } : {}) });
    return { ...block, marks };
  }

  // ── Render block as innerHTML (use:action) ──────────────────────
  function initBlock(node: HTMLDivElement, block: Block) {
    const html = renderBlockText(block.text, block.marks);
    if (node.innerHTML !== html) node.innerHTML = html;
    blockRefs.set(block.id, node);
    return {
      update(newBlock: Block) {
        const newHtml = renderBlockText(newBlock.text, newBlock.marks);
        if (newHtml !== node.innerHTML) {
          const sel = window.getSelection();
          const wasFocused = sel && sel.rangeCount > 0 && node.contains(sel.anchorNode);
          let from = -1, to = -1;
          if (wasFocused) {
            from = domToTextOffset(node, sel!.anchorNode!, sel!.anchorOffset);
            to = domToTextOffset(node, sel!.focusNode!, sel!.focusOffset);
          }
          node.innerHTML = newHtml;
          if (wasFocused && from >= 0) {
            textOffsetsToSelection(node, Math.min(from, to), Math.max(from, to));
          }
        }
        if (newBlock.id !== block.id) {
          blockRefs.delete(block.id);
          blockRefs.set(newBlock.id, node);
          block = newBlock;
        }
      },
      destroy() { blockRefs.delete(block.id); }
    };
  }

  // ── Floating toolbar: range-based formatting ────────────────────
  function onMouseUp(e: MouseEvent) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      showToolbar = false;
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { showToolbar = false; return; }
    const blockEl = (e.target as HTMLElement).closest('[data-block-id]') as HTMLElement | null;
    if (!blockEl) { showToolbar = false; return; }
    const writeEl = blockEl.closest('.j-write');
    if (!writeEl) { showToolbar = false; return; }
    const wr = writeEl.getBoundingClientRect();
    toolbarPos = { top: rect.top - wr.top - 44, left: rect.left + rect.width / 2 - wr.left };
    showToolbar = true;
  }

  function hideToolbar() { setTimeout(() => { showToolbar = false; }, 200); }

  function applyFormatToSelection(type: TextMark['type'], href?: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const blockEl = sel.anchorNode?.parentElement?.closest('[data-block-id]') as HTMLElement | null;
    if (!blockEl) return;
    const blockId = blockEl.dataset.blockId;
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;

    const from = domToTextOffset(blockEl, sel.anchorNode!, sel.anchorOffset);
    const to = domToTextOffset(blockEl, sel.focusNode!, sel.focusOffset);

    blocks[idx] = toggleMark(blocks[idx], type, Math.min(from, to), Math.max(from, to), href);

    blockEl.focus();
    textOffsetsToSelection(blockEl, Math.min(from, to), Math.max(from, to));
    showToolbar = false;
  }

  // ── Block input: sync text + marks from DOM ─────────────────────
  function onBlockInput(idx: number) {
    const el = blockRefs.get(blocks[idx].id);
    if (!el || isComposing) return;
    const { text, marks } = extractTextAndMarks(el);
    if (text !== blocks[idx].text || JSON.stringify(marks) !== JSON.stringify(blocks[idx].marks)) {
      blocks[idx] = { ...blocks[idx], text, marks };
    }
    // Auto-save draft (debounced)
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        localStorage.setItem('journal-draft', JSON.stringify(blocks));
        draftSaved = true;
        setTimeout(() => draftSaved = false, 2000);
      } catch { /* quota exceeded */ }
    }, 2000);
  }

  // ── Composition (IME) handling ──────────────────────────────────
  function onCompositionStart() { isComposing = true; }
  function onCompositionEnd(idx: number) {
    isComposing = false;
    onBlockInput(idx);
  }

  // ── Paste handling: strip formatting ────────────────────────────
  function onBlockPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }

  // ── Block keyboard navigation ───────────────────────────────────
  function onBlockKeydown(idx: number, e: KeyboardEvent) {
    const block = blocks[idx];
    const el = blockRefs.get(block.id);
    if (!el) return;

    // Ctrl shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); applyFormatToSelection('B'); return; }
      if (e.key === 'i') { e.preventDefault(); applyFormatToSelection('I'); return; }
      if (e.key === 'k') {
        e.preventDefault();
        const savedSel = window.getSelection();
        const savedRange = savedSel?.rangeCount ? savedSel.getRangeAt(0) : null;
        const url = prompt('Enter link URL:');
        if (url && isUrl(url)) {
          if (savedRange) {
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(savedRange); }
          }
          applyFormatToSelection('A', url);
        }
        return;
      }
    }

    if (e.key === 'Escape') { showToolbar = false; showSlash = false; return; }

    // ── Slash menu keyboard navigation ────────────────────────
    if (showSlash) {
      const items = filteredSlashItems;
      if (e.key === 'ArrowDown') { e.preventDefault(); slashIdx = Math.min(slashIdx + 1, items.length - 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); slashIdx = Math.max(slashIdx - 1, 0); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (items[slashIdx]) applySlash(items[slashIdx].type); return; }
      if (e.key === 'Escape') { e.preventDefault(); showSlash = false; return; }
      if (e.key.length === 1) { slashSearch += e.key; return; }
      if (e.key === 'Backspace') { slashSearch = slashSearch.slice(0, -1); return; }
      return;
    }

    // Toggle for checkbox
    if (block.type === 'checkbox' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      blocks[idx] = { ...block, checked: !block.checked };
      return;
    }

    // ── Tab: indent / outdent list items ────────────────────────
    if (e.key === 'Tab') {
      const listTypes = new Set(['bullet', 'number', 'checkbox']);
      if (listTypes.has(block.type)) {
        e.preventDefault();
        const currentLevel = block.level || 0;
        if (e.shiftKey) {
          if (currentLevel > 0) {
            blocks[idx] = { ...block, level: currentLevel - 1 };
          }
        } else {
          if (currentLevel < 5) {
            blocks[idx] = { ...block, level: currentLevel + 1 };
          }
        }
        return;
      }
    }

    // ── Slash trigger: '/' at start of empty block ────────────
    if (e.key === '/' && !isComposing && el.innerText.trim() === '') {
      e.preventDefault();
      slashBlockId = block.id;
      slashIdx = 0;
      slashSearch = '';
      const rect = el.getBoundingClientRect();
      const writeEl = el.closest('.j-write');
      const wr = writeEl?.getBoundingClientRect();
      slashPos = { top: (wr ? rect.top - wr.top : 0) + 28, left: 8 };
      showSlash = true;
      blocks[idx] = { ...block, text: '', marks: [] };
      return;
    }

    // ── Enter: split block ───────────────────────────────────
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      let splitAt = block.text.length;
      if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
        splitAt = domToTextOffset(el, sel.anchorNode!, sel.anchorOffset);
      }

      const beforeText = block.text.slice(0, splitAt);
      const afterText = block.text.slice(splitAt);

      const beforeMarks = block.marks
        .filter(m => m.from < splitAt)
        .map(m => ({ ...m, to: Math.min(m.to, splitAt) }));
      const afterMarks = block.marks
        .filter(m => m.to > splitAt)
        .map(m => ({ from: Math.max(0, m.from - splitAt), to: m.to - splitAt, type: m.type, ...(m.href ? { href: m.href } : {}) }));

      blocks[idx] = { ...block, text: beforeText, marks: beforeMarks };

      const newType = block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? 'p' : block.type === 'checkbox' ? 'checkbox' : block.type === 'bullet' ? 'bullet' : block.type === 'number' ? 'number' : 'p';
      const newBlock: Block = { id: uid(), type: newType, text: afterText, marks: afterMarks, checked: false, level: block.level || 0 };
      blocks = [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];

      requestAnimationFrame(() => {
        const newEl = blockRefs.get(newBlock.id);
        if (newEl) { newEl.focus(); selectEnd(newEl); }
      });
      return;
    }

    // ── Backspace on empty block ──────────────────────────────
    if (e.key === 'Backspace' && blocks.length > 1 && !block.text) {
      e.preventDefault();
      const prevBlock = blocks[idx - 1];
      blocks = blocks.filter((_, i) => i !== idx);
      showSlash = false;
      requestAnimationFrame(() => {
        const prevEl = blockRefs.get(prevBlock.id);
        if (prevEl) { prevEl.focus(); selectEnd(prevEl); }
      });
      return;
    }

    // ── Arrow up/down: navigate between blocks ───────────────
    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      const prev = blockRefs.get(blocks[idx - 1].id);
      if (prev) { prev.focus(); selectEnd(prev); }
      return;
    }
    if (e.key === 'ArrowDown' && idx < blocks.length - 1) {
      e.preventDefault();
      const next = blockRefs.get(blocks[idx + 1].id);
      if (next) { next.focus(); selectEnd(next); }
      return;
    }
  }

  // ── Apply slash command ─────────────────────────────────────────
  function applySlash(type: BlockType) {
    if (!slashBlockId) return;
    const idx = blocks.findIndex(b => b.id === slashBlockId);
    if (idx === -1) return;

    if (type === 'divider') {
      blocks = [
        ...blocks.slice(0, idx),
        { id: uid(), type: 'divider', text: '', marks: [], checked: false, level: 0 },
        { id: uid(), type: 'p', text: '', marks: [], checked: false, level: 0 },
        ...blocks.slice(idx + 1),
      ];
    } else {
      blocks[idx] = { ...blocks[idx], type };
    }

    showSlash = false;
    requestAnimationFrame(() => {
      const targetId = type === 'divider' ? blocks[idx + 1]?.id : slashBlockId;
      const el = blockRefs.get(targetId || slashBlockId!);
      if (el) { el.focus(); selectEnd(el); }
    });
    slashBlockId = null;
  }

  // ── Clear blocks (exposed to parent via onclear) ────────────────
  function handleClear() {
    blocks = [emptyBlock()];
    try { localStorage.removeItem('journal-draft'); } catch { /* ignore */ }
    onclear();
  }
</script>

<div class="j-write">
  <!-- Minimal header -->
  <div class="j-write-header">
    <div>
      <h2 class="j-write-title">{todayLabel}</h2>
      <p class="j-write-sub">{t('moduleJournalDayOfYear')} {dayOfYear}</p>
    </div>
    <div class="j-streak-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      {streak} {t('moduleJournalDayStreak')}
    </div>
  </div>

  <!-- Floating format toolbar -->
  {#if showToolbar}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="j-floating-toolbar"
    style="top: {toolbarPos.top}px; left: {toolbarPos.left}px;"
    onclick={(e) => e.stopPropagation()}
    onmouseleave={hideToolbar}
    role="toolbar"
    aria-label="Formatting toolbar"
    tabindex="-1"
  >
    <button class="j-fmt-btn" onclick={() => applyFormatToSelection('B')} title="Bold (Ctrl+B)"><strong>B</strong></button>
    <button class="j-fmt-btn" onclick={() => applyFormatToSelection('I')} title="Italic (Ctrl+I)"><em>I</em></button>
    <button class="j-fmt-btn" onclick={() => applyFormatToSelection('U')} title="Underline (Ctrl+U)"><u>U</u></button>
    <span class="j-fmt-divider"></span>
    <button class="j-fmt-btn" onclick={() => applyFormatToSelection('S')} title="Strikethrough"><s>S</s></button>
    <span class="j-fmt-divider"></span>
    <button class="j-fmt-btn" onclick={() => {
      const savedSel = window.getSelection();
      const savedRange = savedSel?.rangeCount ? savedSel.getRangeAt(0) : null;
      const url = prompt('Enter link URL:');
      if (url && isUrl(url)) {
        if (savedRange) {
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(savedRange); }
        }
        applyFormatToSelection('A', url);
      }
    }} title="Insert link (Ctrl+K)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="j-fmt-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>
  </div>
  {/if}

  <!-- Slash command menu -->
  {#if showSlash}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="j-slash-menu"
    style="top: {slashPos.top}px; left: {slashPos.left}px;"
    onclick={(e) => e.stopPropagation()}
    role="listbox"
    aria-label="Insert block menu"
    tabindex="-1"
  >
    {#each filteredSlashItems as item, i}
      <button
        class="j-slash-item"
        class:j-slash-item--active={i === slashIdx}
        onmouseenter={() => { slashIdx = i; }}
        onclick={() => applySlash(item.type)}
        role="option"
        aria-selected={i === slashIdx}
      >
        <span class="j-slash-icon">{item.icon}</span>
        <div class="j-slash-info">
          <span class="j-slash-label">{item.label}</span>
          <span class="j-slash-desc">{item.desc}</span>
        </div>
      </button>
    {/each}
  </div>
  {/if}

  <!-- Writing area: each block is a separate contentEditable -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="j-write-area" onmouseup={onMouseUp}>
    {#each blocks as block, idx}
      {#if block.type === 'divider'}
        <div class="j-block-divider"><hr /></div>
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          use:initBlock={block}
          contenteditable="true"
          spellcheck={true}
          class="j-block"
          class:j-block--heading={block.type === 'h1' || block.type === 'h2' || block.type === 'h3'}
          class:j-block--bullet={block.type === 'bullet'}
          class:j-block--number={block.type === 'number'}
          class:j-block--toggle={block.type === 'toggle'}
          class:j-block--quote={block.type === 'quote'}
          class:j-block--code={block.type === 'code'}
          class:j-block--checkbox={block.type === 'checkbox'}
          class:j-block--checked={block.checked && block.type === 'checkbox'}
          class:j-block--empty={!block.text}
          class:j-block--lv1={block.level === 1}
          class:j-block--lv2={block.level === 2}
          class:j-block--lv3={block.level === 3}
          class:j-block--lv4={block.level === 4}
          class:j-block--lv5={block.level === 5}
          onkeydown={(e) => onBlockKeydown(idx, e)}
          oninput={() => onBlockInput(idx)}
          oncompositionstart={onCompositionStart}
          oncompositionend={() => onCompositionEnd(idx)}
          onpaste={onBlockPaste}
          onblur={hideToolbar}
          data-block-id={block.id}
          data-placeholder="Type '/' for commands..."
          role="textbox"
          aria-multiline="true"
          aria-label="{block.type} block"
          tabindex="0"
        ></div>
      {/if}
    {/each}

    <!-- Ghost placeholder for when all blocks are empty -->
    {#if blocks.length === 1 && !blocks[0].text && blocks[0].type === 'p'}
    <div class="j-write-ghost">
      <span class="j-ghost-text">{t('moduleJournalStartWriting')}</span>
    </div>
    {/if}
  </div>

  <!-- Footer bar -->
  <div class="j-write-footer">
    <span class="j-write-stats">{wordCount} {t('moduleJournalWords')} · {charCount} {t('moduleJournalChars')}</span>
    <div class="j-write-actions">
      <button class="j-write-btn" onclick={handleClear} title={t('commonClear')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="j-btn-icon"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <button
        class="j-write-btn j-write-btn--save"
        class:j-write-btn--saved={saved}
        onclick={onsave}
        disabled={isSaving}
      >
        {#if isSaving}
          <span class="j-spinner"></span> {t('moduleJournalSaving')}
        {:else if saved}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="j-btn-icon"><polyline points="20 6 9 17 4 12"/></svg>
          {t('moduleJournalSaved')}
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="j-btn-icon"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {t('moduleJournalSaveEntry')}
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════
     ENABLEDBLOCK — Block Editor Styles
     ═══════════════════════════════════════════════════════════════ */

  .j-write {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 740px;
    margin: 0 auto;
    padding: 32px 24px 48px;
    width: 100%;
    min-height: calc(100vh - 120px);
    position: relative;
  }

  .j-write-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .j-write-title {
    font-size: 22px;
    font-weight: 650;
    margin: 0;
    font-family: var(--font-heading);
    letter-spacing: -0.3px;
    line-height: 1.2;
  }

  .j-write-sub {
    font-size: 12px;
    color: var(--muted);
    margin: 4px 0 0;
  }

  .j-streak-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    background: linear-gradient(135deg, oklch(0.769 0.165 70.08), oklch(0.637 0.208 25.331));
    color: oklch(1 0 89.876);
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .j-streak-pill svg {
    width: 16px;
    height: 16px;
  }

  .j-write-area {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }

  .j-block {
    width: 100%;
    padding: 6px 0;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif);
    font-size: 16px;
    line-height: 1.75;
    color: var(--foreground);
    min-height: 1.5em;
    caret-color: var(--mod-accent, oklch(0.68 0.158 276.935));
    transition: opacity 0.15s;
    white-space: pre-wrap;
    word-wrap: break-word;
    position: relative;
  }

  .j-block:focus {
    background: transparent;
  }

  .j-block--empty:not(:focus)::before {
    content: attr(data-placeholder);
    color: var(--muted);
    opacity: 0.45;
    pointer-events: none;
    font-style: normal;
  }

  .j-block--heading {
    font-family: var(--font-heading, 'Inter', ui-sans-serif, system-ui, sans-serif);
    font-size: 24px;
    font-weight: 650;
    line-height: 1.3;
    letter-spacing: -0.4px;
  }

  .j-block--bullet,
  .j-block--number {
    padding-left: 24px;
    position: relative;
  }
  .j-block--bullet.j-block--lv1,
  .j-block--number.j-block--lv1 { padding-left: 48px; }
  .j-block--bullet.j-block--lv2,
  .j-block--number.j-block--lv2 { padding-left: 72px; }
  .j-block--bullet.j-block--lv3,
  .j-block--number.j-block--lv3 { padding-left: 96px; }
  .j-block--bullet.j-block--lv4,
  .j-block--number.j-block--lv4 { padding-left: 120px; }
  .j-block--bullet.j-block--lv5,
  .j-block--number.j-block--lv5 { padding-left: 144px; }

  .j-block--bullet::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: var(--muted);
  }
  .j-block--bullet.j-block--lv1::before { left: 28px; }
  .j-block--bullet.j-block--lv2::before { left: 52px; }
  .j-block--bullet.j-block--lv3::before { left: 76px; }
  .j-block--bullet.j-block--lv4::before { left: 100px; }
  .j-block--bullet.j-block--lv5::before { left: 124px; }

  .j-block--number {
    position: relative;
  }

  .j-block--toggle {
    padding-left: 24px;
    position: relative;
  }

  .j-block--toggle::before {
    content: '▸';
    position: absolute;
    left: 4px;
    color: var(--muted);
    font-size: 12px;
    transition: transform 0.15s;
  }
  .j-block--toggle.j-block--lv1::before { left: 28px; }
  .j-block--toggle.j-block--lv2::before { left: 52px; }
  .j-block--toggle.j-block--lv3::before { left: 76px; }
  .j-block--toggle.j-block--lv4::before { left: 100px; }
  .j-block--toggle.j-block--lv5::before { left: 124px; }
  .j-block--toggle.j-block--lv1 { padding-left: 48px; }
  .j-block--toggle.j-block--lv2 { padding-left: 72px; }
  .j-block--toggle.j-block--lv3 { padding-left: 96px; }
  .j-block--toggle.j-block--lv4 { padding-left: 120px; }
  .j-block--toggle.j-block--lv5 { padding-left: 144px; }

  .j-block--quote {
    padding-left: 20px;
    border-left: 3px solid var(--mod-accent, oklch(0.68 0.158 276.935));
    font-style: italic;
    opacity: 0.85;
  }

  .j-block--code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 14px;
    line-height: 1.6;
    background: var(--muted-surface);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 4px 0;
  }

  .j-block--checkbox {
    padding-left: 28px;
    position: relative;
  }
  .j-block--checkbox.j-block--lv1 { padding-left: 52px; }
  .j-block--checkbox.j-block--lv2 { padding-left: 76px; }
  .j-block--checkbox.j-block--lv3 { padding-left: 100px; }
  .j-block--checkbox.j-block--lv4 { padding-left: 124px; }
  .j-block--checkbox.j-block--lv5 { padding-left: 148px; }

  .j-block--checkbox::before {
    content: '☐';
    position: absolute;
    left: 4px;
    font-size: 15px;
    color: var(--muted);
  }
  .j-block--checkbox.j-block--lv1::before { left: 28px; }
  .j-block--checkbox.j-block--lv2::before { left: 52px; }
  .j-block--checkbox.j-block--lv3::before { left: 76px; }
  .j-block--checkbox.j-block--lv4::before { left: 100px; }
  .j-block--checkbox.j-block--lv5::before { left: 124px; }

  .j-block--checkbox.j-block--checked::before {
    content: '☑';
  }

  .j-block-divider {
    padding: 8px 0;
  }

  .j-block-divider hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0;
  }

  .j-write-ghost {
    position: absolute;
    top: 8px;
    left: 0;
    pointer-events: none;
    user-select: none;
  }

  .j-ghost-text {
    font-size: 16px;
    line-height: 1.75;
    color: var(--muted);
    opacity: 0.35;
    font-family: var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif);
  }

  /* ── Floating toolbar ─────────────────────────────────────────── */
  .j-floating-toolbar {
    position: absolute;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 8px 24px oklch(0 0 0 / 0.18), 0 2px 6px oklch(0 0 0 / 0.08);
    transform: translateX(-50%);
    animation: j-fadeIn 0.12s ease;
  }

  @keyframes j-fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .j-fmt-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.12s;
  }

  .j-fmt-btn:hover {
    background: var(--muted-surface);
  }

  .j-fmt-btn em {
    font-style: italic;
  }

  .j-fmt-divider {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 3px;
  }

  .j-fmt-icon {
    width: 16px;
    height: 16px;
  }

  /* ── Slash menu ───────────────────────────────────────────────── */
  .j-slash-menu {
    position: absolute;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 12px 32px oklch(0 0 0 / 0.2);
    min-width: 220px;
    animation: j-fadeIn 0.12s ease;
  }

  .j-slash-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
    width: 100%;
  }

  .j-slash-item:hover,
  .j-slash-item--active {
    background: var(--muted-surface);
  }

  .j-slash-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--muted-surface);
    display: grid;
    place-items: center;
    font-size: 15px;
    flex-shrink: 0;
  }

  .j-slash-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .j-slash-label {
    font-size: 13px;
    font-weight: 600;
  }

  .j-slash-desc {
    font-size: 11px;
    color: var(--muted);
  }

  /* ── Footer bar ───────────────────────────────────────────────── */
  .j-write-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .j-write-stats {
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
  }

  .j-write-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .j-write-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .j-write-btn:hover {
    background: var(--muted-surface);
    border-color: var(--mod-accent, oklch(0.68 0.158 276.935));
  }

  .j-write-btn--save {
    background: var(--mod-accent, oklch(0.68 0.158 276.935));
    border-color: var(--mod-accent, oklch(0.68 0.158 276.935));
    color: oklch(1 0 89.876);
  }

  .j-write-btn--save:hover {
    opacity: 0.9;
  }

  .j-write-btn--saved {
    background: oklch(0.723 0.192 149.579);
    border-color: oklch(0.723 0.192 149.579);
  }

  .j-btn-icon {
    width: 16px;
    height: 16px;
  }

  .j-write-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .j-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid oklch(1 0 89.876 / 0.3);
    border-top-color: oklch(1 0 89.876);
    border-radius: 50%;
    animation: j-spin 0.6s linear infinite;
    display: inline-block;
  }

  @keyframes j-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 860px) {
    .j-write {
      padding: 24px 16px 40px;
      min-height: calc(100vh - 100px);
    }
    .j-write-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .j-write-footer {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
  }
</style>
