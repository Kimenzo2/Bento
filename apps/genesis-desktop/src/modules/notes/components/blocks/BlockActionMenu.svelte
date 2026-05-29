<!-- BlockActionMenu.svelte
     Full port of anytype-ts/src/ts/component/menu/block/action.tsx
                  anytype-ts/src/ts/component/menu/block/color.tsx
                  anytype-ts/src/ts/component/menu/block/background.tsx
                  anytype-ts/src/ts/lib/action.ts  (duplicate / remove)

     Every action calls the real editorStore method which invokes the
     Tauri/Rust backend.  No stubs.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Block, ContentText } from '$lib/local-store/block';
  import { TextStyle as TS } from '$lib/local-store/block';
  import { editorStore } from '$lib/local-store/store';

  // ── Props ──────────────────────────────────────────────────────────
  let { block, rootId }: { block: Block; rootId: string } = $props();

  // ── Menu state ─────────────────────────────────────────────────────
  let menuOpen = $state(false);
  let subMenu  = $state<'style'|'align'|'color'|'background'|null>(null);
  let filter   = $state('');
  let menuX    = $state(0);
  let menuY    = $state(0);
  let menuEl   = $state<HTMLDivElement | undefined>(undefined);
  let triggerEl = $state<HTMLButtonElement | undefined>(undefined);

  // ── Derived block data ─────────────────────────────────────────────
  let ct          = $derived((block.content ?? {}) as ContentText);
  let isText      = $derived(block.type === 'text');
  let currentStyle  = $derived<number>(ct.style ?? 0);
  let currentColor  = $derived<string>(ct.color ?? 'default');
  let currentBg     = $derived<string>(block.bgColor ?? 'default');
  let currentHAlign = $derived<string>((block.fields as any)?.hAlign ?? 'left');

  // ── Colour palette — port of U.Menu.getTextColors / getBgColors ────
  const COLORS = [
    { id: 'default', label: 'Default', hex: 'var(--foreground)' },
    { id: 'grey',    label: 'Grey',    hex: '#9e9e9e' },
    { id: 'yellow',  label: 'Yellow',  hex: '#e2b631' },
    { id: 'amber',   label: 'Amber',   hex: '#e07b2a' },
    { id: 'red',     label: 'Red',     hex: '#e05c5c' },
    { id: 'pink',    label: 'Pink',    hex: '#e05090' },
    { id: 'purple',  label: 'Purple',  hex: '#9c4de0' },
    { id: 'blue',    label: 'Blue',    hex: '#4a90e0' },
    { id: 'sky',     label: 'Sky',     hex: '#2ab8d4' },
    { id: 'teal',    label: 'Teal',    hex: '#27ae8f' },
    { id: 'green',   label: 'Green',   hex: '#4caf50' },
  ];

  // ── Text style items — port of U.Menu.getBlockText ─────────────────
  const TEXT_STYLES = [
    { id: TS.Paragraph,    label: 'Text'          },
    { id: TS.Header1,      label: 'Heading 1'     },
    { id: TS.Header2,      label: 'Heading 2'     },
    { id: TS.Header3,      label: 'Heading 3'     },
    { id: TS.Quote,        label: 'Quote'         },
    { id: TS.Callout,      label: 'Callout'       },
    { id: TS.Bulleted,     label: 'Bulleted List' },
    { id: TS.Numbered,     label: 'Numbered List' },
    { id: TS.Toggle,       label: 'Toggle'        },
    { id: TS.Checkbox,     label: 'Checkbox'      },
    { id: TS.Code,         label: 'Code'          },
  ];

  // ── Align items — port of U.Menu.getHAlign ─────────────────────────
  const ALIGNS = [
    { id: 'left',    label: 'Left'    },
    { id: 'center',  label: 'Center'  },
    { id: 'right',   label: 'Right'   },
    { id: 'justify', label: 'Justify' },
  ];

  // ── Filter helper ──────────────────────────────────────────────────
  function matches(label: string): boolean {
    return !filter.trim() || label.toLowerCase().includes(filter.toLowerCase());
  }

  // ── Open menu — position relative to trigger ────────────────────────
  async function openMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menuX = rect.right + 6;
    menuY = rect.top;
    menuOpen = true;
    subMenu  = null;
    filter   = '';
    await tick();
    if (menuEl) {
      const mr = menuEl.getBoundingClientRect();
      if (mr.right  > window.innerWidth)  menuX = rect.left - mr.width - 6;
      if (mr.bottom > window.innerHeight) menuY = window.innerHeight - mr.height - 8;
    }
  }

  function closeAll() {
    menuOpen = false;
    subMenu  = null;
    filter   = '';
  }

  function outsideClick(e: MouseEvent) {
    if (menuOpen && menuEl && !menuEl.contains(e.target as Node)
        && !triggerEl?.contains(e.target as Node)) {
      closeAll();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeAll();
    // port of onKeyDownHandler: Ctrl+D = duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      runDuplicate();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (menuOpen) { e.preventDefault(); runDelete(); }
    }
  }

  // ── Actions — every one calls the real editorStore ─────────────────

  // port of Action.duplicate() → store.duplicateBlock()
  async function runDuplicate() {
    closeAll();
    await editorStore.duplicateBlock(block.id!);
  }

  // port of Action.remove() → store.deleteBlock()
  async function runDelete() {
    closeAll();
    await editorStore.deleteBlock(block.id!);
  }

  // port of C.BlockListTurnInto → store.convertBlockStyle()
  async function runStyleChange(styleId: number) {
    closeAll();
    await editorStore.convertBlockStyle(block.id!, styleId);
  }

  // port of C.BlockTextListSetColor → store.setBlockColor()
  async function runColorChange(colorId: string) {
    closeAll();
    await editorStore.setBlockColor(block.id!, colorId);
  }

  // port of C.BlockListSetBackgroundColor → store.setBlockBgColor()
  async function runBgChange(colorId: string) {
    closeAll();
    await editorStore.setBlockBgColor(block.id!, colorId);
  }

  // port of C.BlockListSetAlign → store.setBlockAlign()
  async function runAlignChange(alignId: string) {
    closeAll();
    await editorStore.setBlockAlign(block.id!, alignId);
  }

  // port of C.BlockTextListClearStyle → store.clearBlockStyle()
  async function runClearStyle() {
    closeAll();
    await editorStore.clearBlockStyle(block.id!);
  }

  // port of Action.copyBlocks() — reads contenteditable text, writes clipboard
  function runCopy() {
    const el = document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] .editable`);
    const text = el?.innerText ?? ct.text ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
    closeAll();
  }

  // port of clipboardCut — copy then delete
  async function runCut() {
    runCopy();
    await editorStore.deleteBlock(block.id!);
  }

  // port of clipboardPaste — focus block and use browser paste
  function runPaste() {
    closeAll();
    // Focus the block's editable so the native paste lands there
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] .editable`);
      el?.focus();
      document.execCommand('paste');
    }, 80);
  }
