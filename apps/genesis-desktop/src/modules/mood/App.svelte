<script lang="ts">
  import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import HeartHandshakeIcon from "@lucide/svelte/icons/heart-handshake";
  import PlusIcon from "@lucide/svelte/icons/plus";
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
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  const moduleId = "mood";
  const sectionLabels = ["Check-in", "Calendar", "Activities", "Patterns", "Therapist", "Export"] as const;
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  const moods = [
    { id: "drained", label: "Drained", emoji: "😞", intensity: 24 },
    { id: "restless", label: "Restless", emoji: "😕", intensity: 39 },
    { id: "steady", label: "Steady", emoji: "🙂", intensity: 64 },
    { id: "bright", label: "Bright", emoji: "😊", intensity: 82 },
    { id: "energized", label: "Energized", emoji: "🤩", intensity: 91 },
  ] as const;

  const activityLibrary = [
    "Deep work",
    "Exercise",
    "Family time",
    "Reading",
    "Outside walk",
    "Journaling",
    "Meals",
    "Meetings",
  ];

  const checkIns = [
    { time: "08:10", mood: "Steady", note: "Started the day focused after a quiet morning." },
    { time: "11:45", mood: "Bright", note: "Good energy after shipping the planning deck." },
    { time: "15:20", mood: "Restless", note: "Too many context switches during meetings." },
    { time: "20:40", mood: "Steady", note: "Recovered after a walk and an early dinner." },
  ];

  const patterns = [
    { label: "Exercise days", value: 88, note: "Best emotional stability after movement." },
    { label: "Meeting-heavy days", value: 42, note: "Energy dips sharply after 3+ calls." },
    { label: "Sleep over 7h", value: 79, note: "Usually correlates with calmer afternoons." },
    { label: "Weekend resets", value: 93, note: "Strongest mood rebounds happen on Sundays." },
  ];

  const therapistCards = [
    { title: "Share summary", description: "Export a monthly overview with check-ins, triggers, and trends." },
    { title: "Flag patterns", description: "Surface recurring low-mood days and suggest questions for therapy." },
    { title: "Private notes", description: "Keep sensitive reflection snippets separate from the main timeline." },
  ];

  const exportOptions = [
    { label: "Therapist PDF", detail: "Calendar + pattern summary + selected notes" },
    { label: "CSV timeline", detail: "All check-ins with activity tags and intensity" },
    { label: "Weekly recap", detail: "Short AI summary for your private archive" },
  ];

  let selectedMood = $state("steady");
  let noteText = $state("");
  let selectedActivities = $state(["Deep work", "Reading"]);

  function toggleActivity(activity: string) {
    selectedActivities = selectedActivities.includes(activity)
      ? selectedActivities.filter((entry) => entry !== activity)
      : [...selectedActivities, activity];
  }

  const selectedMoodEntry = $derived(moods.find((mood) => mood.id === selectedMood) ?? moods[2]);
</script>

