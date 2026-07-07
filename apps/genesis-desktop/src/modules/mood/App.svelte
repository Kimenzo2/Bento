<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import HeartHandshakeIcon from "@lucide/svelte/icons/heart-handshake";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import CheckIcon from "@lucide/svelte/icons/check";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    getModuleSectionLabel, moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { onMount } from "svelte";
  import { time } from '$lib/utils/time';

  const moduleId = "mood";
  const sectionLabels = ["Check-in", "Calendar", "Activities", "Export"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Types ────────────────────────────────────────────────────────────────
  type CheckinRow = {
    id: string; mood: string; intensity: number; note: string | null;
    activities: string[]; loggedAt: number; dateKey: string;
  };
  type MoodStats     = { streak: number; total: number; greatDays: number; calmDays: number; };
  type ActivityRow   = { id: string; name: string; createdAt: number; };
  type MoodPattern   = { label: string; value: number; note: string; positive: boolean; };
  type PrivateNote   = { id: string; content: string; createdAt: number; };

  // ── Static mood definitions ───────────────────────────────────────────────
  const journalMoods = [
    { id: 'awful', label: 'Awful', color: '#ef4444' },
    { id: 'low',   label: 'Low',   color: '#f97316' },
    { id: 'okay',  label: 'Okay',  color: '#eab308' },
    { id: 'good',  label: 'Good',  color: '#22c55e' },
    { id: 'great', label: 'Great', color: '#8b5cf6' },
  ];

  const moods = [
    { id: "drained",   label: "Drained",   emoji: "😞", intensity: 24 },
    { id: "restless",  label: "Restless",  emoji: "😕", intensity: 39 },
    { id: "steady",    label: "Steady",    emoji: "🙂", intensity: 64 },
    { id: "bright",    label: "Bright",    emoji: "😊", intensity: 82 },
    { id: "energized", label: "Energized", emoji: "🤩", intensity: 91 },
  ] as const;

  // ── Reactive state ───────────────────────────────────────────────────────
  let selectedMood       = $state("steady");
  let selectedJournalMood = $state('good');
  let noteText           = $state("");
  let selectedActivities: string[] = $state([]);

  // DB data
  let stats:           MoodStats   = $state({ streak: 0, total: 0, greatDays: 0, calmDays: 0 });
  let todayCheckins:   CheckinRow[] = $state([]);
  let monthCheckins:   CheckinRow[] = $state([]);
  let activityLibrary: ActivityRow[] = $state([]);
  let patterns:        MoodPattern[] = $state([]);
  let privateNotes:    PrivateNote[] = $state([]);

  // UI state
  let saving          = $state(false);
  let saved           = $state(false);
  let saveError       = $state("");
  let appLoading      = true;
  let newActivityName = $state("");
  let addingActivity  = $state(false);
  let newNoteText     = "";
  let savingNote      = false;
  let noteSaved       = false;
  let currentMonth    = time.toISOMonth(time.now()); // "2026-05"

  let selectedMoodEntry = $derived(moods.find(m => m.id === selectedMood) ?? moods[2]);

  function journalMoodColor(id: string | null) {
    return journalMoods.find(m => m.id === id)?.color ?? '#666';
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────
  let calendarMap = $derived.by(() => {
    const m = new Map<string, CheckinRow>();
    for (const c of monthCheckins) m.set(c.dateKey, c);
    return m;
  });

  let daysInMonth = $derived.by(() => {
    const [y, mo] = currentMonth.split("-").map(Number);
    return time.getMonthDays(y)[mo];
  });

  function moodEmoji(mood: string) {
    return moods.find(m => m.id === mood)?.emoji ?? "·";
  }

  function moodColor(moodId: string): string {
    const map: Record<string, string> = {
      drained:   'var(--mood-muted)',
      restless:  '#f97316',
      steady:    '#eab308',
      bright:    '#22c55e',
      energized: '#8b5cf6',
    };
    return map[moodId] ?? 'var(--mood-muted)';
  }

  // ── Activity helpers ──────────────────────────────────────────────────────
  function toggleActivity(name: string) {
    selectedActivities = selectedActivities.includes(name)
      ? selectedActivities.filter(a => a !== name)
      : [...selectedActivities, name];
  }

  // ── Activity correlations (computed from month data) ─────────────────────
  let activityCorrelations = $derived.by(() => {
    const map = new Map<string, number[]>();
    for (const c of monthCheckins) {
      for (const a of c.activities) {
        if (!map.has(a)) map.set(a, []);
        map.get(a)!.push(c.intensity);
      }
    }
    return [...map.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([name, scores]) => ({
        name,
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  });

  // ── Data loaders ─────────────────────────────────────────────────────────
  async function loadAll() {
    appLoading = true;
    await Promise.all([
      loadStats(),
      loadTodayCheckins(),
      loadMonthCheckins(),
      loadActivityLibrary(),
      loadPatterns(),
      loadPrivateNotes(),
    ]);
    appLoading = false;
  }

  async function loadStats() {
    try { stats = await invoke("mood_stats"); }
    catch (e) { console.error("mood_stats:", e); }
  }

  async function loadTodayCheckins() {
    try { todayCheckins = await invoke("mood_checkins_today"); }
    catch (e) { console.error("mood_checkins_today:", e); }
  }

  async function loadMonthCheckins() {
    try { monthCheckins = await invoke("mood_checkins_month", { month: currentMonth }); }
    catch (e) { console.error("mood_checkins_month:", e); }
  }

  async function loadActivityLibrary() {
    try { activityLibrary = await invoke("mood_activity_library"); }
    catch (e) { console.error("mood_activity_library:", e); }
  }

  async function loadPatterns() {
    try { patterns = await invoke("mood_patterns"); }
    catch (e) { console.error("mood_patterns:", e); }
  }

  async function loadPrivateNotes() {
    try { privateNotes = await invoke("mood_private_notes_list"); }
    catch (e) { console.error("mood_private_notes_list:", e); }
  }

  // ── Check-in save ─────────────────────────────────────────────────────────
  async function saveCheckin() {
    saving = true; saveError = "";
    try {
      const row: CheckinRow = await invoke("mood_checkin_save", {
        entry: {
          mood:       selectedMood,
          intensity:  selectedMoodEntry.intensity,
          note:       noteText.trim() || null,
          activities: selectedActivities,
        },
      });
      todayCheckins = [...todayCheckins, row];
      monthCheckins = [...monthCheckins, row];
      noteText = ""; selectedActivities = [];
      saved = true; setTimeout(() => (saved = false), 2500);
      await loadStats();
    } catch (e: any) {
      saveError = String(e);
      console.error("mood_checkin_save:", e);
    } finally { saving = false; }
  }

  async function deleteCheckin(id: string) {
    if (!confirm(_t('moduleMoodDeleteConfirm'))) return;
    try {
      await invoke("mood_checkin_delete", { id });
      todayCheckins  = todayCheckins.filter(c => c.id !== id);
      monthCheckins  = monthCheckins.filter(c => c.id !== id);
      await loadStats();
    } catch (e) { console.error("mood_checkin_delete:", e); }
  }

  // ── Activity management ───────────────────────────────────────────────────
  async function addActivity() {
    if (!newActivityName.trim()) return;
    addingActivity = true;
    try {
      const row: ActivityRow = await invoke("mood_activity_add", { name: newActivityName.trim() });
      activityLibrary = [...activityLibrary.filter(a => a.id !== row.id), row]
        .sort((a, b) => a.name.localeCompare(b.name));
      newActivityName = "";
    } catch (e) { console.error("mood_activity_add:", e); }
    finally { addingActivity = false; }
  }

  async function deleteActivity(id: string) {
    try {
      await invoke("mood_activity_delete", { id });
      activityLibrary = activityLibrary.filter(a => a.id !== id);
    } catch (e) { console.error("mood_activity_delete:", e); }
  }

  // ── Private notes ─────────────────────────────────────────────────────────
  async function savePrivateNote() {
    if (!newNoteText.trim()) return;
    savingNote = true;
    try {
      const row: PrivateNote = await invoke("mood_private_note_save", { content: newNoteText.trim() });
      privateNotes = [row, ...privateNotes];
      newNoteText = "";
      noteSaved = true; setTimeout(() => (noteSaved = false), 2000);
    } catch (e) { console.error("mood_private_note_save:", e); }
    finally { savingNote = false; }
  }

  async function deletePrivateNote(id: string) {
    try {
      await invoke("mood_private_note_delete", { id });
      privateNotes = privateNotes.filter(n => n.id !== id);
    } catch (e) { console.error("mood_private_note_delete:", e); }
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  let exportingCsv  = false;
  let exportingPdf  = false;
  let exportingRecap = false;

  async function doExport(type: "csv" | "pdf" | "recap") {
    if (type === "csv")   exportingCsv   = true;
    if (type === "pdf")   exportingPdf   = true;
    if (type === "recap") exportingRecap = true;
    try {
      const dir: string | null = await invoke("pick_export_directory");
      if (!dir) return;

      let content = "";
      let filename = "";

      if (type === "csv") {
        const rows = monthCheckins.map(c =>
          [c.dateKey, c.mood, c.intensity, c.activities.join("|"), c.note ?? ""].join(",")
        );
        content  = ["date,mood,intensity,activities,note", ...rows].join("\n");
        filename = `mood-timeline-${currentMonth}.csv`;
      } else if (type === "pdf") {
        const lines = [
          "MOOD REPORT — " + time.formatDate(time.now(), 'MMMM D, YYYY'),
          "",
          `Streak: ${stats.streak} days | Total entries: ${stats.total}`,
          `Great days: ${stats.greatDays} | Calm days: ${stats.calmDays}`,
          "",
          "== CHECK-INS ==",
          ...monthCheckins.map(c =>
            `${c.dateKey}  ${c.mood} (${c.intensity}%)  [${c.activities.join(",")}]${c.note ? "  "+c.note : ""}`
          ),
          "",
          "== PATTERNS ==",
          ...patterns.map(p => `${p.label}: ${p.value}% — ${p.note}`),
        ];
        content  = lines.join("\n");
        filename = `mood-therapist-report-${currentMonth}.txt`;
      } else {
        const avg = monthCheckins.length
          ? Math.round(monthCheckins.reduce((a, b) => a + b.intensity, 0) / monthCheckins.length)
          : 0;
        content = [
          "WEEKLY MOOD RECAP",
          `Generated: ${time.formatDate(time.now(), 'MMMM D, YYYY')}`,
          "",
          `Check-ins this period: ${monthCheckins.length}`,
          `Average intensity: ${avg}%`,
          `Streak: ${stats.streak} days`,
          "",
          patterns.length ? "Top pattern: " + patterns[0].label : "Log more to surface patterns.",
        ].join("\n");
        filename = `mood-recap-${time.toISODate(time.now())}.txt`;
      }

      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(`${dir}/${filename}`, content);
    } catch (e) { console.error("export failed:", e); }
    finally {
      exportingCsv   = false;
      exportingPdf   = false;
      exportingRecap = false;
    }
  }

  const exportOptions = $derived.by(() => [
    { label: _t('moduleMoodExportCSVTitle'), detail: _t('moduleMoodExportCSVDetail') },
    { label: _t('moduleMoodExportPDFTitle'), detail: _t('moduleMoodExportPDFDetail') },
    { label: _t('moduleMoodExportRecapTitle'), detail: _t('moduleMoodExportRecapDetail') },
  ]);

  onMount(loadAll);
</script>

<main class="mood-workspace module-root" data-module="mood">
  <section class="mood-shell">
    <header class="mood-shell__header">
      <div class="mood-shell__intro">
        <div class="mood-shell__eyebrow">
          <span>{_t('moduleMoodTitle')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>
          {#if selectedSection === "Check-in"}{_t('moduleMoodHeadingCheckin')}
          {:else if selectedSection === "Calendar"}{_t('moduleMoodHeadingCalendar')}
          {:else if selectedSection === "Activities"}{_t('moduleMoodHeadingActivities')}
          {:else if selectedSection === "Export"}{_t('moduleMoodHeadingExport')}
          {/if}
        </h1>
        <p>
          {#if selectedSection === "Check-in"}{_t('moduleMoodDescCheckin')}
          {:else if selectedSection === "Calendar"}{_t('moduleMoodDescCalendar')}
          {:else if selectedSection === "Activities"}{_t('moduleMoodDescActivities')}
          {:else if selectedSection === "Export"}{_t('moduleMoodDescExport')}
          {/if}
        </p>
      </div>
    </header>

    {#if selectedSection === "Check-in"}
      <section class="mood-hero-grid">
        <!-- Profile card -->
        <Card class="mood-profile-card">
          <CardContent class="mood-profile-card__content">
            <div class="mood-avatar">
              {selectedMoodEntry.emoji}
            </div>
            <div class="mood-now">
              <p class="mood-now__label">{_t('moduleMoodProfileTitle')}</p>
              <strong class="mood-now__mood">{_t('moduleMoodMood' + (selectedMoodEntry.id.charAt(0).toUpperCase() + selectedMoodEntry.id.slice(1)))}</strong>
            </div>
            <div class="mood-stats-row">
              <div class="mood-stat"><strong>{stats.streak}</strong><span>{_t('moduleMoodStreak')}</span></div>
              <div class="mood-stat"><strong>{stats.total}</strong><span>{_t('moduleMoodEntries')}</span></div>
              <div class="mood-stat"><strong>{stats.greatDays}</strong><span>{_t('moduleMoodGreatDays')}</span></div>
              <div class="mood-stat"><strong>{stats.calmDays}</strong><span>{_t('moduleMoodCalmDays')}</span></div>
            </div>
          </CardContent>
        </Card>

        <!-- Check-in form -->
        <Card class="mood-checkin-card">
          <CardHeader>
            <CardTitle>{_t('moduleMoodFeelingTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodFeelingDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-checkin">
            <div class="mood-picker">
              {#each moods as mood}
                <button
                  class="mood-picker__item"
                  class:mood-picker__item--active={selectedMood === mood.id}
                  type="button"
                  onclick={() => (selectedMood = mood.id)}
                  aria-label={mood.label}
                >
                  <span class="mood-picker__emoji">{mood.emoji}</span>
                  <span class="mood-picker__label">{_t('moduleMoodMood' + (mood.id.charAt(0).toUpperCase() + mood.id.slice(1)))}</span>
                </button>
              {/each}
            </div>
            <Input bind:value={noteText} placeholder={_t('moduleMoodNotePlaceholder')} class="mood-note-input" />
            {#if selectedActivities.length > 0}
              <div class="mood-chip-row">
                {#each selectedActivities as activity}
                  <Badge variant="secondary" class="mood-chip">{activity}</Badge>
                {/each}
              </div>
            {/if}
            {#if saveError}<p class="mood-error">{saveError}</p>{/if}
            <div class="mood-checkin__footer">
              <span class="mood-intensity-hint">{_t('moduleMoodIntensity').replace('{value}', String(selectedMoodEntry.intensity))}</span>
              <Button onclick={saveCheckin} disabled={saving} class="mood-save-btn">
                {#if saving}<Loader2Icon data-icon="inline-start" class="mood-spin"/>{_t('moduleMoodSaving')}
                {:else if saved}<CheckIcon data-icon="inline-start"/>{_t('moduleMoodSaved')}
                {:else}<HeartHandshakeIcon data-icon="inline-start"/>{_t('moduleMoodSaveCheckin')}{/if}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- Today's timeline -->
      <section class="mood-body">
        <Card class="mood-timeline-card">
          <CardHeader>
            <CardTitle>{_t('moduleMoodTimelineTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodTimelineDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-timeline">
            {#each todayCheckins as entry}
              <article class="mood-timeline__item">
                <span class="mood-timeline__time">{time.formatTime(entry.loggedAt)}</span>
                <div class="mood-timeline__mood-dot" style="background:{moodColor(entry.mood)}"></div>
                <div class="mood-timeline__body">
                  <div class="mood-timeline__head">
                    <strong>{moodEmoji(entry.mood)} {entry.mood}</strong>
                    <span class="mood-timeline__pct">{entry.intensity}%</span>
                  </div>
                  {#if entry.note}<p class="mood-timeline__note">{entry.note}</p>{/if}
                  {#if entry.activities.length > 0}
                    <div class="mood-timeline__acts">{entry.activities.join(" · ")}</div>
                  {/if}
                </div>
                <button class="mood-timeline__del" onclick={() => deleteCheckin(entry.id)} title={_t('commonDelete')}>
                  <TrashIcon size={13} />
                </button>
              </article>
            {/each}
            {#if todayCheckins.length === 0}
              <div class="mood-empty">
                <span class="mood-empty__emoji">🌱</span>
                <p>{_t('moduleMoodNoTimelineYet')}</p>
              </div>
            {/if}
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Calendar"}
      <Card class="mood-calendar-card">
        <CardHeader>
          <CardTitle>{_t('moduleMoodCalendarTitle')}</CardTitle>
          <CardDescription>{_t('moduleMoodCalendarDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="mood-calendar">
          <div class="mood-calendar__grid">
            {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
              {const key = `${currentMonth}-${String(day).padStart(2,"0")}`}
              {const entry = calendarMap.get(key)}
              {const mood = entry ? moods.find(m => m.id === entry.mood) ?? moods[2] : null}
              <div class="mood-cal-day" class:mood-cal-day--logged={!!entry}>
                {#if entry}
                  <div class="mood-cal-day__ring" style="background:color-mix(in srgb, {moodColor(entry.mood)} 20%, transparent)">
                    <span class="mood-cal-day__emoji">{moodEmoji(entry.mood)}</span>
                  </div>
                {:else}
                  <span class="mood-cal-day__num">{day}</span>
                {/if}
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    {:else if selectedSection === "Activities"}
      <div class="mood-grid-2col">
        <Card class="mood-activities-card">
          <CardHeader>
            <CardTitle>{_t('moduleMoodActivityTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodActivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-activity-grid">
            {#each activityLibrary as activity}
              <div
                class="mood-act-btn"
                class:mood-act-btn--selected={selectedActivities.includes(activity.name)}
                role="button"
                tabindex="0"
                onclick={() => toggleActivity(activity.name)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleActivity(activity.name); }}
              >
                <span class="mood-act-btn__label">{activity.name}</span>
                <button class="mood-act-btn__del" onclick={(e) => { e.stopPropagation(); deleteActivity(activity.id); }} title={_t('moduleMoodActivityRemove')}>
                  ×
                </button>
              </div>
            {/each}
          </CardContent>
          <div class="mood-act-add">
            <Input bind:value={newActivityName} placeholder={_t('moduleMoodActivityPlaceholder')} />
            <Button onclick={addActivity} disabled={addingActivity} variant="outline">
              {#if addingActivity}<Loader2Icon data-icon="inline-start" class="mood-spin"/>{_t('moduleMoodAdding')}
              {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleMoodAdd')}{/if}
            </Button>
          </div>
        </Card>

        <Card class="mood-correlations-card">
          <CardHeader>
            <CardTitle>{_t('moduleMoodContextTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodContextDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-correlations">
            {#if activityCorrelations.length > 0}
              {#each activityCorrelations as c}
                <article class="mood-correlation">
                  <div class="mood-correlation__head">
                    <strong>{c.name}</strong>
                    <span class="mood-correlation__count">{c.count}x</span>
                  </div>
                  <div class="mood-meter">
                    <i style="--fill:{Math.min(c.avg, 100)}%"></i>
                  </div>
                  <span class="mood-correlation__avg">{_t('moduleMoodAvgIntensity').replace('{avg}', String(c.avg)).replace('{count}', String(c.count))}</span>
                </article>
              {/each}
            {:else}
              <div class="mood-empty">
                <span class="mood-empty__emoji">🧘</span>
                <p>{_t('moduleMoodNoCorrelations')}</p>
              </div>
            {/if}
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Export"}
      <Card class="mood-export-card">
        <CardHeader>
          <CardTitle>{_t('moduleMoodExportTitle')}</CardTitle>
          <CardDescription>{_t('moduleMoodExportDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="mood-export-list">
          {#each exportOptions as option}
            <article class="mood-export-item">
              <div>
                <strong>{option.label}</strong>
                <p>{option.detail}</p>
              </div>
              <Button variant="outline" class="mood-export-btn">
                <DownloadIcon data-icon="inline-start" />
                {_t('moduleMoodExportBtn')}
              </Button>
            </article>
          {/each}
        </CardContent>
      </Card>
    {/if}
  </section>
</main>

<style>
  :global(.mood-workspace) {
    --mood-bg: var(--background);
    --mood-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --mood-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --mood-border: color-mix(in srgb, var(--border) 84%, transparent);
    --mood-muted: var(--muted);
    --mood-accent-warm: color-mix(in srgb, var(--primary) 30%, var(--surface));
    --mood-accent-cool: color-mix(in srgb, var(--accent) 34%, var(--surface));
    height: 100%;
    background: var(--mood-bg);
    font-family: var(--font-body);
    overflow: hidden;
  }

  :global(.mood-shell) {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
    padding: 28px 30px;
    box-sizing: border-box;
    overflow: hidden;
  }

  :global(.mood-shell__header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    flex-shrink: 0;
  }

  :global(.mood-shell__intro) {
    max-width: 640px;
  }

  :global(.mood-shell__eyebrow) {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    color: var(--mood-muted);
    font-size: 0.78rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.mood-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.4rem, 2vw, 2.2rem);
    line-height: 1.15;
    font-weight: 600;
  }

  :global(.mood-shell__intro) p {
    margin: 8px 0 0;
    line-height: 1.5;
    color: var(--mood-muted);
    font-size: 0.92rem;
  }

  /* ════════════════════════════════════════
     CARDS — Health-style gradient, no borders
     ════════════════════════════════════════ */
  :global(.mood-profile-card),
  :global(.mood-checkin-card),
  :global(.mood-timeline-card),
  :global(.mood-calendar-card),
  :global(.mood-activities-card),
  :global(.mood-correlations-card),
  :global(.mood-export-card) {
    border: none;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--mood-surface) 98%, var(--mood-bg)),
      color-mix(in srgb, var(--mood-surface) 86%, var(--mood-bg)));
  }

  /* ════════════════════════════════════════
     HERO GRID — Profile + Check-in
     ════════════════════════════════════════ */
  :global(.mood-hero-grid) {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    flex-shrink: 0;
  }

  /* ── Profile card ─────────────────────── */
  :global(.mood-profile-card__content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 28px 20px 20px;
  }

  :global(.mood-avatar) {
    width: 96px;
    height: 96px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: var(--background);
    font-size: 2.4rem;
    line-height: 1;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.mood-avatar):hover {
    transform: scale(1.04);
  }

  :global(.mood-now) {
    text-align: center;
  }

  :global(.mood-now__label) {
    margin: 0 0 4px;
    color: var(--mood-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  :global(.mood-now__mood) {
    font-size: 1.2rem;
    font-weight: 600;
  }

  :global(.mood-stats-row) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  :global(.mood-stat) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 8px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--mood-surface-strong) 70%, transparent);
  }

  :global(.mood-stat) strong {
    font-size: 1.35rem;
    line-height: 1;
    font-weight: 700;
  }

  :global(.mood-stat) span {
    color: var(--mood-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-align: center;
  }

  /* ── Check-in form ────────────────────── */
  :global(.mood-checkin) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  :global(.mood-picker) {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
  }

  :global(.mood-picker__item) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px 12px;
    border: none;
    border-radius: 16px;
    background: color-mix(in srgb, var(--mood-surface-strong) 72%, transparent);
    color: var(--mood-muted);
    font: inherit;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.mood-picker__item):hover {
    background: color-mix(in srgb, var(--mood-surface-strong) 90%, transparent);
    transform: translateY(-2px);
  }

  :global(.mood-picker__item--active) {
    background: color-mix(in srgb, var(--primary) 14%, var(--mood-surface));
    color: var(--foreground);
    transform: translateY(-2px);
  }

  :global(.mood-picker__emoji) {
    font-size: 1.8rem;
    line-height: 1;
  }

  :global(.mood-picker__label) {
    font-size: 0.72rem;
    font-weight: 500;
    text-align: center;
  }

  :global(.mood-note-input) {
    border: none;
    background: color-mix(in srgb, var(--mood-surface-strong) 72%, transparent);
    border-radius: 14px;
  }

  :global(.mood-chip-row) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  :global(.mood-chip) {
    border: none;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--foreground);
    font-size: 0.75rem;
    padding: 4px 10px;
    border-radius: 999px;
  }

  :global(.mood-error) {
    color: color-mix(in srgb, #ef4444 78%, var(--foreground));
    font-size: 0.82rem;
    margin: 0;
  }

  :global(.mood-checkin__footer) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--mood-muted);
    font-size: 0.82rem;
  }

  :global(.mood-intensity-hint) {
    font-size: 0.78rem;
  }

  :global(.mood-save-btn) {
    border-radius: 999px;
    padding: 8px 20px;
    font-size: 0.85rem;
  }

  /* ════════════════════════════════════════
     TIMELINE
     ════════════════════════════════════════ */
  :global(.mood-body) {
    flex: 1;
    min-height: 0;
  }

  :global(.mood-timeline-card) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.mood-timeline) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    min-height: 0;
  }

  :global(.mood-timeline__item) {
    display: grid;
    grid-template-columns: 52px 8px 1fr 20px;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 14px;
    transition: background 0.15s;
  }

  :global(.mood-timeline__item):hover {
    background: color-mix(in srgb, var(--mood-surface-strong) 60%, transparent);
  }

  :global(.mood-timeline__time) {
    font-size: 0.75rem;
    color: var(--mood-muted);
    font-variant: tabular-nums;
    text-align: right;
  }

  :global(.mood-timeline__mood-dot) {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  :global(.mood-timeline__body) {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  :global(.mood-timeline__head) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.mood-timeline__head) strong {
    font-size: 0.88rem;
    font-weight: 600;
  }

  :global(.mood-timeline__pct) {
    font-size: 0.72rem;
    color: var(--mood-muted);
  }

  :global(.mood-timeline__note) {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--mood-muted);
  }

  :global(.mood-timeline__acts) {
    font-size: 0.72rem;
    color: color-mix(in srgb, var(--mood-muted) 80%, transparent);
  }

  :global(.mood-timeline__del) {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--mood-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  :global(.mood-timeline__item):hover :global(.mood-timeline__del) {
    opacity: 0.5;
  }

  :global(.mood-timeline__del):hover {
    opacity: 1 !important;
    background: color-mix(in srgb, #ef4444 14%, transparent);
    color: #ef4444;
  }

  /* ── Empty state ──────────────────── */
  :global(.mood-empty) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 28px 0;
    text-align: center;
  }

  :global(.mood-empty__emoji) {
    font-size: 2rem;
  }

  :global(.mood-empty) p {
    margin: 0;
    color: var(--mood-muted);
    font-size: 0.85rem;
    max-width: 280px;
  }

  /* ════════════════════════════════════════
     CALENDAR
     ════════════════════════════════════════ */
  :global(.mood-calendar-card) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.mood-calendar__grid) {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }

  :global(.mood-cal-day) {
    display: grid;
    place-items: center;
    min-height: 80px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--mood-surface-strong) 50%, transparent);
    padding: 8px;
  }

  :global(.mood-cal-day--logged) {
    background: color-mix(in srgb, var(--mood-surface-strong) 76%, transparent);
  }

  :global(.mood-cal-day__ring) {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 1.3rem;
  }

  :global(.mood-cal-day__num) {
    color: var(--mood-muted);
    font-size: 0.82rem;
  }

  /* ════════════════════════════════════════
     ACTIVITIES
     ════════════════════════════════════════ */
  :global(.mood-grid-2col) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  :global(.mood-activities-card),
  :global(.mood-correlations-card) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  :global(.mood-activity-grid) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    overflow: auto;
  }

  :global(.mood-act-btn) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 10px 12px;
    border: none;
    border-radius: 12px;
    background: color-mix(in srgb, var(--mood-surface-strong) 72%, transparent);
    color: var(--foreground);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    overflow: hidden;
  }

  :global(.mood-act-btn):hover {
    background: color-mix(in srgb, var(--accent) 10%, var(--mood-surface-strong));
    transform: translateY(-1px);
  }

  :global(.mood-act-btn--selected) {
    background: color-mix(in srgb, var(--accent) 16%, var(--mood-surface));
    font-weight: 500;
  }

  :global(.mood-act-btn__del) {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--mood-muted);
    font-size: 0.7rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }

  :global(.mood-act-btn):hover :global(.mood-act-btn__del) {
    opacity: 0.5;
  }

  :global(.mood-act-btn__del):hover {
    opacity: 1 !important;
    color: #ef4444;
  }

  :global(.mood-act-add) {
    display: flex;
    gap: 10px;
    padding: 14px 0 0;
    border-top: 1px solid color-mix(in srgb, var(--mood-border) 60%, transparent);
  }

  :global(.mood-act-add) :global(input) {
    flex: 1;
    border: none;
    background: color-mix(in srgb, var(--mood-surface-strong) 72%, transparent);
    border-radius: 12px;
  }

  /* ── Correlations ──────────────────── */
  :global(.mood-correlations) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
  }

  :global(.mood-correlation) {
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--mood-surface-strong) 60%, transparent);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.mood-correlation__head) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global(.mood-correlation__head) strong {
    font-size: 0.85rem;
    font-weight: 600;
  }

  :global(.mood-correlation__count) {
    font-size: 0.72rem;
    color: var(--mood-muted);
  }

  :global(.mood-meter) {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--mood-border) 60%, transparent);
    overflow: hidden;
  }

  :global(.mood-meter) i {
    display: block;
    height: 100%;
    width: var(--fill);
    border-radius: inherit;
    background: linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--accent) 50%, var(--primary)));
    transition: width 0.4s ease;
  }

  :global(.mood-correlation__avg) {
    font-size: 0.74rem;
    color: var(--mood-muted);
  }

  /* ════════════════════════════════════════
     EXPORT
     ════════════════════════════════════════ */
  :global(.mood-export-card) {
    display: flex;
    flex-direction: column;
  }

  :global(.mood-export-list) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :global(.mood-export-item) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--mood-surface-strong) 60%, transparent);
  }

  :global(.mood-export-item) strong {
    font-size: 0.88rem;
    font-weight: 600;
  }

  :global(.mood-export-item) p {
    margin: 3px 0 0;
    font-size: 0.8rem;
    color: var(--mood-muted);
  }

  :global(.mood-export-btn) {
    border-radius: 999px;
    white-space: nowrap;
  }

  /* ════════════════════════════════════════
     SPINNER
     ════════════════════════════════════════ */
  :global(.mood-spin) {
    animation: mood-spin 0.8s linear infinite;
  }

  @keyframes mood-spin {
    to { transform: rotate(360deg); }
  }

  /* ════════════════════════════════════════
     RESPONSIVE
     ════════════════════════════════════════ */
  @media (max-width: 1100px) {
    :global(.mood-hero-grid) {
      grid-template-columns: 1fr;
    }
    :global(.mood-profile-card) {
      display: none;
    }
  }

  @media (max-width: 860px) {
    :global(.mood-shell) {
      padding: 18px;
    }
    :global(.mood-picker),
    :global(.mood-grid-2col) {
      grid-template-columns: 1fr;
    }
  }
</style>
