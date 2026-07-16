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

<div class="streaming-markdown__block" class:streaming-markdown__block-active={streaming} style="overflow:hidden;max-width:100%;min-width:0;">
  {@html html}
</div>
