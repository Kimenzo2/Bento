<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { FileState, FileType, EmbedProcessor } from '$lib/local-store/block';

  export let block: Block;
  // rootId and readonly accepted via $$restProps

  let content = block.content as any;
  let fileState: FileState = content?.state ?? FileState.Empty;
  let fileType: FileType = content?.type ?? FileType.None;
  let targetObjectId: string = content?.targetObjectId ?? '';
  let fileName: string = content?.name ?? '';
  let fileSize: number = content?.size ?? 0;
  let fileMime: string = content?.mime ?? '';
  let processor: EmbedProcessor = content?.processor ?? (0 as EmbedProcessor);

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  // Get embed iframe URL
  function getEmbedUrl(): string | null {
    const targetId = targetObjectId;
    if (!targetId) return null;

    switch (processor) {
      case EmbedProcessor.Youtube:
        return `https://www.youtube-nocookie.com/embed/${targetId}`;
      case EmbedProcessor.Vimeo:
        return `https://player.vimeo.com/video/${targetId}`;
      case EmbedProcessor.Soundcloud:
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(targetId)}`;
      case EmbedProcessor.Twitter:
        return `https://platform.twitter.com/embed/Tweet.html?id=${targetId}`;
      case EmbedProcessor.GithubGist:
        return `https://github.com/${targetId}`;
      default:
        return null;
    }
  }
</script>

<div class="block-file">
  {#if fileType === FileType.Image || fileMime.startsWith('image/')}
    <div class="file-image">
      <div class="file-preview">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Image Preview</span>
      </div>
      {#if fileName}
        <div class="file-meta">
          <span class="file-name">{fileName}</span>
          <span class="file-size">{formatSize(fileSize)}</span>
        </div>
      {/if}
    </div>

  {:else if processor !== (0 as EmbedProcessor)}
    {@const embedUrl = getEmbedUrl()}
    {#if embedUrl}
      <div class="file-embed">
        <iframe
          src={embedUrl}
          title={fileName || 'Embed'}
          loading="lazy"
          allowfullscreen
          class="embed-frame"
        ></iframe>
      </div>
    {:else}
      <div class="file-embed file-embed-generic">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>Linked content: {targetObjectId}</span>
      </div>
    {/if}

  {:else if fileType === FileType.Pdf || fileMime === 'application/pdf'}
    <div class="file-pdf">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <div class="file-info">
        <span class="file-name">{fileName || 'Document.pdf'}</span>
        <span class="file-size">{formatSize(fileSize)}</span>
      </div>
    </div>

  {:else}
    <div class="file-generic">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <div class="file-info">
        <span class="file-name">{fileName || 'File'}</span>
        {#if fileSize > 0}
          <span class="file-size">{formatSize(fileSize)}</span>
        {/if}
        {#if fileMime}
          <span class="file-mime">{fileMime}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .block-file {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    transition: box-shadow 0.2s;
  }

  .file-image {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }

  .file-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
    border-radius: 8px;
    background: var(--muted-surface);
    color: var(--muted);
    font-size: 0.9rem;
  }

  .file-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85rem;
  }

  .file-name {
    font-weight: 600;
    color: var(--foreground);
    word-break: break-all;
  }

  .file-size,
  .file-mime {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .file-pdf,
  .file-generic {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--muted);
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-embed {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
  }

  .embed-frame {
    width: 100%;
    height: 360px;
    border: none;
    border-radius: 12px;
  }

  .file-embed-generic {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>
