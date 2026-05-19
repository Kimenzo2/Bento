<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";

  let {
    rows = 4,
    stats = true,
    cards = 1,
  }: {
    /** Number of skeleton row items in the card body */
    rows?: number;
    /** Whether to show the 3-column stat grid */
    stats?: boolean;
    /** Number of card skeletons to show (1 or 2) */
    cards?: 1 | 2;
  } = $props();
</script>

<div class="mini-app-loading-skeleton flex min-h-full w-full min-w-0 flex-col gap-6 bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-6">
  <!-- Header skeleton -->
  <div class="flex items-start justify-between gap-4">
    <div class="grid gap-2">
      <Skeleton class="h-3 w-20" />
      <Skeleton class="h-6 w-64 sm:w-80" />
      <Skeleton class="h-4 w-72 sm:w-96" />
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Skeleton class="size-9 rounded-full" />
      <Skeleton class="size-9 rounded-full" />
    </div>
  </div>

  <!-- Stats grid skeleton -->
  {#if stats}
    <div class="grid grid-cols-3 gap-4">
      {#each Array(3) as _}
        <div class="rounded-xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <Skeleton class="mb-2 h-3 w-20" />
          <Skeleton class="mb-1 h-8 w-16" />
          <Skeleton class="h-3 w-24" />
        </div>
      {/each}
    </div>
  {/if}

  <!-- Card skeletons -->
  {#each Array(cards) as _}
    <div class="rounded-xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <div class="border-b border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4 sm:p-6 pb-3">
        <Skeleton class="mb-1 h-5 w-32" />
        <Skeleton class="h-3 w-48" />
      </div>
      <div class="grid gap-3 p-4 sm:p-6 pt-4">
        {#each Array(rows) as _}
          <div class="flex items-center gap-3 py-1.5">
            <Skeleton class="size-9 shrink-0 rounded-lg" />
            <div class="grid min-w-0 flex-1 gap-1">
              <Skeleton class="h-4 w-48" />
              <Skeleton class="h-3 w-32" />
            </div>
            <Skeleton class="h-4 w-12 shrink-0" />
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
