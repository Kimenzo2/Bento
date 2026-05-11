<script lang="ts">
  import { marked } from "marked";
  import { escapeMarkdownHtml } from "$lib/markdown/repairMarkdown";

  let {
    raw,
    streaming = false,
  }: {
    raw: string;
    streaming?: boolean;
  } = $props();

  const html = $derived(
    marked.parse(escapeMarkdownHtml(raw), {
      async: false,
      gfm: true,
    }) as string
  );
</script>

<div class="streaming-markdown__block" class:streaming-markdown__block-active={streaming}>
  {@html html}
  {#if streaming}
    <span class="streaming-markdown__caret" aria-hidden="true"></span>
  {/if}
</div>
