<script lang="ts">
  import type { ChartConfig } from "./types.js";

  let {
    config,
    class: className = "",
  }: {
    config: ChartConfig;
    class?: string;
  } = $props();

  const items = $derived(
    Object.entries(config).filter(([, v]) => v.color && v.label)
  );
</script>

<div
  data-slot="chart-legend"
  class={`flex flex-wrap gap-x-4 gap-y-1.5 text-sm ${className}`}
>
  {#each items as [key, item]}
    <span class="flex items-center gap-1.5">
      <span
        class="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style="background:{item.color}"
      ></span>
      <span class="text-[var(--foreground)]">{item.label}</span>
    </span>
  {/each}
</div>
