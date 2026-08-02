<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import { getChainOfThoughtContext } from "./chain-of-thought-context.svelte.js";
  import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";

  interface ChainOfThoughtHeaderProps {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className }: ChainOfThoughtHeaderProps = $props();

  const context = getChainOfThoughtContext();
</script>

<CollapsibleTrigger
  class={cn(
    "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors",
    className,
  )}
>
  <BrainIcon class="size-4" />
  <span class="flex-1 text-left">
    {#if children}
      {@render children()}
    {:else}
      Chain of Thought
    {/if}
  </span>
  <ChevronDownIcon
    class={cn("size-4 transition-transform", context.isOpen ? "rotate-180" : "rotate-0")}
  />
</CollapsibleTrigger>