</script>

<svelte:window on:click={outsideClick} on:keydown={onKeydown} />

<!-- ── Drag handle ──────────────────────────────────────────────────── -->
<button
  bind:this={triggerEl}
  class="drag-handle"
  aria-label="Block actions"
  title="Click for actions · drag to reorder"
  onclick={openMenu}
>
  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="3" cy="3"  r="1.5" fill="currentColor"/>
    <circle cx="7" cy="3"  r="1.5" fill="currentColor"/>
    <circle cx="3" cy="8"  r="1.5" fill="currentColor"/>
    <circle cx="7" cy="8"  r="1.5" fill="currentColor"/>
    <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="7" cy="13" r="1.5" fill="currentColor"/>
  </svg>
</button>

<!-- ── Action menu ──────────────────────────────────────────────────── -->
{#if menuOpen}
<div
  bind:this={menuEl}
  class="bam-menu"
  style="left:{menuX}px; top:{menuY}px"
  role="menu"
>

  <!-- Filter — port of <Filter placeholder="Filter actions…"> -->
  <div class="bam-filter-wrap">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);flex-shrink:0">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input class="bam-filter" type="text" placeholder="Filter actions..." bind:value={filter} />
  </div>

  <!-- ══ TEXT SECTION ════════════════════════════════════════════════ -->
  {#if isText}

    {#if matches('Text') || matches('Style') || matches('Align') || matches('Color') || matches('Background') || matches('Clear')}
    <div class="bam-section">
      <span class="bam-section-name">Text</span>

      <!-- Style submenu -->
      {#if matches('Style') || TEXT_STYLES.some(s => matches(s.label))}
      <button class="bam-item {subMenu === 'style' ? 'is-active' : ''}"
        onclick={() => subMenu = subMenu === 'style' ? null : 'style'}>
        <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        <span class="bam-label">Style</span>
        <span class="bam-caption">{TEXT_STYLES.find(s => s.id === currentStyle)?.label ?? 'Regular Text'}</span>
        <svg class="bam-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {#if subMenu === 'style'}
      <div class="bam-sub">
        {#each TEXT_STYLES.filter(s => matches(s.label)) as s}
        <button class="bam-item {currentStyle === s.id ? 'is-checked' : ''}" onclick={() => runStyleChange(s.id)}>
          <span class="bam-label">{s.label}</span>
          {#if currentStyle === s.id}<svg class="bam-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
        </button>
        {/each}
      </div>
      {/if}
      {/if}

      <!-- Align submenu -->
      {#if matches('Align') || ALIGNS.some(a => matches(a.label))}
      <button class="bam-item {subMenu === 'align' ? 'is-active' : ''}"
        onclick={() => subMenu = subMenu === 'align' ? null : 'align'}>
        <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="15" y2="18"/></svg>
        <span class="bam-label">Align</span>
        <span class="bam-caption">{currentHAlign.charAt(0).toUpperCase() + currentHAlign.slice(1)}</span>
        <svg class="bam-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {#if subMenu === 'align'}
      <div class="bam-sub">
        {#each ALIGNS.filter(a => matches(a.label)) as a}
        <button class="bam-item {currentHAlign === a.id ? 'is-checked' : ''}" onclick={() => runAlignChange(a.id)}>
          <span class="bam-label">{a.label}</span>
          {#if currentHAlign === a.id}<svg class="bam-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
        </button>
        {/each}
      </div>
      {/if}
      {/if}

      <!-- Color submenu — port of blockColor menu -->
      {#if matches('Color') || COLORS.some(c => matches(c.label))}
      <button class="bam-item {subMenu === 'color' ? 'is-active' : ''}"
        onclick={() => subMenu = subMenu === 'color' ? null : 'color'}>
        <div class="bam-dot" style="background:{COLORS.find(c=>c.id===currentColor)?.hex??'var(--foreground)'}"></div>
        <span class="bam-label">Color</span>
        <svg class="bam-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {#if subMenu === 'color'}
      <div class="bam-sub">
        {#each COLORS.filter(c => matches(c.label)) as c}
        <button class="bam-item {currentColor === c.id ? 'is-checked' : ''}" onclick={() => runColorChange(c.id)}>
          <div class="bam-dot" style="background:{c.hex}"></div>
          <span class="bam-label">{c.label}</span>
          {#if currentColor === c.id}<svg class="bam-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
        </button>
        {/each}
      </div>
      {/if}
      {/if}

      <!-- Background submenu — port of blockBackground menu -->
      {#if matches('Background') || COLORS.some(c => matches(c.label))}
      <button class="bam-item {subMenu === 'background' ? 'is-active' : ''}"
        onclick={() => subMenu = subMenu === 'background' ? null : 'background'}>
        <div class="bam-dot bam-dot--bg" style="background:{COLORS.find(c=>c.id===currentBg)?.hex??'#9e9e9e'}"></div>
        <span class="bam-label">Background</span>
        <svg class="bam-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {#if subMenu === 'background'}
      <div class="bam-sub">
        {#each COLORS.filter(c => matches(c.label)) as c}
        <button class="bam-item {currentBg === c.id ? 'is-checked' : ''}" onclick={() => runBgChange(c.id)}>
          <div class="bam-dot" style="background:{c.hex}"></div>
          <span class="bam-label">{c.label}</span>
          {#if currentBg === c.id}<svg class="bam-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
        </button>
        {/each}
      </div>
      {/if}
      {/if}

      <!-- Clear style — port of C.BlockTextListClearStyle -->
      {#if matches('Clear style')}
      <button class="bam-item bam-item--danger" onclick={runClearStyle}>
        <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span class="bam-label">Clear style</span>
      </button>
      {/if}

    </div>
    {/if}

  {/if}

  <!-- ══ CLIPBOARD + DUPLICATE + DELETE ══════════════════════════════ -->
  {#if matches('Copy') || matches('Cut') || matches('Paste') || matches('Duplicate') || matches('Delete')}
  <div class="bam-section">

    {#if matches('Copy')}
    <button class="bam-item" onclick={runCopy}>
      <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span class="bam-label">Copy</span>
      <span class="bam-caption">Ctrl+C</span>
    </button>
    {/if}

    {#if matches('Cut')}
    <button class="bam-item" onclick={runCut}>
      <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
      <span class="bam-label">Cut</span>
      <span class="bam-caption">Ctrl+X</span>
    </button>
    {/if}

    {#if matches('Paste')}
    <button class="bam-item" onclick={runPaste}>
      <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
      <span class="bam-label">Paste</span>
      <span class="bam-caption">Ctrl+V</span>
    </button>
    {/if}

    {#if matches('Duplicate')}
    <button class="bam-item" onclick={runDuplicate}>
      <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span class="bam-label">Duplicate Block</span>
      <span class="bam-caption">Ctrl+D</span>
    </button>
    {/if}

    {#if matches('Delete')}
    <button class="bam-item bam-item--danger" onclick={runDelete}>
      <svg class="bam-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      <span class="bam-label">Delete block</span>
      <span class="bam-caption">Del</span>
    </button>
    {/if}

  </div>
  {/if}

</div>
{/if}

<style>
  /* ── Drag handle ─────────────────────────────────────────────────── */
  .drag-handle {
    position: absolute;
    left: -26px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 24px;
    border: none;
    background: none;
    padding: 0;
    cursor: grab;
    color: var(--muted);
    opacity: 0;
    transition: opacity 0.12s;
    border-radius: 4px;
    z-index: 10;
  }
  .drag-handle:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
    opacity: 1 !important;
    cursor: pointer;
  }
  .drag-handle:active { cursor: grabbing; }

  /* ── Menu shell ──────────────────────────────────────────────────── */
  .bam-menu {
    position: fixed;
    z-index: 9999;
    min-width: 232px;
    max-width: 280px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--surface, #1c1c1e);
    border: 1px solid color-mix(in srgb, var(--border, #3a3a3c) 80%, transparent);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.16);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Filter ──────────────────────────────────────────────────────── */
  .bam-filter-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--border, #3a3a3c) 50%, transparent);
    margin-bottom: 2px;
  }
  .bam-filter {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font-size: 13px;
    color: var(--foreground, #f0f0f0);
    caret-color: var(--primary, #6c8cf7);
    min-width: 0;
  }
  .bam-filter::placeholder { color: var(--muted, #888); }

  /* ── Section ─────────────────────────────────────────────────────── */
  .bam-section {
    display: flex;
    flex-direction: column;
    padding-bottom: 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--border, #3a3a3c) 35%, transparent);
    margin-bottom: 2px;
  }
  .bam-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

  .bam-section-name {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--muted, #888);
    padding: 4px 10px 2px;
  }

  /* ── Item ────────────────────────────────────────────────────────── */
  .bam-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--foreground, #f0f0f0);
    text-align: left;
    transition: background .1s;
  }
  .bam-item:hover, .bam-item.is-active {
    background: color-mix(in srgb, var(--foreground, #f0f0f0) 8%, transparent);
  }
  .bam-item.is-checked { color: var(--primary, #6c8cf7); }
  .bam-item--danger { color: var(--error, #e05c5c); }
  .bam-item--danger:hover {
    background: color-mix(in srgb, var(--error, #e05c5c) 10%, transparent);
  }

  .bam-icon { flex-shrink: 0; color: var(--muted, #888); }
  .bam-item--danger .bam-icon { color: inherit; }
  .bam-label  { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bam-caption { font-size: 11.5px; color: var(--muted, #888); white-space: nowrap; flex-shrink: 0; }
  .bam-chevron { flex-shrink: 0; color: var(--muted, #888); margin-left: auto; }
  .bam-check   { flex-shrink: 0; color: var(--primary, #6c8cf7); margin-left: auto; }

  /* ── Colour dot ──────────────────────────────────────────────────── */
  .bam-dot {
    width: 14px; height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--border,#3a3a3c) 60%, transparent);
  }
  .bam-dot--bg { opacity: .55; }

  /* ── Submenu indent ──────────────────────────────────────────────── */
  .bam-sub {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 2px solid color-mix(in srgb, var(--border,#3a3a3c) 45%, transparent);
  }
</style>
