<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts" module>
  import type { Snippet } from "svelte";

  export interface CheckpointTriggerProps {
    children?: Snippet;
    class?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    tooltip?: string;
    onclick?: (e: MouseEvent) => void;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let {
    children,
    class: className,
    variant = "ghost",
    size = "sm",
    tooltip: tooltipText,
    onclick,
    disabled = false,
    ...restProps
  }: CheckpointTriggerProps = $props();
</script>

{#if tooltipText}
  <button type="button" {onclick} {disabled} class={className} {...restProps} use:tooltip={{ text: tooltipText }}>
    {@render children?.()}
  </button>
{:else}
  <Button {size} type="button" {variant} {onclick} {disabled} class={className} {...restProps}>
    {@render children?.()}
  </Button>
{/if}
