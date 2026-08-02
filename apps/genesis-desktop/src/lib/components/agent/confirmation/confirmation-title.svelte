<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import { cn, type WithElementRef } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  export interface ConfirmationTitleProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { AlertDescription } from "$lib/components/ui/alert/index.js";

  let {
    class: className,
    children,
    ref = $bindable(null),
    ...restProps
  }: ConfirmationTitleProps = $props();
</script>

<AlertDescription bind:ref class={cn("inline", className)} {...restProps}>
  {@render children?.()}
</AlertDescription>
