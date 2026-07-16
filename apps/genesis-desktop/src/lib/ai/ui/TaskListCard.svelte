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
