<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import type { MessageRole } from "../context/message-context.svelte.js";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    from: MessageRole;
    class?: string;
    children: Snippet;
  }

  let { from, class: className, children, ...restProps }: Props = $props();
</script>

<div
  class={cn(
    "group flex w-full max-w-[95%] flex-col gap-2 overflow-hidden min-w-0",
    from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
    className,
  )}
  data-role={from}
  {...restProps}
>
  {@render children()}
</div>
