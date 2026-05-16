<script lang="ts">
  import AssetCard from "$lib/components/AssetCard.svelte";
  import MetricCard from "$lib/components/MetricCard.svelte";
  import ProjectCard from "$lib/components/ProjectCard.svelte";
  import { dashboardMetrics, demoAssets, demoProjects } from "$lib/data/app-data";
</script>

<section class="grid gap-8">
  <div class="grid gap-4 xl:grid-cols-4">
    {#each dashboardMetrics as metric}
      <MetricCard {...metric} />
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
    <div class="grid gap-4">
      {#each demoProjects as project}
        <ProjectCard {project} />
      {/each}
    </div>

    <div class="grid gap-4">
      {#each demoAssets.slice(0, 2) as asset}
        <AssetCard {asset} />
      {/each}
    </div>
  </div>
</section>
