<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="notes-editor grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader class="flex-row items-center justify-between">
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Creation canvas
      </CardTitle>
      <div class="flex gap-3">
        <Button class="rounded-full px-5" variant="outline" href="/viewer">Preview</Button>
        <Button class="rounded-full px-5" href="/export">Export</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="desktop-canvas">
        <div class="desktop-canvas__spread">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Left page</p>
            <p class="mt-3 font-[var(--font-heading)] text-2xl font-semibold text-[var(--foreground)]">
              Scene composition
            </p>
            <p class="mt-2 text-sm leading-7 text-[var(--muted)]">
              Arrange illustration, copy, and pacing without leaving the local desktop surface.
            </p>
          </div>
          <div class="rounded-3xl border border-dashed border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)]"></div>
        </div>
      </div>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Editor rail
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#each ["Narration", "Illustration prompt", "Character consistency", "Layout notes"] as section}
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="font-semibold text-[var(--foreground)]">{section}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            Local-first controls for reviewing and adjusting this section.
          </p>
        </div>
      {/each}
    </CardContent>
  </Card>
</section>
