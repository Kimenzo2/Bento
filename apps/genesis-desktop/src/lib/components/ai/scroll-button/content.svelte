<script lang="ts">
  import { getContext, tick } from "svelte";
  import type { ScrollButtonContext } from "./root.svelte";

  // ── Props ─────────────────────────────────────────────────────
  let {
    children,
    class: className = "",
    ariaLabel,
  }: {
    children: import("svelte").Snippet;
    class?: string;
    ariaLabel?: string;
  } = $props();

  // ── Context ───────────────────────────────────────────────────
  const ctx = getContext<ScrollButtonContext>("scroll-button");
  let contentEl = $state<HTMLDivElement | null>(null);

  // ── Register with root once mounted ───────────────────────────
  $effect(() => {
    if (contentEl) {
      ctx.registerContent(contentEl);
    }
  });
</script>

<div
  bind:this={contentEl}
  class={className}
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label={ariaLabel}
>
  {@render children()}
</div>
