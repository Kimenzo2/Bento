<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import XIcon from "@lucide/svelte/icons/x";
  import { scale } from "svelte/transition";
  import { UseClipboard } from "./use-clipboard.svelte.js";
  import type { CopyButtonProps } from "./types.js";

  let {
    ref = $bindable(null),
    text,
    icon,
    animationDuration = 500,
    variant = "ghost",
    size = "icon",
    onCopy,
    class: className,
    tabindex = -1,
    children,
    ...rest
  }: CopyButtonProps = $props();

  // svelte-ignore state_referenced_locally
  if (size === "icon" && children) {
    size = "default";
  }

  let clipboard = new UseClipboard();
</script>

<Button
  bind:ref
  {variant}
  {size}
  {tabindex}
  class={cn("flex items-center gap-2", className)}
  type="button"
  name="copy"
  onclick={async () => {
    const status = await clipboard.copy(text);
    onCopy?.(status);
  }}
  {...rest}
>
  {#if clipboard.status === "success"}
    <div in:scale={{ duration: animationDuration, start: 0.85 }}>
      <CheckIcon tabindex={-1} strokeWidth={1.8} />
      <span class="sr-only">Copied</span>
    </div>
  {:else if clipboard.status === "failure"}
    <div in:scale={{ duration: animationDuration, start: 0.85 }}>
      <XIcon tabindex={-1} strokeWidth={1.8} />
      <span class="sr-only">Failed to copy</span>
    </div>
  {:else}
    <div in:scale={{ duration: animationDuration, start: 0.85 }}>
      {#if icon}
        {@render icon()}
      {:else}
        <CopyIcon tabindex={-1} strokeWidth={1.8} />
      {/if}
      <span class="sr-only">Copy</span>
    </div>
  {/if}
  {@render children?.()}
</Button>
