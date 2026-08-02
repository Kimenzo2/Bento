<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import * as Code from "$lib/components/agent/code/index.js";
  import type { Snippet } from "svelte";

  interface ToolOutputProps {
    class?: string;
    output?: any;
    errorText?: string;
    children?: Snippet;
    [key: string]: any;
  }

  let {
    class: className = "",
    output,
    errorText,
    children,
    ...restProps
  }: ToolOutputProps = $props();

  let shouldRender = $derived.by(() => {
    return !!(output || errorText);
  });

  let outputComponent = $derived.by(() => {
    if (!output) return null;

    if (typeof output === "object") {
      return {
        type: "code" as const,
        content: JSON.stringify(output, null, 2),
        language: "json" as const,
      };
    } else if (typeof output === "string") {
      return {
        type: "code" as const,
        content: output,
        language: "text" as const,
      };
    } else {
      return {
        type: "text" as const,
        content: String(output),
        language: "text" as const,
      };
    }
  });
</script>

{#if shouldRender}
  <div class={cn("space-y-2 p-4", className)} {...restProps}>
    <h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {errorText ? "Error" : "Result"}
    </h4>
    <div
      class={cn(
        "overflow-x-auto rounded-md text-xs [&_table]:w-full",
        errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground"
      )}
    >
      {#if errorText}
        <div class="p-3">{errorText}</div>
      {:else if outputComponent}
        {#if outputComponent.type === "code"}
          <Code.Root
            code={outputComponent.content}
            lang={outputComponent.language}
            hideLines
          >
            <Code.CopyButton />
          </Code.Root>
        {:else}
          <div class="p-3">{outputComponent.content}</div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
