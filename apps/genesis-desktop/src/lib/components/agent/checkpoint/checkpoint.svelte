<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  export interface CheckpointProps extends HTMLAttributes<HTMLDivElement> {
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { Separator } from "$lib/components/ui/separator";

  let { class: className, children, ...restProps }: CheckpointProps = $props();
</script>

<div
  class={cn("flex items-center gap-0.5 overflow-hidden text-muted-foreground", className)}
  {...restProps}
>
  {@render children?.()}
  <Separator />
</div>
