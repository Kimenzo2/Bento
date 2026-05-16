<script lang="ts">
  import AssetCard from "$lib/components/AssetCard.svelte";
  import { demoAssets } from "$lib/data/app-data";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
  <Card class="surface-card rounded-[28px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Asset manager
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4">
      {#each demoAssets as asset}
        <AssetCard {asset} />
      {/each}
    </CardContent>
  </Card>

  <Card class="surface-card rounded-[28px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Life in Colour workflow
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4">
      <div class="rounded-3xl app-surface p-6">
        <p class="font-[var(--font-heading)] text-xl font-semibold text-[var(--foreground)]">
          Photo ingestion, outline generation, and printable bundle prep.
        </p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          The workspace store is already shaped for photo sets, outline mode, page count, and export state.
        </p>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Photos</p>
          <p class="mt-2 text-2xl font-semibold text-[var(--foreground)]">36</p>
        </div>
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Outline mode</p>
          <p class="mt-2 text-2xl font-semibold text-[var(--foreground)]">Detailed</p>
        </div>
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Target pages</p>
          <p class="mt-2 text-2xl font-semibold text-[var(--foreground)]">12</p>
        </div>
      </div>
    </CardContent>
  </Card>
</section>
