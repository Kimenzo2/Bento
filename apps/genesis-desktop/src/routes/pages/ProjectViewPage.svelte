<script lang="ts">
  import { demoProjects } from "$lib/data/app-data";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";

  let {
    projectId = "",
  }: {
    projectId?: string;
  } = $props();

  const project = $derived(demoProjects.find((entry) => entry.id === projectId) ?? demoProjects[0]);
</script>

<section class="grid gap-6">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader class="gap-4">
      <CardTitle class="font-[var(--font-heading)] text-3xl text-[var(--foreground)]">
        {project.title}
      </CardTitle>
      <p class="max-w-3xl text-[var(--muted)]">{project.synopsis}</p>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-4">
      <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
        <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Status</p>
        <p class="mt-2 text-lg font-semibold text-[var(--foreground)]">{project.status}</p>
      </div>
      <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
        <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Audience</p>
        <p class="mt-2 text-lg font-semibold text-[var(--foreground)]">{project.audience}</p>
      </div>
      <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
        <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Pages</p>
        <p class="mt-2 text-lg font-semibold text-[var(--foreground)]">{project.pages}</p>
      </div>
      <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
        <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Edited</p>
        <p class="mt-2 text-lg font-semibold text-[var(--foreground)]">{project.lastEdited}</p>
      </div>
    </CardContent>
  </Card>

  <div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
    <Card class="surface-card rounded-[28px] border-none bg-transparent shadow-none">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
          Scene list
        </CardTitle>
      </CardHeader>
      <CardContent class="grid gap-3">
        {#each Array.from({ length: 5 }, (_, index) => index + 1) as scene}
          <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
            <p class="font-semibold text-[var(--foreground)]">Scene {scene}</p>
            <p class="mt-1 text-sm text-[var(--muted)]">
              Pacing review, illustration prompts, and narration checkpoint.
            </p>
          </div>
        {/each}
      </CardContent>
    </Card>

    <Card class="surface-card rounded-[28px] border-none bg-transparent shadow-none">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
          Next actions
        </CardTitle>
      </CardHeader>
      <CardContent class="grid gap-4">
        <div class="rounded-3xl app-surface p-6">
          <p class="font-[var(--font-heading)] text-xl font-semibold text-[var(--foreground)]">
            Route this project into the editor shell
          </p>
          <p class="mt-2 text-sm text-[var(--muted)]">
            The desktop port keeps project detail, editing, export, and viewing as distinct navigable states.
          </p>
          <div class="mt-4 flex gap-3">
            <Button class="rounded-full px-5" href="/editor">Open editor</Button>
            <Button class="rounded-full px-5" href="/export" variant="outline">Prepare export</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</section>