<main class="mood-workspace module-root">
  <section class="mood-shell">
    <header class="mood-shell__header">
      <div class="mood-shell__intro">
        <div class="mood-shell__eyebrow">
          <span>Mood studio</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Track how the day feels without breaking the flow of the desktop app.</h1>
        <p>
          One-tap check-ins, activity context, therapist-ready summaries, and patterns that stay private.
        </p>
      </div>

      <div class="mood-shell__actions">
        <Button variant="outline">
          <CalendarDaysIcon data-icon="inline-start" />
          View month
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          AI recap
        </Button>
      </div>
    </header>

    <section class="mood-hero-grid">
      <Card class="mood-profile-card">
        <CardHeader>
          <CardTitle>Maya Simmons</CardTitle>
          <CardDescription>Your personal mood dashboard</CardDescription>
        </CardHeader>
        <CardContent class="mood-profile-card__content">
          <div class="mood-avatar">MS</div>
          <div class="mood-profile-card__stats">
            <div><strong>11</strong><span>streak</span></div>
            <div><strong>56</strong><span>entries</span></div>
            <div><strong>12</strong><span>great days</span></div>
          </div>
        </CardContent>
      </Card>

      <Card class="mood-gradient-card mood-gradient-card--warm">
        <CardHeader>
          <CardTitle>Great days</CardTitle>
          <CardDescription>Highest consistency this month</CardDescription>
        </CardHeader>
        <CardContent><strong>83%</strong></CardContent>
      </Card>

      <Card class="mood-gradient-card mood-gradient-card--cool">
        <CardHeader>
          <CardTitle>Calm days</CardTitle>
          <CardDescription>Stable afternoons after routines</CardDescription>
        </CardHeader>
        <CardContent><strong>56%</strong></CardContent>
      </Card>

      <Card class="mood-tools-card">
        <CardHeader>
          <CardTitle>Connected apps</CardTitle>
          <CardDescription>3 active wellness signals supporting the timeline</CardDescription>
        </CardHeader>
        <CardContent class="mood-chip-row">
          <Badge variant="secondary">Sleep</Badge>
          <Badge variant="secondary">Steps</Badge>
          <Badge variant="secondary">Journal</Badge>
        </CardContent>
      </Card>
    </section>

    {#if selectedSection === "Check-in"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>How are you feeling right now?</CardTitle>
            <CardDescription>Quick emotional capture with enough detail to be useful later.</CardDescription>
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
                  <strong>{mood.label}</strong>
                </button>
              {/each}
            </div>
            <Input bind:value={noteText} placeholder="What influenced this feeling?" />
            <div class="mood-chip-row">
              {#each selectedActivities as activity}
                <Badge variant="outline">{activity}</Badge>
              {/each}
            </div>
            <div class="mood-checkin__footer">
              <span>Selected intensity {selectedMoodEntry.intensity}%</span>
              <Button>
                <PlusIcon data-icon="inline-start" />
                Save check-in
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>Today’s timeline</CardTitle>
            <CardDescription>Recent emotional snapshots you can revisit or edit.</CardDescription>
          </CardHeader>
          <CardContent class="mood-timeline">
            {#each checkIns as entry}
              <article class="mood-timeline__item">
                <span>{entry.time}</span>
                <div>
                  <strong>{entry.mood}</strong>
                  <p>{entry.note}</p>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Calendar"}
      <Card class="mood-panel">
        <CardHeader>
          <CardTitle>Calendar view</CardTitle>
          <CardDescription>Month-at-a-glance logging so mood capture does not stay locked to one day.</CardDescription>
        </CardHeader>
        <CardContent class="mood-calendar">
          {#each Array.from({ length: 30 }, (_, index) => index + 1) as day}
            <button class="mood-calendar__day" type="button">
              <small>{day}</small>
              <span>{moods[day % moods.length].emoji}</span>
            </button>
          {/each}
        </CardContent>
      </Card>
    {:else if selectedSection === "Activities"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>Activity tags</CardTitle>
            <CardDescription>Tag the patterns that shape mood without needing a second app.</CardDescription>
          </CardHeader>
          <CardContent class="mood-activity-grid">
            {#each activityLibrary as activity}
              <button
                class:mood-activity-grid__item--selected={selectedActivities.includes(activity)}
                class="mood-activity-grid__item"
                type="button"
                onclick={() => toggleActivity(activity)}
              >
                {activity}
              </button>
            {/each}
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>Context summary</CardTitle>
            <CardDescription>Selected activities connected to the strongest emotional shifts.</CardDescription>
          </CardHeader>
          <CardContent class="mood-summary-list">
            {#each selectedActivities as activity}
              <article>
                <strong>{activity}</strong>
                <p>Appears most often on steady and bright days this month.</p>
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Patterns"}
      <section class="mood-two-column">
        <Card class="mood-panel mood-panel--wide">
          <CardHeader>
            <CardTitle>Pattern review</CardTitle>
            <CardDescription>Correlations surfaced from repeated check-ins, not guesswork.</CardDescription>
          </CardHeader>
          <CardContent class="mood-pattern-list">
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
          </CardContent>
        </Card>

        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>AI pattern note</CardTitle>
            <CardDescription>A plain-language interpretation before you export or share.</CardDescription>
          </CardHeader>
          <CardContent class="mood-ai-note">
            <p>
              Your strongest mood days cluster around movement, quiet mornings, and fewer than three meetings.
              The biggest dips happen after long meeting blocks without a reset window.
            </p>
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Therapist"}
      <section class="mood-two-column">
        <Card class="mood-panel">
          <CardHeader>
            <CardTitle>Therapy prep</CardTitle>
            <CardDescription>Gather the important emotional signals before your next session.</CardDescription>
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
            <CardTitle>Suggested talking points</CardTitle>
            <CardDescription>High-signal prompts generated from the current month.</CardDescription>
          </CardHeader>
          <CardContent class="mood-summary-list">
            <article>
              <strong>Meeting overload</strong>
              <p>Explore why stacked calls create anxiety faster than solo workload.</p>
            </article>
            <article>
              <strong>Weekend reset effect</strong>
              <p>Understand which rituals are actually producing the Sunday rebound.</p>
            </article>
            <article>
              <strong>Sleep and patience</strong>
              <p>Notice how shorter sleep windows correlate with irritability before lunch.</p>
            </article>
          </CardContent>
        </Card>
      </section>
    {:else if selectedSection === "Export"}
      <Card class="mood-panel">
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Move your data out cleanly without losing the context behind it.</CardDescription>
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
                Export
              </Button>
            </article>
          {/each}
        </CardContent>
      </Card>
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
