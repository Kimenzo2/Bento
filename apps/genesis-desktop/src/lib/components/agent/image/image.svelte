<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import type { ImageProps } from "./types";

  let {
    ref = $bindable(null),
    base64,
    uint8Array,
    mediaType,
    alt,
    class: className,
    ...rest
  }: ImageProps = $props();
</script>

<img
  bind:this={ref}
  {alt}
  class={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
  src={`data:${mediaType};base64,${base64}`}
  {...rest}
/>
