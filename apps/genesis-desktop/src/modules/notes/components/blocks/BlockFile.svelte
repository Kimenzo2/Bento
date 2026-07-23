<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { FileState, FileType, EmbedProcessor } from '$lib/local-store/block';
  import { editorStore } from '$lib/local-store/store';

  let { block }: { block: Block } = $props();

  let content = $derived(block.content as any);
  let fileState: FileState = $derived(content?.state ?? FileState.Empty);
  let fileType: FileType = $derived(content?.type ?? FileType.None);
  let targetObjectId: string = $derived(content?.targetObjectId ?? '');
  let fileName: string = $derived(content?.name ?? '');
  let fileSize: number = $derived(content?.size ?? 0);
  let fileMime: string = $derived(content?.mime ?? '');
  let processor: EmbedProcessor = $derived(content?.processor ?? (0 as EmbedProcessor));

  let fileSrc = $state('');
  let convertFileSrc: ((path: string) => string) | null = null;

  $effect(() => {
    const oid = targetObjectId;
    if (!oid) { fileSrc = ''; return; }
    if (convertFileSrc) {
      fileSrc = convertFileSrc(oid);
    } else {
      import('@tauri-apps/api/core').then(({ convertFileSrc: cfs }) => {
        convertFileSrc = cfs;
        fileSrc = cfs(oid);
      }).catch(() => { fileSrc = ''; });
    }
  });

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

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

  async function handleFilePick() {
    if (!block.id) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filters = fileType === FileType.Image
        ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }]
        : fileType === FileType.Video
          ? [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }]
          : fileType === FileType.Audio
            ? [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] }]
            : [{ name: 'All files', extensions: ['*'] }];
      const selected = await open({ multiple: false, filters });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : (Array.isArray(selected) ? selected[0] : '');
      if (!filePath) return;
      const name = filePath.split(/[\\/]/).pop() || 'file';
      const ext = name.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', mp4: 'video/mp4', webm: 'video/webm',
        mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
        pdf: 'application/pdf',
      };
      await editorStore.setBlockContent(block.id, {
        ...(block.content as any || {}),
        state: FileState.Done,
        targetObjectId: filePath,
        name,
        mime: mimeMap[ext] || 'application/octet-stream',
      } as any);
    } catch (e) {
      console.error('[BlockFile] file pick error:', e);
    }
  }
</script>

<div class="block-file">
  {#if fileState === FileState.Empty}
    <div class="file-empty" role="button" tabindex="0" onclick={handleFilePick} onkeydown={(e) => e.key === 'Enter' && handleFilePick()}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        {#if fileType === FileType.Image}
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        {:else if fileType === FileType.Video}
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        {:else}
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        {/if}
      </svg>
      <span>
        {fileType === FileType.Image ? 'Click to select an image' : fileType === FileType.Video ? 'Click to select a video' : 'Click to select a file'}
      </span>
      <span class="file-empty-hint">Opens file browser</span>
    </div>

  {:else if fileType === FileType.Image || fileMime.startsWith('image/')}
    <div class="file-image">
      <div class="file-preview">
        {#if fileSrc}
          <img src={fileSrc} alt={fileName} class="file-image-src" loading="lazy" />
        {:else}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Image Preview</span>
        {/if}
      </div>
      {#if fileName}
        <div class="file-meta">
          <span class="file-name">{fileName}</span>
          <span class="file-size">{formatSize(fileSize)}</span>
        </div>
      {/if}
    </div>

  {:else if fileType === FileType.Video || fileMime.startsWith('video/')}
    <div class="file-video">
      {#if fileSrc}
        <video controls class="file-video-src" preload="metadata">
          <source src={fileSrc} type={fileMime || 'video/mp4'} />
        </video>
      {:else}
        <div class="file-preview">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <span>Video Preview</span>
        </div>
      {/if}
      {#if fileName}
        <div class="file-meta">
          <span class="file-name">{fileName}</span>
        </div>
      {/if}
    </div>

  {:else if fileType === FileType.Audio || fileMime.startsWith('audio/')}
    <div class="file-audio">
      {#if fileSrc}
        <audio controls class="file-audio-src" preload="metadata">
          <source src={fileSrc} type={fileMime || 'audio/mpeg'} />
        </audio>
      {:else}
        <div class="file-preview">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <span>Audio file</span>
        </div>
      {/if}
      {#if fileName}
        <div class="file-meta">
          <span class="file-name">{fileName}</span>
        </div>
      {/if}
    </div>

  {:else if processor !== (0 as EmbedProcessor)}
    {const embedUrl = getEmbedUrl()}
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
    max-width: 100%;
    border-radius: 12px;
    overflow: hidden;
    transition: box-shadow 0.2s;
  }

  .file-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }

  .file-empty:hover { background: color-mix(in srgb, var(--foreground) 3%, transparent); }
  .file-empty-hint { font-size: 0.75rem; opacity: 0.6; }

  .file-image {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    min-width: 0;
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
    overflow: hidden;
  }

  .file-image-src {
    width: 100%;
    height: auto;
    max-height: 480px;
    object-fit: contain;
    border-radius: 8px;
    display: block;
  }

  .file-video, .file-audio {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface);
  }

  .file-video-src {
    width: 100%;
    max-width: 100%;
    display: block;
    border-radius: 12px 12px 0 0;
  }

  .file-audio-src {
    width: 100%;
    display: block;
    padding: 16px;
    box-sizing: border-box;
  }

  .file-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85rem;
    padding: 0 4px;
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
    min-width: 0;
  }

  .file-embed {
    width: 100%;
    max-width: 100%;
    border-radius: 12px;
    overflow: hidden;
  }

  .embed-frame {
    width: 100%;
    max-width: 100%;
    height: 360px;
    border: none;
    border-radius: 12px;
    display: block;
  }

  @media (max-width: 600px) {
    .embed-frame {
      height: 240px;
    }
  }

  .file-embed-generic {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }
</style>
