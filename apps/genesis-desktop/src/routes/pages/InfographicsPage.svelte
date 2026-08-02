<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import MetricCard from "$lib/components/MetricCard.svelte";
</script>

<section class="grid gap-6">
  <div class="grid gap-4 xl:grid-cols-3">
    <MetricCard label="Narrative Reach" value="81%" caption="Retention through page 14" />
    <MetricCard label="Brand Recall" value="94%" caption="Post-view prompt response" />
    <MetricCard label="Visual Consistency" value="97%" caption="Scene-board match score" />
  </div>

  <div class="rounded-[36px] app-surface p-8">
    <p class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
      Infographic generation surface
    </p>
    <p class="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
      This desktop page mirrors the product’s data-storytelling route with export-aware layout previews and shared asset references.
    </p>
  </div>
</section>
