<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    value,
    type = "metric",
    weight,
    prefix = "",
    suffix = "",
    class: className,
  }: {
    value: string | number;
    type?: "hero" | "metric" | "stat" | "tabular";
    weight?: 300 | 400 | 500 | 600 | 700 | 800;
    prefix?: string;
    suffix?: string;
    class?: string;
  } = $props();

  const weightClass = $derived(
    weight === 500 ? "number-medium"
    : weight === 600 || weight === 700 || weight === 800 ? "number-semibold"
    : ""
  );
</script>

<span
  class={cn("number", `number-${type}`, weightClass, className)}
>
  {prefix}{value}{suffix}
</span>
