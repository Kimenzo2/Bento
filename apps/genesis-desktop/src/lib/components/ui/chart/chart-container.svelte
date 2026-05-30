<script lang="ts">
  import type { ChartConfig } from "./types.js";

  let {
    config,
    class: className = "",
    children,
  }: {
    config: ChartConfig;
    class?: string;
    children?: import("svelte").Snippet;
  } = $props();

  // Inject CSS colour variables so chart slices can reference
  // var(--color-chrome) etc. without extra setup in every callsite.
  const cssVars = $derived(
    Object.entries(config)
      .filter(([, v]) => v.color)
      .map(([k, v]) => `--color-${k}:${v.color}`)
      .join(";")
  );
</script>

<div
  data-slot="chart-container"
  class={className}
  style={cssVars}
>
  {@render children?.()}
</div>
