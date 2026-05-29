<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // BlockRelation.svelte — Port of anytype-ts/block/relation.tsx
  // Renders key–value relation cells inside a note block
  // ════════════════════════════════════════════════════════════════════
  import { invoke } from '@tauri-apps/api/core';
  import type { Block } from '$lib/local-store/block';

  let { block, readonly = false, objectId = '' }: {
    block: Block;
    readonly?: boolean;
    objectId?: string;
  } = $props();

  // Read content inside a $derived so block prop changes propagate
  let content = $derived(block.content as any);
  let relationKey = $derived<string>(content?.key ?? '');
  let relationName = $derived<string>(content?.relationName ?? relationKey);
  let relationFormat = $derived<string>(content?.relationFormat ?? 'text');

  // Mutable editing state — must be $state so updates trigger re-render
  let value = $derived<string>((block.content as any)?.value ?? '');
  let isEditing = $state(false);
  let editValue = $state('');

  async function saveRelation() {
    if (!objectId || !relationKey) return;
    isEditing = false;
    value = editValue;
    try {
      await invoke('local_store_set_relation', {
        objectId,
        key: relationKey,
        value: editValue,
      });
    } catch (e) {
      console.error('[BlockRelation] save failed:', e);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') saveRelation();
    if (e.key === 'Escape') { isEditing = false; editValue = value; }
  }

  const formatIcons: Record<string, string> = {
    text: '📝', longtext: '📃', number: '#', select: '◉',
    multiselect: '◉', date: '📅', file: '📎', checkbox: '☑',
    url: '🔗', email: '✉️', phone: '📞',
  };

  let icon = $derived(formatIcons[relationFormat] ?? '•');
</script>

<div class="block-relation" class:is-readonly={readonly}>
  {#if !relationKey}
    <div class="relation-empty">
      <span class="relation-icon">+</span>
      <span>Add a relation</span>
    </div>
  {:else}
    <div class="relation-row">
      <!-- Left: name + format icon -->
      <div class="relation-info">
        <span class="relation-icon" aria-hidden="true">{icon}</span>
        <span class="relation-name">{relationName || relationKey}</span>
      </div>

      <!-- Right: value cell -->
      {#if isEditing && !readonly}
        <div class="relation-cell relation-cell--editing">
          {#if relationFormat === 'checkbox'}
            <input
              type="checkbox"
              class="relation-checkbox"
              checked={editValue === 'true'}
              onchange={(e) => { editValue = String((e.target as HTMLInputElement).checked); saveRelation(); }}
            />
          {:else}
            <input
              type={relationFormat === 'url' ? 'url' : relationFormat === 'email' ? 'email' : relationFormat === 'number' ? 'number' : 'text'}
              class="relation-input"
              bind:value={editValue}
              onkeydown={handleKey}
              onblur={saveRelation}
            />
          {/if}
        </div>
      {:else}
        <button
          class="relation-cell relation-cell--display"
          class:is-empty={!value}
          onclick={() => { if (!readonly) { editValue = value; isEditing = true; } }}
          disabled={readonly}
        >
          {#if relationFormat === 'checkbox'}
            <span class="relation-check-icon">
              {value === 'true'
                ? '☑'
                : '☐'}
            </span>
          {:else if value}
            <span class="relation-value">{value}</span>
          {:else}
            <span class="relation-placeholder">Empty</span>
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .block-relation {
    width: 100%;
    padding: 2px 0;
  }

  .relation-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px dashed var(--border);
    border-radius: 8px;
    color: var(--muted);
    font-size: 0.88rem;
    cursor: pointer;
  }

  .relation-row {
    display: grid;
    grid-template-columns: minmax(120px, 200px) 1fr;
    align-items: center;
    gap: 16px;
    padding: 6px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  }

  .relation-row:last-child { border-bottom: none; }

  .relation-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .relation-icon {
    font-size: 0.85rem;
    flex-shrink: 0;
    opacity: 0.5;
  }

  .relation-name {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .relation-cell {
    min-width: 0;
    text-align: left;
  }

  .relation-cell--display {
    all: unset;
    display: block;
    padding: 4px 8px;
    border-radius: 6px;
    font: inherit;
    font-size: 0.9rem;
    color: var(--foreground);
    cursor: pointer;
    width: 100%;
    transition: background 0.12s;
  }

  .relation-cell--display:not([disabled]):hover {
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  .relation-value {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .relation-placeholder {
    color: var(--muted);
    opacity: 0.5;
    font-size: 0.88rem;
  }

  .relation-cell--editing {
    padding: 0;
  }

  .relation-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--primary);
    border-radius: 6px;
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    font-size: 0.9rem;
    outline: none;
    box-sizing: border-box;
  }

  .relation-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
    cursor: pointer;
  }

  .relation-check-icon {
    font-size: 1rem;
  }

  .is-readonly .relation-cell--display {
    cursor: default;
  }
</style>
