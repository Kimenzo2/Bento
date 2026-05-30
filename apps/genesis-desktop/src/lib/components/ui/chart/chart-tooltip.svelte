<script lang="ts">
  let {
    hideLabel = false,
    class: className = "",
    children,
  }: {
    hideLabel?: boolean;
    class?: string;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div
  data-slot="chart-tooltip"
  class={`rounded-xl bg-[var(--background)] px-3 py-2 text-sm ${className}`}
>
  {@render children?.()}
</div>
