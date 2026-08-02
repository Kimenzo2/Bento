<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface ChainOfThoughtSearchResultProps
    extends HTMLAttributes<HTMLElement> {
    children: Snippet;
    class?: string;
  }

  let {
    children,
    class: className,
    ...restProps
  }: ChainOfThoughtSearchResultProps = $props();
</script>

<Badge
  class={cn("gap-1 px-2 py-0.5 text-xs font-normal", className)}
  variant="secondary"
  {...restProps}
>
  {@render children()}
</Badge>
