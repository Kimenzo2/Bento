<script lang="ts">
  import AssetCard from "$lib/components/AssetCard.svelte";
  import { demoAssets } from "$lib/data/app-data";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="ai-thread grid gap-6">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Prompt board
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <div class="rounded-3xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-5">
        <p class="font-semibold text-[var(--foreground)]">Working prompt</p>
        <p class="mt-2 text-sm leading-7 text-[var(--muted)]">
          Design a premium, warm, editorial spread with layered character depth, clean margins, and precise visual hierarchy.
        </p>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        {#each demoAssets.slice(0, 3) as asset}
          <AssetCard {asset} />
        {/each}
      </div>
    </CardContent>
  </Card>
</section>
