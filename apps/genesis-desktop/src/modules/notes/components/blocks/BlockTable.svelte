<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // BlockTable.svelte — Port of anytype-ts/block/table.tsx + table/row.tsx
  // Full editable table with resize, row/column ops, keyboard nav
  // ════════════════════════════════════════════════════════════════════
  import { onMount, onDestroy, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { Block } from '$lib/local-store/block';
  import { time } from '$lib/utils/time';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  interface TableRow { id: string; cells: Record<string, { text: string }>; isHeader?: boolean }
  interface TableColumn { id: string; width: number }
  interface TableData { rows: TableRow[]; columns: TableColumn[] }

  let { block, rootId = '', readonly = false }: {
    block: Block;
    rootId?: string;
    readonly?: boolean;
  } = $props();

  // ── Table data ────────────────────────────────────────────────────
  const MIN_COL_WIDTH = 80;
  const DEFAULT_COL_WIDTH = 160;

  function loadTable(): TableData {
    const c = block.content as any;
    return {
      rows: (c?.rows ?? []).map((r: any) => ({ id: r.id, cells: { ...(r.cells ?? {}) }, isHeader: r.isHeader })),
      columns: (c?.columns ?? []).map((c2: any) => ({ id: c2.id, width: c2.width ?? DEFAULT_COL_WIDTH })),
    };
  }

  let tableData = $state<TableData>(loadTable());
  let rows = $derived(tableData.rows);
  let columns = $derived(tableData.columns);

  let editingCell: string | null = $state(null);

  function persistTable() {
    if (!block.id) return;
    invoke('local_store_block_update', {
      id: block.id,
      content: { columns: tableData.columns, rows: tableData.rows },
      fields: null,
      align: null,
      bgColor: null,
    }).catch((e) => console.error('[BlockTable] persist', e));
  }

  // ── Cell ops ──────────────────────────────────────────────────────
  function getCellKey(rowId: string, colId: string) { return `${rowId}--${colId}`; }

  function cellText(rowId: string, colId: string): string {
    return tableData.rows.find(r => r.id === rowId)?.cells[colId]?.text ?? '';
  }

  function updateCell(rowId: string, colId: string, text: string) {
    tableData = {
      ...tableData,
      rows: tableData.rows.map(r =>
        r.id === rowId
          ? { ...r, cells: { ...r.cells, [colId]: { ...r.cells[colId], text } } }
          : r
      ),
    };
    persistTable();
  }

  // ── Keyboard navigation ───────────────────────────────────────────
  function handleCellKey(e: KeyboardEvent, rowIdx: number, colIdx: number) {
    const rowId = rows[rowIdx]?.id;
    const colId = columns[colIdx]?.id;
    if (!rowId || !colId) return;

    switch (e.key) {
      case 'Tab': {
        e.preventDefault();
        const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
        if (nextColIdx >= 0 && nextColIdx < columns.length) {
          focusCell(rowIdx, nextColIdx);
        } else if (!e.shiftKey && rowIdx < rows.length - 1) {
          focusCell(rowIdx + 1, 0);
        } else if (e.shiftKey && rowIdx > 0) {
          focusCell(rowIdx - 1, columns.length - 1);
        }
        break;
      }
      case 'Enter': {
        if (!e.shiftKey) {
          e.preventDefault();
          if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, colIdx);
          else addRow();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, colIdx);
        break;
      }
    }
  }

  async function focusCell(rowIdx: number, colIdx: number) {
    const rowId = tableData.rows[rowIdx]?.id;
    const colId = tableData.columns[colIdx]?.id;
    if (!rowId || !colId) return;
    const key = getCellKey(rowId, colId);
    editingCell = key;
    // Wait for DOM to update with textarea
    await tick();
    await tick();
    // Use rAF to ensure the textarea is painted and focusable
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const el = document.querySelector<HTMLTextAreaElement>(
      `[data-cell="${key}"] textarea.cell-input`
    );
    if (el) {
      el.focus();
      // Place cursor at end of text
      const len = el.value.length;
      el.setSelectionRange(len, len);
      autoResize(el);
    } else {
      // Retry once more after another frame
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const el2 = document.querySelector<HTMLTextAreaElement>(
        `[data-cell="${key}"] textarea.cell-input`
      );
      if (el2) {
        el2.focus();
        const len2 = el2.value.length;
        el2.setSelectionRange(len2, len2);
        autoResize(el2);
      }
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // ── Row / column management ────────────────────────────────────────
  function addRow(afterIdx?: number) {
    const newRow = {
      id: `row-${time.now()}`,
      cells: Object.fromEntries(tableData.columns.map(c => [c.id, { text: '' }])),
    };
    const idx = afterIdx ?? tableData.rows.length;
    tableData = {
      ...tableData,
      rows: [...tableData.rows.slice(0, idx + 1), newRow, ...tableData.rows.slice(idx + 1)],
    };
    persistTable();
  }

  function addColumn(afterIdx?: number) {
    const newColId = `col-${time.now()}`;
    const idx = afterIdx ?? tableData.columns.length;
    tableData = {
      columns: [
        ...tableData.columns.slice(0, idx + 1),
        { id: newColId, width: DEFAULT_COL_WIDTH },
        ...tableData.columns.slice(idx + 1),
      ],
      rows: tableData.rows.map(r => ({
        ...r,
        cells: { ...r.cells, [newColId]: { text: '' } },
      })),
    };
    persistTable();
  }

  function deleteRow(rowId: string) {
    if (tableData.rows.length <= 1) return;
    tableData = { ...tableData, rows: tableData.rows.filter(r => r.id !== rowId) };
    persistTable();
  }

  function moveRowUp(rowId: string) {
    const idx = tableData.rows.findIndex(r => r.id === rowId);
    if (idx <= 0) return;
    const r = tableData.rows;
    tableData = { ...tableData, rows: [...r.slice(0, idx - 1), r[idx], r[idx - 1], ...r.slice(idx + 1)] };
    persistTable();
  }

  function moveRowDown(rowId: string) {
    const idx = tableData.rows.findIndex(r => r.id === rowId);
    if (idx < 0 || idx >= tableData.rows.length - 1) return;
    const r = tableData.rows;
    tableData = { ...tableData, rows: [...r.slice(0, idx), r[idx + 1], r[idx], ...r.slice(idx + 2)] };
    persistTable();
  }

  function moveColLeft(colId: string) {
    const idx = tableData.columns.findIndex(c => c.id === colId);
    if (idx <= 0) return;
    const c = tableData.columns;
    tableData = { ...tableData, columns: [...c.slice(0, idx - 1), c[idx], c[idx - 1], ...c.slice(idx + 1)] };
    persistTable();
  }

  function moveColRight(colId: string) {
    const idx = tableData.columns.findIndex(c => c.id === colId);
    if (idx < 0 || idx >= tableData.columns.length - 1) return;
    const c = tableData.columns;
    tableData = { ...tableData, columns: [...c.slice(0, idx), c[idx + 1], c[idx], ...c.slice(idx + 2)] };
    persistTable();
  }

  function deleteColumn(colId: string) {
    if (tableData.columns.length <= 1) return;
    tableData = {
      columns: tableData.columns.filter(c => c.id !== colId),
      rows: tableData.rows.map(r => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    };
    persistTable();
  }

  function toggleHeader(rowId: string) {
    tableData = {
      ...tableData,
      rows: tableData.rows.map(r => r.id === rowId ? { ...r, isHeader: !r.isHeader } : r),
    };
    persistTable();
  }

  // ── Column resize ──────────────────────────────────────────────────
  let resizingColIdx: number | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function onResizeStart(e: MouseEvent, colIdx: number) {
    e.preventDefault();
    resizingColIdx = colIdx;
    resizeStartX = e.pageX;
    resizeStartWidth = columns[colIdx].width;
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (resizingColIdx === null) return;
    const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + (e.pageX - resizeStartX));
    tableData = {
      ...tableData,
      columns: tableData.columns.map((c, i) => i === resizingColIdx ? { ...c, width: newWidth } : c),
    };
  }

  function onResizeEnd() {
    resizingColIdx = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  }

  // ── Context menus ──────────────────────────────────────────────────
  let rowMenuId: string | null = $state(null);
  let colMenuId: string | null = $state(null);
  let rowMenuPos = $state({ x: 0, y: 0 });
  let colMenuPos = $state({ x: 0, y: 0 });

  function openRowMenu(e: MouseEvent, rowId: string) {
    e.preventDefault(); e.stopPropagation();
    rowMenuId = rowId;
    rowMenuPos = { x: e.clientX, y: e.clientY };
    colMenuId = null;
  }

  function openColMenu(e: MouseEvent, colId: string) {
    e.preventDefault(); e.stopPropagation();
    colMenuId = colId;
    colMenuPos = { x: e.clientX, y: e.clientY };
    rowMenuId = null;
  }

  function closeMenus() { rowMenuId = null; colMenuId = null; }

  // Initialize from block content on mount / block change
  let prevBlockId = '';
  $effect(() => {
    if (block?.id && block.id !== prevBlockId) {
      prevBlockId = block.id;
      const t = loadTable();
      if (t.rows.length === 0 || t.columns.length === 0) {
        tableData = {
          columns: [
            { id: 'col-0', width: DEFAULT_COL_WIDTH },
            { id: 'col-1', width: DEFAULT_COL_WIDTH },
            { id: 'col-2', width: DEFAULT_COL_WIDTH },
          ],
          rows: [
            { id: 'row-header', isHeader: true, cells: { 'col-0': { text: '' }, 'col-1': { text: '' }, 'col-2': { text: '' } } },
            { id: 'row-0', cells: { 'col-0': { text: '' }, 'col-1': { text: '' }, 'col-2': { text: '' } } },
          ],
        };
      } else {
        tableData = t;
      }
    }
  });

  onMount(() => {
    document.addEventListener('mousedown', closeMenus);
  });

  onDestroy(() => {
    document.removeEventListener('mousedown', closeMenus);
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  });

  // Grid template
  let gridTemplate = $derived(columns.map(c => `${c.width}px`).join(' '));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="block-table" role="region" aria-label="Table">
  <div class="table-scroll-wrap">
    <div class="table-inner">

      <!-- Column headers row -->
      <div class="table-row table-header-row" style="grid-template-columns: 28px {gridTemplate};">
        <!-- Corner cell -->
        <div class="table-corner"></div>
        {#each columns as col, colIdx (col.id)}
          <div class="table-col-header">
            {#if !readonly}
              <button
                class="col-menu-btn"
                onclick={(e) => { e.stopPropagation(); openColMenu(e, col.id); }}
                use:tooltip={{ text: "Column options" }}
              >⋯</button>
            {/if}
            <!-- Resize handle -->
            {#if !readonly}
              <div
                class="col-resize-handle"
                role="separator"
                aria-orientation="vertical"
                onmousedown={(e) => onResizeStart(e, colIdx)}
              ></div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Data rows -->
      {#each rows as row, rowIdx (row.id)}
        <div
          class="table-row"
          class:table-row--header={row.isHeader}
          style="grid-template-columns: 28px {gridTemplate};"
        >
          <!-- Row handle -->
          <div class="table-row-handle">
            {#if !readonly}
              <button
                class="row-menu-btn"
                onclick={(e) => { e.stopPropagation(); openRowMenu(e, row.id); }}
                use:tooltip={{ text: "Row options" }}
              >⋮</button>
            {/if}
          </div>

          <!-- Cells -->
          {#each columns as col, colIdx (col.id)}
            <div
              class="table-cell"
              class:is-header-cell={row.isHeader}
              class:is-editing={editingCell === getCellKey(row.id, col.id)}
              data-cell={getCellKey(row.id, col.id)}
              onclick={(e) => { if (!readonly) { e.stopPropagation(); editingCell = getCellKey(row.id, col.id); focusCell(rowIdx, colIdx); } }}
              ondblclick={(e) => { if (!readonly) { e.stopPropagation(); editingCell = getCellKey(row.id, col.id); focusCell(rowIdx, colIdx); } }}
              onkeydown={(e) => handleCellKey(e, rowIdx, colIdx)}
              role="gridcell"
              tabindex="0"
            >
              {#if editingCell === getCellKey(row.id, col.id) && !readonly}
                <textarea
                  class="cell-input"
                  value={cellText(row.id, col.id)}
                  oninput={(e) => {
                    updateCell(row.id, col.id, (e.target as HTMLTextAreaElement).value);
                    autoResize(e.target as HTMLTextAreaElement);
                  }}
                  onclick={(e) => { e.stopPropagation(); }}
                  onkeydown={(e) => handleCellKey(e, rowIdx, colIdx)}
                  onblur={() => { editingCell = null; }}
                  onmousedown={(e) => e.stopPropagation()}
                  rows={1}
                  spellcheck={false}
                ></textarea>
              {:else}
                <div class="cell-display" class:is-empty={!cellText(row.id, col.id)}>
                  {cellText(row.id, col.id) || ''}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}

      <!-- Add row / add column buttons -->
      {#if !readonly}
        <div class="table-add-row-wrap">
          <button class="table-add-btn" onclick={() => addRow()}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Add row
          </button>
        </div>
      {/if}
    </div>

    {#if !readonly}
      <button class="table-add-col-btn" onclick={() => addColumn()} use:tooltip={{ text: "Add column" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    {/if}
  </div>

  <!-- ── Row context menu ─────────────────────────────────────────── -->
  {#if rowMenuId}
    <div
      class="table-context-menu"
      style="left:{rowMenuPos.x}px; top:{rowMenuPos.y}px;"
      onmousedown={(e) => e.stopPropagation()}
      role="menu"
      tabindex="0"
    >
      <button class="ctx-item" role="menuitem" onclick={() => { addRow(rows.findIndex(r => r.id === rowMenuId)); closeMenus(); }}>Insert row below</button>
      <button class="ctx-item" role="menuitem" onclick={() => { addRow(rows.findIndex(r => r.id === rowMenuId) - 1); closeMenus(); }}>Insert row above</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item" role="menuitem" onclick={() => { moveRowUp(rowMenuId!); closeMenus(); }} disabled={rows.findIndex(r=>r.id===rowMenuId) <= 0}>Move row up</button>
      <button class="ctx-item" role="menuitem" onclick={() => { moveRowDown(rowMenuId!); closeMenus(); }} disabled={rows.findIndex(r=>r.id===rowMenuId) >= rows.length - 1}>Move row down</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item" role="menuitem" onclick={() => { toggleHeader(rowMenuId!); closeMenus(); }}>
        {rows.find(r => r.id === rowMenuId)?.isHeader ? 'Remove header' : 'Make header row'}
      </button>
      <div class="ctx-sep"></div>
      <button class="ctx-item ctx-danger" role="menuitem" onclick={() => { deleteRow(rowMenuId!); closeMenus(); }}>Delete row</button>
    </div>
  {/if}

  <!-- ── Column context menu ─────────────────────────────────────── -->
  {#if colMenuId}
    <div
      class="table-context-menu"
      style="left:{colMenuPos.x}px; top:{colMenuPos.y}px;"
      onmousedown={(e) => e.stopPropagation()}
      role="menu"
      tabindex="0"
    >
      <button class="ctx-item" role="menuitem" onclick={() => { addColumn(columns.findIndex(c => c.id === colMenuId)); closeMenus(); }}>Insert column right</button>
      <button class="ctx-item" role="menuitem" onclick={() => { addColumn(columns.findIndex(c => c.id === colMenuId) - 1); closeMenus(); }}>Insert column left</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item" role="menuitem" onclick={() => { moveColLeft(colMenuId!); closeMenus(); }} disabled={columns.findIndex(c=>c.id===colMenuId) <= 0}>Move column left</button>
      <button class="ctx-item" role="menuitem" onclick={() => { moveColRight(colMenuId!); closeMenus(); }} disabled={columns.findIndex(c=>c.id===colMenuId) >= columns.length - 1}>Move column right</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item ctx-danger" role="menuitem" onclick={() => { deleteColumn(colMenuId!); closeMenus(); }}>Delete column</button>
    </div>
  {/if}
</div>

<style>
  .block-table {
    position: relative;
    width: 100%;
    overflow: visible;
  }

  .table-scroll-wrap {
    display: flex;
    align-items: flex-start;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .table-inner {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* ── Row ───────────────────────────────────────────────────────── */
  .table-row {
    display: grid;
    border-bottom: 1px solid var(--border);
  }

  .table-row:last-child { border-bottom: none; }

  .table-header-row {
    background: color-mix(in srgb, var(--surface) 80%, var(--background));
  }

  .table-row--header .table-cell {
    font-weight: 600;
    background: color-mix(in srgb, var(--surface) 80%, var(--background));
  }

  /* ── Cells ─────────────────────────────────────────────────────── */
  .table-cell {
    position: relative;
    padding: 0;
    border-right: 1px solid var(--border);
    min-height: 36px;
    cursor: text;
    outline: none;
    transition: background 0.1s;
  }

  .table-cell:last-child { border-right: none; }

  .table-cell:focus-within,
  .table-cell.is-editing {
    background: color-mix(in srgb, var(--primary) 5%, var(--surface));
  }

  .cell-display {
    padding: 7px 10px;
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 36px;
    color: var(--foreground);
  }

  .cell-display.is-empty {
    color: var(--muted);
    opacity: 0.3;
  }

  .cell-input {
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: none;
    outline: none;
    box-sizing: border-box;
    min-height: 36px;
    overflow: hidden;
  }

  /* ── Column headers ─────────────────────────────────────────────── */
  .table-col-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 28px;
    padding: 0 4px;
    border-right: 1px solid var(--border);
  }

  .table-col-header:last-child { border-right: none; }

  .col-menu-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.12s;
  }

  .table-col-header:hover .col-menu-btn { opacity: 1; }

  .col-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
  }

  .col-resize-handle:hover { background: var(--primary); opacity: 0.5; }

  /* ── Row handle ─────────────────────────────────────────────────── */
  .table-corner {
    border-right: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 80%, var(--background));
  }

  .table-row-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 60%, var(--background));
  }

  .row-menu-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.12s;
  }

  .table-row:hover .row-menu-btn { opacity: 1; }

  /* ── Add buttons ─────────────────────────────────────────────────── */
  .table-add-row-wrap {
    display: flex;
    border-top: 1px solid var(--border);
  }

  .table-add-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.82rem;
    color: var(--muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    border-radius: 0 0 10px 10px;
    width: 100%;
  }

  .table-add-btn:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); color: var(--foreground); }

  .table-add-col-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    border: 1px solid var(--border);
    border-left: none;
    border-radius: 0 10px 10px 0;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    align-self: stretch;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }

  .table-add-col-btn:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); color: var(--foreground); }

  /* ── Context menus ───────────────────────────────────────────────── */
  .table-context-menu {
    position: fixed;
    z-index: 1000;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 20px oklch(from var(--color-shadow) l c h / 0.1);
    min-width: 160px;
  }

  .ctx-item:disabled { opacity: 0.35; cursor: default; pointer-events: none; }
  .ctx-item {
    all: unset;
    display: block;
    width: 100%;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 0.88rem;
    color: var(--foreground);
    cursor: pointer;
    transition: background 0.1s;
    box-sizing: border-box;
  }

  .ctx-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .ctx-item.ctx-danger { color: var(--destructive, oklch(0.637 0.208 25.331)); }
  .ctx-item.ctx-danger:hover { background: color-mix(in srgb, var(--destructive, oklch(0.637 0.208 25.331)) 8%, transparent); }

  .ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>
