<script lang="ts">
  import { Collapsible } from "$lib/components/ui/collapsible/index.js";
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  export interface TaskProps extends CollapsiblePrimitive.RootProps {
    class?: string;
    children?: Snippet;
  }

  let { open = $bindable(true), class: className, children, ...restProps }: TaskProps = $props();
</script>

<Collapsible
  class={cn(
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
    className
  )}
  bind:open
  {...restProps}
>
  {@render children?.()}
</Collapsible>
