<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import type { Snippet } from "svelte";
  import type { ButtonProps } from "$lib/components/ui/button/index.js";

  export interface ConfirmationActionProps extends ButtonProps {}
</script>

<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils";

  let {
    class: className,
    variant = "default",
    size = "sm",
    children,
    ...restProps
  }: ConfirmationActionProps = $props();
</script>

<Button class={cn("h-8 px-3 text-sm", className)} type="button" {variant} {size} {...restProps}>
  {@render children?.()}
</Button>
