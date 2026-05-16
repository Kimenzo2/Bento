<script lang="ts">
  import { dailyChallenges } from "$lib/data/app-data";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Level 12 · Story Architect
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      <div class="rounded-3xl app-surface p-6">
        <p class="text-sm text-[var(--muted)]">Current XP</p>
        <p class="mt-2 font-[var(--font-heading)] text-5xl font-semibold text-[var(--foreground)]">
          2,460 / 3,000
        </p>
      </div>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Daily challenges
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#each dailyChallenges as challenge}
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="font-semibold text-[var(--foreground)]">{challenge}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">Worth 120 XP when completed.</p>
        </div>
      {/each}
    </CardContent>
  </Card>
</section>
