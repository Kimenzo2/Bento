<script lang="ts" module>
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  export interface ConversationProps extends HTMLAttributes<HTMLDivElement> {
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { setStickToBottomContext } from "./stick-to-bottom-context.svelte.js";

  let {
    class: className,
    children,
    ...restProps
  }: ConversationProps = $props();

  setStickToBottomContext();
</script>

<div
  class={cn("relative flex h-full flex-col overflow-hidden", className)}
  role="log"
  {...restProps}
>
  {@render children?.()}
</div>
