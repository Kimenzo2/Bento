<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import DropletsIcon from "@lucide/svelte/icons/droplets";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import UtensilsCrossedIcon from "@lucide/svelte/icons/utensils-crossed";
  import { onMount } from "svelte";
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
    MiniAppRoot,
    MiniAppHeader,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import "./nutrition.css";

  const moduleId = "nutrition";
  const sectionLabels = ["Today", "Water", "Meals", "Macros", "Reminders", "Export"] as const;
  const selectedSection = $derived(
    getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels),
  );

  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  const drinks = [
    { time: "07:20", amount: "250 ml" },
    { time: "09:45", amount: "500 ml" },
    { time: "12:05", amount: "250 ml" },
    { time: "15:40", amount: "150 ml" },
  ];

  const meals = [
    { title: "Oatmeal bowl", detail: "Berries, chia, almond butter", kcal: "450 kcal" },
    { title: "Chicken grain salad", detail: "Greens, couscous, citrus dressing", kcal: "620 kcal" },
    { title: "Protein yogurt", detail: "Afternoon top-up", kcal: "190 kcal" },
  ];

  const macros = [
    { label: "Protein", value: "112 g", fill: 74 },
    { label: "Carbs", value: "168 g", fill: 63 },
    { label: "Fats", value: "52 g", fill: 57 },
  ];

  const reminders = [
    { label: "Hydration pulse", detail: "Every 90 min, 08:00–18:00", mode: "Active" },
    { label: "Lunch break", detail: "12:30 with focus cooldown", mode: "Scheduled" },
    { label: "Protein check", detail: "20:00 if intake is low", mode: "Smart" },
  ];

  const exportOptions = [
    { title: "Nutrition PDF", detail: "Meals, hydration, and adherence — 14 days." },
    { title: "Macro CSV", detail: "Daily totals for spreadsheet tracking." },
    { title: "Reminder log", detail: "Prompt timing and completion history." },
  ];
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Nutrition"
    title="Hydration & meals"
    description="Water ring, meal log, macros, and reminders."
  >
    {#snippet actions()}
      <Badge variant="outline" class="rounded-full">{selectedSection}</Badge>
      <Button variant="outline" type="button">
        <DropletsIcon data-icon="inline-start" />
        Quick add
      </Button>
      <Button type="button">
        <SparklesIcon data-icon="inline-start" />
        Meal insight
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Water", value: "0.7 / 2.4 L", hint: "29% of goal" },
      { label: "Calories", value: "1,860", hint: "of 2,300 target" },
      { label: "Meals", value: "3", hint: "Logged today" },
    ]}
  />

  <div class="grid gap-4 lg:grid-cols-2">
    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Hydration</CardTitle>
        <CardDescription>0.7 L of 2.4 L target</CardDescription>
      </CardHeader>
      <CardContent class="flex justify-center py-2">
        <div class="nutrition-ring" style="--nutrition-fill: 29%">
          <strong>0.7L</strong>
          <small>29%</small>
        </div>
      </CardContent>
    </Card>

    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Today</CardTitle>
        <CardDescription>Calories, meals, and next cue.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        <article class="mini-app-row flex-col items-start gap-1">
          <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Calories</span>
          <strong>1,860 / 2,300</strong>
        </article>
        <article class="mini-app-row flex-col items-start gap-1">
          <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Next cue</span>
          <strong>Water at 16:30</strong>
        </article>
      </CardContent>
    </Card>
  </div>

  <section class="grid gap-4">
    {#if selectedSection === "Today"}
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Timeline</CardTitle>
            <CardDescription>Water and meals today.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            {#each [...drinks.map((d) => ({ type: "Water", title: d.amount, detail: d.time })), ...meals.map((m, i) => ({ type: `Meal ${i + 1}`, title: m.title, detail: m.kcal }))] as entry (entry.type + entry.title)}
              <article class="mini-app-row flex-col items-start gap-1">
                <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{entry.type}</span>
                <strong>{entry.title}</strong>
                <p class="text-sm text-[var(--muted)]">{entry.detail}</p>
              </article>
            {/each}
          </CardContent>
        </Card>
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Quick add</CardTitle>
            <CardDescription>Water amounts and meal shortcuts.</CardDescription>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-2">
            {#each ["150 ml", "250 ml", "500 ml", "Snack", "Meal", "Custom"] as item (item)}
              <button type="button" class="nutrition-quick-btn">{item}</button>
            {/each}
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Water"}
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Water log</CardTitle>
            <CardDescription>Today's intake.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            {#each drinks as drink (drink.time)}
              <article class="mini-app-row">
                <span class="text-sm text-[var(--muted)]">{drink.time}</span>
                <strong class="ml-auto">{drink.amount}</strong>
              </article>
            {/each}
          </CardContent>
        </Card>
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Stats</CardTitle>
            <CardDescription>Hydration streaks and averages.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            <article class="mini-app-row flex-col items-start gap-1">
              <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Streak</span>
              <strong>12 days</strong>
            </article>
            <article class="mini-app-row flex-col items-start gap-1">
              <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Weekly avg</span>
              <strong>1.9 L</strong>
            </article>
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Meals"}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Meals</CardTitle>
          <CardDescription>Food logged today.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each meals as meal (meal.title)}
            <article class="mini-app-row">
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)]"
              >
                <UtensilsCrossedIcon class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <strong>{meal.title}</strong>
                <p class="text-sm text-[var(--muted)]">{meal.detail}</p>
              </div>
              <span class="shrink-0 text-sm font-medium">{meal.kcal}</span>
            </article>
          {/each}
        </CardContent>
      </Card>
    {:else if selectedSection === "Macros"}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Macros</CardTitle>
          <CardDescription>Protein, carbs, and fats.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          {#each macros as macro (macro.label)}
            <article class="grid gap-2">
              <div class="flex justify-between text-sm">
                <strong>{macro.label}</strong>
                <span class="text-[var(--muted)]">{macro.value}</span>
              </div>
              <div class="mini-app-progress h-2">
                <span style={`width: ${macro.fill}%`}></span>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    {:else if selectedSection === "Reminders"}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Reminders</CardTitle>
          <CardDescription>Hydration and meal nudges.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each reminders as reminder (reminder.label)}
            <article class="mini-app-row">
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)]"
              >
                <BellIcon class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <strong>{reminder.label}</strong>
                <p class="text-sm text-[var(--muted)]">{reminder.detail}</p>
              </div>
              <Badge variant="secondary">{reminder.mode}</Badge>
            </article>
          {/each}
        </CardContent>
      </Card>
    {:else}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Export</CardTitle>
          <CardDescription>Download nutrition history.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each exportOptions as option (option.title)}
            <article class="mini-app-row">
              <div class="min-w-0">
                <strong>{option.title}</strong>
                <p class="text-sm text-[var(--muted)]">{option.detail}</p>
              </div>
              <Button variant="outline" type="button">
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
            </article>
          {/each}
        </CardContent>
      </Card>
    {/if}
  </section>
</MiniAppRoot>
