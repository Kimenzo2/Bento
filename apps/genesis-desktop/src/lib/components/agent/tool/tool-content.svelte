<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { CollapsibleContent } from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  interface ToolContentProps {
    class?: string;
    children?: Snippet;
    [key: string]: any;
  }

  let { class: className = "", children, ...restProps }: ToolContentProps = $props();
</script>

<CollapsibleContent
  class={cn(
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</CollapsibleContent>
