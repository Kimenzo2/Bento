<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  let { children }: { children?: any } = $props();
  let contentEl = $state<HTMLDivElement | null>(null);
  let contentHeight = $state(0);
  let hasContent = $derived(children !== undefined && children !== null);

  $effect(() => {
    if (!contentEl || !hasContent) return;
    const ro = new ResizeObserver(([entry]) => {
      contentHeight = entry.contentRect.height;
    });
    ro.observe(contentEl);
    return () => ro.disconnect();
  });
</script>

{#if hasContent}
  {#if contentHeight > 0}
    <div
      class="attach-clip"
      style="height: {contentHeight + 6}px;"
    >
      <div bind:this={contentEl} class="attach-row">
        {@render children()}
      </div>
    </div>
  {:else}
    <div bind:this={contentEl} class="attach-row attach-row--measure">
      {@render children()}
    </div>
  {/if}
{/if}

<style>
  .attach-clip {
    overflow: hidden;
    transition: height 0.34s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .attach-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 0 6px;
  }

  .attach-row--measure {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    height: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .attach-clip {
      transition: none;
    }
  }
</style>
