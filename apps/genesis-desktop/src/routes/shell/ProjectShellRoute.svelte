<script lang="ts">
  import type { RouteResult } from "@mateothegreat/svelte5-router";
  import ShellLayout from "$lib/components/ShellLayout.svelte";
  import ProjectViewPage from "../pages/ProjectViewPage.svelte";

  let {
    route,
  }: {
    route?: RouteResult;
  } = $props();

  const projectId = $derived(
    ((route?.result.path.params as Record<string, string> | undefined)?.projectId ?? "")
  );
</script>

<ShellLayout page="project">
  <ProjectViewPage projectId={projectId} />
</ShellLayout>
