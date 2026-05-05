<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { AssetSummary } from "$lib/data/app-data";

  let {
    asset,
  }: {
    asset: AssetSummary;
  } = $props();
</script>

<Card class="surface-card rounded-[24px] border-none bg-transparent shadow-none">
  <CardHeader class="gap-3">
    <div class="flex items-center justify-between gap-3">
      <CardTitle class="font-[var(--font-heading)] text-xl text-[var(--foreground)]">
        {asset.name}
      </CardTitle>
      <Badge variant="outline" class="rounded-full px-3 py-1 text-xs">
        {asset.status}
      </Badge>
    </div>
    <CardDescription class="text-[var(--muted)]">{asset.type}</CardDescription>
  </CardHeader>
  <CardContent class="grid gap-3 md:grid-cols-2">
    <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
      <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Updated</p>
      <p class="mt-2 text-base font-semibold text-[var(--foreground)]">{asset.updatedAt}</p>
    </div>
    <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
      <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Size</p>
      <p class="mt-2 text-base font-semibold text-[var(--foreground)]">{asset.size}</p>
    </div>
  </CardContent>
</Card>
