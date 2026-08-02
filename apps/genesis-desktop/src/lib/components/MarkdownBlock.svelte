<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

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
