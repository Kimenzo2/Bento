<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { X, FileText, Calendar, Clock } from 'lucide-svelte';

  let {
    onClose = () => {},
    onOpenNote = (id: string) => {},
    notes = [] as any[],
  } = $props();

  let viewMode = $state<'grid' | 'list'>('grid');

  function formatDate(ts: number): string {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function groupLabel(note: any): string {
    const d = note.updatedAt ?? note.updated_at;
    return formatDate(d);
  }

  let grouped = $derived.by(() => {
    const groups: Record<string, any[]> = {};
    for (const n of notes) {
      const label = groupLabel(n);
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    }
    const order = ['Today', 'Yesterday'];
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1; if (bi !== -1) return 1;
      return 0;
    });
  });
</script>

<div class="alldocs-overlay" onclick={() => onClose()} role="presentation">
  <div class="alldocs" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="All notes">
    <div class="alldocs-header">
      <h2 class="alldocs-title">All Notes</h2>
      <div class="alldocs-actions">
        <button class="alldocs-view-btn" class:active={viewMode === 'grid'} onclick={() => viewMode = 'grid'} type="button" aria-label="Grid view" title="Grid view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button class="alldocs-view-btn" class:active={viewMode === 'list'} onclick={() => viewMode = 'list'} type="button" aria-label="List view" title="List view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button class="alldocs-close" onclick={() => onClose()} type="button"><X size={14} /></button>
      </div>
    </div>

    <div class="alldocs-body">
      {#each grouped as [label, items]}
        <div class="alldocs-group">
          <div class="alldocs-group-label">{label}</div>
          {#if viewMode === 'grid'}
            <div class="alldocs-grid">
              {#each items as note (note.id)}
                <button class="alldocs-card" onclick={() => onOpenNote(note.id)} type="button">
                  <span class="alldocs-card-icon">{note.icon ?? '\u{1F4C4}'}</span>
                  <span class="alldocs-card-title">{note.title?.trim() || 'Untitled'}</span>
                  {#if note.preview}
                    <span class="alldocs-card-preview">{note.preview}</span>
                  {/if}
                  <span class="alldocs-card-date">{formatDate(note.updatedAt ?? note.updated_at)}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="alldocs-list">
              {#each items as note (note.id)}
                <button class="alldocs-list-item" onclick={() => onOpenNote(note.id)} type="button">
                  <span class="alldocs-list-icon">{note.icon ?? '\u{1F4C4}'}</span>
                  <span class="alldocs-list-title">{note.title?.trim() || 'Untitled'}</span>
                  <span class="alldocs-list-date">{formatDate(note.updatedAt ?? note.updated_at)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .alldocs-overlay { position: fixed; inset: 0; z-index: 9995; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, #000 30%, transparent); }
  .alldocs { width: 640px; max-height: 560px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; }
  .alldocs-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .alldocs-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--foreground); }
  .alldocs-actions { display: flex; align-items: center; gap: 4px; }
  .alldocs-view-btn { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; transition: background 100ms ease, color 100ms ease; }
  .alldocs-view-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .alldocs-view-btn.active { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
  .alldocs-close { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .alldocs-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .alldocs-body { flex: 1; overflow-y: auto; padding: 8px 12px; }
  .alldocs-group { margin-bottom: 16px; }
  .alldocs-group-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; padding: 0 4px; }
  .alldocs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
  .alldocs-card { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--foreground); cursor: pointer; text-align: left; font: inherit; transition: border-color 100ms ease, background 100ms ease; }
  .alldocs-card:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 5%, transparent); }
  .alldocs-card-icon { font-size: 20px; }
  .alldocs-card-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alldocs-card-preview { font-size: 11px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-clamp: 2; }
  .alldocs-card-date { font-size: 10px; color: var(--muted); }
  .alldocs-list { display: flex; flex-direction: column; gap: 2px; }
  .alldocs-list-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: none; border-radius: 6px; background: transparent; color: var(--foreground); cursor: pointer; font: inherit; text-align: left; width: 100%; transition: background 100ms ease; }
  .alldocs-list-item:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .alldocs-list-icon { font-size: 16px; flex-shrink: 0; }
  .alldocs-list-title { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alldocs-list-date { font-size: 11px; color: var(--muted); flex-shrink: 0; }
</style>
