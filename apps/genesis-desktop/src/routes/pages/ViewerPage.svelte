<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="grid gap-6">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Storybook viewer
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each Array.from({ length: 6 }, (_, index) => index + 1) as page}
        <div class="rounded-[28px] border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_92%,transparent)] p-5">
          <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Page {page}</p>
          <div class="mt-4 aspect-[4/5] rounded-3xl app-surface"></div>
        </div>
      {/each}
    </CardContent>
  </Card>
</section>
