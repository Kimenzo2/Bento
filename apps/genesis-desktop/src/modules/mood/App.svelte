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

  const moduleId = "mood";
  const sectionLabels = ["Check-in", "Calendar", "Activities", "Patterns", "Therapist", "Export"] as const;
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
  let monthCheckins:   CheckinRow[] = [];
  let activityLibrary: ActivityRow[] = $state([]);
  let patterns:        MoodPattern[] = $state([]);
  let privateNotes:    PrivateNote[] = [];

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
  let currentMonth    = new Date().toISOString().slice(0, 7); // "2026-05"

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
    return new Date(y, mo, 0).getDate();
  });

  function moodEmoji(mood: string) {
    return moods.find(m => m.id === mood)?.emoji ?? "·";
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
          "MOOD REPORT — " + new Date().toLocaleDateString(),
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
          `Generated: ${new Date().toLocaleDateString()}`,
          "",
          `Check-ins this period: ${monthCheckins.length}`,
          `Average intensity: ${avg}%`,
          `Streak: ${stats.streak} days`,
          "",
          patterns.length ? "Top pattern: " + patterns[0].label : "Log more to surface patterns.",
        ].join("\n");
        filename = `mood-recap-${new Date().toISOString().slice(0,10)}.txt`;
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

  const therapistCards = $derived.by(() => [
    { title: _t('moduleMoodSleepPatterns'), description: _t('moduleMoodSleepPatternsDesc') },
    { title: _t('moduleMoodActivityImpact'), description: _t('moduleMoodActivityImpactDesc') },
    { title: _t('moduleMoodSocialConnections'), description: _t('moduleMoodSocialConnectionsDesc') },
    { title: _t('moduleMoodWorkStress'), description: _t('moduleMoodWorkStressDesc') },
  ]);

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
          {:else if selectedSection === "Patterns"}{_t('moduleMoodHeadingPatterns')}
          {:else if selectedSection === "Therapist"}{_t('moduleMoodHeadingTherapist')}
          {:else if selectedSection === "Export"}{_t('moduleMoodHeadingExport')}
          {/if}
        </h1>
        <p>
          {#if selectedSection === "Check-in"}{_t('moduleMoodDescCheckin')}
          {:else if selectedSection === "Calendar"}{_t('moduleMoodDescCalendar')}
          {:else if selectedSection === "Activities"}{_t('moduleMoodDescActivities')}
          {:else if selectedSection === "Patterns"}{_t('moduleMoodDescPatterns')}
          {:else if selectedSection === "Therapist"}{_t('moduleMoodDescTherapist')}
          {:else if selectedSection === "Export"}{_t('moduleMoodDescExport')}
          {/if}
        </p>
      </div>

      <div class="mood-shell__actions">
        <Button variant="outline">
          <CalendarDaysIcon data-icon="inline-start" />
          {_t('moduleMoodViewMonth')}
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          {_t('moduleMoodAIRecap')}
        </Button>
      </div>
    </header>

    {#if selectedSection === "Check-in"}
    <section class="mood-hero-grid">
      <!-- Journal-ported mood checker card -->
      <Card class="mood-bento-card mood-bento-card--accent mood-bento-mood">
        <CardContent class="mood-bento-mood__content">
          <div class="mood-bento-mood__label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mood-bento-icon"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            Quick Mood Check
          </div>
          <div class="mood-bento-mood__grid">
            {#each journalMoods as mood}
              <button
                class="mood-bento-mood__btn"
                class:mood-bento-mood__btn--active={selectedJournalMood === mood.id}
                style="--m-color: {mood.color}"
                onclick={() => { selectedJournalMood = mood.id; }}
              >
                <span class="mood-bento-mood__dot" style="background: {mood.color}"></span>
                {mood.label}
              </button>
            {/each}
          </div>
          <div class="mood-bento-mood__selected">
            <span class="mood-bento-mood__big" style="color: {journalMoodColor(selectedJournalMood)}">{journalMoods.find(m=>m.id===selectedJournalMood)?.label}</span>
            <span class="mood-bento-hint">How are you feeling today?</span>
          </div>
        </CardContent>
      </Card>

      <Card class="mood-profile-card">
        <CardHeader>
          <CardTitle>{_t('moduleMoodProfileTitle')}</CardTitle>
          <CardDescription>{_t('moduleMoodProfileDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="mood-profile-card__content">
          <div class="mood-avatar">
            {selectedMoodEntry.emoji}
          </div>
          <div class="mood-profile-card__stats">
            <div><strong>{stats.streak}</strong><span>{_t('moduleMoodStreak')}</span></div>
            <div><strong>{stats.total}</strong><span>{_t('moduleMoodEntries')}</span></div>
            <div><strong>{stats.greatDays}</strong><span>{_t('moduleMoodGreatDays')}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card class="mood-gradient-card mood-gradient-card--warm">
        <CardHeader>
          <CardTitle>{_t('moduleMoodGreatDaysTitle')}</CardTitle>
          <CardDescription>{_t('moduleMoodGreatDaysDesc')}</CardDescription>
        </CardHeader>
        <CardContent><strong>{stats.greatDays}</strong></CardContent>
      </Card>

      <Card class="mood-gradient-card mood-gradient-card--cool">
        <CardHeader>
          <CardTitle>{_t('moduleMoodCalmDays')}</CardTitle>
          <CardDescription>{_t('moduleMoodCalmDaysDesc')}</CardDescription>
        </CardHeader>
        <CardContent><strong>{stats.calmDays}</strong></CardContent>
      </Card>

      <Card class="mood-tools-card">
        <CardHeader>
          <CardTitle>{_t('moduleMoodTodayCheckins')}</CardTitle>
          <CardDescription>{_t('moduleMoodTodayCheckinsDesc').replace('{count}', String(todayCheckins.length))}</CardDescription>
        </CardHeader>
        <CardContent class="mood-chip-row">
          {#each todayCheckins as c}
            <Badge variant="secondary">{moodEmoji(c.mood)} {c.mood}</Badge>
          {/each}
          {#if todayCheckins.length === 0}
            <span style="color:var(--mood-muted);font-size:0.85rem">{_t('moduleMoodNoCheckinsYet')}</span>
          {/if}
        </CardContent>
      </Card>
    </section>
    {/if}

    {#if selectedSection === "Check-in"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodFeelingTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodFeelingDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-checkin">
            <div class="mood-picker">
              {#each moods as mood}
                <button
                  class:mood-picker__item--active={selectedMood === mood.id}
                  class="mood-picker__item"
                  type="button"
                  onclick={() => (selectedMood = mood.id)}
                >
                  <span>{mood.emoji}</span>
                  <strong>{_t('moduleMoodMood' + (mood.id.charAt(0).toUpperCase() + mood.id.slice(1)))}</strong>
                </button>
              {/each}
            </div>
            <Input bind:value={noteText} placeholder={_t('moduleMoodNotePlaceholder')} />
            <div class="mood-chip-row">
              {#each selectedActivities as activity}
                <Badge variant="outline">{activity}</Badge>
              {/each}
            </div>
            {#if saveError}<p style="color:color-mix(in srgb,red 70%,var(--mood-muted));font-size:0.82rem">{saveError}</p>{/if}
            <div class="mood-checkin__footer">
              <span>{_t('moduleMoodIntensity').replace('{value}', String(selectedMoodEntry.intensity))}</span>
              <Button onclick={saveCheckin} disabled={saving}>
                {#if saving}<Loader2Icon data-icon="inline-start" style="animation:spin 0.8s linear infinite"/>{_t('moduleMoodSaving')}
                {:else if saved}<CheckIcon data-icon="inline-start"/>{_t('moduleMoodSaved')}
                {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleMoodSaveCheckin')}{/if}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodTimelineTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodTimelineDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-timeline">
            {#each todayCheckins as entry}
              <article class="mood-timeline__item">
                <span>{new Date(entry.loggedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                <div>
                  <strong>{moodEmoji(entry.mood)} {entry.mood} ({entry.intensity}%)</strong>
                  {#if entry.note}<p>{entry.note}</p>{/if}
                  {#if entry.activities.length > 0}
                    <p style="font-size:0.78rem;color:var(--mood-muted)">{entry.activities.join(" · ")}</p>
                  {/if}
                </div>
                <button onclick={() => deleteCheckin(entry.id)} style="background:none;border:none;cursor:pointer;color:var(--mood-muted);opacity:0.5;padding:4px" title={_t('commonDelete')}>×</button>
              </article>
            {/each}
            {#if todayCheckins.length === 0}
              <p style="color:var(--mood-muted);text-align:center;padding:20px 0;font-size:0.88rem">{_t('moduleMoodNoTimelineYet')}</p>
            {/if}
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Calendar"}
      <div class="mood-calendar-wrapper">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodCalendarTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodCalendarDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-calendar">
            {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
              {@const key = `${currentMonth}-${String(day).padStart(2,"0")}`}
              {@const entry = calendarMap.get(key)}
              <button class="mood-calendar__day" type="button" style={entry ? "border-color:color-mix(in srgb,var(--primary) 40%,var(--mood-border))" : ""}>
                <small>{day}</small>
                <span>{entry ? moodEmoji(entry.mood) : "·"}</span>
                {#if entry}<small style="font-size:0.65rem;color:var(--mood-muted)">{entry.intensity}%</small>{/if}
              </button>
            {/each}
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Activities"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodActivityTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodActivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-activity-grid">
            {#each activityLibrary as activity}
              <div style="position:relative">
                <button
                  class:mood-activity-grid__item--selected={selectedActivities.includes(activity.name)}
                  class="mood-activity-grid__item"
                  type="button"
                  onclick={() => toggleActivity(activity.name)}
                >{activity.name}</button>
                <button onclick={() => deleteActivity(activity.id)}
                  style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;color:var(--mood-muted);font-size:0.7rem;opacity:0.4;line-height:1"
                  title={_t('moduleMoodActivityRemove')}>×</button>
              </div>
            {/each}
          </CardContent>
          <div style="padding:16px 24px;border-top:1px solid var(--mood-border);display:flex;gap:10px">
            <Input bind:value={newActivityName} placeholder={_t('moduleMoodActivityPlaceholder')} style="flex:1"/>
            <Button onclick={addActivity} disabled={addingActivity} variant="outline">
              {#if addingActivity}<Loader2Icon data-icon="inline-start"/>{_t('moduleMoodAdding')}
              {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleMoodAdd')}{/if}
            </Button>
          </div>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodContextTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodContextDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-summary-list">
            {#if activityCorrelations.length > 0}
              {#each activityCorrelations as c}
                <article>
                  <strong>{c.name}</strong>
                  <p>{_t('moduleMoodAvgIntensity').replace('{avg}', String(c.avg)).replace('{count}', String(c.count)).replace('{s}', c.count > 1 ? 's' : '')}</p>
                </article>
              {/each}
            {:else}
              <p style="color:var(--mood-muted);font-size:0.85rem;padding:10px 0">
                {_t('moduleMoodNoCorrelations')}
              </p>
            {/if}
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Patterns"}
      <section class="mood-two-column">
        <Card class="mood-panel mood-panel--wide">
          <CardHeader>
            <CardTitle>{_t('moduleMoodPatternReview')}</CardTitle>
            <CardDescription>{_t('moduleMoodPatternReviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-pattern-list">
            {#if patterns.length > 0}
              {#each patterns as pattern}
                <article class="mood-pattern-list__item">
                  <div>
                    <strong>{pattern.label}</strong>
                    <p>{pattern.note}</p>
                  </div>
                  <div class="mood-pattern-list__metric">
                    <div style={`--fill:${pattern.value}%`}></div>
                    <span>{pattern.value}%</span>
                  </div>
                </article>
              {/each}
            {:else}
              <p style="color:var(--mood-muted);font-size:0.88rem;padding:12px 0">
                {_t('moduleMoodNoPatternsYet')}
              </p>
            {/if}
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodAINote')}</CardTitle>
            <CardDescription>{_t('moduleMoodAINoteDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-ai-note">
            <p>{_t('moduleMoodAINoteText')}</p>
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Therapist"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodTherapyTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodTherapyDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-summary-list">
            {#each therapistCards as card}
              <article>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
              </article>
            {/each}
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodTalkPointsTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodTalkPointsDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-summary-list">
            <article>
              <strong>{_t('moduleMoodTalkMeetingOverload')}</strong>
              <p>{_t('moduleMoodTalkMeetingOverloadDesc')}</p>
            </article>
            <article>
              <strong>{_t('moduleMoodTalkWeekendReset')}</strong>
              <p>{_t('moduleMoodTalkWeekendResetDesc')}</p>
            </article>
            <article>
              <strong>{_t('moduleMoodTalkSleepPatience')}</strong>
              <p>{_t('moduleMoodTalkSleepPatienceDesc')}</p>
            </article>
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Export"}
      <div class="mood-export-wrapper">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>{_t('moduleMoodExportTitle')}</CardTitle>
            <CardDescription>{_t('moduleMoodExportDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="mood-export-list">
            {#each exportOptions as option}
              <article class="mood-export-list__item">
                <div>
                  <strong>{option.label}</strong>
                  <p>{option.detail}</p>
                </div>
                <Button variant="outline">
                  <DownloadIcon data-icon="inline-start" />
                  {_t('moduleMoodExportBtn')}
                </Button>
              </article>
            {/each}
          </CardContent>
        </Card>
      </div>
    {/if}
  </section>
</main>

<style>
  .mood-workspace {
    --mood-bg: var(--background);
    --mood-surface: color-mix(in srgb, var(--surface) 95%, var(--background));
    --mood-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --mood-border: color-mix(in srgb, var(--border) 84%, transparent);
    --mood-muted: var(--muted);
    --mood-accent-warm: color-mix(in srgb, var(--primary) 30%, var(--surface));
    --mood-accent-cool: color-mix(in srgb, var(--accent) 34%, var(--surface));
    min-height: 100%;
    background: var(--mood-bg);
  }

  .mood-shell {
    display: grid;
    gap: 20px;
    min-height: 100%;
    padding: 28px;
    box-sizing: border-box;
  }

  .mood-shell__header,
  .mood-shell__actions,
  .mood-shell__eyebrow,
  .mood-profile-card__stats,
  .mood-chip-row,
  .mood-checkin__footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mood-shell__header {
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .mood-shell__intro {
    max-width: 760px;
    display: grid;
    gap: 10px;
  }

  .mood-shell__eyebrow {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--mood-muted);
  }

  .mood-shell__intro h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2vw, 2.35rem);
    line-height: 1.1;
  }

  .mood-shell__intro p {
    margin: 0;
    line-height: 1.6;
    color: var(--mood-muted);
  }

  .mood-hero-grid,
  .mood-two-column {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .mood-two-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.mood-profile-card),
  :global(.mood-gradient-card),
  :global(.mood-tools-card),
  :global(.mood-panel) {
    background: var(--mood-surface);
    border-color: var(--mood-border);
  }

  :global(.mood-profile-card) {
    grid-column: span 1;
  }

  :global(.mood-profile-card__content) {
    display: grid;
    gap: 18px;
    justify-items: center;
  }

  .mood-avatar {
    width: 104px;
    height: 104px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: var(--background);
    font-weight: 700;
    font-size: 1.8rem;
  }

  .mood-profile-card__stats {
    justify-content: center;
  }

  .mood-profile-card__stats div {
    display: grid;
    justify-items: center;
    gap: 2px;
  }

  .mood-profile-card__stats strong,
  :global(.mood-gradient-card) strong {
    font-size: 2rem;
    line-height: 1;
  }

  .mood-profile-card__stats span {
    color: var(--mood-muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  :global(.mood-gradient-card--warm) {
    background: linear-gradient(135deg, var(--mood-surface), var(--mood-accent-warm), color-mix(in srgb, var(--primary) 18%, var(--surface)));
  }

  :global(.mood-gradient-card--cool) {
    background: linear-gradient(135deg, var(--mood-surface), var(--mood-accent-cool), color-mix(in srgb, var(--accent) 16%, var(--surface)));
  }

  :global(.mood-tools-card) {
    grid-column: span 2;
  }

  :global(.mood-checkin),
  :global(.mood-timeline),
  :global(.mood-pattern-list),
  :global(.mood-summary-list),
  :global(.mood-export-list) {
    display: grid;
    gap: 14px;
  }

  .mood-picker {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .mood-picker__item,
  .mood-activity-grid__item,
  .mood-calendar__day {
    border: 1px solid var(--mood-border);
    background: var(--mood-surface-strong);
    border-radius: calc(var(--radius) * 1.25);
  }

  .mood-picker__item {
    padding: 16px 12px;
    display: grid;
    justify-items: center;
    gap: 8px;
  }

  .mood-picker__item--active {
    border-color: color-mix(in srgb, var(--primary) 42%, var(--mood-border));
    background: color-mix(in srgb, var(--primary) 14%, var(--mood-surface));
  }

  .mood-picker__item span {
    font-size: 1.75rem;
  }

  .mood-checkin__footer {
    justify-content: space-between;
    color: var(--mood-muted);
    font-size: 0.85rem;
  }

  .mood-timeline__item,
  .mood-pattern-list__item,
  :global(.mood-summary-list) article,
  .mood-export-list__item {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--mood-border);
    border-radius: calc(var(--radius) * 1.25);
    background: var(--mood-surface-strong);
  }

  .mood-timeline__item {
    grid-template-columns: 64px 1fr;
  }

  .mood-timeline__item span,
  .mood-pattern-list__item p,
  :global(.mood-summary-list) p,
  .mood-export-list__item p,
  :global(.mood-ai-note) p {
    margin: 0;
    color: var(--mood-muted);
    line-height: 1.55;
  }

  :global(.mood-calendar) {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
  }

  .mood-calendar__day {
    min-height: 92px;
    padding: 12px;
    display: grid;
    align-content: space-between;
    justify-items: start;
  }

  .mood-calendar__day small {
    color: var(--mood-muted);
  }

  .mood-calendar__day span {
    font-size: 1.4rem;
  }

  :global(.mood-activity-grid) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .mood-activity-grid__item {
    padding: 14px 12px;
    text-align: left;
  }

  .mood-activity-grid__item--selected {
    border-color: color-mix(in srgb, var(--accent) 38%, var(--mood-border));
    background: color-mix(in srgb, var(--accent) 14%, var(--mood-surface));
  }

  .mood-pattern-list__item,
  .mood-export-list__item {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .mood-pattern-list__metric {
    display: grid;
    gap: 8px;
    min-width: 180px;
    justify-items: end;
  }

  .mood-pattern-list__metric div {
    width: 180px;
    height: 10px;
    border-radius: 999px;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--primary) 54%, var(--foreground)) var(--fill),
        color-mix(in srgb, var(--mood-border) 82%, transparent) 0
      );
  }

  :global(.mood-panel--wide) {
    min-height: 0;
  }

  :global(.mood-ai-note) {
    line-height: 1.6;
  }

  /* ── Ported Journal mood bento card ─────────────────────────────── */
  .mood-bento-card {
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
  }

  .mood-bento-card--accent {
    background: linear-gradient(135deg, #818cf8, #6366f1);
    color: #fff;
  }

  .mood-bento-mood {
    grid-column: span 2;
  }

  .mood-bento-mood__content {
    display: grid;
    gap: 14px;
  }

  .mood-bento-mood__label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mood-bento-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .mood-bento-mood__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mood-bento-mood__btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.2);
    background: transparent;
    color: rgba(255,255,255,0.8);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .mood-bento-mood__btn:hover {
    background: rgba(255,255,255,0.1);
  }

  .mood-bento-mood__btn--active {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.5);
    color: #fff;
  }

  .mood-bento-mood__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .mood-bento-mood__selected {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .mood-bento-mood__big {
    font-size: 20px;
    font-weight: 700;
  }

  .mood-bento-hint {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
  }

  @media (max-width: 1180px) {
    .mood-hero-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    :global(.mood-tools-card) {
      grid-column: span 2;
    }
  }

  @media (max-width: 960px) {
    .mood-shell {
      padding: 20px;
    }

    .mood-shell__header,
    .mood-shell__actions,
    .mood-checkin__footer,
    .mood-two-column {
      flex-direction: column;
      grid-template-columns: 1fr;
    }

    .mood-picker,
    :global(.mood-calendar),
    :global(.mood-activity-grid),
    .mood-hero-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
