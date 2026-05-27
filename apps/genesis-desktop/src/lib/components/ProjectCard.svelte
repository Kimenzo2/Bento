<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { ProjectSummary } from "$lib/data/app-data";
  import { selectProject } from "$lib/stores/workspace.store";

  let {
    project,
  }: {
    project: ProjectSummary;
  } = $props();

  const openProject = () => {
    selectProject(project.id);
    goto(`/project/${project.id}`);
  };
</script>

<Card class="surface-card rounded-[28px] border-none bg-transparent shadow-none">
  <CardHeader class="gap-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
          {project.title}
        </CardTitle>
        <CardDescription class="mt-2 max-w-xl text-[var(--muted)]">
          {project.synopsis}
        </CardDescription>
      </div>
      <Badge class="rounded-full px-3 py-1 text-xs">{project.status}</Badge>
    </div>
  </CardHeader>
  <CardContent class="grid gap-3 md:grid-cols-3">
    <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
      <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Pages</p>
      <p class="mt-2 text-xl font-semibold text-[var(--foreground)]">{project.pages}</p>
    </div>
    <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
      <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Audience</p>
      <p class="mt-2 text-xl font-semibold text-[var(--foreground)]">{project.audience}</p>
    </div>
    <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
      <p class="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Last edited</p>
      <p class="mt-2 text-xl font-semibold text-[var(--foreground)]">{project.lastEdited}</p>
    </div>
  </CardContent>
  <CardFooter class="gap-3">
    <Button class="rounded-full px-5" onclick={openProject}>Open project</Button>
    <Button class="rounded-full px-5" variant="outline" onclick={() => goto("/notes")}>
      Continue editing
    </Button>
  </CardFooter>
</Card>
