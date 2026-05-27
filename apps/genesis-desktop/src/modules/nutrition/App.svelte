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
  import { activeBundle, createTranslator } from "$lib/i18n";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  const moduleId = "nutrition";
  const sectionLabels = ["Today", "Water", "Meals", "Macros", "Reminders", "Export", "Journal"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

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
  // ── Journal section (ported exactly from Journal's Nutrition section) ──
  let journalCalories = $state(1840);
  let journalWater = $state(6);
  let journalMacros = $state({ protein: 98, carbs: 210, fat: 62 });
  let journalMeals = $state([
    { name: 'Breakfast', kcal: 380, items: 'Oats, berries, coffee' },
    { name: 'Lunch', kcal: 620, items: 'Chicken salad, sourdough' },
    { name: 'Snack', kcal: 180, items: 'Almonds, apple' },
    { name: 'Dinner', kcal: 660, items: 'Salmon, quinoa, greens' },
  ]);

  function updateJournalNut() {
    // placeholder for persistence
  }

  let journalProgress = $derived((journalCalories / 2200) * 100);
</script>

<main class="nutrition-workspace module-root" data-module="nutrition">
  <section class="nutrition-shell">
    <header class="nutrition-shell__header">
      <div class="nutrition-shell__intro">
        <div class="nutrition-shell__eyebrow">
          <span>{_t('moduleNutritionTitle')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>{_t('moduleNutritionDesc')}</h1>
        <p>{_t('moduleNutritionSubtitle')}</p>
      </div>

      <div class="nutrition-shell__actions">
        <Button variant="outline">
          <DropletsIcon data-icon="inline-start" />
          {_t('moduleNutritionQuickAdd')}
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          {_t('moduleNutritionMealInsight')}
        </Button>
      </div>
    </header>

    {#if selectedSection === "Today"}
    <section class="nutrition-hero-grid">
      <Card class="nutrition-ring-card">
        <CardHeader>
          <CardTitle>{_t('moduleNutritionHydration')}</CardTitle>
          <CardDescription>{_t('moduleNutritionHydrationDesc')}</CardDescription>
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
          <CardTitle>{_t('moduleNutritionTodaysTarget')}</CardTitle>
          <CardDescription>{_t('moduleNutritionTodaysTargetDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="nutrition-hero-list">
          <article><span>{_t('moduleNutritionCalories')}</span><strong>1,860 / 2,300</strong></article>
          <article><span>{_t('moduleNutritionMealsLogged')}</span><strong>3 so far</strong></article>
          <article><span>{_t('moduleNutritionNextCue')}</span><strong>{_t('moduleNutritionWaterReminder')}</strong></article>
        </CardContent>
      </Card>
    </section>
    {/if}

    <section class="nutrition-shell__body">
      {#if selectedSection === "Today"}
        <div class="nutrition-grid nutrition-grid--today">
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>{_t('moduleNutritionTimeline')}</CardTitle>
              <CardDescription>{_t('moduleNutritionTimelineDesc')}</CardDescription>
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
              <CardTitle>{_t('moduleNutritionQuickAdd')}</CardTitle>
              <CardDescription>{_t('moduleNutritionQuickAddDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-quick-add">
              {#each ["150 ml", "250 ml", "500 ml", _t('moduleNutritionSnack'), _t('moduleNutritionMeal'), _t('moduleNutritionCustom')] as item}
                <button type="button">{item}</button>
              {/each}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Water"}
        <div class="nutrition-grid nutrition-grid--water">
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>{_t('moduleNutritionWaterLog')}</CardTitle>
              <CardDescription>{_t('moduleNutritionWaterLogDesc')}</CardDescription>
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
              <CardTitle>{_t('moduleNutritionHydrationStats')}</CardTitle>
              <CardDescription>{_t('moduleNutritionHydrationStatsDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-stat-list">
              <article><span>{_t('moduleNutritionStreak')}</span><strong>12 days</strong></article>
              <article><span>{_t('moduleNutritionWeeklyAvg')}</span><strong>1.9L</strong></article>
              <article><span>{_t('moduleNutritionBestDay')}</span><strong>2.8L</strong></article>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Meals"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleNutritionMeals')}</CardTitle>
            <CardDescription>{_t('moduleNutritionMealsDesc')}</CardDescription>
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
            <CardTitle>{_t('moduleNutritionMacroBreakdown')}</CardTitle>
            <CardDescription>{_t('moduleNutritionMacroBreakdownDesc')}</CardDescription>
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
            <CardTitle>{_t('moduleNutritionReminderCadence')}</CardTitle>
            <CardDescription>{_t('moduleNutritionReminderCadenceDesc')}</CardDescription>
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
      {:else if selectedSection === "Journal"}
    <section class="nj-bento">
      <!-- CALORIE RING CARD (accent, focus-ring style) -->
      <div class="nj-card nj-card--accent nj-card--calring">
        <div class="nj-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          {_t('moduleNutritionCaloriesToday')}
        </div>
        <div class="nj-ring-wrap">
          <PremiumRing
            size={156}
            thickness={12}
            segments={[{ value: journalProgress, color: "white", label: "Calories" }]}
            centerLabel={_t('moduleNutritionCaloriesToday')}
            centerValue={String(journalCalories)}
            centerNote={`/ 2200 ${_t('moduleNutritionKcal')}`}
          />
        </div>
        <div class="nj-macro-row">
          <span class="nj-macro"><b>{journalMacros.protein}g</b><span>{_t('moduleNutritionProtein')}</span></span>
          <span class="nj-macro"><b>{journalMacros.carbs}g</b><span>{_t('moduleNutritionCarbs')}</span></span>
          <span class="nj-macro"><b>{journalMacros.fat}g</b><span>{_t('moduleNutritionFat')}</span></span>
        </div>
      </div>

      <!-- MEALS LIST CARD (surface) -->
      <div class="nj-card nj-card--surface nj-card--meals">
        <div class="nj-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
          {_t('moduleNutritionMeals')}
        </div>
        {#each journalMeals as meal}
        <div class="nj-meal-row">
          <div class="nj-meal-info">
            <span class="nj-meal-name">{meal.name}</span>
            <span class="nj-meal-items">{meal.items}</span>
          </div>
          <span class="nj-meal-kcal">{meal.kcal} kcal</span>
        </div>
        {/each}
      </div>

      <!-- WATER CARD (dark) -->
      <div class="nj-card nj-card--dark nj-card--water">
        <div class="nj-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          {_t('moduleNutritionWater')}
        </div>
        <div class="nj-stat-big" style="color:#3b82f6">{journalWater}<span class="nj-stat-unit">{_t('moduleNutritionGlasses')}</span></div>
        <div class="nj-water-dots">
          {#each [1,2,3,4,5,6,7,8] as g}
            <button class="nj-water-dot" class:nj-water-dot--filled={g <= journalWater} onclick={() => { journalWater = g; updateJournalNut(); }}>
              <svg viewBox="0 0 24 24" fill={g<=journalWater?'#3b82f6':'none'} stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </button>
          {/each}
        </div>
        <p class="nj-card-hint">{_t('moduleNutritionGoalGlasses')}</p>
      </div>
    </section>
      {:else}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleNutritionExportData')}</CardTitle>
            <CardDescription>{_t('moduleNutritionExportDataDesc')}</CardDescription>
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
                  {_t('moduleNutritionExport')}
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
    box-shadow: none;
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

  /* ── Journal section (ported from Journal's Nutrition bento cards) ── */
  .nj-bento {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 16px;
  }

  .nj-card {
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
  }

  .nj-card--accent {
    background: var(--nutrition-accent, var(--primary));
    color: #fff;
    align-items: center;
    text-align: center;
  }

  .nj-card--surface {
    background: var(--card);
    border: 1px solid var(--border);
  }

  .nj-card--dark {
    background: var(--surface);
    color: var(--surface-foreground, #fff);
  }

  .nj-card-label {
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

  .nj-card-label svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .nj-card-hint {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
  }

  /* Calorie ring */
  .nj-ring-wrap {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto;
  }

  .nj-ring-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .nj-ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .nj-ring-num {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
  }

  .nj-ring-sub {
    font-size: 11px;
    opacity: 0.6;
  }

  .nj-macro-row {
    display: flex;
    gap: 16px;
    justify-content: center;
  }

  .nj-macro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 12px;
  }

  .nj-macro b {
    font-size: 16px;
    font-weight: 700;
  }

  /* Meals list */
  .nj-card--meals {
    padding: 18px;
  }

  .nj-meal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }

  .nj-meal-row:last-child {
    border-bottom: none;
  }

  .nj-meal-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nj-meal-name {
    font-size: 14px;
    font-weight: 600;
  }

  .nj-meal-items {
    font-size: 12px;
    color: var(--muted);
  }

  .nj-meal-kcal {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    flex-shrink: 0;
  }

  /* Water card */
  .nj-card--water {
    padding: 22px;
  }

  .nj-stat-big {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .nj-stat-unit {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.6;
  }

  .nj-water-dots {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .nj-water-dot {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    opacity: 0.3;
    transition: all 0.15s;
  }

  .nj-water-dot:hover {
    opacity: 0.7;
    transform: scale(1.15);
  }

  .nj-water-dot--filled {
    opacity: 1;
  }

  .nj-water-dot svg {
    width: 18px;
    height: 18px;
  }

  @media (max-width: 860px) {
    .nj-bento { grid-template-columns: 1fr; }
  }
</style>
