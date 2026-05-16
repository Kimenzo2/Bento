<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import CoffeeIcon from "@lucide/svelte/icons/coffee";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import FilterIcon from "@lucide/svelte/icons/filter";
  import GlassWaterIcon from "@lucide/svelte/icons/glass-water";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import {
    MiniAppHeader,
    MiniAppRoot,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";

  let { moduleId = "water", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  let intake = $state(1200);
  const goal = 2500;

  const percentage = $derived(Math.min((intake / goal) * 100, 100));

  const logs = [
    { id: 1, time: "09:30 AM", amount: 200, label: "Water", icon: GlassWaterIcon },
    { id: 2, time: "11:15 AM", amount: 350, label: "Coffee", icon: CoffeeIcon },
    { id: 3, time: "02:00 PM", amount: 500, label: "Bottle", icon: DropletIcon },
    { id: 4, time: "04:45 PM", amount: 150, label: "Water", icon: GlassWaterIcon },
  ];

  const quickAdds = [
    { amount: 150, label: "150ml", icon: CoffeeIcon },
    { amount: 200, label: "200ml", icon: GlassWaterIcon },
    { amount: 350, label: "350ml", icon: FilterIcon },
    { amount: 500, label: "500ml", icon: DropletIcon },
  ];

  function addDrink(amount: number) {
    intake += amount;
  }
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Hydration"
    title="Water & quick logging"
    description="Track daily intake with one-tap adds, streaks, and gentle reminders — offline-first."
  >
    {#snippet actions()}
      <Badge variant="outline">🔥 12-day streak</Badge>
      <Button variant="outline" size="icon" type="button" aria-label="Settings">
        <SettingsIcon class="size-4" />
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Today", value: `${intake} ml`, hint: `Goal ${goal} ml` },
      { label: "Progress", value: `${Math.round(percentage)}%`, hint: "Of daily target" },
      { label: "Next reminder", value: "3:00 PM", hint: "Hydration pulse" },
    ]}
  />

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Today's intake</CardTitle>
        <CardDescription>Ring fills as you log drinks throughout the day.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center gap-6">
        <div
          class="relative flex size-56 items-center justify-center overflow-hidden rounded-full ring-4 ring-[color:color-mix(in_srgb,var(--border)_80%,transparent)]"
        >
          <div
            class="absolute inset-x-0 bottom-0 bg-[var(--primary)] opacity-20 transition-[height] duration-500"
            style:height="{percentage}%"
            aria-hidden="true"
          ></div>
          <div class="relative z-10 text-center">
            <p class="font-[var(--font-heading)] text-4xl font-bold text-[var(--foreground)]">
              {intake}
              <span class="text-lg font-semibold text-[var(--muted)]"> ml</span>
            </p>
            <p class="mt-1 text-sm text-[var(--muted)]">/ {goal} ml goal</p>
          </div>
        </div>

        <div class="flex w-full flex-wrap justify-center gap-2">
          {#each quickAdds as item (item.label)}
            <Button variant="outline" type="button" class="h-auto min-w-[4.5rem] flex-col gap-1 py-3" onclick={() => addDrink(item.amount)}>
              <item.icon class="size-5" />
              <span class="text-xs font-semibold">{item.label}</span>
            </Button>
          {/each}
          <Button variant="outline" type="button" class="size-[4.5rem] border-dashed" aria-label="Custom amount">
            <PlusIcon class="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Today's log</CardTitle>
        <CardDescription>Every pour, bottle, and coffee counts toward hydration.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each logs as log (log.id)}
          <article class="mini-app-row">
            <div class="flex min-w-0 items-center gap-3">
              <log.icon class="size-5 shrink-0 text-[var(--muted)]" />
              <div class="min-w-0">
                <p class="font-medium text-[var(--foreground)]">{log.label}</p>
                <p class="text-sm text-[var(--muted)]">{log.time}</p>
              </div>
            </div>
            <span class="shrink-0 text-sm font-semibold text-[var(--primary)]">+{log.amount} ml</span>
          </article>
        {/each}

        <Button variant="ghost" type="button" class="mt-2 w-full text-[var(--muted)]">
          <BellIcon data-icon="inline-start" />
          Next reminder: 3:00 PM
        </Button>
      </CardContent>
    </Card>
  </div>
</MiniAppRoot>
