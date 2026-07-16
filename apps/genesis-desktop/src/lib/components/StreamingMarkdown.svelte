<script lang="ts">
  import { Lexer } from "marked";
  import MarkdownBlock from "$lib/components/MarkdownBlock.svelte";
  import { repairMarkdown } from "$lib/markdown/repairMarkdown";

  let {
    content,
  }: {
    content: string;
  } = $props();

  const blocks = $derived.by(() => {
    const repaired = repairMarkdown(content);
    const tokens = Lexer.lex(repaired, { gfm: true });
    return tokens.map((token, index) => ({
      raw: token.raw,
      index,
      streaming: index === tokens.length - 1,
    }));
  });
</script>

<div class="streaming-markdown" style="overflow:hidden;max-width:100%;min-width:0;">
  {#each blocks as block (block.index)}
    <MarkdownBlock raw={block.raw} streaming={block.streaming} />
  {/each}
</div>
