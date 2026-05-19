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
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  const moduleId = "sleep";
  const sectionLabels = ["Tonight", "Score", "Routine", "Trends", "Alarm", "Export"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

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
</script>

<main class="sleep-workspace module-root">
  <section class="sleep-shell">
    <header class="sleep-shell__header">
      <div class="sleep-shell__intro">
        <div class="sleep-shell__eyebrow">
          <span>Somna</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Sleep score, routine, and alarm planning stay inside one calm desktop surface.</h1>
        <p>Tonight’s setup, last night’s quality, and the weekly pattern all fit without leaving the shell.</p>
      </div>

      <div class="sleep-shell__actions">
        <Button variant="outline">
          <MoonStarIcon data-icon="inline-start" />
          Night mode
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          AI bedtime
        </Button>
      </div>
    </header>

    <section class="sleep-hero-grid">
      <Card class="sleep-orb-card">
        <CardHeader>
          <CardTitle>Last night</CardTitle>
          <CardDescription>7h 42m total sleep with a strong recovery curve.</CardDescription>
        </CardHeader>
        <CardContent class="sleep-orb-card__content">
          <div class="sleep-orb">
            <strong>82</strong>
            <small>score</small>
          </div>
          <div class="sleep-meta">
            <div><strong>+11%</strong><span>better than weekly average</span></div>
            <div><strong>06:35</strong><span>smart wake target</span></div>
          </div>
        </CardContent>
      </Card>

      <Card class="sleep-summary-card">
        <CardHeader>
          <CardTitle>Recovery outlook</CardTitle>
          <CardDescription>Energy forecast before tomorrow begins.</CardDescription>
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

    <section class="sleep-shell__body">
      {#if selectedSection === "Tonight"}
        <div class="sleep-grid sleep-grid--tonight">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Tonight plan</CardTitle>
              <CardDescription>Keep the current module’s bedtime flow, but expand it into a full nightly brief.</CardDescription>
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
              <CardTitle>Pre-sleep checklist</CardTitle>
              <CardDescription>Routine steps remain visible before you close the app.</CardDescription>
            </CardHeader>
            <CardContent class="sleep-routine-list">
              {#each routine as step}
                <article>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.note}</p>
                  </div>
                  <Badge variant={step.status === "Done" ? "default" : "secondary"}>{step.status}</Badge>
                </article>
              {/each}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Score"}
        <div class="sleep-grid sleep-grid--score">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Stage balance</CardTitle>
              <CardDescription>Break the score into the parts that actually drove it.</CardDescription>
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
              <CardTitle>Score breakdown</CardTitle>
              <CardDescription>Sleep timing, duration, and wake consistency mapped into one panel.</CardDescription>
            </CardHeader>
            <CardContent class="sleep-breakdown">
              <div><span>Duration</span><strong>88</strong></div>
              <div><span>Consistency</span><strong>79</strong></div>
              <div><span>Recovery</span><strong>84</strong></div>
              <div><span>Wake stability</span><strong>81</strong></div>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Routine"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>Bedtime routine</CardTitle>
            <CardDescription>The original routine card now expands into a full sequence with status and coaching.</CardDescription>
          </CardHeader>
          <CardContent class="sleep-routine-board">
            {#each routine as step, index}
              <article>
                <div class="sleep-routine-board__count">{index + 1}</div>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.note}</p>
                </div>
                <Badge variant={step.status === "Done" ? "default" : "outline"}>{step.status}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Trends"}
        <div class="sleep-grid sleep-grid--trends">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Weekly trend</CardTitle>
              <CardDescription>The original bar chart becomes a full-width trend view.</CardDescription>
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
              <CardTitle>Pattern notes</CardTitle>
              <CardDescription>Simple takeaways instead of another dashboard layer.</CardDescription>
            </CardHeader>
            <CardContent class="sleep-list">
              <article><span>Best night</span><strong>Thursday</strong><p>Longest deep sleep after screens cut off by 9:30 PM.</p></article>
              <article><span>Weakest night</span><strong>Wednesday</strong><p>Late caffeine and short recovery window pulled the score down.</p></article>
              <article><span>Trend</span><strong>Rising</strong><p>Average score is up 6 points compared with the previous week.</p></article>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Alarm"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>Alarm orchestration</CardTitle>
            <CardDescription>Smart wake presets, travel backup, and routine tie-ins stay in one screen.</CardDescription>
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
      {:else}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>Export sleep data</CardTitle>
            <CardDescription>Prepare coach-ready or archive-ready files without breaking the desktop flow.</CardDescription>
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
                  Export
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
    font-family: "Satoshi", "Manrope", sans-serif;
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
    box-shadow: inset 0 0 0 28px var(--sleep-surface);
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
</style>
