<script lang="ts">
  import { MoreHorizontal } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu/index.js';

  type TelemetryTableColumn = {
    key: string;
    label: string;
    align?: 'start' | 'end' | 'center';
  };

  type TelemetryTableAction = {
    label: string;
    run: () => void;
    disabled?: boolean;
  };

  type TelemetryTableRow = {
    id: string;
    cells: Record<string, string | number>;
    actions?: TelemetryTableAction[];
  };

  export let columns: TelemetryTableColumn[] = [];
  export let rows: TelemetryTableRow[] = [];
  export let emptyLabel = 'No rows available.';
  export let dense = false;

  function alignClass(align: TelemetryTableColumn['align']) {
    if (align === 'end') return 'telemetry-table-cell--end';
    if (align === 'center') return 'telemetry-table-cell--center';
    return 'telemetry-table-cell--start';
  }

  function toneForValue(value: string | number) {
    const normalized = String(value).toLowerCase();
    if (normalized.includes('healthy') || normalized.includes('resolved') || normalized.includes('auto-pruned')) {
      return 'success';
    }
    if (normalized.includes('watch') || normalized.includes('slow') || normalized.includes('warn')) {
      return 'warning';
    }
    if (normalized.includes('critical') || normalized.includes('open')) {
      return 'danger';
    }
    return null;
  }

  function badgeClass(value: string | number) {
    const tone = toneForValue(value);
    return tone ? `telemetry-table-badge telemetry-table-badge--${tone}` : 'telemetry-table-badge';
  }
</script>

<div class={`telemetry-table-shell ${dense ? 'telemetry-table-shell--dense' : ''}`}>
  <table class="telemetry-table">
    <thead>
      <tr>
        {#each columns as column}
          <th class={alignClass(column.align)}>{column.label}</th>
        {/each}
        {#if rows.some((row) => (row.actions?.length ?? 0) > 0)}
          <th class="telemetry-table-cell--end">Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#if rows.length === 0}
        <tr>
          <td class="telemetry-table-empty" colspan={columns.length + 1}>{emptyLabel}</td>
        </tr>
      {:else}
        {#each rows as row}
          <tr>
            {#each columns as column}
              <td class={alignClass(column.align)}>
                {#if column.key === 'status' || column.key === 'severity' || toneForValue(row.cells[column.key])}
                  {#if toneForValue(row.cells[column.key])}
                    <Badge variant="outline" class={badgeClass(row.cells[column.key])}>
                      {row.cells[column.key]}
                    </Badge>
                  {:else}
                    {row.cells[column.key]}
                  {/if}
                {:else if column.key === 'table' || column.key === 'command' || column.key === 'process'}
                  <span class="telemetry-table-primary">{row.cells[column.key]}</span>
                {:else if column.key === 'detail' || column.key === 'fix' || column.key === 'event'}
                  <span class="telemetry-table-secondary">{row.cells[column.key]}</span>
                {:else}
                  {row.cells[column.key]}
                {/if}
              </td>
            {/each}
            {#if rows.some((item) => (item.actions?.length ?? 0) > 0)}
              <td class="telemetry-table-cell--end">
                {#if row.actions?.length}
                  <div class="telemetry-table-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        class="telemetry-table-action telemetry-table-action--menu"
                        aria-label="Open row actions"
                      >
                          <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="telemetry-table-menu">
                        {#each row.actions as action}
                          <DropdownMenuItem
                            class="telemetry-table-menu-item"
                            disabled={action.disabled}
                            onclick={action.run}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        {/each}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .telemetry-table-shell {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--border);
    border-radius: 0.95rem;
    background: color-mix(in srgb, var(--surface) 98%, transparent);
  }

  .telemetry-table {
    width: 100%;
    min-width: 1100px;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .telemetry-table thead th {
    height: 3rem;
    padding: 0 1rem;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 90%, var(--background));
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .telemetry-table tbody td {
    padding: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
    color: var(--foreground);
    font-size: 0.92rem;
    vertical-align: middle;
  }

  .telemetry-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .telemetry-table tbody tr:hover td {
    background: color-mix(in srgb, var(--surface) 94%, var(--telemetry-accent-soft));
  }

  .telemetry-table-cell--start {
    text-align: left;
  }

  .telemetry-table-cell--end {
    text-align: right;
  }

  .telemetry-table-cell--center {
    text-align: center;
  }

  .telemetry-table-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 2rem;
  }

  .telemetry-table-action {
    min-height: 1.9rem;
    padding-inline: 0.55rem;
    border-radius: 0.45rem;
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .telemetry-table-action--menu {
    width: 2rem;
    min-width: 2rem;
    padding-inline: 0;
  }

  .telemetry-table-menu {
    width: 11rem;
  }

  .telemetry-table-menu-item {
    cursor: default;
  }

  .telemetry-table-empty {
    padding: 2rem 1rem !important;
    text-align: center;
    color: var(--muted);
  }

  .telemetry-table-primary {
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .telemetry-table-secondary {
    color: var(--foreground);
    opacity: 0.88;
  }

  .telemetry-table-badge {
    min-height: 1.55rem;
    padding-inline: 0.55rem;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .telemetry-table-badge--success {
    border-color: color-mix(in srgb, #10b981 40%, var(--border));
    color: #34d399;
    background: color-mix(in srgb, #10b981 10%, transparent);
  }

  .telemetry-table-badge--warning {
    border-color: color-mix(in srgb, #f59e0b 40%, var(--border));
    color: #fbbf24;
    background: color-mix(in srgb, #f59e0b 10%, transparent);
  }

  .telemetry-table-badge--danger {
    border-color: color-mix(in srgb, #ef4444 40%, var(--border));
    color: #f87171;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .telemetry-table-shell--dense .telemetry-table tbody td {
    padding-block: 0.8rem;
  }
</style>
