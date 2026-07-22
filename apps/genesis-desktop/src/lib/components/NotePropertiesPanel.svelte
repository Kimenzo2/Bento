<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { X, Calendar, Clock, Hash, FileText } from 'lucide-svelte';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let {
    noteId = '',
    onClose = () => {},
  } = $props();

  let note = $state<any | null>(null);
  let loading = $state(true);

  async function loadNote() {
    if (!noteId) return;
    loading = true;
    try {
      const result = await invoke<any>('notes_object_get', { noteId });
      note = result;
    } catch (err) {
      console.error('[properties] load failed:', err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (noteId) void loadNote();
    else { note = null; loading = false; }
  });

  function formatDate(ts: number): string {
    if (!ts) return 'Unknown';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function countWords(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }
</script>

<div class="properties-panel">
  <div class="properties-header">
    <span class="properties-title">Properties</span>
    <button class="properties-close" onclick={() => onClose()} aria-label="Close" type="button" use:tooltip={{ text: "Close" }}><X size={14} /></button>
  </div>

  {#if loading}
    <div class="properties-loading"><div class="spinner"></div></div>
  {:else if note}
    <div class="properties-body">
      <div class="prop-row">
        <Calendar size={13} />
        <span class="prop-label">Created</span>
        <span class="prop-value">{formatDate(note.createdAt ?? note.created_at)}</span>
      </div>
      <div class="prop-row">
        <Clock size={13} />
        <span class="prop-label">Updated</span>
        <span class="prop-value">{formatDate(note.updatedAt ?? note.updated_at)}</span>
      </div>
      {#if note.tags && note.tags.length > 0}
        <div class="prop-row prop-tags-row">
          <Hash size={13} />
          <span class="prop-label">Tags</span>
          <span class="prop-tags">
              {#each note.tags as tag, i}
              <span class="prop-tag">{tag}</span>
            {/each}
          </span>
        </div>
      {/if}
      <div class="prop-row">
        <FileText size={13} />
        <span class="prop-label">ID</span>
        <span class="prop-value prop-id">{noteId}</span>
      </div>
    </div>
  {:else}
    <div class="properties-loading">No note selected</div>
  {/if}
</div>

<style>
  .properties-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .properties-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .properties-title { font-size: 12px; font-weight: 600; color: var(--foreground); text-transform: uppercase; letter-spacing: 0.05em; }
  .properties-close { display: grid; place-items: center; width: 22px; height: 22px; border: none; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; }
  .properties-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .properties-loading { display: flex; align-items: center; justify-content: center; padding: 24px; color: var(--muted); font-size: 12px; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--muted); border-radius: 50%; animation: spin 0.7s linear; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .properties-body { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .prop-row { display: flex; align-items: center; gap: 6px; padding: 5px 6px; border-radius: 4px; font-size: 11px; color: var(--foreground); }
  .prop-row:hover { background: color-mix(in srgb, var(--foreground) 3%, transparent); }
  .prop-label { color: var(--muted); flex-shrink: 0; min-width: 48px; }
  .prop-value { color: var(--foreground); font-size: 11px; }
  .prop-id { font-family: monospace; font-size: 10px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
  .prop-tags-row { flex-wrap: wrap; }
  .prop-tags { display: flex; flex-wrap: wrap; gap: 3px; }
  .prop-tag { display: inline-flex; padding: 1px 5px; border-radius: 3px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-size: 10px; font-weight: 500; }
</style>
