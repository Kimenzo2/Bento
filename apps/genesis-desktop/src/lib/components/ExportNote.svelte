<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Download, FileText, Code, Braces } from 'lucide-svelte';
  import { getRootBlocks, getTitleBlock } from '$lib/local-store/store';
  import { tooltip } from "$lib/components/Tooltip.svelte";
  import type { Block, ContentText } from '$lib/local-store/block';
  import { TextStyle as TS, MarkType } from '$lib/local-store/block';

  let { objectId = '' }: { objectId?: string } = $props();

  let open = $state(false);

  function toggle() { open = !open; }
  function close() { open = false; }

  function getDocTitle(): string {
    const title = getTitleBlock();
    if (title) {
      const ct = title.content as ContentText;
      return ct.text.trim() || 'untitled';
    }
    return 'untitled';
  }

  function getBlocks(): Block[] {
    return getRootBlocks();
  }

  function textStyleToMarkdown(block: Block): string {
    const ct = block.content as ContentText;
    let text = ct.text;

    const marks = [...(ct.marks ?? [])].sort((a, b) => a.range.from - b.range.from);
    if (marks.length > 0) {
      let result = '';
      let pos = 0;
      for (const m of marks) {
        if (m.range.from > pos) result += text.slice(pos, m.range.from);
        const t = text.slice(m.range.from, m.range.to);
        switch (m.type) {
          case MarkType.Bold: result += `**${t}**`; break;
          case MarkType.Italic: result += `*${t}*`; break;
          case MarkType.Strike: result += `~~${t}~~`; break;
          case MarkType.Code: result += `\`${t}\``; break;
          case MarkType.Link: result += `[${t}](${m.param || ''})`; break;
          case MarkType.Subscript: result += `<sub>${t}</sub>`; break;
          case MarkType.Superscript: result += `<sup>${t}</sup>`; break;
          case MarkType.Underline: result += t; break;
          default: result += t;
        }
        pos = m.range.to;
      }
      if (pos < text.length) result += text.slice(pos);
      text = result;
    }

    const style = ct.style;
    if (style === TS.Header1) return `# ${text}`;
    if (style === TS.Header2) return `## ${text}`;
    if (style === TS.Header3) return `### ${text}`;
    if (style === TS.Header4) return `#### ${text}`;
    if (style === TS.Quote) return `> ${text}`;
    if (style === TS.Code) return '```\n' + text + '\n```';
    if (style === TS.Bulleted) return `- ${text}`;
    if (style === TS.Numbered) return `1. ${text}`;
    if (style === TS.Checkbox) return `- [${ct.checked ? 'x' : ' '}] ${text}`;
    if (style === TS.Toggle || style === TS.ToggleHeader1 || style === TS.ToggleHeader2 || style === TS.ToggleHeader3) return `<details><summary>${text}</summary>\n\n</details>`;
    if (style === TS.Callout) return `> **${text}**`;
    return text;
  }

  function blocksToMarkdown(): string {
    const titleBlock = getTitleBlock();
    const blocks = getBlocks();
    let md = '';
    if (titleBlock) {
      const ct = titleBlock.content as ContentText;
      md += `# ${ct.text}\n\n`;
    }
    for (const b of blocks) {
      if (b.type === 'text') {
        md += textStyleToMarkdown(b) + '\n\n';
      } else if (b.type === 'div') {
        md += '---\n\n';
      }
    }
    return md.trim();
  }

  function blockContentToPlain(block: Block): string {
    if (block.type === 'text') {
      const ct = block.content as ContentText;
      let text = ct.text;
      const marks = ct.marks ?? [];
      for (const m of marks) {
        if (m.type === MarkType.Link) {
          const linkText = text.slice(m.range.from, m.range.to);
          text = text.slice(0, m.range.from) + linkText + text.slice(m.range.to);
        }
      }
      return text;
    }
    return '';
  }

  function blocksToHTML(): string {
    const titleBlock = getTitleBlock();
    const blocks = getBlocks();
    let html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n';
    html += `<title>${getDocTitle()}</title>\n`;
    html += '<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.7}h1{font-size:2rem}h2{font-size:1.6rem}h3{font-size:1.3rem}blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:16px;color:#666}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}ul{padding-left:24px}ol{padding-left:24px}hr{border:none;border-top:1px solid #ddd}</style>\n</head>\n<body>\n';
    if (titleBlock) {
      const ct = titleBlock.content as ContentText;
      html += `<h1>${escHtml(ct.text)}</h1>\n`;
    }
    for (const b of blocks) {
      if (b.type === 'text') {
        const ct = b.content as ContentText;
        const text = buildHtmlWithMarks(ct.text, ct.marks ?? []);
        const style = ct.style;
        if (style === TS.Header1) html += `<h2>${text}</h2>\n`;
        else if (style === TS.Header2) html += `<h3>${text}</h3>\n`;
        else if (style === TS.Header3) html += `<h4>${text}</h4>\n`;
        else if (style === TS.Header4) html += `<h5>${text}</h5>\n`;
        else if (style === TS.Quote) html += `<blockquote>${text}</blockquote>\n`;
        else if (style === TS.Code) html += `<pre><code>${escHtml(ct.text)}</code></pre>\n`;
        else if (style === TS.Bulleted) html += `<ul><li>${text}</li></ul>\n`;
        else if (style === TS.Numbered) html += `<ol><li>${text}</li></ol>\n`;
        else if (style === TS.Checkbox) html += `<p><input type="checkbox" ${ct.checked ? 'checked' : ''} disabled> ${text}</p>\n`;
        else html += `<p>${text}</p>\n`;
      } else if (b.type === 'div') {
        html += '<hr>\n';
      }
    }
    html += '</body>\n</html>';
    return html;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildHtmlWithMarks(text: string, marks: any[]): string {
    if (!text) return '';
    type Evt = { pos: number; order: number; tag: string };
    const events: Evt[] = [];
    const sorted = [...marks].sort((a, b) => a.range.from - b.range.from || b.range.to - a.range.to);
    sorted.forEach((m, i) => {
      const { from, to } = m.range;
      if (from >= to || from < 0 || to > text.length) return;
      const [open, close] = markToTags(m);
      events.push({ pos: from, order: i, tag: open });
      events.push({ pos: to, order: -i - 1, tag: close });
    });
    events.sort((a, b) => a.pos - b.pos || a.order - b.order);
    let html = '';
    let pos = 0;
    for (const ev of events) {
      if (ev.pos > pos) { html += escHtml(text.slice(pos, ev.pos)); pos = ev.pos; }
      html += ev.tag;
    }
    if (pos < text.length) html += escHtml(text.slice(pos));
    return html;
  }

  function markToTags(m: any): [string, string] {
    switch (m.type) {
      case MarkType.Bold: return ['<strong>', '</strong>'];
      case MarkType.Italic: return ['<em>', '</em>'];
      case MarkType.Code: return ['<code>', '</code>'];
      case MarkType.Strike: return ['<s>', '</s>'];
      case MarkType.Underline: return ['<u>', '</u>'];
      case MarkType.Subscript: return ['<sub>', '</sub>'];
      case MarkType.Superscript: return ['<sup>', '</sup>'];
      case MarkType.Link: return [`<a href="${m.param || '#'}">`, '</a>'];
      default: return ['', ''];
    }
  }

  function blocksToJSON(): string {
    const titleBlock = getTitleBlock();
    const blocks = getBlocks();
    const data: any = { title: getDocTitle(), blocks: [] };
    for (const b of blocks) {
      if (b.type === 'text') {
        const ct = b.content as ContentText;
        data.blocks.push({
          id: b.id,
          type: 'text',
          style: ct.style,
          text: ct.text,
          marks: ct.marks ?? [],
          checked: ct.checked,
        });
      } else if (b.type === 'div') {
        data.blocks.push({ id: b.id, type: 'div' });
      }
    }
    return JSON.stringify(data, null, 2);
  }

  async function handleExport(as: 'markdown' | 'html' | 'json') {
    let text = '';
    let ext = '';
    let filterName = '';
    switch (as) {
      case 'markdown': text = blocksToMarkdown(); ext = 'md'; filterName = 'Markdown'; break;
      case 'html': text = blocksToHTML(); ext = 'html'; filterName = 'HTML'; break;
      case 'json': text = blocksToJSON(); ext = 'json'; filterName = 'JSON'; break;
    }
    const filename = getDocTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'document';
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: `${filename}.${ext}`,
        filters: [{ name: filterName, extensions: [ext] }]
      });
      if (!filePath) return;
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(filePath, text);
    } catch (e) {
      console.error('Export failed:', e);
    }
    close();
  }

  function handleClose(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.export-dropdown')) close();
  }
