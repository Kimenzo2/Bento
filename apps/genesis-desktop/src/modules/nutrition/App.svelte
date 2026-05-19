<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import DropletsIcon from "@lucide/svelte/icons/droplets";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import UtensilsCrossedIcon from "@lucide/svelte/icons/utensils-crossed";
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

  const moduleId = "nutrition";
  const sectionLabels = ["Today", "Water", "Meals", "Macros", "Reminders", "Export"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  const drinks = [
    { time: "07:20", amount: "250 ml" },
    { time: "09:45", amount: "500 ml" },
    { time: "12:05", amount: "250 ml" },
    { time: "15:40", amount: "150 ml" },
  ];

  const meals = [
    { title: "Oatmeal bowl", detail: "Berries, chia, almond butter", kcal: "450 kcal" },
    { title: "Chicken grain salad", detail: "Greens, couscous, citrus dressing", kcal: "620 kcal" },
    { title: "Protein yogurt", detail: "Quick afternoon top-up", kcal: "190 kcal" },
  ];

  const macros = [
    { label: "Protein", value: "112 g", fill: 74 },
    { label: "Carbs", value: "168 g", fill: 63 },
    { label: "Fats", value: "52 g", fill: 57 },
  ];

  const reminders = [
    { label: "Hydration pulse", detail: "Every 90 minutes from 08:00 to 18:00", mode: "Active" },
    { label: "Lunch break", detail: "12:30 with focus-session cooldown", mode: "Scheduled" },
    { label: "Protein check", detail: "20:00 fallback if intake is low", mode: "Smart" },
  ];

  const exportOptions = [
    { title: "Nutrition PDF", detail: "Meals, hydration, and adherence for the past 14 days." },
    { title: "Macro CSV", detail: "Daily totals for coaching or spreadsheet tracking." },
    { title: "Reminder log", detail: "Prompt timing and response completion history." },
  ];
</script>

<main class="nutrition-workspace module-root">
  <section class="nutrition-shell">
    <header class="nutrition-shell__header">
      <div class="nutrition-shell__intro">
        <div class="nutrition-shell__eyebrow">
          <span>Nutrition</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Hydration remains the anchor, with meals, macros, reminders, and exports added around it.</h1>
        <p>The module keeps its crisp ring-first layout and expands into shell-driven nutrition sections.</p>
      </div>

      <div class="nutrition-shell__actions">
        <Button variant="outline">
          <DropletsIcon data-icon="inline-start" />
          Quick add
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          Meal insight
        </Button>
      </div>
    </header>

    <section class="nutrition-hero-grid">
      <Card class="nutrition-ring-card">
        <CardHeader>
          <CardTitle>Hydration</CardTitle>
          <CardDescription>0.7L of 2.4L target</CardDescription>
        </CardHeader>
        <CardContent class="nutrition-ring-card__content">
          <div class="nutrition-ring">
            <strong>0.7L</strong>
            <small>29%</small>
          </div>
        </CardContent>
      </Card>

      <Card class="nutrition-hero-card">
        <CardHeader>
          <CardTitle>Today’s target</CardTitle>
          <CardDescription>Structure meals around focus hours and recovery training.</CardDescription>
        </CardHeader>
        <CardContent class="nutrition-hero-list">
          <article><span>Calories</span><strong>1,860 / 2,300</strong></article>
          <article><span>Meals logged</span><strong>3 so far</strong></article>
          <article><span>Next cue</span><strong>Water reminder at 16:30</strong></article>
        </CardContent>
      </Card>
    </section>

    <section class="nutrition-shell__body">
      {#if selectedSection === "Today"}
        <div class="nutrition-grid nutrition-grid--today">
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Meals and hydration in one compact day view.</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-timeline">
              {#each [...drinks.map((drink) => ({ type: "Water", title: drink.amount, detail: drink.time })), ...meals.map((meal, index) => ({ type: `Meal ${index + 1}`, title: meal.title, detail: meal.kcal }))] as entry}
                <article>
                  <span>{entry.type}</span>
                  <strong>{entry.title}</strong>
                  <p>{entry.detail}</p>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>Quick add</CardTitle>
              <CardDescription>Keep the original add buttons, but make them part of a larger day board.</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-quick-add">
              {#each ["150 ml", "250 ml", "500 ml", "Snack", "Meal", "Custom"] as item}
                <button type="button">{item}</button>
              {/each}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Water"}
        <div class="nutrition-grid nutrition-grid--water">
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>Water log</CardTitle>
              <CardDescription>The existing hydration timeline becomes its own panel.</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-water-log">
              {#each drinks as drink}
                <article>
                  <span>{drink.time}</span>
                  <strong>{drink.amount}</strong>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>Hydration stats</CardTitle>
              <CardDescription>Streaks and averages without adding another sidebar.</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-stat-list">
              <article><span>Streak</span><strong>12 days</strong></article>
              <article><span>Weekly average</span><strong>1.9L</strong></article>
              <article><span>Best day</span><strong>2.8L</strong></article>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Meals"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>Meals</CardTitle>
            <CardDescription>Food logging joins the hydration view without becoming a generic tracker dashboard.</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-meal-list">
            {#each meals as meal}
              <article>
                <div class="nutrition-meal-list__icon">
                  <UtensilsCrossedIcon size={18} />
                </div>
                <div>
                  <strong>{meal.title}</strong>
                  <p>{meal.detail}</p>
                </div>
                <span>{meal.kcal}</span>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Macros"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>Macro breakdown</CardTitle>
            <CardDescription>Protein, carbs, and fats fit in a simple fixed-height layout.</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-macro-list">
            {#each macros as macro}
              <article>
                <div class="nutrition-macro-list__copy">
                  <strong>{macro.label}</strong>
                  <span>{macro.value}</span>
                </div>
                <div class="nutrition-meter"><i style={`--fill:${macro.fill}%`}></i></div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Reminders"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>Reminder cadence</CardTitle>
            <CardDescription>Hydration and meal nudges aligned to the workday.</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-reminder-list">
            {#each reminders as reminder}
              <article>
                <div class="nutrition-reminder-list__icon">
                  <BellIcon size={18} />
                </div>
                <div>
                  <strong>{reminder.label}</strong>
                  <p>{reminder.detail}</p>
                </div>
                <Badge variant="secondary">{reminder.mode}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>Export nutrition data</CardTitle>
            <CardDescription>Hydration and meal history packaged for review.</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-export-list">
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
  :global(.nutrition-workspace) {
    --nutrition-bg: var(--background);
    --nutrition-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --nutrition-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --nutrition-border: color-mix(in srgb, var(--border) 86%, transparent);
    --nutrition-ink: var(--foreground);
    --nutrition-muted: var(--muted);
    --nutrition-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    overflow: hidden;
    font-family: "Space Grotesk", sans-serif;
  }

  :global(.nutrition-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.nutrition-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.nutrition-shell__intro) {
    max-width: 56rem;
  }

  :global(.nutrition-shell__eyebrow) {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    color: var(--nutrition-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.nutrition-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.nutrition-shell__intro) p {
    margin: 12px 0 0;
    color: var(--nutrition-muted);
    max-width: 42rem;
  }

  :global(.nutrition-shell__actions) {
    display: flex;
    gap: 12px;
  }

  :global(.nutrition-hero-grid) {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 16px;
  }

  :global(.nutrition-ring-card),
  :global(.nutrition-hero-card),
  :global(.nutrition-panel) {
    border-color: var(--nutrition-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--nutrition-surface) 98%, var(--background)),
        color-mix(in srgb, var(--nutrition-surface) 86%, var(--background))
      );
  }

  :global(.nutrition-ring-card__content) {
    display: grid;
    place-items: center;
  }

  :global(.nutrition-ring) {
    display: grid;
    place-items: center;
    width: 188px;
    aspect-ratio: 1;
    border-radius: 999px;
    background: conic-gradient(var(--nutrition-accent) 29%, color-mix(in srgb, var(--border) 80%, transparent) 0);
    box-shadow: inset 0 0 0 28px var(--nutrition-surface);
  }

  :global(.nutrition-ring) strong {
    font-size: 2.8rem;
  }

  :global(.nutrition-ring) small,
  :global(.nutrition-hero-list) span,
  :global(.nutrition-timeline) p,
  :global(.nutrition-water-log) span,
  :global(.nutrition-stat-list) span,
  :global(.nutrition-meal-list) p,
  :global(.nutrition-reminder-list) p,
  :global(.nutrition-export-list) p {
    color: var(--nutrition-muted);
  }

  :global(.nutrition-hero-list) {
    display: grid;
    gap: 12px;
  }

  :global(.nutrition-hero-list) article,
  :global(.nutrition-timeline) article,
  :global(.nutrition-water-log) article,
  :global(.nutrition-stat-list) article,
  :global(.nutrition-meal-list) article,
  :global(.nutrition-macro-list) article,
  :global(.nutrition-reminder-list) article,
  :global(.nutrition-export-list) article {
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--nutrition-surface-strong) 92%, transparent);
  }

  :global(.nutrition-hero-list) article {
    padding: 16px 18px;
  }

  :global(.nutrition-hero-list) span {
    display: block;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  :global(.nutrition-hero-list) strong {
    display: block;
    margin-top: 6px;
    font-size: 1.2rem;
  }

  :global(.nutrition-shell__body),
  :global(.nutrition-grid),
  :global(.nutrition-panel),
  :global(.nutrition-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.nutrition-grid) {
    display: grid;
    gap: 16px;
    height: 100%;
  }

  :global(.nutrition-grid--today),
  :global(.nutrition-grid--water) {
    grid-template-columns: 1.1fr 0.9fr;
  }

  :global(.nutrition-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.nutrition-panel--full) {
    height: 100%;
  }

  :global(.nutrition-timeline),
  :global(.nutrition-water-log),
  :global(.nutrition-meal-list),
  :global(.nutrition-macro-list),
  :global(.nutrition-reminder-list),
  :global(.nutrition-export-list) {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
  }

  :global(.nutrition-timeline) article,
  :global(.nutrition-water-log) article,
  :global(.nutrition-meal-list) article,
  :global(.nutrition-macro-list) article,
  :global(.nutrition-reminder-list) article,
  :global(.nutrition-export-list) article {
    padding: 16px 18px;
  }

  :global(.nutrition-timeline) span,
  :global(.nutrition-water-log) span {
    display: block;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  :global(.nutrition-timeline) strong,
  :global(.nutrition-water-log) strong,
  :global(.nutrition-stat-list) strong {
    display: block;
    margin-top: 6px;
    font-size: 1.1rem;
  }

  :global(.nutrition-quick-add) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    align-content: start;
  }

  :global(.nutrition-quick-add) button {
    padding: 16px;
    border: 1px solid color-mix(in srgb, var(--nutrition-accent) 38%, var(--nutrition-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--nutrition-accent) 12%, var(--nutrition-surface));
    color: var(--nutrition-ink);
    font: inherit;
  }

  :global(.nutrition-stat-list) {
    display: grid;
    gap: 12px;
  }

  :global(.nutrition-stat-list) article {
    padding: 18px;
  }

  :global(.nutrition-meal-list) article {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    gap: 14px;
    align-items: center;
  }

  :global(.nutrition-meal-list__icon),
  :global(.nutrition-reminder-list__icon) {
    display: grid;
    place-items: center;
    width: 38px;
    aspect-ratio: 1;
    border-radius: 14px;
    background: color-mix(in srgb, var(--nutrition-accent) 12%, var(--nutrition-surface));
    color: var(--nutrition-accent);
  }

  :global(.nutrition-macro-list) article {
    display: grid;
    gap: 10px;
  }

  :global(.nutrition-macro-list__copy) {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  :global(.nutrition-meter) {
    height: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--nutrition-border) 72%, transparent);
    overflow: hidden;
  }

  :global(.nutrition-meter) i {
    display: block;
    width: var(--fill);
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(180deg, var(--nutrition-accent), color-mix(in srgb, var(--accent) 34%, var(--nutrition-accent)));
  }

  :global(.nutrition-reminder-list) article,
  :global(.nutrition-export-list) article {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    gap: 14px;
    align-items: center;
  }

  :global(.nutrition-export-list) article {
    grid-template-columns: 1fr auto;
  }
</style>
