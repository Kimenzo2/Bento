<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import { cn, type WithElementRef } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import type { ToolUIPartApproval, ToolUIPartState } from "./confirmation-context.svelte.js";

  export interface ConfirmationProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
    approval?: ToolUIPartApproval;
    state: ToolUIPartState;
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { Alert } from "$lib/components/ui/alert/index.js";
  import { setConfirmationContext } from "./confirmation-context.svelte.js";
  import { watch } from "runed";

  let {
    class: className,
    approval,
    state,
    children,
    ref = $bindable(null),
    ...restProps
  }: ConfirmationProps = $props();

  let shouldRender = $derived(
    approval && state !== "input-streaming" && state !== "input-available"
  );

  // svelte-ignore state_referenced_locally
  setConfirmationContext({ approval, state });

  watch(
    () => approval,
    (newApproval) => {
      setConfirmationContext({ approval: newApproval, state });
    }
  );
</script>

{#if shouldRender}
  <Alert bind:ref class={cn("flex flex-col gap-2", className)} {...restProps}>
    {@render children?.()}
  </Alert>
{/if}
