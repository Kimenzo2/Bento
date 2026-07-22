<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { untrack } from 'svelte';
  import { ArrowLeft, FileText } from 'lucide-svelte';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  interface Backlink {
    id: string;
    sourceNoteId: string;
    sourceTitle: string;
    sourceIcon: string | null;
    targetTitle: string;
    createdAt: number;
  }

  let {
    noteId = '',
    onNavigateTo = (id: string) => {},
    onClose = () => {},
  } = $props();

  let backlinks = $state<Backlink[]>([]);
  let loading = $state(false);

  let cancel: AbortController | null = null;
  $effect(() => {
    if (!noteId) { backlinks = []; return; }
    untrack(() => cancel?.abort());
    const ctrl = new AbortController();
    cancel = ctrl;
    loading = true;
    const token = ctrl.signal;
    invoke<Backlink[]>('notes_get_backlinks', { noteId })
      .then((result) => { if (!token.aborted) backlinks = result; })
      .catch((err) => { if (!token.aborted) { console.error('[backlinks] load failed:', err); backlinks = []; } })
      .finally(() => { if (!token.aborted) loading = false; });
    return () => ctrl.abort();
  });

  function formatDate(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
</script>

<div class="backlinks-panel">
  <div class="backlinks-header">
    <button class="backlinks-back" onclick={() => onClose()} aria-label="Close backlinks" type="button" use:tooltip={{ text: "Close backlinks" }}>
      <ArrowLeft size={14} />
    </button>
    <span class="backlinks-title">Backlinks</span>
    {#if !loading}
      <span class="backlinks-count">{backlinks.length}</span>
    {/if}
  </div>
  <div class="backlinks-body">
    {#if loading}
      <div class="backlinks-empty">
        <div class="bl-spinner"></div>
        <span>Loading…</span>
      </div>
    {:else if backlinks.length === 0}
      <div class="backlinks-empty">
        <FileText size={20} strokeWidth={1} class="bl-empty-icon" />
        <span>No backlinks</span>
        <p class="bl-empty-hint">Other notes can link here using [[Note Title]]</p>
      </div>
    {:else}
      {#each backlinks as bl (bl.id)}
        <button class="backlink-item" onclick={() => onNavigateTo(bl.sourceNoteId)} type="button">
          <span class="bl-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 1.5C3.5 1.22 3.72 1 4 1H10.5L12.5 3V4.5H12C11.72 4.5 11.5 4.72 11.5 5V14.5H4C3.72 14.5 3.5 14.28 3.5 14V1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 1V3H12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 6.5H10M5.5 9H10M5.5 11.5H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
          <span class="bl-body">
            <span class="bl-title">{bl.sourceTitle || 'Untitled'}</span>
            <span class="bl-date">{formatDate(bl.createdAt)}</span>
          </span>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .backlinks-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    background: color-mix(in srgb, var(--foreground) 1%, var(--background));
    width: 240px;
    flex-shrink: 0;
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    flex-shrink: 0;
  }

  .backlinks-back {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .backlinks-back:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }

  .backlinks-title { font-size: 13px; font-weight: 600; color: var(--foreground); flex: 1; }

  .backlinks-count {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: color-mix(in srgb, var(--foreground) 45%, transparent);
  }

  .backlinks-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .backlinks-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
    font-size: 12px;
    text-align: center;
  }

  .bl-empty-icon { opacity: 0.3; }
  .bl-empty-hint { margin: 0; font-size: 11px; color: color-mix(in srgb, var(--foreground) 25%, transparent); }

  .bl-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-top-color: color-mix(in srgb, var(--foreground) 50%, transparent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .backlink-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background 80ms ease;
  }
  .backlink-item:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }

  .bl-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; height: 18px; text-align: center; color: var(--muted); }
  .bl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .bl-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bl-date { font-size: 10px; color: color-mix(in srgb, var(--foreground) 35%, transparent); }
</style>
