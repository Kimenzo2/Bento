<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { X, ChevronLeft, ChevronRight } from 'lucide-svelte';

  let {
    open = false,
    onClose = () => {},
    onOpenNote = (id: string) => {},
    onOpenDailyNote = (date: string) => {},
  } = $props();

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth());
  let selectedDate = $state(new Date().toISOString().slice(0, 10));
  let notesForDate = $state<any[]>([]);
  let loadingNotes = $state(false);

  function daysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate(); }
  function firstDayOfMonth(y: number, m: number): number { return new Date(y, m, 1).getDay(); }

  function prevMonth() { if (viewMonth === 0) { viewMonth = 11; viewYear--; } else { viewMonth--; } }
  function nextMonth() { if (viewMonth === 11) { viewMonth = 0; viewYear++; } else { viewMonth++; } }

  function selectDate(day: number) {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    selectedDate = d;
    loadNotesForDate(d);
  }

  async function loadNotesForDate(date: string) {
    loadingNotes = true;
    try {
      const all = await invoke<any[]>('notes_list', { includeArchived: false, limit: 200, offset: 0 });
      const dayStart = new Date(date + 'T00:00:00').getTime();
      const dayEnd = dayStart + 86_400_000;
      notesForDate = all.filter((n: any) => {
        const t = n.createdAt ?? n.created_at;
        return t >= dayStart && t < dayEnd;
      });
    } catch {
      notesForDate = [];
    } finally {
      loadingNotes = false;
    }
  }

  function openDailyForDate() {
    onOpenDailyNote(selectedDate);
    onClose();
  }

  function today() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = now.toISOString().slice(0, 10);
    loadNotesForDate(selectedDate);
  }

  let show = $derived(open);
</script>

{#if show}
  <div class="cal-overlay" onclick={() => onClose()} role="presentation">
    <div class="cal-palette" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Calendar">
      <div class="cal-header">
        <span class="cal-title">Calendar</span>
        <button class="cal-close" onclick={() => onClose()} type="button"><X size={14} /></button>
      </div>

      <div class="cal-nav">
        <button class="cal-nav-btn" onclick={prevMonth} type="button"><ChevronLeft size={14} /></button>
        <span class="cal-nav-label">{MONTHS[viewMonth]} {viewYear}</span>
        <button class="cal-nav-btn" onclick={nextMonth} type="button"><ChevronRight size={14} /></button>
        <button class="cal-today-btn" onclick={today} type="button">Today</button>
      </div>

      <div class="cal-grid">
        {#each DAYS as d}
          <span class="cal-day-header">{d}</span>
        {/each}
        {#each Array(firstDayOfMonth(viewYear, viewMonth)) as _}
          <span class="cal-day-empty"></span>
        {/each}
        {#each Array(daysInMonth(viewYear, viewMonth)) as _, i}
          {const day = i + 1}
          {const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
          {const isToday = dateStr === new Date().toISOString().slice(0, 10)}
          {const isSelected = dateStr === selectedDate}
          <button
            class="cal-day"
            class:cal-today={isToday}
            class:cal-selected={isSelected}
            onclick={() => selectDate(day)}
            type="button"
          >{day}</button>
        {/each}
      </div>

      <div class="cal-notes">
        <div class="cal-notes-header">
          <span>Notes for {selectedDate}</span>
          <button class="cal-create-btn" onclick={openDailyForDate} type="button">+ Daily note</button>
        </div>
        {#if loadingNotes}
          <div class="cal-loading">Loading...</div>
        {:else if notesForDate.length === 0}
          <div class="cal-no-notes">No notes for this date</div>
        {:else}
          {#each notesForDate as note (note.id)}
            <button class="cal-note-row" onclick={() => { onOpenNote(note.id); onClose(); }} type="button">
              <span class="cal-note-icon">{note.icon ?? '\u{1F4C4}'}</span>
              <span class="cal-note-title">{note.title || 'Untitled'}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cal-overlay { position: fixed; inset: 0; z-index: 9997; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--background) 60%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); animation: fade-in 0.1s ease; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  .cal-palette { width: 340px; max-height: 540px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-md); display: flex; flex-direction: column; overflow: hidden; animation: slide-up 0.12s cubic-bezier(0.22, 1, 0.36, 1); }
  @keyframes slide-up { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .cal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .cal-title { font-size: 14px; font-weight: 600; color: var(--foreground); }
  .cal-close { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .cal-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .cal-nav { display: flex; align-items: center; gap: 6px; padding: 8px 14px; flex-shrink: 0; }
  .cal-nav-btn { display: grid; place-items: center; width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .cal-nav-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .cal-nav-label { flex: 1; font-size: 13px; font-weight: 600; color: var(--foreground); }
  .cal-today-btn { padding: 3px 10px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--foreground); font: inherit; font-size: 11px; cursor: pointer; }
  .cal-today-btn:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; padding: 4px 10px; }
  .cal-day-header { text-align: center; font-size: 10px; font-weight: 600; color: var(--muted); padding: 4px 0; }

  .cal-day { display: flex; align-items: center; justify-content: center; height: 30px; border: none; border-radius: 6px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; transition: all 80ms ease; }
  .cal-day:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .cal-day.cal-today { font-weight: 700; color: var(--primary); }
  .cal-day.cal-selected { background: var(--primary); color: white; font-weight: 600; }
  .cal-notes { flex: 1; overflow-y: auto; border-top: 1px solid var(--border); padding: 6px; }
  .cal-notes-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; font-size: 11px; color: var(--muted); }
  .cal-create-btn { padding: 2px 8px; border: none; border-radius: 4px; background: var(--primary); color: white; font: inherit; font-size: 10px; cursor: pointer; font-weight: 500; }
  .cal-loading, .cal-no-notes { padding: 16px; text-align: center; font-size: 12px; color: var(--muted); }
  .cal-note-row { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; border: none; border-radius: 4px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
  .cal-note-row:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .cal-note-icon { flex-shrink: 0; }
  .cal-note-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
