<script lang="ts">
  import { cn } from "$lib/utils";
  import { codeVariants } from "./index.js";
  import type { CodeRootProps } from "./types";
  import { useCode } from "./code.svelte.js";

  let {
    ref = $bindable(null),
    variant = "default",
    lang = "typescript" as CodeRootProps["lang"],
    code,
    class: className,
    hideLines = false,
    highlight = [],
    children,
    ...rest
  }: CodeRootProps = $props();

  const codeState = useCode({
    code: { get current() { return code; } },
    hideLines: { get current() { return hideLines; } },
    highlight: { get current() { return highlight; } },
    lang: { get current() { return lang ?? "typescript"; } },
  });
</script>

<div {...rest} bind:this={ref} class={cn(codeVariants({ variant }), className)}>
  <div class="ai-code-wrapper">
    {@html codeState.highlighted}
    {@render children?.()}
  </div>
</div>

<style>
  .ai-code-wrapper :global(pre.shiki) {
    overflow-x: auto;
    border-radius: 0.5rem;
    background: inherit;
    padding: 1rem 0;
    font-size: 0.875rem;
  }

  .ai-code-wrapper :global(pre.shiki:not([data-code-overflow] *):not([data-code-overflow])) {
    overflow-y: auto;
    max-height: min(100%, 650px);
  }

  .ai-code-wrapper :global(pre.shiki code) {
    display: grid;
    min-width: 100%;
    border-radius: 0;
    border: 0;
    background: transparent;
    padding: 0;
    counter-reset: line;
    box-decoration-break: clone;
  }

  .ai-code-wrapper :global(pre.line-numbers) {
    counter-reset: step;
    counter-increment: step 0;
  }

  .ai-code-wrapper :global(pre.line-numbers .line::before) {
    content: counter(step);
    counter-increment: step;
    display: inline-block;
    width: 1.8rem;
    margin-right: 1.4rem;
    text-align: right;
    color: var(--muted-foreground);
  }

  .ai-code-wrapper :global(pre .line.line--highlighted) {
    background: var(--secondary);
  }

  .ai-code-wrapper :global(pre .line.line--highlighted span) {
    position: relative;
  }

  .ai-code-wrapper :global(pre .line) {
    display: inline-block;
    min-height: 1rem;
    width: 100%;
    padding: 0 1rem 0.125rem;
  }

  .ai-code-wrapper :global(pre.line-numbers .line) {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .ai-code-wrapper :global(pre.shiki code .line.diff.add) {
    background: oklch(0.723 0.192 149.579 / 0.1);
  }

  .ai-code-wrapper :global(pre.shiki code .line.diff.remove) {
    background: oklch(0.637 0.208 25.331 / 0.1);
  }
</style>
