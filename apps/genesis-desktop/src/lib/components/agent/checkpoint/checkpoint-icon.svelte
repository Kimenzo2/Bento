<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  export interface CheckpointIconProps {
    class?: string;
    children?: Snippet;
    size?: number;
  }
</script>

<script lang="ts">
  import Bookmark from "@lucide/svelte/icons/bookmark";

  let { class: className, children, size = 16, ...restProps }: CheckpointIconProps = $props();
</script>

{#if children}
  {@render children()}
{:else}
  <Bookmark class={cn(className)} {size} {...restProps} />
{/if}
