<script lang="ts">
  import { MoreHorizontal } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
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
    if (align === 'end') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
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
  <Table.Root class="telemetry-table">
    <Table.Header>
      <Table.Row class="telemetry-table-header-row">
        {#each columns as column}
          <Table.Head class={alignClass(column.align)}>{column.label}</Table.Head>
        {/each}
        {#if rows.some((row) => (row.actions?.length ?? 0) > 0)}
          <Table.Head class="text-right">Actions</Table.Head>
        {/if}
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#if rows.length === 0}
        <Table.Row>
          <Table.Cell class="telemetry-table-empty" colspan={columns.length + 1}>{emptyLabel}</Table.Cell>
        </Table.Row>
      {:else}
        {#each rows as row}
          <Table.Row class="telemetry-table-body-row">
            {#each columns as column}
              <Table.Cell class={alignClass(column.align)}>
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
              </Table.Cell>
            {/each}
            {#if rows.some((item) => (item.actions?.length ?? 0) > 0)}
              <Table.Cell class="text-right">
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
              </Table.Cell>
            {/if}
          </Table.Row>
        {/each}
      {/if}
    </Table.Body>
  </Table.Root>
</div>

<style>
  .telemetry-table-shell {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--surface) 98%, transparent);
  }

  :global(.telemetry-table) {
    min-width: 800px;
  }

  :global(.telemetry-table-header-row) {
    background: color-mix(in srgb, var(--surface) 90%, var(--background));
  }

  :global(.telemetry-table-body-row:hover) {
    background: color-mix(in srgb, var(--surface) 94%, var(--telemetry-accent-soft));
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

  :global(.telemetry-table-badge) {
    min-height: 1.55rem;
    padding-inline: 0.55rem;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  :global(.telemetry-table-badge--success) {
    border-color: color-mix(in srgb, #10b981 40%, var(--border));
    color: #34d399;
    background: color-mix(in srgb, #10b981 10%, transparent);
  }

  :global(.telemetry-table-badge--warning) {
    border-color: color-mix(in srgb, #f59e0b 40%, var(--border));
    color: #fbbf24;
    background: color-mix(in srgb, #f59e0b 10%, transparent);
  }

  :global(.telemetry-table-badge--danger) {
    border-color: color-mix(in srgb, #ef4444 40%, var(--border));
    color: #f87171;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .telemetry-table-shell--dense :global([data-slot="table-cell"]) {
    padding-block: 0.5rem;
  }
</style>
