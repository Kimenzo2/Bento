<script lang="ts">
  import "./goals.css";
  import AlertCircleIcon from "@lucide/svelte/icons/circle-alert";
  import BookIcon from "@lucide/svelte/icons/book";
  import CheckCircle2Icon from "@lucide/svelte/icons/circle-check";
  import CreditCardIcon from "@lucide/svelte/icons/credit-card";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "goals", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const currentWeek = 19;
  const totalWeeks = 52;
  const showWeeklyCheckIn = true;

  const goals = [
    {
      id: 1,
      title: "Run a half marathon",
      icon: DumbbellIcon,
      current: 12,
      target: 21.1,
      unit: "km",
      lastLogged: "2 days ago",
      deadline: "47 days left",
      status: "active" as const,
    },
    {
      id: 2,
      title: "Emergency fund",
      icon: CreditCardIcon,
      current: 4500,
      target: 10000,
      unit: "$",
      lastLogged: "Updated today",
      deadline: "5 days overdue",
      status: "overdue" as const,
    },
    {
      id: 3,
      title: "Read 24 books",
      icon: BookIcon,
      current: 8,
      target: 24,
      unit: "books",
      lastLogged: "1 week ago",
      deadline: "228 days left",
      status: "active" as const,
    },
  ];

  let showNewGoalForm = $state(false);

  const sortedGoals = $derived(
    [...goals].sort((a, b) => (a.status === "overdue" ? -1 : b.status === "overdue" ? 1 : 0)),
  );
</script>

<MiniAppRoot class="goals-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Goals"
    title="Goal tracker"
    description="Milestones, weekly check-ins, and progress across fitness, finance, and learning."
  >
    {#snippet actions()}
      <Button type="button" onclick={() => (showNewGoalForm = true)}>
        <PlusIcon data-icon="inline-start" />
        New goal
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Active goals", value: "3", hint: "In progress" },
      { label: "Week", value: `${currentWeek}/${totalWeeks}`, hint: "Year progress" },
      { label: "Check-in", value: "Due", hint: "Weekly review" },
    ]}
  />

  {#if showWeeklyCheckIn}
    <section class="goals-checkin">
      <span class="goals-checkin-icon"><TrendingUpIcon class="size-6" /></span>
      <span>
        <h2 class="font-[var(--font-heading)] text-lg font-semibold">Weekly check-in</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">Log progress before the week ends.</p>
      </span>
      <Button type="button" variant="secondary" class="w-fit">Start check-in</Button>
    </section>
  {/if}

  <section class="grid gap-4">
    {#each sortedGoals as goal (goal.id)}
      {@const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))}
      <article class="goals-card" class:is-overdue={goal.status === "overdue"}>
        <header class="goals-card-top">
          <span class="min-w-0">
            <h3 class="font-semibold text-[var(--foreground)]">{goal.title}</h3>
            <p class="goals-deadline" class:is-overdue={goal.status === "overdue"}>
              {#if goal.status === "overdue"}
                <AlertCircleIcon class="size-3.5" />
              {/if}
              {goal.deadline}
            </p>
          </span>
          <span class="goals-icon-box"><goal.icon class="size-5" /></span>
        </header>
        <span class="mb-2 flex items-baseline justify-between gap-2">
          <span class="text-2xl font-bold">
            {goal.current}
            <span class="text-sm font-medium text-[var(--muted)]">{goal.unit}</span>
          </span>
          <span class="text-sm text-[var(--muted)]">{goal.target} {goal.unit} · {pct}%</span>
        </span>
        <span class="goals-progress-track">
          <span
            class="goals-progress-fill"
            class:is-overdue={goal.status === "overdue"}
            style="width:{pct}%"
          ></span>
        </span>
        <footer
          class="goals-footer"
          class:is-updated={goal.lastLogged.includes("today")}
        >
          {#if goal.lastLogged.includes("today")}
            <CheckCircle2Icon class="size-3.5" />
          {/if}
          {goal.lastLogged}
        </footer>
      </article>
    {/each}
  </section>

  {#if showNewGoalForm}
    <div class="goals-modal-backdrop" role="presentation">
      <button
        type="button"
        class="absolute inset-0"
        aria-label="Close dialog"
        onclick={() => (showNewGoalForm = false)}
      ></button>
      <form
        class="goals-modal relative z-10"
        onsubmit={(e) => {
          e.preventDefault();
          showNewGoalForm = false;
        }}
      >
        <header class="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-6 py-4">
          <h2 class="font-[var(--font-heading)] text-lg font-semibold">New goal</h2>
          <Button type="button" variant="ghost" size="sm" onclick={() => (showNewGoalForm = false)}>
            Close
          </Button>
        </header>
        <CardContent class="grid gap-4 py-6">
          <div class="grid gap-2">
            <Label for="goal-name">Goal name</Label>
            <Input id="goal-name" placeholder="Learn Spanish" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <section class="grid gap-2">
              <Label for="goal-target">Target</Label>
              <Input id="goal-target" type="number" placeholder="0" />
            </section>
            <div class="grid gap-2">
              <Label for="goal-unit">Unit</Label>
              <Input id="goal-unit" placeholder="hours, km, books" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="goal-deadline">Deadline</Label>
            <Input id="goal-deadline" type="date" />
          </div>
        </CardContent>
        <footer class="border-t border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-6 py-4">
          <Button type="submit" class="w-full">Save goal</Button>
        </footer>
      </form>
    </div>
  {/if}
</MiniAppRoot>
