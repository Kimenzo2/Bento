<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { EmbedProcessor } from '$lib/local-store/block';
  import { editorStore } from '$lib/local-store/store';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { block, readonly = false }: { block: Block; readonly?: boolean } = $props();

  let isEditing = $state(false);
  let editText = $state('');

  let processor = $derived((block.content as any)?.processor ?? EmbedProcessor.Latex);
  let displayText = $derived((block.content as any)?.text ?? '');

  // ── Lazy-load KaTeX — CDN fallback, no npm install required ────────
  let katex: any = null;
  async function loadKatex() {
    if (katex) return katex;
    try {
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';
      const m = await import(/* @vite-ignore */ cdnUrl);
      katex = m.default || m;
    } catch {
    }
    return katex;
  }

  // ── Processor meta ─────────────────────────────────────────────────
  const PROCESSOR_NAMES: Record<number, string> = {
    [EmbedProcessor.Latex]: 'LaTeX',
    [EmbedProcessor.Mermaid]: 'Mermaid',
    [EmbedProcessor.Chart]: 'Chart',
    [EmbedProcessor.Youtube]: 'YouTube',
    [EmbedProcessor.Vimeo]: 'Vimeo',
    [EmbedProcessor.Soundcloud]: 'SoundCloud',
    [EmbedProcessor.GoogleMaps]: 'Google Maps',
    [EmbedProcessor.Miro]: 'Miro',
    [EmbedProcessor.Figma]: 'Figma',
    [EmbedProcessor.Twitter]: 'Twitter/X',
    [EmbedProcessor.GithubGist]: 'GitHub Gist',
    [EmbedProcessor.Codepen]: 'CodePen',
    [EmbedProcessor.Excalidraw]: 'Excalidraw',
    [EmbedProcessor.Spotify]: 'Spotify',
  };

  const IFRAME_PROCESSORS = new Set([
    EmbedProcessor.Youtube, EmbedProcessor.Vimeo, EmbedProcessor.Soundcloud,
    EmbedProcessor.GoogleMaps, EmbedProcessor.Miro, EmbedProcessor.Figma,
    EmbedProcessor.Twitter, EmbedProcessor.GithubGist, EmbedProcessor.Codepen,
    EmbedProcessor.Spotify,
  ]);

  function getEmbedUrl(text: string, processor: EmbedProcessor): string | null {
    switch (processor) {
      case EmbedProcessor.Youtube: {
        const m = text.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/);
        return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
      }
      case EmbedProcessor.Vimeo: {
        const m = text.match(/vimeo\.com\/(\d+)/);
        return m ? `https://player.vimeo.com/video/${m[1]}` : null;
      }
      case EmbedProcessor.Soundcloud:
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(text)}&auto_play=false`;
      case EmbedProcessor.Spotify: {
        const m = text.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
        return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
      }
      case EmbedProcessor.Figma:
        return `https://www.figma.com/embed?embed_host=bento&url=${encodeURIComponent(text)}`;
      case EmbedProcessor.Miro: {
        const m = text.match(/miro\.com\/app\/board\/([^/?]+)/);
        return m ? `https://miro.com/app/live-embed/${m[1]}/` : null;
      }
      case EmbedProcessor.GoogleMaps:
        return `https://maps.google.com/maps?q=${encodeURIComponent(text)}&output=embed`;
      default:
        return null;
    }
  }

  let valueEl = $state<HTMLDivElement>()!;

  async function renderLatex() {
    if (!valueEl || processor !== EmbedProcessor.Latex) return;
    const k = await loadKatex();
    if (!k) return;
    try {
      valueEl.innerHTML = k.renderToString(displayText, {
        displayMode: true, strict: false, throwOnError: true,
        output: 'html', fleqn: true,
      });
    } catch (e: any) {
      valueEl.innerHTML = `<div class="embed-error">LaTeX Error: ${String(e?.message || e)}</div>`;
    }
  }

  let mermaidInstance: any = null;
  async function loadMermaid() {
    if (mermaidInstance) return mermaidInstance;
    try {
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
      const m = await import(/* @vite-ignore */ cdnUrl);
      mermaidInstance = m.default || m;
      if (mermaidInstance) mermaidInstance.initialize({ startOnLoad: false, theme: 'dark' });
    } catch {
    }
    return mermaidInstance;
  }

  async function renderMermaid() {
    if (!valueEl || processor !== EmbedProcessor.Mermaid) return;
    const mermaid = await loadMermaid();
    if (!mermaid) {
      valueEl.innerHTML = `<div class="embed-error">Mermaid library failed to load from CDN</div>`;
      return;
    }
    try {
      const id = `mermaid-${block.id}`;
      const { svg } = await mermaid.render(id, displayText);
      valueEl.innerHTML = svg;
    } catch (e) {
      valueEl.innerHTML = `<div class="embed-error">Mermaid Error: ${String(e)}</div>`;
    }
  }

  function renderIframe() {
    if (!valueEl) return;
    const src = getEmbedUrl(displayText, processor);
    if (!src) {
      valueEl.innerHTML = `<div class="embed-empty"><span>${PROCESSOR_NAMES[processor] || 'Embed'}</span><p>Paste a URL to embed</p></div>`;
      return;
    }
    let iframe = valueEl.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
      valueEl.innerHTML = '';
      valueEl.appendChild(iframe);
    }
    iframe.src = src;
  }

  async function render() {
    if (!displayText && processor !== EmbedProcessor.Excalidraw) {
      if (valueEl) valueEl.innerHTML = '';
      return;
    }
    if (processor === EmbedProcessor.Latex) {
      await renderLatex();
    } else if (processor === EmbedProcessor.Mermaid) {
      await renderMermaid();
    } else if (IFRAME_PROCESSORS.has(processor)) {
      renderIframe();
    }
  }

  let nodeEl: HTMLDivElement;

  $effect(() => {
    if (displayText && !isEditing && valueEl) {
      render();
    }
  });

  function startEdit(e: MouseEvent) {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    editText = displayText;
    isEditing = true;
  }

  async function saveEdit() {
    await editorStore.setBlockContent(block.id as string, { ...(block.content as any || {}), text: editText });
    isEditing = false;
  }

  function handleEditKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
  }

  const processorName = $derived(PROCESSOR_NAMES[processor] ?? 'Embed');
  const placeholder = $derived(processor === EmbedProcessor.Latex
    ? 'Enter LaTeX…'
    : processor === EmbedProcessor.Mermaid
      ? 'Enter Mermaid diagram…'
      : `Paste ${processorName} URL…`);
