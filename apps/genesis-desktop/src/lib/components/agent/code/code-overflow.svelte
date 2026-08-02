<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import { Button } from "$lib/components/ui/button/index.js";
  import { useCodeOverflow } from "./code.svelte.js";
  import type { CodeOverflowProps } from "./types";
  import type { Snippet } from "svelte";

  let {
    collapsed = $bindable(true),
    class: className,
    children,
    ...props
  }: CodeOverflowProps = $props();

  const state = useCodeOverflow({
    collapsed: { current: collapsed },
  });
</script>

<div
  {...props}
  data-code-overflow
  data-collapsed={collapsed}
  class={cn("relative data-[collapsed=true]:max-h-[300px]", collapsed ? "overflow-y-hidden" : "overflow-y-auto", className)}
>
  {@render children?.()}
  {#if collapsed}
    <div
      class="from-background absolute bottom-0 left-0 z-10 h-full w-full bg-gradient-to-t to-transparent"
    ></div>
  {/if}
  {#if collapsed}
    <Button
      variant="secondary"
      size="sm"
      class="absolute bottom-0 left-1/2 z-20 w-fit -translate-x-1/2"
      onclick={state.toggleCollapsed}
    >
      Expand
    </Button>
  {:else}
    <Button
      variant="secondary"
      size="sm"
      class="absolute bottom-6 left-1/2 z-20 w-fit -translate-x-1/2"
      onclick={state.toggleCollapsed}
    >
      Collapse
    </Button>
  {/if}
</div>
