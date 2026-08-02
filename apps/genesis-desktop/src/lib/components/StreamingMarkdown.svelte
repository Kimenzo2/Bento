<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { Lexer } from "marked";
  import MarkdownBlock from "$lib/components/MarkdownBlock.svelte";
  import { repairMarkdown } from "$lib/markdown/repairMarkdown";

  let {
    content,
  }: {
    content: string;
  } = $props();

  let parsedBlocks = $state<{ raw: string; index: number; streaming: boolean }[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function parseContent() {
    const repaired = repairMarkdown(content);
    const tokens = Lexer.lex(repaired, { gfm: true });
    parsedBlocks = tokens.map((token, index) => ({
      raw: token.raw,
      index,
      streaming: true,
    }));
  }

  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(parseContent, 20);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });
</script>

<div class="streaming-markdown" style="overflow:hidden;max-width:100%;min-width:0;">
  {#each parsedBlocks as block (block.index)}
    <MarkdownBlock raw={block.raw} streaming={block.streaming} />
  {/each}
</div>
