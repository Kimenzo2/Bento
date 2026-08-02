<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import type { TaskDraft } from "$lib/ai/client";
  import TaskCard from "./TaskCard.svelte";

  let { items }: { items: TaskDraft[] } = $props();
</script>

<div class="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
  {#each items as item}
    <TaskCard task={item} />
  {/each}
</div>
