<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { X, Calendar, Clock } from 'lucide-svelte';

  let {
    onClose = () => {},
    onOpenNote = (id: string) => {},
  } = $props();

  let days = $state<{ dateKey: string; label: string; notes: any[] }[]>([]);
  let loading = $state(true);
  let selectedDay = $state<string | null>(null);

  async function loadActivity() {
    loading = true;
    try {
      const all = await invoke<any[]>('notes_list', { includeArchived: false, limit: 200, offset: 0 });
      const grouped: Record<string, any[]> = {};
      for (const note of all) {
        const d = new Date(note.updatedAt ?? note.updated_at);
        const key = d.toISOString().slice(0, 10);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      }
      const sorted = Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 30)
        .map(([dateKey, notes]) => {
          const d = new Date(dateKey + 'T12:00:00');
          const today = new Date();
          const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
          let label = dateKey;
          if (d.toDateString() === today.toDateString()) label = 'Today';
          else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
          else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          return { dateKey, label, notes };
        });
      days = sorted;
      if (sorted.length > 0) selectedDay = sorted[0].dateKey;
    } catch (err) {
      console.error('[activity] load failed:', err);
    } finally {
      loading = false;
    }
  }

  function activeNotes() {
    return days.find(d => d.dateKey === selectedDay)?.notes ?? [];
  }

  $effect(() => { void loadActivity(); });
</script>

<div class="activity-overlay" onclick={() => onClose()} role="presentation">
  <div class="activity" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Activity timeline">
    <div class="activity-header">
      <h2 class="activity-title">Activity Timeline</h2>
      <button class="activity-close" onclick={() => onClose()} type="button"><X size={14} /></button>
    </div>

    <div class="activity-body">
      {#if loading}
        <div class="activity-loading"><div class="spinner"></div><span>Loading...</span></div>
      {:else if days.length === 0}
        <div class="activity-empty">No recent activity</div>
      {:else}
        <div class="activity-sidebar">
          {#each days as day}
            <button
              class="activity-day-btn"
              class:active={selectedDay === day.dateKey}
              onclick={() => selectedDay = day.dateKey}
              type="button"
            >
              <span class="activity-day-label">{day.label}</span>
              <span class="activity-day-count">{day.notes.length}</span>
            </button>
          {/each}
        </div>
        <div class="activity-content">
          <div class="activity-content-header">
            <span class="activity-content-date">{days.find(d => d.dateKey === selectedDay)?.label ?? ''}</span>
          </div>
          <div class="activity-notes">
            {#each activeNotes() as note (note.id)}
              <button class="activity-note" onclick={() => { onOpenNote(note.id); onClose(); }} type="button">
                <span class="activity-note-icon">{note.icon ?? '\u{1F4C4}'}</span>
                <div class="activity-note-body">
                  <span class="activity-note-title">{note.title?.trim() || 'Untitled'}</span>
                  {#if note.preview}
                    <span class="activity-note-preview">{note.preview}</span>
                  {/if}
                </div>
                <span class="activity-note-time">{new Date(note.updatedAt ?? note.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .activity-overlay { position: fixed; inset: 0; z-index: 9994; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--background) 60%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .activity { position: relative; width: 680px; height: 500px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; }
  .activity-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .activity-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--foreground); }
  .activity-close { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .activity-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .activity-body { flex: 1; display: flex; overflow: hidden; }
  .activity-loading, .activity-empty { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; color: var(--muted); font-size: 13px; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--muted); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .activity-sidebar { width: 180px; overflow-y: auto; border-right: 1px solid var(--border); padding: 6px; flex-shrink: 0; }
  .activity-day-btn { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 8px; border: none; border-radius: 6px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; text-align: left; transition: background 100ms ease; }
  .activity-day-btn:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .activity-day-btn.active { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-weight: 600; }
  .activity-day-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .activity-day-count { font-size: 11px; color: var(--muted); font-weight: 500; }
  .activity-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .activity-content-header { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--foreground); flex-shrink: 0; }
  .activity-notes { flex: 1; overflow-y: auto; padding: 6px; }
  .activity-note { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; color: var(--foreground); font: inherit; text-align: left; cursor: pointer; transition: background 100ms ease; }
  .activity-note:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .activity-note-icon { font-size: 18px; flex-shrink: 0; }
  .activity-note-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .activity-note-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .activity-note-preview { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .activity-note-time { font-size: 11px; color: var(--muted); flex-shrink: 0; }
</style>
