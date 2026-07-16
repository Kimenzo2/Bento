<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Block, TextStyle, Mark, TextRange, ContentText } from '$lib/local-store/block';
  import { TextStyle as TS, MarkType, DivStyle } from '$lib/local-store/block';
  import { isTextBlock, isTextCode, isTextTitle, isTextDescription, isTextHeader, isTextToggle } from '$lib/local-store/block';
  import { editorStore } from '$lib/local-store/store';
  

  let { block, rootId, readonly = false, blockIndex = 0, softEnter = false, onUpdate = () => {}, onFocus = () => {}, onBlur = () => {}, onKeyDown = () => {}, onKeyUp = () => {}, onToggle = () => {}, onStyleConvert = () => {} }: {
    block: Block;
    rootId: string;
    readonly?: boolean;
    blockIndex?: number;
    softEnter?: boolean;
    onUpdate?: (blockId: string, text: string, marks: Mark[]) => void;
    onFocus?: (e?: any) => void;
    onBlur?: (e?: any) => void;
    onKeyDown?: (e: any, value: string, marks: Mark[], range: any, props: any) => void;
    onKeyUp?: (e: any, value: string, marks: Mark[], range: any, props: any) => void;
    onToggle?: (e?: any) => void;
    onStyleConvert?: (blockId: string, style: TextStyle) => void;
  } = $props();

  // ── Derived from block content (reactive to prop changes) ───────────
  let textValue: string = '';
  let marks: Mark[] = [];
  let style: TextStyle = $state(TS.Paragraph);
  let checked: boolean = $state(false);
  let iconEmoji: string | undefined;
  let iconImage: string | undefined;

  let isFocused = false;
  let isSyncing = false;
  let editableEl = $state<HTMLDivElement>()!;

  // No debounce — call onUpdate immediately on every keystroke.
  // This matches the original Anytype-ts text.tsx behavior where
  // onInput just calls onUpdate?.() directly.
  // Debouncing the store update created a race window where text
  // typed right before a note switch was silently lost because
  // the deferred onUpdate would fire after the store had been
  // reset for the new note, and setBlockText couldn't find the
  // old blockId in the new note's blockMap.

  // Sync local state from block prop (skip during active editing to avoid cursor jumps)
  $effect(() => {
    if (!block || !block.content) return;
    const ct = block.content as ContentText;
    // Always sync style/checked (affects chrome, not cursor)
    style = ct.style ?? TS.Paragraph;
    checked = ct.checked ?? false;
    if (!isFocused) {
      const newText = ct.text ?? '';
      const newMarks = ct.marks ?? [];
      textValue = newText;
      marks = newMarks;
      // Only sync innerHTML if text actually changed — avoids expensive
      // innerHTML reset on every keystroke to other blocks.
      if (editableEl && !isSyncing) {
        const currentText = editableEl.innerText || '';
        if (currentText !== newText) {
          try {
            isSyncing = true;
            syncEditable();
          } finally {
            isSyncing = false;
          }
        }
      }
    }
  });

  $effect(() => {
    if (block && block.content && isFocused) {
      // Still sync style/checked even during editing (they affect the chrome)
      const ct = block.content as ContentText;
      style = ct.style ?? style;
      checked = ct.checked ?? checked;
    }
  });

  // ── Color + bgColor + align derived from block ────────────────────
  // color lives in content; bgColor and hAlign live on the block root / fields.
  // All three are reactive to the block prop so they update when the store
  // pushes a new block object after an action-menu change.
  let color    = $derived<string>((block.content as ContentText)?.color ?? '');
  let bgColor  = $derived<string>(block.bgColor ?? '');
  let hAlign   = $derived<string>((block.fields as any)?.hAlign ?? 'left');

  // Map palette IDs → CSS custom properties defined in app.css / the theme.
  // We never hardcode hex — every value is a var() so all themes work.
  const COLOR_MAP: Record<string, string> = {
    default: 'var(--foreground)',
    grey:    'color-mix(in srgb, var(--foreground) 55%, var(--background))',
    yellow:  'var(--block-color-yellow,  #e2b631)',
    amber:   'var(--block-color-amber,   #e07b2a)',
    red:     'var(--block-color-red,     #e05c5c)',
    pink:    'var(--block-color-pink,    #e05090)',
    purple:  'var(--block-color-purple,  #9c4de0)',
    blue:    'var(--block-color-blue,    #4a90e0)',
    sky:     'var(--block-color-sky,     #2ab8d4)',
    teal:    'var(--block-color-teal,    #27ae8f)',
    green:   'var(--block-color-green,   #4caf50)',
  };

  const BG_MAP: Record<string, string> = {
    default: 'transparent',
    grey:    'color-mix(in srgb, var(--foreground) 8%,  var(--background))',
    yellow:  'color-mix(in srgb, var(--block-color-yellow,  #e2b631) 14%, var(--background))',
    amber:   'color-mix(in srgb, var(--block-color-amber,   #e07b2a) 14%, var(--background))',
    red:     'color-mix(in srgb, var(--block-color-red,     #e05c5c) 14%, var(--background))',
    pink:    'color-mix(in srgb, var(--block-color-pink,    #e05090) 14%, var(--background))',
    purple:  'color-mix(in srgb, var(--block-color-purple,  #9c4de0) 14%, var(--background))',
    blue:    'color-mix(in srgb, var(--block-color-blue,    #4a90e0) 14%, var(--background))',
    sky:     'color-mix(in srgb, var(--block-color-sky,     #2ab8d4) 14%, var(--background))',
    teal:    'color-mix(in srgb, var(--block-color-teal,    #27ae8f) 14%, var(--background))',
    green:   'color-mix(in srgb, var(--block-color-green,   #4caf50) 14%, var(--background))',
  };

  let resolvedColor   = $derived(color   && color   !== 'default' ? (COLOR_MAP[color]  ?? 'var(--foreground)') : '');
  let resolvedBg      = $derived(bgColor && bgColor !== 'default' ? (BG_MAP[bgColor]   ?? 'transparent')       : 'transparent');
  let resolvedAlign   = $derived(hAlign || 'left');

  let blockStyle = $derived([
    resolvedColor ? `color:${resolvedColor}` : '',
    resolvedBg    ? `background:${resolvedBg}` : '',
  ].filter(Boolean).join(';'));

  // ── Placeholder text based on style ────────────────────────────────
  let placeholder = $derived.by(() => {
    if (style === TS.Title) return 'Untitled';
    if (style === TS.Description) return 'Add a description...';
    if (style === TS.Callout) return 'Type something...';
    if (style === TS.Code) return 'Write code...';
    return 'Type / for commands';
  });

  // ── Link dialog state ──────────────────────────────────────────────
  let showLinkDialog = $state(false);
  let linkUrl = $state('');

  // ── Markdown trigger map ────────────────────────────────────────────
  const MARKDOWN_MAP: Record<string, TextStyle> = {
    '# ': TS.Header1,
    '## ': TS.Header2,
    '### ': TS.Header3,
    '> ': TS.Toggle,
    '" ': TS.Quote,
    '- ': TS.Bulleted,
    '* ': TS.Bulleted,
    '+ ': TS.Bulleted,
    '[] ': TS.Checkbox,
    '1. ': TS.Numbered,
  };

  // ── Cursor / selection utilities ─────────────────────────────────────
  function getCaretPosition(el: HTMLElement): number {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;

    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  function setCaretPosition(el: HTMLElement, pos: number) {
    const sel = window.getSelection();
    if (!sel) return;

    const range = document.createRange();
    let charIndex = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const nextCharIndex = charIndex + node.textContent!.length;
      if (charIndex <= pos && pos <= nextCharIndex) {
        range.setStart(node, pos - charIndex);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      charIndex = nextCharIndex;
    }

    // If position is at end, select last node
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── ContentEditable sync ────────────────────────────────────────────
  // Build HTML from plain text + marks.
  // Marks are applied in sorted order on the PLAIN TEXT (not on growing HTML),
  // then the result is HTML-encoded. This avoids offset shifting.
  function buildHtml(text: string, marksArr: Mark[]): string {
    if (!text) return '';

    // Collect all open/close events sorted by position
    type Evt = { pos: number; order: number; tag: string };
    const events: Evt[] = [];
    const sorted = [...marksArr].sort((a, b) => a.range.from - b.range.from || b.range.to - a.range.to);

    sorted.forEach((m, i) => {
      const { from, to } = m.range;
      if (from >= to || from < 0 || to > text.length) return;
      const [open, close] = markToTags(m);
      events.push({ pos: from, order: i,     tag: open  });
      events.push({ pos: to,   order: -i - 1, tag: close });
    });

    // Sort: by position, then closes before opens at same pos
    events.sort((a, b) => a.pos - b.pos || a.order - b.order);

    let html = '';
    let pos = 0;
    for (const ev of events) {
      if (ev.pos > pos) {
        html += escHtml(text.slice(pos, ev.pos));
        pos = ev.pos;
      }
      html += ev.tag;
    }
    if (pos < text.length) html += escHtml(text.slice(pos));
    return html;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function markToTags(m: Mark): [string, string] {
    switch (m.type) {
      case MarkType.Bold:      return ['<strong>', '</strong>'];
      case MarkType.Italic:    return ['<em>', '</em>'];
      case MarkType.Code:      return ['<code>', '</code>'];
      case MarkType.Strike:    return ['<s>', '</s>'];
      case MarkType.Underline: return ['<u>', '</u>'];
      case MarkType.Link:      return [`<a href="${m.param || '#'}" rel="noopener">`, '</a>'];
      default:                 return ['<span>', '</span>'];
    }
  }

  function syncEditable() {
    if (!editableEl) return;
    const html = buildHtml(textValue, marks);
    if (editableEl.innerHTML !== html) {
      editableEl.innerHTML = html;
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────
  function handleInput() {
    if (!editableEl) return;
    textValue = editableEl.innerText || '';
    // Call onUpdate immediately — matches Anytype-ts text.tsx original
    // where onInput() just calls onUpdate?.() with no debounce.
    onUpdate(block.id || '', textValue, marks);
  }

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    onFocus(e);
  }

  function handleBlur(e: FocusEvent) {
    // CRITICAL: Sync live text to store BEFORE setting isFocused=false.
    // The $effect re-runs when isFocused changes, and if the store has
    // stale text, it will overwrite the contenteditable with old content,
    // erasing the user's last typed characters.
    if (block.id) editorStore.syncBlockTextToStore(block.id);
    isFocused = false;
    onBlur(e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const range = { from: getCaretPosition(editableEl), to: getCaretPosition(editableEl) };
    const blockId = block.id;

    // ── Mark shortcuts (Ctrl/Cmd + key) ────────────────────────────
    const isCmd = e.metaKey || e.ctrlKey;

    if (isCmd && e.key === 'b') {
      e.preventDefault();
      if (blockId) editorStore.applyMarkToSelection(blockId, MarkType.Bold);
      return;
    }
    if (isCmd && e.key === 'i') {
      e.preventDefault();
      if (blockId) editorStore.applyMarkToSelection(blockId, MarkType.Italic);
      return;
    }
    if (isCmd && e.key === 'u') {
      e.preventDefault();
      if (blockId) editorStore.applyMarkToSelection(blockId, MarkType.Underline);
      return;
    }
    if (isCmd && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      if (blockId) editorStore.applyMarkToSelection(blockId, MarkType.Strike);
      return;
    }
    if (isCmd && e.key === 'e') {
      e.preventDefault();
      if (blockId) editorStore.applyMarkToSelection(blockId, MarkType.Code);
      return;
    }
    if (isCmd && e.key === 'k') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && blockId) {
        // Check if selection already has a link mark
        const hasLink = editorStore.hasMarkAtSelection(blockId, MarkType.Link);
        if (hasLink) {
          // Remove link
          const range = sel.getRangeAt(0);
          const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
          if (el) {
            const pre = document.createRange();
            pre.selectNodeContents(el);
            pre.setEnd(range.startContainer, range.startOffset);
            const from = pre.toString().length;
            const to = from + range.toString().length;
            editorStore.toggleMark(blockId, MarkType.Link, { from, to });
          }
        } else {
          // Show link dialog
          showLinkDialog = true;
          linkUrl = 'https://';
          setTimeout(() => document.getElementById('link-url-input')?.focus(), 50);
        }
      }
      return;
    }

    // ── Tab indent/outdent for bullet/numbered blocks ──────────────
    if (e.key === 'Tab' && (style === TS.Bulleted || style === TS.Numbered || style === TS.Checkbox || style === TS.Toggle)) {
      e.preventDefault();
      // Toggle between bullet styles or indent — delegate to parent
      // For now, insert a tab-indented block below
      if (blockId) {
        onKeyDown(e, textValue, marks, { from: range.from, to: range.from }, { block, rootId, readonly });
      }
      return;
    }

    // ── Enter: insert newline or delegate to parent ─────────────
    if (e.key === 'Enter' && !e.shiftKey && !isTextCode(style)) {
      e.preventDefault();
      if (softEnter) {
        // Insert soft newline within the same block (journal-style)
        const insertAt = getCaretPosition(editableEl);
        textValue = textValue.slice(0, insertAt) + '\n' + textValue.slice(insertAt);
        syncEditable();
        setCaretPosition(editableEl, insertAt + 1);
        onUpdate(block.id || '', textValue, marks);
      } else {
        // Delegate to parent (creates new block — notes-style)
        onKeyDown(e, textValue, marks, range, { block, rootId, readonly });
      }
      return;
    }

    // ── Shift+Enter: insert newline ────────────────────────────────
    if (e.key === 'Enter' && e.shiftKey && !isTextCode(style)) {
      e.preventDefault();
      const insertAt = getCaretPosition(editableEl);
      textValue = textValue.slice(0, insertAt) + '\n' + textValue.slice(insertAt);
      syncEditable();
      setCaretPosition(editableEl, insertAt + 1);
      onUpdate(block.id || '', textValue, marks);
      return;
    }

    // ── Arrow up/down: navigate between blocks ─────────────────────
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const pos = getCaretPosition(editableEl);
      const atStart = pos === 0;
      const atEnd = pos === textValue.length;
      if ((e.key === 'ArrowUp' && atStart) || (e.key === 'ArrowDown' && atEnd)) {
        e.preventDefault();
        onKeyDown(e, textValue, marks, range, { block, rootId, readonly });
        return;
      }
    }

    // ── Backspace at start: merge with previous block ──────────────
    if (e.key === 'Backspace') {
      const pos = getCaretPosition(editableEl);
      if (pos === 0) {
        e.preventDefault();
        onKeyDown(e, textValue, marks, { from: 0, to: 0 }, { block, rootId, readonly });
        return;
      }
    }

    // ── Tab in code: insert tab character ──────────────────────────
    if (e.key === 'Tab' && isTextCode(style)) {
      e.preventDefault();
      const pos = getCaretPosition(editableEl);
      textValue = textValue.slice(0, pos) + '\t' + textValue.slice(pos);
      syncEditable();
      setCaretPosition(editableEl, pos + 1);
      onUpdate(block.id || '', textValue, marks);
      return;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    const pos = getCaretPosition(editableEl);

    // Check for markdown triggers
    // Runs only on keyup after user types a space/prefixed pattern
    if (
      !isTextCode(style) &&
      !isTextTitle(style) &&
      !isTextDescription(style) &&
      textValue.length > 0
    ) {
      for (const [trigger, newStyle] of Object.entries(MARKDOWN_MAP)) {
        if (textValue.startsWith(trigger) && textValue.length <= trigger.length + 2) {
          // Trigger matched! Strip the prefix and convert block style
          const remaining = textValue.slice(trigger.length);
          textValue = remaining;
          syncEditable();
          setCaretPosition(editableEl, 0);
          const bid = block.id;
          if (bid) {
            onUpdate(bid, textValue, marks); // persist stripped text
            onStyleConvert(bid, newStyle);   // persist style change
          }
          return;
        }
      }
    }

    onKeyUp(e, textValue, marks, { from: pos, to: pos }, { block, rootId, readonly });
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html') || '';
    const text = e.clipboardData?.getData('text/plain') || '';

    const pos = getCaretPosition(editableEl);
    textValue = textValue.slice(0, pos) + text + textValue.slice(pos);
    syncEditable();
    setCaretPosition(editableEl, pos + text.length);
    onUpdate(block.id || '', textValue, marks);
  }

  function handleCheckboxToggle() {
    if (readonly) return;
    checked = !checked;
    onToggle();
  }

  // ── Link dialog handlers ────────────────────────────────────────────
  function confirmLink() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !block.id) return;
    const el = document.querySelector(`[data-block-id="${block.id}"] .editable`);
    if (!el) return;
    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const from = pre.toString().length;
    const to = from + range.toString().length;
    if (from < to && linkUrl.trim()) {
      editorStore.toggleMark(block.id, MarkType.Link, { from, to }, linkUrl.trim());
    }
    showLinkDialog = false;
    linkUrl = '';
  }

  function cancelLink() {
    showLinkDialog = false;
    linkUrl = '';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  onMount(() => {
    syncEditable();
  });


  // ── CSS class helpers ──────────────────────────────────────────────
  const styleClassMap: Record<TextStyle, string> = {
    [TS.Paragraph]: 'style-paragraph',
    [TS.Header1]: 'style-h1',
    [TS.Header2]: 'style-h2',
    [TS.Header3]: 'style-h3',
    [TS.Header4]: 'style-h4',
    [TS.Quote]: 'style-quote',
    [TS.Code]: 'style-code',
    [TS.Title]: 'style-title',
    [TS.Checkbox]: 'style-checkbox',
    [TS.Bulleted]: 'style-bulleted',
    [TS.Numbered]: 'style-numbered',
    [TS.Toggle]: 'style-toggle',
    [TS.Description]: 'style-description',
    [TS.Callout]: 'style-callout',
    [TS.ToggleHeader1]: 'style-toggle-h1',
    [TS.ToggleHeader2]: 'style-toggle-h2',
    [TS.ToggleHeader3]: 'style-toggle-h3',
  };

  let styleClass = $derived(styleClassMap[style] || 'style-paragraph');

  // ── Code block language selector ────────────────────────────────────
  const CODE_LANGUAGES = [
    { id: 'plaintext', label: 'Plain Text' },
    { id: 'bash', label: 'Bash' },
    { id: 'html', label: 'HTML' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'json', label: 'JSON' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'mermaid', label: 'Mermaid' },
    { id: 'python', label: 'Python' },
    { id: 'rust', label: 'Rust' },
    { id: 'svg', label: 'SVG' },
    { id: 'xml', label: 'XML' },
    { id: 'yaml', label: 'YAML' },
  ];
  import { setBlockFields } from '$lib/local-store/editor-state.svelte';

  let showLangSelector = $state(false);
  let codeLanguage = $derived((block.fields?.codeLanguage as string) || 'plaintext');
  let langLabel = $derived(CODE_LANGUAGES.find(l => l.id === codeLanguage)?.label || 'Plain Text');

  function selectLanguage(lang: string) {
    showLangSelector = false;
    if (lang === codeLanguage) return;
    void setBlockFields(block.id!, { codeLanguage: lang });
  }
</script>

<div
  class="block-text {styleClass}"
  class:is-readonly={readonly}
  class:is-checked={checked && style === TS.Checkbox}
  data-block-id={block.id}
  style="{blockStyle}{blockStyle ? ';' : ''}text-align:{resolvedAlign}"
>
  {#if style === TS.Checkbox}
    <button
      class="checkbox-toggle"
      onclick={handleCheckboxToggle}
      aria-label={checked ? 'Uncheck' : 'Check'}
    >
      {#if checked}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--primary)"/>
          <path d="M4.5 8.5L7 11L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="var(--border)" stroke-width="1"/>
        </svg>
      {/if}
    </button>
  {/if}

  {#if style === TS.Bulleted}
    <span class="marker-bullet">•</span>
  {/if}

  {#if style === TS.Numbered}
    <span class="marker-number">{blockIndex + 1}.</span>
  {/if}

  {#if style === TS.Toggle || style === TS.ToggleHeader1 || style === TS.ToggleHeader2 || style === TS.ToggleHeader3}
    <button class="toggle-arrow" onclick={() => onToggle()} aria-label="Toggle">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  {/if}

  {#if style === TS.Callout && (iconEmoji || iconImage)}
    <span class="callout-icon">{iconEmoji || '💡'}</span>
  {/if}

  {#if style === TS.Code}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="code-lang-bar" onclick={() => showLangSelector = !showLangSelector} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showLangSelector = !showLangSelector; } }} aria-label="Code language: {langLabel}">
      <span class="code-lang-label">{langLabel}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    {#if showLangSelector}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="code-lang-dropdown" onclick={() => showLangSelector = false}>
        {#each CODE_LANGUAGES as lang}
          <button
            class="code-lang-option"
            class:is-active={lang.id === codeLanguage}
            onclick={(e) => { e.stopPropagation(); selectLanguage(lang.id); }}
          >{lang.label}</button>
        {/each}
      </div>
    {/if}
  {/if}

  <div
    bind:this={editableEl}
    class="editable"
    contenteditable={!readonly}
    spellcheck={true}
    data-placeholder={placeholder}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    onkeyup={handleKeyUp}
    onpaste={handlePaste}
    tabindex="0"
    role="textbox"
    aria-multiline="true"
    aria-label={placeholder}
  ></div>
</div>

{#if showLinkDialog}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="link-dialog-overlay" onclick={cancelLink}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="link-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="link-dialog-header">Add link</div>
      <div class="link-dialog-body">
        <input
          id="link-url-input"
          type="url"
          class="link-dialog-input"
          placeholder="https://..."
          bind:value={linkUrl}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmLink(); } if (e.key === 'Escape') { e.preventDefault(); cancelLink(); } }}
        />
      </div>
      <div class="link-dialog-actions">
        <button class="link-dialog-btn secondary" onclick={cancelLink}>Cancel</button>
        <button class="link-dialog-btn primary" onclick={confirmLink}>Apply</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .block-text {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 2px 4px;
    width: 100%;
    min-height: 28px;
    border-radius: 4px;
    /* color and background are applied via inline style — not classes —
       so they respond correctly to the global theme token system */
  }

  /* Give coloured-background blocks visible padding */
  .block-text[style*="background:color-mix"],
  .block-text[style*="background:rgb"],
  .block-text[style*="background:#"] {
    padding: 4px 8px;
    border-radius: 6px;
  }

  /* ── Style variants ──────────────────────────────────────────────── */
  .style-paragraph .editable {
    font-size: 1rem;
    line-height: 1.7;
    text-wrap: pretty;
  }

  .style-h1 .editable {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }

  .style-h2 .editable {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .style-h3 .editable {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .style-h4 .editable {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.5;
    text-wrap: balance;
  }

  .style-title .editable {
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .style-quote .editable {
    font-size: 1rem;
    line-height: 1.7;
    padding-left: 16px;
    border-left: 3px solid var(--border);
    color: var(--muted);
    font-style: italic;
    text-wrap: pretty;
  }

  .style-code {
    position: relative;
    flex-direction: column;
    gap: 0;
  }
  .code-lang-bar {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    margin: 4px 0 0 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: inherit;
    color: var(--muted);
    background: var(--surface);
    cursor: pointer;
    user-select: none;
    align-self: flex-start;
    transition: background 0.15s;
  }
  .code-lang-bar:hover {
    background: var(--hover);
    color: var(--foreground);
  }
  .code-lang-label { text-transform: capitalize; }
  .code-lang-dropdown {
    position: absolute;
    top: 28px;
    left: 12px;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 4px;
    z-index: 100;
    max-height: 240px;
    overflow-y: auto;
    min-width: 130px;
  }
  .code-lang-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--foreground);
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
  }
  .code-lang-option:hover { background: var(--hover); }
  .code-lang-option.is-active {
    background: var(--primary);
    color: var(--primary-foreground);
  }

  .style-code .editable {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--muted-surface);
    white-space: pre-wrap;
    word-break: break-word;
    tab-size: 2;
  }

  .style-callout {
    padding: 12px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .style-description .editable {
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--muted);
  }

  .style-toggle .editable {
    font-size: 1rem;
    line-height: 1.7;
    text-wrap: pretty;
  }

  .style-toggle-h1 .editable {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }

  .style-toggle-h2 .editable {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
    text-wrap: balance;
  }

  .style-toggle-h3 .editable {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
    text-wrap: balance;
  }

  .style-bulleted .editable,
  .style-numbered .editable {
    font-size: 1rem;
    line-height: 1.7;
    text-wrap: pretty;
  }

  .style-checkbox .editable {
    font-size: 1rem;
    line-height: 1.7;
    text-wrap: pretty;
  }

  .is-checked .editable {
    text-decoration: line-through;
    opacity: 0.5;
  }

  /* ── Marker elements ──────────────────────────────────────────────── */
  .marker-bullet {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    color: var(--muted);
    padding-top: 6px;
  }

  .marker-number {
    flex-shrink: 0;
    min-width: 24px;
    text-align: right;
    padding-right: 4px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    padding-top: 6px;
  }

  .checkbox-toggle {
    flex-shrink: 0;
    margin-top: 6px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .checkbox-toggle:hover {
    opacity: 1;
  }

  .toggle-arrow {
    flex-shrink: 0;
    margin-top: 8px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--muted);
    transition: transform 0.15s, color 0.15s;
  }

  .toggle-arrow:hover {
    color: var(--foreground);
  }

  .callout-icon {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 1.3rem;
  }

  /* ── ContentEditable ──────────────────────────────────────────────── */
  .editable {
    flex: 1;
    min-width: 0;
    min-height: 1.7em;
    outline: none;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .editable:empty::before {
    content: attr(data-placeholder);
    color: var(--muted);
    opacity: 0.5;
    pointer-events: none;
  }

  .editable :global(strong) {
    font-weight: 700;
  }

  .editable :global(em) {
    font-style: italic;
  }

  .editable :global(code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
    padding: 1px 4px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--muted-surface) 80%, transparent);
  }

  .editable :global(a) {
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
  }

  .editable :global(s) {
    text-decoration: line-through;
  }

  .has-color .editable {
    color: var(--block-text-color, inherit);
  }

  /* ── Link Dialog ───────────────────────────────────────────────── */
  .link-dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--background) 60%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .link-dialog {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }

  .link-dialog-header {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--foreground);
  }

  .link-dialog-body {
    margin-bottom: 12px;
  }

  .link-dialog-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .link-dialog-input:focus {
    border-color: var(--primary);
  }

  .link-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .link-dialog-btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .link-dialog-btn.primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
  }

  .link-dialog-btn.secondary {
    background: transparent;
    color: var(--foreground);
  }

  .link-dialog-btn:hover {
    opacity: 0.9;
  }
</style>
