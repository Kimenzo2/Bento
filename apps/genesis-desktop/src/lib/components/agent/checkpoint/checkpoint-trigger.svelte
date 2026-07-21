<script lang="ts" module>
  import type { Snippet } from "svelte";

  export interface CheckpointTriggerProps {
    children?: Snippet;
    class?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    tooltip?: string;
    onclick?: (e: MouseEvent) => void;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let {
    children,
    class: className,
    variant = "ghost",
    size = "sm",
    tooltip: tooltipText,
    onclick,
    disabled = false,
    ...restProps
  }: CheckpointTriggerProps = $props();
</script>

{#if tooltipText}
  <Button {size} type="button" {variant} {onclick} {disabled} class={className} {...restProps} use:tooltip={{ text: tooltipText }}>
    {@render children?.()}
  </Button>
{:else}
  <Button {size} type="button" {variant} {onclick} {disabled} class={className} {...restProps}>
    {@render children?.()}
  </Button>
{/if}
