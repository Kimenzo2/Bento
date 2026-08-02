<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { CollapsibleContent } from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  export interface TaskContentProps extends CollapsiblePrimitive.ContentProps {
    children?: Snippet;
    class?: string;
  }

  let { children, class: className, ...restProps }: TaskContentProps = $props();
</script>

<CollapsibleContent
  class={cn(
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
    className
  )}
  {...restProps}
>
  <div class="border-muted mt-4 space-y-2 border-l-2 pl-4">
    {@render children?.()}
  </div>
</CollapsibleContent>
