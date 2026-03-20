import type { SavedBook, UserTier } from '../../types';
import type { ExportJobConfig, WorkerMessage, WorkerResponse } from '../workers/export.worker';

export interface ExportResult {
  blob: Blob;
  filename: string;
}

export interface ExportOptions {
  fps?: number;
  quality?: 'standard' | 'high';
  onProgress?: (progress: number, stage: string) => void;
}

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

export class VideoExporter {
  async export(
    book: SavedBook,
    tier: UserTier,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const pages = book.project.chapters.flatMap((chapter) => chapter.pages);
    const pagesWithImages = pages
      .filter((page) => page.imageUrl)
      .map((page) => ({
        illustrationUrl: page.imageUrl as string,
        pageNumber: page.pageNumber,
        text: page.text,
      }));

    if (pagesWithImages.length === 0) {
      throw new Error('No illustrations found. Generate images before exporting video.');
    }

    const config: ExportJobConfig = {
      title: book.title,
      pages: pagesWithImages,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fps: options.fps ?? 24,
      durationPerPage: 3,
      transitionDuration: 0.8,
      realm: inferRealm(book),
      quality: options.quality ?? (tier === 'STUDIO' || tier === 'EMPIRE' ? 'high' : 'standard'),
      tier,
    };

    if (this.isSafari() || typeof Worker === 'undefined') {
      return this.exportWithMediaRecorder(config, options.onProgress);
    }

    return this.exportWithWorker(config, options.onProgress);
  }

  private exportWithWorker(
    config: ExportJobConfig,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), {
        type: 'module',
      });

      const cleanup = (): void => {
        worker.terminate();
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === 'progress') {
          onProgress?.(data.percent, data.stage);
          return;
        }

        if (data.type === 'complete') {
          const blob = new Blob([data.buffer], { type: 'video/mp4' });
          cleanup();
          resolve({
            blob,
            filename: this.sanitizeFilename(config.title) + '.mp4',
          });
          return;
        }

        cleanup();
        reject(new Error(data.message));
      };

      worker.onerror = (error) => {
        cleanup();
        reject(new Error(error.message || 'Video export worker failed'));
      };

      const message: WorkerMessage = { type: 'start', config };
      worker.postMessage(message);
    });
  }

  private async exportWithMediaRecorder(
    config: ExportJobConfig,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ExportResult> {
    onProgress?.(0, 'Preparing Safari fallback export...');

    if (typeof document === 'undefined') {
      throw new Error('MediaRecorder fallback requires a browser environment.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Unable to create canvas context for fallback export.');
    }

    const stream = canvas.captureStream(config.fps);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: this.getFallbackMimeType(),
      videoBitsPerSecond: config.quality === 'high' ? 6_000_000 : 3_000_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();

    const images = await Promise.all(
      config.pages.map(async (page) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = page.illustrationUrl;
        await image.decode();
        return image;
      })
    );

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image) continue;

      ctx.clearRect(0, 0, config.width, config.height);
      ctx.drawImage(image, 0, 0, config.width, config.height);

      const progress = Math.round((i / images.length) * 100);
      onProgress?.(progress, `Rendering page ${i + 1} of ${images.length}...`);

      await wait(config.durationPerPage * 1000);
    }

    recorder.stop();
    await stopped;

    const mimeType = chunks[0]?.type || this.getFallbackMimeType();
    const blob = new Blob(chunks, { type: mimeType });

    onProgress?.(100, 'Complete!');

    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    return {
      blob,
      filename: `${this.sanitizeFilename(config.title)}.${extension}`,
    };
  }

  private sanitizeFilename(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'storybook-export';
  }

  private isSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  }

  private getFallbackMimeType(): string {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
      return 'video/mp4;codecs=h264';
    }

    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      return 'video/webm;codecs=vp9';
    }

    return 'video/webm';
  }
}

function inferRealm(book: SavedBook): 'kingdom' | 'cosmos' | 'cell' {
  const candidate = (book as unknown as { project?: { realm?: string } }).project?.realm;
  if (candidate === 'kingdom' || candidate === 'cosmos' || candidate === 'cell') {
    return candidate;
  }

  return 'kingdom';
}

export async function generateVideo(
  book: SavedBook,
  tier: UserTier,
  onProgress?: (progress: number, stage: string) => void
): Promise<void> {
  const exporter = new VideoExporter();
  const result = await exporter.export(book, tier, { onProgress });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(result.blob);
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
