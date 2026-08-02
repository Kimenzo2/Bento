<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { getContext, tick } from "svelte";
  import type { ScrollButtonContext } from "./root.svelte";

  // ── Props ─────────────────────────────────────────────────────
  let {
    children,
    class: className = "",
    ariaLabel,
  }: {
    children: import("svelte").Snippet;
    class?: string;
    ariaLabel?: string;
  } = $props();

  // ── Context ───────────────────────────────────────────────────
  const ctx = getContext<ScrollButtonContext>("scroll-button");
  let contentEl = $state<HTMLDivElement | null>(null);

  // ── Register with root once mounted ───────────────────────────
  $effect(() => {
    if (contentEl) {
      ctx.registerContent(contentEl);
    }
  });
</script>

<div
  bind:this={contentEl}
  class={className}
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label={ariaLabel}
>
  {@render children()}
</div>
