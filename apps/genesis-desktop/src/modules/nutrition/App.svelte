<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import DropletsIcon from "@lucide/svelte/icons/droplets";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
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
  // PieChart / Text kept for any other chart usage in this module.
  // PremiumRing wraps the segmented ring — used for the hydration Today card.
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { PieChart, Text } from 'layerchart';
  import { activeBundle, createTranslator } from "$lib/i18n";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import HydrationPieChart from "$lib/components/charts/HydrationPieChart.svelte";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const moduleId = "nutrition";
  const sectionLabels = ["Today", "Water", "Meals", "Macros", "Reminders", "Export"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Backend types ──
  interface WaterEntryType {
    id: string;
    amountMl: number;
    loggedAt: number;
  }

  interface TodayWaterType {
    totalMl: number;
    goalMl: number;
    percentage: number;
    entries: WaterEntryType[];
  }

  interface HydrationStatsType {
    streakDays: number;
    weeklyAvgMl: number;
    bestDayMl: number;
    bestDayDate: string;
  }

  interface MealFoodType {
    id: string;
    mealId: string;
    name: string;
    quantity: number;
    unit: string;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    createdAt: number;
  }

  interface MealEntryType {
    id: string;
    name: string;
    mealType: string;
    notes: string;
    totalKcal: number;
    loggedAt: number;
    foods: MealFoodType[];
  }

  interface MacroTotalsType {
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }

  interface NutritionGoalsType {
    waterGoalMl: number;
    calorieGoal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
  }

  interface TodaySummaryType {
    mealsLogged: number;
    caloriesRemaining: number;
    nextCue: string | null;
    macros: MacroTotalsType;
    goals: NutritionGoalsType;
    water: TodayWaterType;
    meals: MealEntryType[];
  }

  interface NutritionReminderType {
    id: string;
    label: string;
    detail: string;
    mode: string;
    schedule: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  // ── Hydration stats (separate endpoint, not in summary) ──
  let hydrationStats = $state<HydrationStatsType>({ streakDays: 0, weeklyAvgMl: 0, bestDayMl: 0, bestDayDate: "" });

  async function loadHydrationStats() {
    try {
      hydrationStats = await invoke<HydrationStatsType>("nutrition_get_hydration_stats");
    } catch (e) {
      console.error("Failed to load hydration stats:", e);
    }
  }

  // ── Today summary (single source of truth) ──
  let todaySummary = $state<TodaySummaryType>({
    mealsLogged: 0,
    caloriesRemaining: 0,
    nextCue: null,
    macros: { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    goals: { waterGoalMl: 2000, calorieGoal: 2200, proteinGoalG: 150, carbsGoalG: 250, fatGoalG: 70 },
    water: { totalMl: 0, goalMl: 2000, percentage: 0, entries: [] },
    meals: [],
  });

  // ── Derived from todaySummary ──
  let hydrationTotal = $derived(todaySummary.water.totalMl);
  let hydrationGoalMl = $derived(todaySummary.water.goalMl);
  let hydrationPct = $derived(Math.min(100, Math.round((hydrationTotal / hydrationGoalMl) * 100)));
  let hydrationEntries = $derived(todaySummary.water.entries);
  let hydrationCurrent = $derived(hydrationTotal / 1000);
  let hydrationGoal = $derived(hydrationGoalMl / 1000);
  let hydrationPercentage = $derived(Math.round((hydrationCurrent / hydrationGoal) * 100));

  let drinks = $derived(
    hydrationEntries.map(e => {
      const d = new Date(e.loggedAt);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const amount = e.amountMl >= 1000 ? `${(e.amountMl / 1000).toFixed(1)} L` : `${e.amountMl} ml`;
      return { time: `${h}:${m}`, amount };
    })
  );

  let macroTotals = $derived(todaySummary.macros);
  let nutritionGoals = $derived(todaySummary.goals);
  let meals = $derived(todaySummary.meals);

  async function addWater(ml: number) {
    try {
      await invoke("nutrition_log_water", { params: { amountMl: ml } });
      await Promise.all([loadTodaySummary(), loadHydrationStats()]);
    } catch (e) {
      console.error("Failed to log water:", e);
    }
  }

  async function resetHydration() {
    try {
      await invoke("nutrition_reset_water");
      await Promise.all([loadTodaySummary(), loadHydrationStats()]);
    } catch (e) {
      console.error("Failed to reset hydration:", e);
    }
  }

  async function loadTodaySummary() {
    try {
      todaySummary = await invoke<TodaySummaryType>("nutrition_get_today_summary");
    } catch (e) {
      console.error("Failed to load today summary:", e);
    }
  }

  // ── Quick-add meal (Today section) ──
  let mealName = $state("");
  let mealKcal = $state<number | null>(null);
  let quickAddLoading = $state(false);

  async function addQuickMeal() {
    const name = mealName.trim();
    const kcal = mealKcal;
    if (!name) return;
    quickAddLoading = true;
    try {
      await invoke("nutrition_log_meal", {
        params: {
          name,
          mealType: "snack",
          totalKcal: kcal ?? null,
        },
      });
      mealName = "";
      mealKcal = null;
      await loadTodaySummary();
    } catch (e) {
      console.error("Failed to log meal:", e);
    } finally {
      quickAddLoading = false;
    }
  }

  onMount(() => {
    loadTodaySummary();
    loadHydrationStats();
    loadReminders();
  });

  // ── Macro goal editor ──
  let pendingGoals = $state<NutritionGoalsType>({ waterGoalMl: 2000, calorieGoal: 2200, proteinGoalG: 150, carbsGoalG: 250, fatGoalG: 70 });
  let goalsSaving = $state(false);

  // Sync pendingGoals when nutritionGoals changes (from summary refresh)
  $effect(() => {
    pendingGoals = { ...nutritionGoals };
  });

  async function updateGoals() {
    goalsSaving = true;
    try {
      await invoke("nutrition_update_goals", {
        params: {
          calorieGoal: pendingGoals.calorieGoal,
          proteinGoalG: pendingGoals.proteinGoalG,
          carbsGoalG: pendingGoals.carbsGoalG,
          fatGoalG: pendingGoals.fatGoalG,
        },
      });
      await loadTodaySummary();
    } catch (e) {
      console.error("Failed to update goals:", e);
    } finally {
      goalsSaving = false;
    }
  }

  // ── Macros derived (from todaySummary) ──
  let macros = $derived([
    { label: "Protein", value: `${Math.round(macroTotals.proteinG)} g`, fill: nutritionGoals.proteinGoalG > 0 ? Math.min(100, Math.round((macroTotals.proteinG / nutritionGoals.proteinGoalG) * 100)) : 0 },
    { label: "Carbs", value: `${Math.round(macroTotals.carbsG)} g`, fill: nutritionGoals.carbsGoalG > 0 ? Math.min(100, Math.round((macroTotals.carbsG / nutritionGoals.carbsGoalG) * 100)) : 0 },
    { label: "Fats", value: `${Math.round(macroTotals.fatG)} g`, fill: nutritionGoals.fatGoalG > 0 ? Math.min(100, Math.round((macroTotals.fatG / nutritionGoals.fatGoalG) * 100)) : 0 },
  ]);

  // ── Reminders (saved in DB, separate from summary) ──
  let reminders = $state<NutritionReminderType[]>([]);
  let reminderActionLoading = $state<string | null>(null);

  // New reminder form
  let newReminderLabel = $state("");
  let newReminderDetail = $state("");
  let newReminderMode = $state("Active");
  let newReminderSaving = $state(false);

  async function saveReminder() {
    const label = newReminderLabel.trim();
    if (!label) return;
    newReminderSaving = true;
    try {
      await invoke("nutrition_save_reminder", {
        params: {
          label,
          detail: newReminderDetail.trim() || null,
          mode: newReminderMode,
          enabled: true,
        },
      });
      newReminderLabel = "";
      newReminderDetail = "";
      newReminderMode = "Active";
      await loadReminders();
    } catch (e) {
      console.error("Failed to save reminder:", e);
    } finally {
      newReminderSaving = false;
    }
  }

  async function loadReminders() {
    try {
      reminders = await invoke<NutritionReminderType[]>("nutrition_get_reminders");
    } catch (e) {
      console.error("Failed to load reminders:", e);
    }
  }

  async function toggleReminder(id: string, currentEnabled: boolean) {
    const key = `toggle-${id}`;
    reminderActionLoading = key;
    try {
      await invoke("nutrition_toggle_reminder", { id, enabled: !currentEnabled });
      await loadReminders();
    } catch (e) {
      console.error("Failed to toggle reminder:", e);
    } finally {
      reminderActionLoading = null;
    }
  }

  async function deleteReminder(id: string) {
    const key = `delete-${id}`;
    reminderActionLoading = key;
    try {
      await invoke("nutrition_delete_reminder", { id });
      await loadReminders();
    } catch (e) {
      console.error("Failed to delete reminder:", e);
    } finally {
      reminderActionLoading = null;
    }
  }

  // ── Export (backend-backed) ──
  interface NutritionExportRowType {
    date: string;
    waterMl: number;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    mealsCount: number;
  }

  let exportLoading = $state<string | null>(null);

  async function exportData(format: 'nutrition-csv' | 'macro-csv' | 'reminder-log') {
    exportLoading = format;
    try {
      if (format === 'nutrition-csv') {
        const rows = await invoke<NutritionExportRowType[]>("nutrition_export_data", { days: 14 });
        const header = "Date,Water ml,Calories kcal,Protein g,Carbs g,Fat g,Meals\n";
        const csv = header + rows.map(r =>
          `${r.date},${r.waterMl},${r.caloriesKcal},${r.proteinG.toFixed(1)},${r.carbsG.toFixed(1)},${r.fatG.toFixed(1)},${r.mealsCount}`
        ).join("\n");
        await invoke("export_content_to_file", { content: csv, defaultName: "bento-nutrition-14d.csv", extension: "csv", filterName: "CSV files" });
      } else if (format === 'macro-csv') {
        const rows = await invoke<NutritionExportRowType[]>("nutrition_export_data", { days: 30 });
        const header = "Date,Calories kcal,Protein g,Carbs g,Fat g\n";
        const csv = header + rows.map(r =>
          `${r.date},${r.caloriesKcal},${r.proteinG.toFixed(1)},${r.carbsG.toFixed(1)},${r.fatG.toFixed(1)}`
        ).join("\n");
        await invoke("export_content_to_file", { content: csv, defaultName: "bento-macros-30d.csv", extension: "csv", filterName: "CSV files" });
      } else if (format === 'reminder-log') {
        const reminders = await invoke<NutritionReminderType[]>("nutrition_get_reminders");
        const header = "Label,Detail,Mode,Enabled\n";
        const csv = header + reminders.map(r =>
          `"${r.label}","${r.detail}",${r.mode},${r.enabled}`
        ).join("\n");
        await invoke("export_content_to_file", { content: csv, defaultName: "bento-reminders.csv", extension: "csv", filterName: "CSV files" });
      }
    } catch (e) {
      console.error("Failed to export:", e);
    } finally {
      exportLoading = null;
    }
  }
</script>

<main class="nutrition-workspace module-root" data-module="nutrition">
  <section class="nutrition-shell">
    <header class="nutrition-shell__header">
      <div class="nutrition-shell__intro">
        <div class="nutrition-shell__eyebrow">
          <UtensilsCrossedIcon size={13}/><span>{_t('moduleNutritionTitle')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>{_t('moduleNutritionDesc')}</h1>
        <p>{_t('moduleNutritionSubtitle')}</p>
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
          <!--
            PremiumRing wraps the segmented layerchart PieChart.
            Replaces the previous inline <PieChart> block.
            value is 0-100 (hydrationPct). label shows ml / goal.
          -->
          <PremiumRing
            value={hydrationPct}
            count={60}
            size={250}
            label="{hydrationTotal} / {hydrationGoalMl} ml"
            activeColor="var(--color-success, #52b788)"
          />
          <div class="nutrition-hydration-controls">
            <div class="nutrition-hydration-stats">
              <span class="nutrition-hydration-total number number-metric number-semibold">{hydrationTotal} ml</span>
              <span class="nutrition-hydration-goal number number-metric">/ {hydrationGoalMl} ml</span>
            </div>
            <div class="nutrition-hydration-buttons">
              <button
                class="nutrition-hydration-btn"
                onclick={() => addWater(-50)}
                disabled={hydrationTotal <= 0}
              >
                <MinusIcon size={14} />
              </button>
              {#each [
                { label: "50ml", value: 50 },
                { label: "150ml", value: 150 },
                { label: "250ml", value: 250 },
                { label: "500ml", value: 500 },
              ] as preset}
                <button
                  class="nutrition-hydration-btn nutrition-hydration-btn--add"
                  onclick={() => addWater(preset.value)}
                  disabled={hydrationTotal >= hydrationGoalMl}
                >
                  +{preset.label}
                </button>
              {/each}
              <button
                class="nutrition-hydration-btn nutrition-hydration-btn--reset"
                onclick={resetHydration}
                disabled={hydrationTotal <= 0}
              >
                <RotateCcwIcon size={14} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="nutrition-hero-card">
        <CardHeader>
          <CardTitle>{_t('moduleNutritionTodaysTarget')}</CardTitle>
          <CardDescription>{_t('moduleNutritionTodaysTargetDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="nutrition-hero-list">
          <article><span>{_t('moduleNutritionCalories')}</span><strong class="number number-stat">{todaySummary.macros.caloriesKcal.toLocaleString()} / {todaySummary.goals.calorieGoal.toLocaleString()}</strong></article>
          <article><span>{_t('moduleNutritionMealsLogged')}</span><strong class="number number-stat">{todaySummary.mealsLogged} so far</strong></article>
          <article><span>{_t('moduleNutritionNextCue')}</span><strong>{todaySummary.nextCue ?? _t('moduleNutritionWaterReminder')}</strong></article>
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
              {#each [...drinks.map((drink) => ({ type: "Water", title: drink.amount, detail: drink.time })), ...meals.map((meal, index) => ({ type: `Meal ${index + 1}`, title: meal.name, detail: `${meal.totalKcal} kcal` }))] as entry}
                <article>
                  <span>{entry.type}</span>
                  <strong class={entry.type === 'Water' ? 'number number-tabular' : ''}>{entry.title}</strong>
                  <p class="number number-tabular">{entry.detail}</p>
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
              <div class="nutrition-quick-add__section">
                <span class="nutrition-quick-add__label">{_t('moduleNutritionHydration')}</span>
                <div class="nutrition-quick-add__row">
                  {#each [
                    { label: "150 ml", value: 150 },
                    { label: "250 ml", value: 250 },
                    { label: "500 ml", value: 500 },
                    { label: "1 L", value: 1000 },
                  ] as preset}
                    <button
                      type="button"
                      class="nutrition-quick-add__pill"
                      onclick={() => addWater(preset.value)}
                      disabled={hydrationTotal >= hydrationGoalMl}
                    >+{preset.label}</button>
                  {/each}
                </div>
              </div>
              <div class="nutrition-quick-add__section">
                <span class="nutrition-quick-add__label">{_t('moduleNutritionMeal')}</span>
                <div class="nutrition-quick-add__row">
                  <input
                    type="text"
                    class="nutrition-quick-add__input"
                    placeholder="Meal name…"
                    bind:value={mealName}
                    onkeydown={(e) => e.key === 'Enter' && addQuickMeal()}
                  />
                  <input
                    type="number"
                    class="nutrition-quick-add__input nutrition-quick-add__input--narrow"
                    placeholder="kcal"
                    min="0"
                    bind:value={mealKcal}
                    onkeydown={(e) => e.key === 'Enter' && addQuickMeal()}
                  />
                  <button
                    type="button"
                    class="nutrition-quick-add__pill nutrition-quick-add__pill--primary"
                    onclick={addQuickMeal}
                    disabled={!mealName.trim() || quickAddLoading}
                  >+</button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Water"}
        <div class="nutrition-grid nutrition-grid--water">
          <Card class="nutrition-panel nutrition-panel--chart">
            <CardHeader>
              <CardTitle>{_t('moduleNutritionWaterLog')}</CardTitle>
              <CardDescription>{_t('moduleNutritionWaterLogDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-water-chart-content">
              <div class="nutrition-hydration-chart nutrition-hydration-chart--large">
                <HydrationPieChart percentage={hydrationPercentage} height={260} segments={80} ariaLabel="Hydration progress: {hydrationCurrent}L of {hydrationGoal}L ({hydrationPercentage}%)" />
                <div class="nutrition-hydration-overlay nutrition-hydration-overlay--large">
                  <strong class="number number-hero number-semibold">{hydrationCurrent}L</strong>
                  <small class="number number-metric">of {hydrationGoal}L ({hydrationPercentage}%)</small>
                </div>
              </div>
              <div class="nutrition-water-log-list">
                {#each drinks as drink}
                  <article>
                    <span>{drink.time}</span>
                    <strong class="number number-tabular">{drink.amount}</strong>
                  </article>
                {/each}
              </div>
            </CardContent>
          </Card>

          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>{_t('moduleNutritionHydrationStats')}</CardTitle>
              <CardDescription>{_t('moduleNutritionHydrationStatsDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-stat-list">
              <article><span>{_t('moduleNutritionStreak')}</span><strong class="number number-stat">{hydrationStats.streakDays} days</strong></article>
              <article><span>{_t('moduleNutritionWeeklyAvg')}</span><strong class="number number-stat">{(hydrationStats.weeklyAvgMl / 1000).toFixed(1)}L</strong></article>
              <article><span>{_t('moduleNutritionBestDay')}</span><strong class="number number-stat">{(hydrationStats.bestDayMl / 1000).toFixed(1)}L</strong></article>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Meals"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleNutritionMeals')}</CardTitle>
            <CardDescription>{_t('moduleNutritionMealsDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-meal-list">              {#each meals as meal}
              <article>
                <div class="nutrition-meal-list__icon">
                  <UtensilsCrossedIcon size={18} />
                </div>
                <div>
                  <strong>{meal.name}</strong>
                  <p>{meal.notes}</p>
                </div>
                <span class="number number-tabular">{meal.totalKcal} kcal</span>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Macros"}
        <div class="nutrition-macros-layout">
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>{_t('moduleNutritionMacroBreakdown')}</CardTitle>
              <CardDescription>{_t('moduleNutritionMacroBreakdownDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-macro-list">
              {#each macros as macro}
                <article>
                  <div class="nutrition-macro-list__copy">
                    <strong>{macro.label}</strong>
                    <span class="number number-metric">{macro.value}</span>
                  </div>
                  <div class="nutrition-meter" role="meter" aria-label="{macro.label} intake" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(macro.fill)}><i style={`--fill:${macro.fill}%`}></i></div>
                </article>
              {/each}
            </CardContent>
          </Card>
          <Card class="nutrition-panel">
            <CardHeader>
              <CardTitle>Daily Targets</CardTitle>
              <CardDescription>Set your daily macro targets</CardDescription>
            </CardHeader>
            <CardContent class="nutrition-goal-editor">
              <div class="nutrition-goal-editor__grid">
                <label class="nutrition-goal-editor__field">
                  <span>Calories</span>
                  <input type="number" min="0" step="50" bind:value={pendingGoals.calorieGoal} />
                  <small>kcal</small>
                </label>
                <label class="nutrition-goal-editor__field">
                  <span>Protein</span>
                  <input type="number" min="0" step="5" bind:value={pendingGoals.proteinGoalG} />
                  <small>g</small>
                </label>
                <label class="nutrition-goal-editor__field">
                  <span>Carbs</span>
                  <input type="number" min="0" step="5" bind:value={pendingGoals.carbsGoalG} />
                  <small>g</small>
                </label>
                <label class="nutrition-goal-editor__field">
                  <span>Fats</span>
                  <input type="number" min="0" step="5" bind:value={pendingGoals.fatGoalG} />
                  <small>g</small>
                </label>
              </div>
              <Button
                variant="default"
                class="nutrition-goal-editor__save"
                onclick={updateGoals}
                disabled={goalsSaving}
              >
                {goalsSaving ? 'Saving…' : 'Save Targets'}
              </Button>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Reminders"}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleNutritionReminderCadence')}</CardTitle>
            <CardDescription>{_t('moduleNutritionReminderCadenceDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-reminder-list">
            <!-- New reminder form -->
            <div class="nutrition-reminder-form">
              <div class="nutrition-reminder-form__row">
                <input
                  type="text"
                  class="nutrition-reminder-form__input"
                  placeholder="Reminder label…"
                  bind:value={newReminderLabel}
                  onkeydown={(e) => e.key === 'Enter' && saveReminder()}
                />
                <input
                  type="text"
                  class="nutrition-reminder-form__input nutrition-reminder-form__input--detail"
                  placeholder="Optional detail…"
                  bind:value={newReminderDetail}
                  onkeydown={(e) => e.key === 'Enter' && saveReminder()}
                />
                <select
                  class="nutrition-reminder-form__select"
                  bind:value={newReminderMode}
                >
                  <option value="Active">Active</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Smart">Smart</option>
                </select>
                <button
                  type="button"
                  class="nutrition-reminder-form__add"
                  onclick={saveReminder}
                  disabled={!newReminderLabel.trim() || newReminderSaving}
                >+</button>
              </div>
            </div>
            {#each reminders as reminder}
              <article class="nutrition-reminder-item">
                <div class="nutrition-reminder-list__icon">
                  <BellIcon size={18} />
                </div>
                <div class="nutrition-reminder-item__body">
                  <strong>{reminder.label}</strong>
                  <p>{reminder.detail}</p>
                  <Badge variant="secondary">{reminder.mode}</Badge>
                </div>
                <div class="nutrition-reminder-item__actions">
                  <button
                    type="button"
                    class="nutrition-reminder-toggle"
                    role="switch"
                    aria-checked={reminder.enabled}
                    aria-label="Toggle {reminder.label}"
                    onclick={() => toggleReminder(reminder.id, reminder.enabled)}
                    disabled={reminderActionLoading === `toggle-${reminder.id}`}
                    use:tooltip={{ text: reminder.enabled ? 'Disable reminder' : 'Enable reminder' }}
                  >
                    <span class="nutrition-reminder-toggle__thumb"></span>
                  </button>
                  <button
                    type="button"
                    class="nutrition-reminder-delete"
                    aria-label="Delete {reminder.label}"
                    onclick={() => deleteReminder(reminder.id)}
                    disabled={reminderActionLoading === `delete-${reminder.id}`}
                    use:tooltip={{ text: "Delete reminder" }}
                  >
                    <Trash2Icon size={14} />
                  </button>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <Card class="nutrition-panel nutrition-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleNutritionExportData')}</CardTitle>
            <CardDescription>{_t('moduleNutritionExportDataDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="nutrition-export-list">
            <article>
                <div>
                  <strong>Nutrition CSV</strong>
                  <p>Meals, hydration, and adherence for the past 14 days.</p>
                </div>
                <Button variant="outline" onclick={() => exportData('nutrition-csv')} disabled={exportLoading !== null}>
                  <DownloadIcon data-icon="inline-start" />
                  {exportLoading === 'nutrition-csv' ? 'Exporting...' : _t('moduleNutritionExport')}
                </Button>
              </article>
              <article>
                <div>
                  <strong>Macro CSV</strong>
                  <p>Daily totals for coaching or spreadsheet tracking.</p>
                </div>
                <Button variant="outline" onclick={() => exportData('macro-csv')} disabled={exportLoading !== null}>
                  <DownloadIcon data-icon="inline-start" />
                  {exportLoading === 'macro-csv' ? 'Exporting...' : _t('moduleNutritionExport')}
                </Button>
              </article>
              <article>
                <div>
                  <strong>Reminder log</strong>
                  <p>Prompt timing and response completion history.</p>
                </div>
                <Button variant="outline" onclick={() => exportData('reminder-log')} disabled={exportLoading !== null}>
                  <DownloadIcon data-icon="inline-start" />
                  {exportLoading === 'reminder-log' ? 'Exporting...' : _t('moduleNutritionExport')}
                </Button>
              </article>
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
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    height: 100%;
    padding: 28px 30px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    overflow: hidden;
    font-family: "Space Grotesk", sans-serif;
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.nutrition-workspace) button,
  :global(.nutrition-workspace) input,
  :global(.nutrition-workspace) select {
    user-select: none;
  }

  :global(.nutrition-workspace) ::selection {
    background: color-mix(in srgb, var(--nutrition-accent) 22%, transparent);
    color: var(--nutrition-ink);
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
  gap: 10px;
  margin-bottom: 12px;
    color: var(--nutrition-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.nutrition-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    text-wrap: balance;
    letter-spacing: -0.02em;
  }

  :global(.nutrition-shell__intro) p {
    margin: 12px 0 0;
    color: var(--nutrition-muted);
    max-width: 42rem;
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  :global(.nutrition-hydration-chart) {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.nutrition-hydration-chart--large) {
    width: 260px;
    height: 260px;
  }

  :global(.nutrition-hydration-overlay) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    text-align: center;
    z-index: 10;
  }

  :global(.nutrition-hydration-overlay) strong {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--nutrition-ink);
  }

  :global(.nutrition-hydration-overlay) small {
    font-size: 0.85rem;
    color: var(--nutrition-muted);
    margin-top: 4px;
  }

  :global(.nutrition-hydration-overlay--large) strong {
    font-size: 2.5rem;
  }

  :global(.nutrition-hydration-overlay--large) small {
    font-size: 0.95rem;
  }

  :global(.nutrition-water-chart-content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  :global(.nutrition-water-log-list) {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    width: 100%;
  }

  :global(.nutrition-water-log-list) article {
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--nutrition-surface-strong) 92%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
  }

  :global(.nutrition-water-log-list) span {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--nutrition-muted);
  }

  :global(.nutrition-water-log-list) strong {
    font-size: 1rem;
    margin-top: 4px;
  }

  :global(.nutrition-panel--chart) :global(.card-content) {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  :global(.nutrition-hydration-label) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }

  :global(.nutrition-hydration-label) strong {
    font-size: 1.8rem;
    font-weight: 600;
    line-height: 1;
  }

  :global(.nutrition-hydration-label) small {
    font-size: 0.9rem;
    color: var(--nutrition-muted);
    margin-top: 4px;
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

  :global(.nutrition-quick-add) {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  :global(.nutrition-quick-add__section) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.nutrition-quick-add__label) {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--nutrition-muted);
    font-weight: 600;
  }

  :global(.nutrition-quick-add__row) {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.nutrition-quick-add__pill) {
    padding: 10px 16px;
    border: 1px solid color-mix(in srgb, var(--nutrition-accent) 38%, var(--nutrition-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--nutrition-accent) 12%, var(--nutrition-surface));
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 160ms var(--ease-spring), background 160ms ease, border-color 160ms ease;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.nutrition-quick-add__pill:hover:not(:disabled)) {
      background: color-mix(in srgb, var(--nutrition-accent) 22%, var(--nutrition-surface));
      border-color: var(--nutrition-accent);
    }
  }

  :global(.nutrition-quick-add__pill:active:not(:disabled)) {
    transform: scale(0.96);
  }

  :global(.nutrition-quick-add__pill:disabled) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  :global(.nutrition-quick-add__pill--primary) {
    background: var(--nutrition-accent);
    color: var(--nutrition-surface);
    border-color: var(--nutrition-accent);
  }

  :global(.nutrition-quick-add__pill--primary:hover:not(:disabled)) {
    opacity: 0.85;
  }

  :global(.nutrition-quick-add__input) {
    flex: 1;
    min-width: 0;
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 999px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  :global(.nutrition-quick-add__input:focus) {
    border-color: var(--nutrition-accent);
  }

  :global(.nutrition-quick-add__input::placeholder) {
    color: var(--nutrition-muted);
    opacity: 0.6;
  }

  :global(.nutrition-quick-add__input--narrow) {
    flex: 0 0 80px;
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

  :global(.nutrition-reminder-item) {
    grid-template-columns: 38px 1fr auto !important;
  }

  :global(.nutrition-reminder-item__body) {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  :global(.nutrition-reminder-item__body) strong {
    font-size: 0.95rem;
    font-weight: 600;
  }

  :global(.nutrition-reminder-item__body) p {
    font-size: 0.82rem;
    margin: 0;
  }

  :global(.nutrition-reminder-item__actions) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Toggle switch ── */
  :global(.nutrition-reminder-toggle) {
    position: relative;
    width: 36px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: color-mix(in srgb, var(--nutrition-border) 72%, transparent);
    cursor: pointer;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }

  :global(.nutrition-reminder-toggle[aria-checked="true"]) {
    background: var(--nutrition-accent);
  }

  :global(.nutrition-reminder-toggle:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.nutrition-reminder-toggle__thumb) {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--nutrition-surface);
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }

  :global(.nutrition-reminder-toggle[aria-checked="true"] .nutrition-reminder-toggle__thumb) {
    transform: translateX(16px);
  }

  /* ── Delete button ── */
  :global(.nutrition-reminder-delete) {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--nutrition-muted) 30%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--nutrition-muted);
    cursor: pointer;
    transition: transform 160ms var(--ease-spring), background 160ms ease, border-color 160ms ease, color 160ms ease;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.nutrition-reminder-delete:hover:not(:disabled)) {
      border-color: color-mix(in srgb, var(--destructive, #e74c3c) 50%, transparent);
      color: var(--destructive, #e74c3c);
      background: color-mix(in srgb, var(--destructive, #e74c3c) 10%, transparent);
    }
  }

  :global(.nutrition-reminder-delete:active:not(:disabled)) {
    transform: scale(0.92);
  }

  :global(.nutrition-reminder-delete:disabled) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── New reminder form ── */
  :global(.nutrition-reminder-form) {
    border: 1px dashed color-mix(in srgb, var(--nutrition-accent) 30%, var(--nutrition-border));
    border-radius: 20px;
    padding: 16px 18px;
    background: color-mix(in srgb, var(--nutrition-accent) 4%, var(--nutrition-surface));
  }

  :global(.nutrition-reminder-form__row) {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  :global(.nutrition-reminder-form__input) {
    flex: 1;
    min-width: 0;
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 999px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  :global(.nutrition-reminder-form__input:focus) {
    border-color: var(--nutrition-accent);
  }

  :global(.nutrition-reminder-form__input::placeholder) {
    color: var(--nutrition-muted);
    opacity: 0.6;
  }

  :global(.nutrition-reminder-form__input--detail) {
    flex: 0.7;
  }

  :global(.nutrition-reminder-form__select) {
    padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 999px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 0.82rem;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  :global(.nutrition-reminder-form__select:focus) {
    border-color: var(--nutrition-accent);
  }

  :global(.nutrition-reminder-form__add) {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--nutrition-accent);
    color: var(--nutrition-surface);
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  :global(.nutrition-reminder-form__add:hover:not(:disabled)) {
    opacity: 0.85;
  }

  :global(.nutrition-reminder-form__add:disabled) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── Macro goal editor ── */
  :global(.nutrition-goal-editor__grid) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  :global(.nutrition-goal-editor__field) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.nutrition-goal-editor__field) span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--nutrition-muted);
    font-weight: 600;
  }

  :global(.nutrition-goal-editor__field) input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--nutrition-border) 92%, transparent);
    border-radius: 12px;
    background: var(--nutrition-bg);
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  :global(.nutrition-goal-editor__field) input:focus {
    border-color: var(--nutrition-accent);
  }

  :global(.nutrition-goal-editor__field) small {
    font-size: 0.72rem;
    color: var(--nutrition-muted);
  }

  :global(.nutrition-goal-editor__save) {
    margin-top: 16px;
    width: 100%;
  }

  :global(.nutrition-macros-layout) {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
    overflow: auto;
  }

  :global(.nutrition-macros-layout) :global(.nutrition-panel) {
    flex-shrink: 0;
    overflow: auto;
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

  /* ── Hydration controls (Today section PieChart) ── */
  :global(.nutrition-hydration-controls) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 320px;
  }

  :global(.nutrition-hydration-stats) {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  :global(.nutrition-hydration-total) {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-success);
  }

  :global(.nutrition-hydration-goal) {
    font-size: 0.82rem;
    color: var(--nutrition-muted);
  }

  :global(.nutrition-hydration-buttons) {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  :global(.nutrition-hydration-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid color-mix(in srgb, var(--nutrition-accent) 38%, var(--nutrition-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--nutrition-accent) 12%, var(--nutrition-surface));
    color: var(--nutrition-ink);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 160ms var(--ease-spring), background 160ms ease, border-color 160ms ease;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.nutrition-hydration-btn:hover:not(:disabled)) {
      background: color-mix(in srgb, var(--nutrition-accent) 22%, var(--nutrition-surface));
      border-color: var(--nutrition-accent);
    }
  }

  :global(.nutrition-hydration-btn:active:not(:disabled)) {
    transform: scale(0.96);
  }

  :global(.nutrition-hydration-btn:disabled) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  :global(.nutrition-hydration-btn--add) {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
  }

  :global(.nutrition-hydration-btn--add:hover:not(:disabled)) {
    background: color-mix(in srgb, var(--color-success) 20%, transparent);
    border-color: var(--color-success);
  }

  :global(.nutrition-hydration-btn--reset) {
    color: var(--nutrition-muted);
    border-color: color-mix(in srgb, var(--nutrition-muted) 30%, transparent);
    background: transparent;
  }

  :global(.nutrition-hydration-btn--reset:hover:not(:disabled)) {
    color: var(--nutrition-ink);
    border-color: var(--nutrition-muted);
  }

  @media (max-width: 860px) {
    .nj-bento { grid-template-columns: 1fr; }
  }

  /* ── Reduced Motion ─────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    :global(.nutrition-quick-add__pill),
    :global(.nutrition-hydration-btn),
    :global(.nutrition-reminder-delete),
    :global(.nutrition-reminder-toggle),
    :global(.nutrition-reminder-toggle__thumb) {
      transition: none !important;
    }
    :global(.nutrition-quick-add__pill:active:not(:disabled)),
    :global(.nutrition-hydration-btn:active:not(:disabled)),
    :global(.nutrition-reminder-delete:active:not(:disabled)) {
      transform: none !important;
    }
  }
</style>
