<script lang="ts">
  import DownloadIcon from "@lucide/svelte/icons/download";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import WindIcon from "@lucide/svelte/icons/wind";
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

  const moduleId = "breathing";
  const sectionLabels = ["Breathe", "Sessions", "Sounds", "Check-ins", "Streaks", "Export"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  const modes = [
    { title: "Box 4-4-4-4", detail: "Steady reset before work blocks" },
    { title: "4-7-8 reset", detail: "Long exhale for evening downshift" },
    { title: "Physiological sigh", detail: "Fast de-stress after sharp spikes" },
    { title: "Coherent breathing", detail: "Five breaths per minute for calm focus" },
  ];

  const sessions = [
    { title: "Lunch reset", duration: "6 min", outcome: "Stress dropped from 5.1 to 2.9" },
    { title: "Pre-call calm", duration: "3 min", outcome: "Voice steadier, heart rate eased" },
    { title: "Bedtime downshift", duration: "8 min", outcome: "Sleep routine adherence improved" },
  ];

  const sounds = [
    { title: "Warm air", detail: "Soft filtered noise", active: true },
    { title: "Rain room", detail: "Muted roof ambience", active: false },
    { title: "Ocean pulse", detail: "Long low swells", active: false },
  ];

  const checkIns = [
    { prompt: "Current level", value: "3.2 / 10", note: "Mild background tension" },
    { prompt: "Target after session", value: "1.8 / 10", note: "Return to steady baseline" },
    { prompt: "Body cue", value: "Jaw + shoulders", note: "Most tension sits high today" },
  ];

  const streaks = [
    { label: "Current streak", value: "18 days" },
    { label: "Best week", value: "6 sessions" },
    { label: "Night reset rate", value: "82%" },
  ];

  const exportOptions = [
    { title: "Breathing recap PDF", detail: "Sessions, streaks, and before/after check-ins." },
    { title: "CSV session log", detail: "Technique, duration, and subjective stress shift." },
    { title: "Calm share card", detail: "A one-page summary for coaching or therapy review." },
  ];
</script>

<main class="breathing-workspace module-root">
  <section class="breathing-shell">
    <header class="breathing-shell__header">
      <div class="breathing-shell__intro">
        <div class="breathing-shell__eyebrow">
          <span>Calm lab</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Keep the breathing orb and extend it into sessions, sounds, check-ins, streaks, and export.</h1>
        <p>The module stays gentle and focused while using the shell-controlled section state.</p>
      </div>

      <div class="breathing-shell__actions">
        <Button variant="outline">
          <Volume2Icon data-icon="inline-start" />
          Sounds
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          AI calm
        </Button>
      </div>
    </header>

    <section class="breathing-hero-grid">
      <Card class="breathing-orb-card">
        <CardHeader>
          <CardTitle>Box breathing</CardTitle>
          <CardDescription>Four counts in, hold, out, hold.</CardDescription>
        </CardHeader>
        <CardContent class="breathing-orb-card__content">
          <div class="breathing-orb">
            <strong>04</strong>
            <small>inhale</small>
          </div>
          <Button>
            <WindIcon data-icon="inline-start" />
            Start session
          </Button>
        </CardContent>
      </Card>

      <Card class="breathing-hero-card">
        <CardHeader>
          <CardTitle>Calm state</CardTitle>
          <CardDescription>Immediate context without opening another panel.</CardDescription>
        </CardHeader>
        <CardContent class="breathing-hero-list">
          <article><span>Streak</span><strong>18 days</strong></article>
          <article><span>Best time</span><strong>Before sleep</strong></article>
          <article><span>Preferred sound</span><strong>Warm air</strong></article>
        </CardContent>
      </Card>
    </section>

    <section class="breathing-shell__body">
      {#if selectedSection === "Breathe"}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Exercise library</CardTitle>
            <CardDescription>The original exercise list gets its own proper screen.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-mode-list">
            {#each modes as mode}
              <article>
                <div>
                  <strong>{mode.title}</strong>
                  <p>{mode.detail}</p>
                </div>
                <Button variant="outline">Open</Button>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sessions"}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Duration and subjective outcome in a fixed-height timeline.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-session-list">
            {#each sessions as session}
              <article>
                <div>
                  <strong>{session.title}</strong>
                  <p>{session.outcome}</p>
                </div>
                <span>{session.duration}</span>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sounds"}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Sound bed</CardTitle>
            <CardDescription>Ambient support, kept lightweight and calm.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-sound-list">
            {#each sounds as sound}
              <article>
                <Volume2Icon size={18} />
                <div>
                  <strong>{sound.title}</strong>
                  <p>{sound.detail}</p>
                </div>
                <Badge variant={sound.active ? "default" : "outline"}>{sound.active ? "Active" : "Ready"}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Check-ins"}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Anxiety check-ins</CardTitle>
            <CardDescription>The original before/after check now grows into a full check-in panel.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-check-list">
            {#each checkIns as item}
              <article>
                <span>{item.prompt}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Streaks"}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Streaks and rhythm</CardTitle>
            <CardDescription>Compact streak stats that still feel like part of Calm Lab.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-streak-list">
            {#each streaks as streak}
              <article>
                <span>{streak.label}</span>
                <strong>{streak.value}</strong>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <Card class="breathing-panel breathing-panel--full">
          <CardHeader>
            <CardTitle>Export calm history</CardTitle>
            <CardDescription>Session summaries and check-ins packaged without leaving the shell.</CardDescription>
          </CardHeader>
          <CardContent class="breathing-export-list">
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
  :global(.breathing-workspace) {
    --breathing-bg: var(--background);
    --breathing-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --breathing-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --breathing-border: color-mix(in srgb, var(--border) 86%, transparent);
    --breathing-ink: var(--foreground);
    --breathing-muted: var(--muted);
    --breathing-accent: var(--primary);
    --breathing-accent-soft: color-mix(in srgb, var(--accent) 36%, var(--primary));
    height: 100%;
    padding: 28px 30px;
    background: var(--breathing-bg);
    color: var(--breathing-ink);
    overflow: hidden;
    font-family: "Outfit", sans-serif;
  }

  :global(.breathing-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.breathing-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.breathing-shell__intro) {
    max-width: 56rem;
  }

  :global(.breathing-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--breathing-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.breathing-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.breathing-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--breathing-muted);
  }

  :global(.breathing-shell__actions) {
    display: flex;
    gap: 12px;
  }

  :global(.breathing-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 16px;
  }

  :global(.breathing-orb-card),
  :global(.breathing-hero-card),
  :global(.breathing-panel) {
    border-color: var(--breathing-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--breathing-surface) 98%, var(--background)),
        color-mix(in srgb, var(--breathing-surface) 86%, var(--background))
      );
  }

  :global(.breathing-orb-card__content) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 20px;
    align-items: center;
  }

  :global(.breathing-orb) {
    display: grid;
    place-items: center;
    width: 210px;
    aspect-ratio: 1;
    border-radius: 999px;
    background:
      radial-gradient(
        circle,
        var(--breathing-surface) 0 42%,
        color-mix(in srgb, var(--breathing-accent) 72%, var(--breathing-surface)) 43% 45%,
        color-mix(in srgb, var(--breathing-accent) 16%, var(--breathing-surface)) 46%
      );
  }

  :global(.breathing-orb) strong {
    display: block;
    font-size: 3rem;
    line-height: 1;
  }

  :global(.breathing-orb) small,
  :global(.breathing-hero-list) span,
  :global(.breathing-mode-list) p,
  :global(.breathing-session-list) p,
  :global(.breathing-sound-list) p,
  :global(.breathing-check-list) p,
  :global(.breathing-export-list) p {
    color: var(--breathing-muted);
  }

  :global(.breathing-hero-list),
  :global(.breathing-mode-list),
  :global(.breathing-session-list),
  :global(.breathing-sound-list),
  :global(.breathing-check-list),
  :global(.breathing-export-list) {
    display: grid;
    gap: 12px;
  }

  :global(.breathing-hero-list) article,
  :global(.breathing-mode-list) article,
  :global(.breathing-session-list) article,
  :global(.breathing-sound-list) article,
  :global(.breathing-check-list) article,
  :global(.breathing-streak-list) article,
  :global(.breathing-export-list) article {
    border: 1px solid color-mix(in srgb, var(--breathing-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--breathing-surface-strong) 92%, transparent);
  }

  :global(.breathing-hero-list) article {
    padding: 16px 18px;
  }

  :global(.breathing-shell__body),
  :global(.breathing-panel),
  :global(.breathing-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.breathing-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.breathing-panel--full) {
    height: 100%;
  }

  :global(.breathing-mode-list),
  :global(.breathing-session-list),
  :global(.breathing-sound-list),
  :global(.breathing-check-list),
  :global(.breathing-streak-list),
  :global(.breathing-export-list) {
    min-height: 0;
    overflow: auto;
  }

  :global(.breathing-mode-list) article,
  :global(.breathing-session-list) article,
  :global(.breathing-sound-list) article,
  :global(.breathing-export-list) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.breathing-sound-list) article {
    grid-template-columns: 18px 1fr auto;
  }

  :global(.breathing-check-list) article,
  :global(.breathing-streak-list) article {
    padding: 16px 18px;
  }

  :global(.breathing-check-list) span,
  :global(.breathing-streak-list) span {
    display: block;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--breathing-muted);
  }

  :global(.breathing-check-list) strong,
  :global(.breathing-streak-list) strong {
    display: block;
    margin-top: 8px;
    font-size: 1.25rem;
  }

  :global(.breathing-streak-list) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
</style>
