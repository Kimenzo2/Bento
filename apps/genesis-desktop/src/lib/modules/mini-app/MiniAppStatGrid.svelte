<script lang="ts">
  import type { Snippet } from "svelte";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { cn } from "$lib/utils.js";

  export type MiniAppStat = {
    label: string;
    value: string;
    hint?: string;
  };

  let {
    stats,
    class: className,
    columns = 3,
  }: {
    stats: MiniAppStat[];
    class?: string;
    columns?: 2 | 3 | 4;
  } = $props();

  const gridClass = $derived(
    columns === 4
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  );
</script>

<div class={cn("grid gap-4", gridClass, className)}>
  {#each stats as stat (stat.label)}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader class="gap-1 pb-2">
        <CardDescription class="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          {stat.label}
        </CardDescription>
        <CardTitle class="number number-metric text-[var(--foreground)]">
          {stat.value}
        </CardTitle>
      </CardHeader>
      {#if stat.hint}
        <CardContent class="pt-0 text-sm text-[var(--muted)]">{stat.hint}</CardContent>
      {/if}
    </Card>
  {/each}
</div>
