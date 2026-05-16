<script lang="ts">
  import { Plus, Activity, Utensils, Scale, Droplet } from "lucide-svelte";
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
    miniAppAccent,
  } from "$lib/modules/mini-app/index.js";
  import { cn } from "$lib/utils.js";
  import "./health.css";

  let { moduleId = "health", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  type LogIcon = typeof Activity | typeof Utensils | typeof Droplet;

  type LogEntry = {
    id: string;
    type: "workout" | "meal" | "weight" | "water";
    title: string;
    value: string;
    time: string;
    icon: LogIcon;
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tabs = ["Today", "Progress", "Goals"] as const;
  let activeTab = $state<(typeof tabs)[number]>("Today");
  let showBottomSheet = $state(false);

  const rings = [
    { label: "Calories left", value: "1,200", offset: 60, accent: miniAppAccent(0) },
    { label: "Steps today", value: "4,500", offset: 100, accent: miniAppAccent(1) },
    { label: "Water", value: "1.5L", offset: 150, accent: miniAppAccent(2) },
  ];

  let activityLog: LogEntry[] = [
    { id: "1", type: "workout", title: "Morning Run", value: "340 kcal", time: "7:00 AM", icon: Activity },
    { id: "2", type: "meal", title: "Oatmeal Bowl", value: "450 kcal", time: "8:30 AM", icon: Utensils },
    { id: "3", type: "water", title: "Glass of water", value: "0.5 L", time: "11:00 AM", icon: Droplet },
  ];
</script>

<MiniAppRoot class="relative gap-5 p-4 sm:p-6">
  <MiniAppHeader eyebrow="Health" title="Today" description={today}>
    {#snippet actions()}
      <nav class="flex flex-wrap gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--card)_92%,var(--background))] p-1 ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        {#each tabs as tab}
          <button
            type="button"
            class={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
            onclick={() => (activeTab = tab)}
          >
            {tab}
          </button>
        {/each}
      </nav>
    {/snippet}
  </MiniAppHeader>

  {#if activeTab === "Today"}
    <MiniAppStatGrid
      columns={3}
      stats={[
        { label: "Active energy", value: "420 kcal", hint: "Burned so far" },
        { label: "Move goal", value: "68%", hint: "Ring progress" },
        { label: "Stand hours", value: "9/12", hint: "Hourly stand" },
      ]}
    />

    <div class="health-rings grid gap-4 sm:grid-cols-3">
      {#each rings as ring (ring.label)}
        <Card
          class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
        >
          <CardContent class="flex flex-col items-center gap-3 p-4 pt-5">
            <div class="health-ring relative">
              <svg viewBox="0 0 100 100" class="size-[7.5rem] -rotate-90" aria-hidden="true">
                <circle
                  class="health-ring__track"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke-width="8"
                />
                <circle
                  class="health-ring__progress"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke-width="8"
                  stroke={ring.accent}
                  stroke-linecap="round"
                  stroke-dasharray="251.2"
                  stroke-dashoffset={ring.offset}
                />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-lg font-semibold text-[var(--foreground)]">
                {ring.value}
              </span>
            </div>
            <p class="text-sm text-[var(--muted)]">{ring.label}</p>
          </CardContent>
        </Card>
      {/each}
    </div>

    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Activity log</CardTitle>
        <CardDescription>Workouts, meals, weight, and hydration for today.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each activityLog as entry (entry.id)}
          <article class="mini-app-row">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={`background: color-mix(in srgb, ${miniAppAccent(entry.type === "workout" ? 0 : entry.type === "meal" ? 1 : entry.type === "water" ? 2 : 3)} 16%, var(--card)); color: ${miniAppAccent(entry.type === "workout" ? 0 : entry.type === "meal" ? 1 : entry.type === "water" ? 2 : 3)}`}
            >
              <entry.icon class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-[var(--foreground)]">{entry.title}</p>
              <p class="text-sm text-[var(--muted)]">{entry.time}</p>
            </div>
            <span class="shrink-0 text-sm font-semibold text-[var(--foreground)]">{entry.value}</span>
          </article>
        {/each}
      </CardContent>
    </Card>

    <Button
      class="fixed right-4 bottom-6 z-10 size-14 rounded-full shadow-lg sm:right-6"
      type="button"
      onclick={() => (showBottomSheet = true)}
      aria-label="Log health entry"
    >
      <Plus class="size-6" />
    </Button>

    {#if showBottomSheet}
      <button
        type="button"
        class="health-sheet-overlay fixed inset-0 z-40 bg-[color:color-mix(in_srgb,var(--background)_35%,transparent)] backdrop-blur-sm"
        aria-label="Close log menu"
        onclick={() => (showBottomSheet = false)}
      ></button>
      <div
        class="health-sheet fixed bottom-4 left-1/2 z-50 w-[min(100%-2rem,36rem)] -translate-x-1/2 rounded-3xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--card)] p-5 shadow-xl sm:p-6"
        role="dialog"
        aria-label="Log options"
      >
        <div class="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[color:color-mix(in_srgb,var(--border)_70%,transparent)]"></div>
        <div class="grid grid-cols-2 gap-3">
          {#each [
            { label: "Workout", icon: Activity, idx: 0 },
            { label: "Weight", icon: Scale, idx: 3 },
            { label: "Water", icon: Droplet, idx: 2 },
            { label: "Meal", icon: Utensils, idx: 1 },
          ] as tile (tile.label)}
            <button
              type="button"
              class="flex flex-col items-center gap-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--card)_96%,var(--background))] p-4 transition-colors hover:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--border))]"
              onclick={() => (showBottomSheet = false)}
            >
              <div
                class="flex size-14 items-center justify-center rounded-2xl"
                style={`background: color-mix(in srgb, ${miniAppAccent(tile.idx)} 14%, var(--card)); color: ${miniAppAccent(tile.idx)}`}
              >
                <tile.icon class="size-7" />
              </div>
              <span class="text-sm font-medium text-[var(--foreground)]">{tile.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardContent class="p-8 text-center text-[var(--muted)]">
        <p>{activeTab} view is coming soon.</p>
      </CardContent>
    </Card>
  {/if}
</MiniAppRoot>
