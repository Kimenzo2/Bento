<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import CopyButton from "$lib/components/agent/copy-button/copy-button.svelte";
  import { useCodeCopyButton } from "./code.svelte.js";
  import type { CodeCopyButtonProps } from "./types.js";

  let {
    ref = $bindable(null),
    variant = "ghost",
    size = "icon",
    class: className,
    ...rest
  }: CodeCopyButtonProps = $props();

  const copyButton = useCodeCopyButton();
</script>

<CopyButton
  class={cn("absolute top-2 right-2", className)}
  text={copyButton.code}
  {variant}
  {size}
  {...rest}
/>
