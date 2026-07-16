<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ChartConfig } from "./types.js";

  let { config, class: className, children }: {
    config: ChartConfig;
    class?: string;
    children: Snippet;
  } = $props();

  const cssVars = $derived(
    Object.entries(config)
      .filter(([, v]) => v.color)
      .map(([k, v]) => `--color-${k}:${v.color}`)
      .join(";")
  );
</script>

<div class={className} style={cssVars}>
  {@render children()}
</div>
