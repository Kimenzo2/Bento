<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Search from "@lucide/svelte/icons/search";
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  export interface TaskTriggerProps extends CollapsiblePrimitive.TriggerProps {
    title: string;
    class?: string;
    children?: Snippet;
  }

  let { children, class: className, title, ...restProps }: TaskTriggerProps = $props();
</script>

{#if children}
  <CollapsibleTrigger class={cn("group", className)} {...restProps}>
    {@render children?.()}
  </CollapsibleTrigger>
{:else}
  <CollapsibleTrigger class={cn("group", className)} {...restProps}>
    <div
      class="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-2 text-sm transition-colors"
    >
      <Search class="size-4" />
      <p class="text-sm">{title}</p>
      <ChevronDown class="size-4 transition-transform group-data-[state=open]:rotate-180" />
    </div>
  </CollapsibleTrigger>
{/if}
