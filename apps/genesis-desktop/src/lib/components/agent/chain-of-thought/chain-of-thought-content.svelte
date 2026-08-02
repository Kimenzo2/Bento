<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import { getChainOfThoughtContext } from "./chain-of-thought-context.svelte.js";
  import { CollapsibleContent } from "$lib/components/ui/collapsible/index.js";
  import type { Snippet } from "svelte";

  interface ChainOfThoughtContentProps {
    children: Snippet;
    class?: string;
  }

  let { children, class: className }: ChainOfThoughtContentProps = $props();

  const context = getChainOfThoughtContext();
</script>

<CollapsibleContent
  class={cn(
    "mt-2 space-y-3",
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
    className,
  )}
>
  {@render children()}
</CollapsibleContent>
