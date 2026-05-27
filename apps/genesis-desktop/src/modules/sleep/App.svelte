<script lang="ts">
  import MoonStarIcon from "@lucide/svelte/icons/moon-star";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  const moduleId = "sleep";
  const sectionLabels = ["Tonight", "Score", "Routine", "Trends", "Alarm", "Export", "Log"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  let displaySection = $derived.by(() => {
    const labels: Record<string, string> = {
      Tonight: _t("moduleSleepSectionTonight"),
      Score: _t("moduleSleepSectionScore"),
      Routine: _t("moduleSleepSectionRoutine"),
      Trends: _t("moduleSleepSectionTrends"),
      Alarm: _t("moduleSleepSectionAlarm"),
      Export: _t("moduleSleepSectionExport"),
    };
    return labels[selectedSection] ?? selectedSection;
  });

  const tonightFocus = [
    { label: "Wind-down", value: "22:15", note: "Reading lamp and no inbox after 10pm." },
    { label: "Target sleep", value: "7h 50m", note: "Enough recovery for tomorrow’s training block." },
    { label: "Bedroom", value: "19°C", note: "Cooling mode starts 30 minutes before bed." },
  ];

  const sleepStages = [
    { label: "Deep", value: "2h 04m", fill: 72 },
    { label: "REM", value: "1h 41m", fill: 58 },
    { label: "Light", value: "3h 57m", fill: 83 },
    { label: "Awake", value: "18m", fill: 16 },
  ];

  const routine = [
    { title: "Dim lights", status: "Done", note: "Started 45 minutes before bed." },
    { title: "Phone docked", status: "Done", note: "Charging outside the room." },
    { title: "Stretch shoulders", status: "Next", note: "6 minute unwind queued." },
    { title: "Set smart alarm", status: "Ready", note: "Wake window 06:15 to 06:45." },
  ];

  const weeklyTrend = [
    { day: "Mon", score: 62 },
    { day: "Tue", score: 74 },
    { day: "Wed", score: 58 },
    { day: "Thu", score: 82 },
    { day: "Fri", score: 69 },
    { day: "Sat", score: 77 },
    { day: "Sun", score: 71 },
  ];

  const alarms = [
    { label: "Weekday sunrise", time: "06:35", window: "20 min light-sleep window", mode: "Smart" },
    { label: "Saturday recovery", time: "07:25", window: "Gentle chime + blinds", mode: "Flexible" },
    { label: "Travel fallback", time: "06:00", window: "Hotel vibration only", mode: "Backup" },
  ];

  const exportOptions = [
    { title: "Sleep PDF", detail: "Last 30 nights with score, debt, and routine adherence." },
    { title: "CSV stages", detail: "Nightly deep, REM, and wake events for external analysis." },
    { title: "Shareable recap", detail: "A one-page summary for coach or clinician review." },
  ];

  // ── Log section (ported exactly from Journal's Sleep section) ────────
  let logSleepHours = $state(7.2);
  let logSleepQuality = $state(4);
  let logSleepData = $state([
    { date: 'May 21', hours: 7.2, quality: 4, bedtime: '11:10 PM', wake: '6:22 AM' },
    { date: 'May 20', hours: 6.8, quality: 3, bedtime: '11:45 PM', wake: '6:35 AM' },
    { date: 'May 19', hours: 8.1, quality: 5, bedtime: '10:30 PM', wake: '6:36 AM' },
    { date: 'May 18', hours: 7.5, quality: 4, bedtime: '11:00 PM', wake: '6:30 AM' },
    { date: 'May 17', hours: 5.9, quality: 2, bedtime: '12:15 AM', wake: '6:10 AM' },
  ]);

  let logAvgHours = $derived(
    logSleepData.length > 0
      ? (logSleepData.reduce((s, r) => s + r.hours, 0) / logSleepData.length).toFixed(1)
      : '7.0'
  );

  function toggleLogStar(star: number) {
    logSleepQuality = star;
  }
</script>

<main class="sleep-workspace module-root" data-module="sleep">
  <section class="sleep-shell">
    <header class="sleep-shell__header">
      <div class="sleep-shell__intro">
        <div class="sleep-shell__eyebrow">
          <span>{_t('moduleSleepSomna')}</span>
          <Badge variant="outline">{displaySection}</Badge>
        </div>
        <h1>{_t('moduleSleepDesc')}</h1>
        <p>{_t('moduleSleepHeaderDesc')}</p>
      </div>

      <div class="sleep-shell__actions">
        <Button variant="outline">
          <MoonStarIcon data-icon="inline-start" />
          {_t('moduleSleepNightMode')}
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          {_t('moduleSleepAIBedtime')}
        </Button>
      </div>
    </header>

    {#if selectedSection === "Tonight"}
    <section class="sleep-hero-grid">
      <Card class="sleep-orb-card">
        <CardHeader>
          <CardTitle>{_t('moduleSleepLastNight')}</CardTitle>
          <CardDescription>{_t('moduleSleepLastNightDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="sleep-orb-card__content">
          <div class="sleep-orb">
            <strong>82</strong>
            <small>{_t('moduleSleepScore')}</small>
          </div>
          <div class="sleep-meta">
            <div><strong>+11%</strong><span>{_t('moduleSleepBetterThanAvg')}</span></div>
            <div><strong>06:35</strong><span>{_t('moduleSleepSmartWake')}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card class="sleep-summary-card">
        <CardHeader>
          <CardTitle>{_t('moduleSleepRecoveryOutlook')}</CardTitle>
          <CardDescription>{_t('moduleSleepRecoveryOutlookDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="sleep-summary-list">
          {#each tonightFocus as item}
            <article>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
    {/if}

    {#if selectedSection === "Log"}
    <section class="sl-bento">
      <!-- SLEEP HERO CARD (accent) — ported exactly from Journal -->
      <div class="sl-card sl-card--accent sl-card--hero">
        <div class="sl-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          {_t('moduleJournalLastNight')}
        </div>
        <div class="sl-hero-num">{logSleepHours}<span class="sl-unit">{_t('moduleJournalHrs')}</span></div>
        <!-- Quality stars -->
        <div class="sl-stars">
          {#each [1,2,3,4,5] as star}
            <button class="sl-star" class:sl-star--on={star <= logSleepQuality} onclick={() => toggleLogStar(star)}>
              <svg viewBox="0 0 24 24" fill={star <= logSleepQuality ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          {/each}
        </div>
        <p class="sl-card-hint">{_t('moduleJournalQualityRating')}</p>
      </div>

      <!-- SLEEP LOG LIST CARD (surface) — ported exactly from Journal -->
      <div class="sl-card sl-card--surface sl-card--log">
        <div class="sl-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          {_t('moduleJournal5DayLog')}
        </div>
        {#each logSleepData as row}
        <div class="sl-log-row">
          <span class="sl-log-date">{row.date}</span>
          <div class="sl-bar-wrap">
            <div class="sl-bar" style="width:{(row.hours / 9) * 100}%;background:color-mix(in srgb, #8b5cf6 {Math.round((row.quality/5)*100)}%, #3b82f6)"></div>
          </div>
          <span class="sl-log-hrs">{row.hours}{_t('moduleJournalH')}</span>
          <div class="sl-stars-mini">
            {#each [1,2,3,4,5] as s}
              <svg viewBox="0 0 24 24" fill={s<=row.quality?'#8b5cf6':'none'} stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sl-star-mini"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {/each}
          </div>
        </div>
        {/each}
      </div>

      <!-- SLEEP AVG CARD (dark) — ported exactly from Journal -->
      <div class="sl-card sl-card--dark sl-card--avg">
        <div class="sl-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          {_t('moduleJournalAvgThisWeek')}
        </div>
        <div class="sl-stat-big">{logAvgHours}<span class="sl-unit">{_t('moduleJournalHrs')}</span></div>
        <p class="sl-card-hint" style="color:#22c55e">{_t('moduleJournalAvgIncrease')}</p>
        <div class="sl-tips">
          <span class="sl-tip">{_t('moduleJournalGoal7')}</span>
          <span class="sl-tip">{_t('moduleJournalBedtime')}</span>
        </div>
      </div>

    </section>
    {/if}

    <section class="sleep-shell__body">
      {#if selectedSection === "Tonight"}
        <div class="sleep-grid sleep-grid--tonight">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepTonightPlan')}</CardTitle>
              <CardDescription>{_t('moduleSleepTonightPlanDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-list">
              {#each tonightFocus as item}
                <article>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepPreSleepChecklist')}</CardTitle>
              <CardDescription>{_t('moduleSleepPreSleepChecklistDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-routine-list">
              {#each routine as step}
                <article>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.note}</p>
                  </div>
                  <Badge variant={step.status === 'Done' ? 'default' : 'secondary'}>{_t('moduleSleep' + step.status)}</Badge>
                </article>
              {/each}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Score"}
        <div class="sleep-grid sleep-grid--score">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepStageBalance')}</CardTitle>
              <CardDescription>{_t('moduleSleepStageBalanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-stage-list">
              {#each sleepStages as stage}
                <article>
                  <div class="sleep-stage-copy">
                    <strong>{stage.label}</strong>
                    <span>{stage.value}</span>
                  </div>
                  <div class="sleep-meter"><i style={`--fill:${stage.fill}%`}></i></div>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepScoreBreakdown')}</CardTitle>
              <CardDescription>{_t('moduleSleepScoreBreakdownDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-breakdown">
              <div><span>{_t('moduleSleepDuration')}</span><strong>88</strong></div>
              <div><span>{_t('moduleSleepConsistency')}</span><strong>79</strong></div>
              <div><span>{_t('moduleSleepRecovery')}</span><strong>84</strong></div>
              <div><span>{_t('moduleSleepWakeStability')}</span><strong>81</strong></div>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Routine"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepBedtimeRoutine')}</CardTitle>
            <CardDescription>{_t('moduleSleepBedtimeRoutineDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-routine-board">
            {#each routine as step, index}
              <article>
                <div class="sleep-routine-board__count">{index + 1}</div>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.note}</p>
                </div>
                <Badge variant={step.status === 'Done' ? 'default' : 'outline'}>{_t('moduleSleep' + step.status)}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Trends"}
        <div class="sleep-grid sleep-grid--trends">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepWeeklyTrend')}</CardTitle>
              <CardDescription>{_t('moduleSleepWeeklyTrendDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-trend-chart">
              {#each weeklyTrend as item}
                <article>
                  <span>{item.day}</span>
                  <i style={`--bar:${item.score}%`}></i>
                  <strong>{item.score}</strong>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepPatternNotes')}</CardTitle>
              <CardDescription>{_t('moduleSleepPatternNotesDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-list">
              <article><span>{_t('moduleSleepBestNight')}</span><strong>{_t('moduleSleepBestNightValue')}</strong><p>{_t('moduleSleepBestNightDesc')}</p></article>
              <article><span>{_t('moduleSleepWeakestNight')}</span><strong>{_t('moduleSleepWeakestNightValue')}</strong><p>{_t('moduleSleepWeakestNightDesc')}</p></article>
              <article><span>{_t('moduleSleepTrend')}</span><strong>{_t('moduleSleepRising')}</strong><p>{_t('moduleSleepTrendDesc')}</p></article>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Alarm"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepAlarmOrch')}</CardTitle>
            <CardDescription>{_t('moduleSleepAlarmOrchDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-alarm-list">
            {#each alarms as alarm}
              <article>
                <div>
                  <strong>{alarm.label}</strong>
                  <p>{alarm.window}</p>
                </div>
                <div class="sleep-alarm-list__time">{alarm.time}</div>
                <Badge variant="secondary">{alarm.mode}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Log"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>Sleep schedule details</CardTitle>
            <CardDescription>Bedtime and wake time for the last 5 nights.</CardDescription>
          </CardHeader>
          <CardContent class="sleep-breakdown">
            {#each logSleepData as row}
              <div>
                <span>{row.date}</span>
                <strong>{row.hours}h</strong>
                <span>Bed: {row.bedtime} · Wake: {row.wake}</span>
              </div>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepExportTitle')}</CardTitle>
            <CardDescription>{_t('moduleSleepExportDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-export-list">
            {#each exportOptions as option}
              <article>
                <div>
                  <strong>{option.title}</strong>
                  <p>{option.detail}</p>
                </div>
                <Button variant="outline">
                  <DownloadIcon data-icon="inline-start" />
                  {_t('moduleSleepExportBtn')}
                </Button>
              </article>
            {/each}
          </CardContent>
        </Card>
      {/if}
    </section>
  </section>
</main>

<style>
  :global(.sleep-workspace) {
    --sleep-bg: var(--background);
    --sleep-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --sleep-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --sleep-border: color-mix(in srgb, var(--border) 86%, transparent);
    --sleep-ink: var(--foreground);
    --sleep-muted: var(--muted);
    --sleep-accent: var(--primary);
    --sleep-accent-soft: color-mix(in srgb, var(--accent) 36%, var(--primary));
    height: 100%;
    padding: 28px 30px;
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    overflow: hidden;
    font-family: var(--font-body);
  }

  :global(.sleep-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 20px;
    height: 100%;
    min-height: 0;
  }

  :global(.sleep-shell__header),
  :global(.sleep-hero-grid),
  :global(.sleep-shell__body),
  :global(.sleep-grid) {
    min-height: 0;
  }

  :global(.sleep-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.sleep-shell__intro) {
    max-width: 56rem;
  }

  :global(.sleep-shell__eyebrow) {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    color: var(--sleep-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.sleep-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.9rem, 3.2vw, 3rem);
    line-height: 1.02;
  }

  :global(.sleep-shell__intro) p {
    max-width: 44rem;
    margin: 12px 0 0;
    color: var(--sleep-muted);
    font-size: 0.98rem;
  }

  :global(.sleep-shell__actions) {
    display: flex;
    gap: 12px;
  }

  :global(.sleep-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 16px;
  }

  :global(.sleep-orb-card),
  :global(.sleep-summary-card),
  :global(.sleep-panel) {
    border-color: var(--sleep-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--sleep-surface) 98%, var(--background)),
        color-mix(in srgb, var(--sleep-surface) 86%, var(--background))
      );
  }

  :global(.sleep-orb-card__content) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 20px;
    align-items: center;
  }

  :global(.sleep-orb) {
    display: grid;
    place-items: center;
    width: 180px;
    aspect-ratio: 1;
    border-radius: 999px;
    background: conic-gradient(var(--sleep-accent) 82%, color-mix(in srgb, var(--border) 80%, transparent) 0);
    box-shadow: none;
  }

  :global(.sleep-orb) strong {
    display: block;
    font-size: 3.15rem;
    line-height: 1;
  }

  :global(.sleep-orb) small,
  :global(.sleep-meta) span,
  :global(.sleep-list) p,
  :global(.sleep-routine-list) p,
  :global(.sleep-stage-copy) span,
  :global(.sleep-alarm-list) p {
    color: var(--sleep-muted);
  }

  :global(.sleep-meta) {
    display: grid;
    gap: 14px;
  }

  :global(.sleep-meta) strong {
    display: block;
    font-size: 1.35rem;
  }

  :global(.sleep-summary-list),
  :global(.sleep-list),
  :global(.sleep-routine-list),
  :global(.sleep-stage-list),
  :global(.sleep-export-list),
  :global(.sleep-alarm-list) {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
  }

  :global(.sleep-summary-list) article,
  :global(.sleep-list) article,
  :global(.sleep-routine-list) article,
  :global(.sleep-stage-list) article,
  :global(.sleep-export-list) article,
  :global(.sleep-alarm-list) article,
  :global(.sleep-routine-board) article,
  :global(.sleep-breakdown) div {
    border: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--sleep-surface-strong) 92%, transparent);
  }

  :global(.sleep-summary-list) article,
  :global(.sleep-list) article {
    padding: 16px 18px;
  }

  :global(.sleep-summary-list) span,
  :global(.sleep-list) span {
    display: block;
    color: var(--sleep-muted);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  :global(.sleep-summary-list) strong,
  :global(.sleep-list) strong {
    display: block;
    margin-top: 6px;
    font-size: 1.2rem;
  }

  :global(.sleep-shell__body) {
    min-height: 0;
  }

  :global(.sleep-grid) {
    display: grid;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  :global(.sleep-grid--tonight),
  :global(.sleep-grid--score),
  :global(.sleep-grid--trends) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.sleep-panel),
  :global(.sleep-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.sleep-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.sleep-panel--full) {
    height: 100%;
  }

  :global(.sleep-routine-list) article,
  :global(.sleep-alarm-list) article,
  :global(.sleep-routine-board) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.sleep-stage-list) article {
    padding: 16px 18px;
  }

  :global(.sleep-stage-copy) {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 10px;
  }

  :global(.sleep-meter) {
    height: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sleep-border) 72%, transparent);
    overflow: hidden;
  }

  :global(.sleep-meter) i,
  :global(.sleep-trend-chart) i {
    display: block;
    border-radius: inherit;
    background: linear-gradient(180deg, var(--sleep-accent), var(--sleep-accent-soft));
  }

  :global(.sleep-meter) i {
    width: var(--fill);
    height: 100%;
  }

  :global(.sleep-breakdown) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  :global(.sleep-breakdown) div {
    padding: 18px;
  }

  :global(.sleep-breakdown) span {
    display: block;
    color: var(--sleep-muted);
    font-size: 0.85rem;
  }

  :global(.sleep-breakdown) strong {
    display: block;
    margin-top: 12px;
    font-size: 2rem;
  }

  :global(.sleep-routine-board),
  :global(.sleep-trend-chart) {
    display: grid;
    gap: 12px;
    min-height: 0;
  }

  :global(.sleep-routine-board) {
    overflow: auto;
  }

  :global(.sleep-routine-board) article {
    grid-template-columns: 46px 1fr auto;
  }

  :global(.sleep-routine-board__count) {
    display: grid;
    place-items: center;
    width: 46px;
    aspect-ratio: 1;
    border-radius: 16px;
    background: color-mix(in srgb, var(--sleep-accent) 16%, var(--sleep-surface));
    color: var(--sleep-ink);
    font-weight: 700;
  }

  :global(.sleep-trend-chart) {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    align-items: end;
    height: 100%;
  }

  :global(.sleep-trend-chart) article {
    display: grid;
    justify-items: center;
    align-items: end;
    gap: 10px;
    height: 100%;
  }

  :global(.sleep-trend-chart) i {
    width: 28px;
    height: var(--bar);
    min-height: 18px;
    align-self: end;
  }

  :global(.sleep-trend-chart) span,
  :global(.sleep-trend-chart) strong {
    font-size: 0.8rem;
  }

  :global(.sleep-alarm-list) article {
    grid-template-columns: 1fr auto auto;
  }

  :global(.sleep-alarm-list__time) {
    font: 600 1.4rem "JetBrains Mono", monospace;
  }

  :global(.sleep-export-list) article {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    padding: 16px 18px;
  }
  /* ── Log section (ported exactly from Journal's Sleep bento cards) ── */
  .sl-bento {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1fr;
    gap: 16px;
  }

  .sl-card {
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
  }

  .sl-card--accent {
    background: var(--sleep-accent, var(--primary));
    color: #fff;
    align-items: center;
    text-align: center;
  }

  .sl-card--surface {
    background: var(--card);
    border: 1px solid var(--border);
  }

  .sl-card--dark {
    background: var(--surface);
    color: var(--surface-foreground, #fff);
  }

  .sl-card-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .sl-card-label svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .sl-card-hint {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
  }

  .sl-hero-num {
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .sl-unit {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.6;
  }

  .sl-stars {
    display: flex;
    gap: 6px;
  }

  .sl-star {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    color: rgba(255,255,255,0.3);
    transition: all 0.15s;
  }

  .sl-star:hover {
    transform: scale(1.15);
  }

  .sl-star--on {
    color: #fbbf24;
  }

  .sl-star svg {
    width: 22px;
    height: 22px;
  }

  .sl-card--log {
    padding: 18px;
  }

  .sl-log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  .sl-log-row:last-child {
    border-bottom: none;
  }

  .sl-log-date {
    width: 60px;
    font-size: 12px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .sl-bar-wrap {
    flex: 1;
    height: 10px;
    border-radius: 999px;
    background: var(--muted-surface);
    overflow: hidden;
  }

  .sl-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .sl-log-hrs {
    width: 36px;
    font-size: 12px;
    font-weight: 600;
    text-align: right;
  }

  .sl-stars-mini {
    display: flex;
    gap: 2px;
  }

  .sl-star-mini {
    width: 12px;
    height: 12px;
  }

  .sl-card--avg {
    padding: 22px;
  }

  .sl-stat-big {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .sl-tips {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sl-tip {
    font-size: 12px;
    opacity: 0.7;
    padding: 6px 10px;
    background: rgba(255,255,255,0.06);
    border-radius: 8px;
  }

  @media (max-width: 860px) {
    .sl-bento { grid-template-columns: 1fr; }
  }
</style>