</script>

<div class="block-embed" bind:this={nodeEl} class:is-editing={isEditing} class:is-empty={!displayText}>
  {#if isEditing}
    <div class="embed-editor">
      <div class="embed-editor-header">
        <span class="embed-editor-label">{processorName}</span>
        <button class="embed-editor-save" onclick={saveEdit}>Done</button>
      </div>
      <textarea
        class="embed-editor-input"
        bind:value={editText}
        placeholder={placeholder}
        onkeydown={handleEditKey}
        rows={6}
        spellcheck={false}
      ></textarea>
    </div>
  {:else}
    {#if !displayText}
      <div class="embed-empty" role="button" tabindex="0" onclick={startEdit} onkeydown={(e) => e.key === 'Enter' && startEdit(e as any)}>
        <div class="embed-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <p class="embed-empty-text">{placeholder}</p>
      </div>
    {:else}
      <div class="embed-value" bind:this={valueEl}></div>

      {#if !readonly}
        <button class="embed-source-btn" onclick={startEdit} use:tooltip={{ text: "Edit source" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .block-embed {
    position: relative;
    width: 100%;
    max-width: 100%;
    border-radius: 10px;
    overflow: hidden;
  }

  .embed-value {
    min-height: 40px;
    padding: 8px 0;
    overflow-x: auto;
    max-width: 100%;
  }

  .embed-value :global(iframe) {
    width: 100%;
    max-width: 100%;
    height: 360px;
    border: none;
    border-radius: 8px;
    display: block;
  }

  @media (max-width: 600px) {
    .embed-value :global(iframe) {
      height: 240px;
    }
  }

  .embed-value :global(.embed-error) {
    padding: 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--destructive, oklch(0.637 0.208 25.331)) 10%, transparent);
    color: var(--destructive, oklch(0.637 0.208 25.331));
    font-family: monospace;
    font-size: 0.85rem;
  }

  .embed-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 24px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    cursor: pointer;
    color: var(--muted);
    text-align: center;
    transition: background 0.15s;
  }

  .embed-empty:hover { background: color-mix(in srgb, var(--foreground) 3%, transparent); }
  .embed-empty-icon { opacity: 0.5; }
  .embed-empty-text { margin: 0; font-size: 0.9rem; }

  .embed-source-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--background);
    color: var(--muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .block-embed:hover .embed-source-btn { opacity: 1; }

  .embed-editor {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface);
  }

  .embed-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 90%, var(--background));
  }

  .embed-editor-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .embed-editor-save {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: var(--primary-foreground, oklch(1 0 89.876));
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }

  .embed-editor-input {
    width: 100%;
    max-width: 100%;
    padding: 14px;
    border: none;
    background: transparent;
    color: var(--foreground);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88rem;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }
</style>
