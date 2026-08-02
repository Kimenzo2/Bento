<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import type { Snippet } from "svelte";

  export interface ConfirmationAcceptedProps {
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { getConfirmationContext } from "./confirmation-context.svelte.js";

  let { children }: ConfirmationAcceptedProps = $props();

  let context = getConfirmationContext();

  let shouldShow = $derived(
    context.approval?.approved === true &&
      (context.state === "approval-responded" ||
        context.state === "output-denied" ||
        context.state === "output-available")
  );
</script>

{#if shouldShow}
  {@render children?.()}
{/if}
