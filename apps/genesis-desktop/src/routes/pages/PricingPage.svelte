<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";

  const tiers = [
    { name: "Spark", price: "$0", detail: "Personal drafts and core desktop routes." },
    { name: "Creator", price: "$19.99", detail: "More AI runs, exports, and asset concurrency." },
    { name: "Studio", price: "$59.99", detail: "Team workflows, richer exports, higher throughput." },
    { name: "Empire", price: "$199.99", detail: "Brand operations, reports, and premium orchestration." },
  ];
</script>

<section class="grid gap-4 xl:grid-cols-4">
  {#each tiers as tier}
    <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
          {tier.name}
        </CardTitle>
      </CardHeader>
      <CardContent class="grid gap-4">
        <p class="font-[var(--font-heading)] text-4xl font-semibold text-[var(--foreground)]">{tier.price}</p>
        <p class="text-sm text-[var(--muted)]">{tier.detail}</p>
        <Button class="rounded-full px-5">{tier.name === "Spark" ? "Current plan" : `Choose ${tier.name}`}</Button>
      </CardContent>
    </Card>
  {/each}
</section>
