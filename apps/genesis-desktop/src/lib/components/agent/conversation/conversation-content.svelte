<script lang="ts" module>
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  export interface ConversationContentProps extends HTMLAttributes<HTMLDivElement> {
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { getStickToBottomContext } from "./stick-to-bottom-context.svelte.js";
  import { watch } from "runed";

  let { class: className, children, ...restProps }: ConversationContentProps = $props();

  const context = getStickToBottomContext();
  let element: HTMLDivElement;

  watch(
    () => element,
    () => {
      if (element) {
        context.setElement(element);
        context.scrollToBottom("smooth");
      }
    },
  );
</script>

<div
  bind:this={element}
  class={cn("flex flex-col gap-8 p-4", className)}
  {...restProps}
>
  {@render children?.()}
</div>
