<script lang="ts">
  import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
  import type { Block, TextStyle, Mark, TextRange, ContentText } from '$lib/local-store/block';
  import { TextStyle as TS, MarkType, DivStyle } from '$lib/local-store/block';
  import { isTextBlock, isTextCode, isTextTitle, isTextDescription, isTextHeader, isTextToggle, canHaveMarks } from '$lib/local-store/block';

  export let block: Block;
  export let rootId: string;
  export let readonly: boolean = false;
  export let blockIndex: number = 0;
  export let onUpdate: (blockId: string, text: string, marks: Mark[]) => void = () => {};
  export let onFocus: (e?: any) => void = () => {};
  export let onBlur: (e?: any) => void = () => {};
  export let onKeyDown: (e: any, value: string, marks: Mark[], range: any, props: any) => void = () => {};
  export let onKeyUp: (e: any, value: string, marks: Mark[], range: any, props: any) => void = () => {};
  export let onToggle: (e?: any) => void = () => {};
  export let onStyleConvert: (blockId: string, style: TextStyle) => void = () => {};

  const dispatch = createEventDispatcher();

  // ── Derived from block content (reactive to prop changes) ───────────
  let textValue: string = '';
  let marks: Mark[] = [];
  let style: TextStyle = TS.Paragraph;
  let checked: boolean = false;
  let color: string | undefined;
  let iconEmoji: string | undefined;
  let iconImage: string | undefined;

  let isFocused = false;
  let editableEl: HTMLDivElement;

  // Sync local state from block prop (skip during active editing to avoid cursor jumps)
  $: if (block && block.content && !isFocused) {
    const ct = block.content as ContentText;
    textValue = ct.text ?? '';
    marks = ct.marks ?? [];
    style = ct.style ?? TS.Paragraph;
    checked = ct.checked ?? false;
    if (editableEl) syncEditable();
  }

  $: if (block && block.content && isFocused) {
    // Still sync style/checked even during editing (they affect the chrome)
    const ct = block.content as ContentText;
    style = ct.style ?? style;
    checked = ct.checked ?? checked;
  }

  // ── Placeholder text based on style ────────────────────────────────
  let placeholder = 'Type / for commands';
  $: {
    if (style === TS.Title) {
      placeholder = 'Untitled';
    } else if (style === TS.Description) {
      placeholder = 'Add a description...';
    } else if (style === TS.Callout) {
      placeholder = 'Type something...';
    } else if (style === TS.Code) {
      placeholder = 'Write code...';
    } else {
      placeholder = 'Type / for commands';
    }
  }

  // ── Markdown trigger map ────────────────────────────────────────────
  // Keys include the trailing space; triggered when textValue starts with one
  // and the user hasn't gone far (<= 2 extra chars) to avoid re-triggering
  // after the user has already started typing meaningful content.
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
  function syncEditable() {
    if (!editableEl) return;
    let html = textValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    // Apply mark rendering (simplified — bold, italic, code, link)
    if (marks.length > 0) {
      // Sort marks by range.from descending so we don't shift positions
      const sorted = [...marks].sort((a, b) => b.range.from - a.range.from);
      for (const mark of sorted) {
        const before = html.slice(0, mark.range.from);
        const mid = html.slice(mark.range.from, mark.range.to);
        const after = html.slice(mark.range.to);

        switch (mark.type) {
          case MarkType.Bold:
            html = before + `<strong>${mid}</strong>` + after;
            break;
          case MarkType.Italic:
            html = before + `<em>${mid}</em>` + after;
            break;
          case MarkType.Code:
            html = before + `<code>${mid}</code>` + after;
            break;
          case MarkType.Strike:
            html = before + `<s>${mid}</s>` + after;
            break;
          case MarkType.Underline:
            html = before + `<u>${mid}</u>` + after;
            break;
          case MarkType.Link:
            html = before + `<a href="${mark.param || '#'}">${mid}</a>` + after;
            break;
          default:
            break;
        }
      }
    }

    editableEl.innerHTML = html;
  }

  // ── Event handlers ──────────────────────────────────────────────────
  function handleInput() {
    if (!editableEl) return;
    textValue = editableEl.innerText || '';
    onUpdate(block.id || '', textValue, marks);
  }

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    onFocus(e);
  }

  function handleBlur(e: FocusEvent) {
    isFocused = false;
    onBlur(e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const range = { from: getCaretPosition(editableEl), to: getCaretPosition(editableEl) };

    // Enter: split block or handle shift+enter
    if (e.key === 'Enter' && !e.shiftKey && !isTextCode(style)) {
      e.preventDefault();
      onKeyDown(e, textValue, marks, range, { block, rootId, readonly });
      return;
    }

    // Shift+Enter: insert newline
    if (e.key === 'Enter' && e.shiftKey && !isTextCode(style)) {
      e.preventDefault();
      const insertAt = getCaretPosition(editableEl);
      textValue = textValue.slice(0, insertAt) + '\n' + textValue.slice(insertAt);
      syncEditable();
      setCaretPosition(editableEl, insertAt + 1);
      onUpdate(block.id || '', textValue, marks);
      return;
    }

    // Backspace at start: merge with previous block
    if (e.key === 'Backspace') {
      const pos = getCaretPosition(editableEl);
      if (pos === 0) {
        e.preventDefault();
        onKeyDown(e, textValue, marks, { from: 0, to: 0 }, { block, rootId, readonly });
        return;
      }
    }

    // Tab in code: insert tab character
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
    dispatch('togglecheck', { checked });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  onMount(() => {
    syncEditable();
  });

  afterUpdate(() => {
    if (!editableEl) return;
    // During active editing, only sync if the editable content doesn't match.
    // This handles cases where the store updated textValue (e.g. after Enter split)
    // while user was focused on an unrelated block.
    const currentText = editableEl.innerText || '';
    if (currentText !== textValue && !isFocused) {
      syncEditable();
    }
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

  $: styleClass = styleClassMap[style] || 'style-paragraph';
</script>

<div
  class="block-text {styleClass}"
  class:is-readonly={readonly}
  class:is-checked={checked && style === TS.Checkbox}
  class:has-color={!!color}
  data-block-id={block.id}
>
  {#if style === TS.Checkbox}
    <button
      class="checkbox-toggle"
      on:click={handleCheckboxToggle}
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
    <button class="toggle-arrow" on:click={() => onToggle()} aria-label="Toggle">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  {/if}

  {#if style === TS.Callout && (iconEmoji || iconImage)}
    <span class="callout-icon">{iconEmoji || '💡'}</span>
  {/if}

  <div
    bind:this={editableEl}
    class="editable"
    contenteditable={!readonly}
    spellcheck={!isTextCode(style)}
    data-placeholder={placeholder}
    on:input={handleInput}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown={handleKeyDown}
    on:keyup={handleKeyUp}
    on:paste={handlePaste}
    tabindex="0"
    role="textbox"
    aria-multiline="true"
    aria-label={placeholder}
  ></div>
</div>

<style>
  .block-text {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 2px 0;
    width: 100%;
    min-height: 28px;
  }

  .block-text.is-readonly {
    cursor: default;
  }

  /* ── Style variants ──────────────────────────────────────────────── */
  .style-paragraph .editable {
    font-size: 1rem;
    line-height: 1.7;
  }

  .style-h1 .editable {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.03em;
  }

  .style-h2 .editable {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  .style-h3 .editable {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: -0.01em;
  }

  .style-h4 .editable {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.5;
  }

  .style-title .editable {
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.04em;
  }

  .style-quote .editable {
    font-size: 1rem;
    line-height: 1.7;
    padding-left: 16px;
    border-left: 3px solid var(--border);
    color: var(--muted);
    font-style: italic;
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
  }

  .style-toggle-h1 .editable {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .style-toggle-h2 .editable {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .style-toggle-h3 .editable {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .style-bulleted .editable,
  .style-numbered .editable {
    font-size: 1rem;
    line-height: 1.7;
  }

  .style-checkbox .editable {
    font-size: 1rem;
    line-height: 1.7;
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
</style>
