<script lang="ts">
  import type { Snippet } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { cn } from "$lib/utils.js";

  let {
    eyebrow,
    title,
    description,
    actions,
    class: className,
  }: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: Snippet;
    class?: string;
  } = $props();
</script>

<header class={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
  <div class="min-w-0 space-y-2">
    {#if eyebrow}
      <Badge variant="outline" class="rounded-full px-3 py-1 text-[0.82rem] uppercase tracking-[0.18em] text-[var(--muted)]">
        {eyebrow}
      </Badge>
    {/if}
    <h1 class="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl" style="line-height:1.05">
      {title}
    </h1>
    {#if description}
      <p class="max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
  {/if}
</header>
