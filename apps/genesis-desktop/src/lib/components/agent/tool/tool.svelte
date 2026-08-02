<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { Collapsible } from "$lib/components/ui/collapsible/index.js";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  interface ToolProps {
    class?: string;
    children?: Snippet;
    [key: string]: any;
  }

  let { class: className = "", children, ...restProps }: ToolProps = $props();

  // Stable per-instance id — `$state` is evaluated once at init. A
  // `$derived.by(() => crypto.randomUUID())` would generate a NEW id on every
  // reactive re-render, breaking the Collapsible's aria-controls/label linkage
  // and confusing the browser's element associations.
  let id = $state(crypto.randomUUID());
</script>

<Collapsible {id} class={cn("not-prose mb-4 w-full rounded-md border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)]", className)} {...restProps}>
  {@render children?.()}
</Collapsible>
