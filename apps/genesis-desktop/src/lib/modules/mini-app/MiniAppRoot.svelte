<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  let {
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
  class={cn(
    "mini-app-root module-root flex min-h-full w-full min-w-0 flex-col gap-6 bg-[var(--background)] text-[var(--foreground)]",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</div>