</script>

<svelte:window onclick={handleClose} />

<div class="export-btn-wrap">
  <button class="export-trigger" onclick={toggle} aria-label="Export note" type="button" use:tooltip={{ text: "Export note" }}>
    <Download size={14} />
  </button>
  {#if open}
    <div class="export-dropdown" role="menu" onclick={(e) => e.stopPropagation()}>
      <div class="export-label">Export As</div>
      <button class="export-item" role="menuitem" onclick={() => handleExport('markdown')}>
        <FileText size={14} /> Markdown
      </button>
      <button class="export-item" role="menuitem" onclick={() => handleExport('html')}>
        <Code size={14} /> HTML
      </button>
      <button class="export-item" role="menuitem" onclick={() => handleExport('json')}>
        <Braces size={14} /> JSON
      </button>
    </div>
  {/if}
</div>

<style>
  .export-btn-wrap {
    position: relative;
    display: inline-flex;
  }
  .export-trigger {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .export-trigger:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .export-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 160px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
    padding: 4px;
    z-index: 100;
    animation: drop-in 0.1s ease;
  }
  @keyframes drop-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .export-label {
    padding: 6px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .export-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--foreground);
    cursor: pointer;
    transition: background 100ms ease;
    box-sizing: border-box;
  }
  .export-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .export-item :global(svg) {
    color: var(--muted);
    flex-shrink: 0;
  }
</style>
