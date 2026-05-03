import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SavedBook } from '../../types';
import { VideoExporter } from './VideoExporter';

const createBook = (): SavedBook => ({
  id: 'book-1',
  title: 'Adventure Story',
  project: {
    title: 'Adventure Story',
    genre: 'Adventure',
    setting: 'Ocean',
    writingStyle: 'Playful',
    ageGroup: '8-10',
    totalChapters: 1,
    totalPages: 2,
    realm: 'kingdom',
    chapters: [
      {
        chapterNumber: 1,
        title: 'Start',
        summary: 'A beginning',
        pages: [
          {
            pageNumber: 1,
            title: 'Page One',
            content: 'Once upon a time',
            imageUrl: 'https://example.com/1.png',
          },
          {
            pageNumber: 2,
            title: 'Page Two',
            content: 'The next scene',
            imageUrl: 'https://example.com/2.png',
          },
        ],
      },
    ],
    characters: [],
    plotOutline: [],
    educationalGoals: [],
    coverImage: null,
    language: 'English',
    readingTime: 6,
    keyThemes: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('VideoExporter', () => {
  it('exports through worker and returns mp4 blob metadata', async () => {
    let onMessage: ((event: { data: any }) => void) | null = null;
    let postedConfig: any;

    class WorkerMock {
      onmessage: ((event: { data: any }) => void) | null = null;
      onerror: ((event: { message: string }) => void) | null = null;

      postMessage(message: any): void {
        postedConfig = message.config;
        onMessage = this.onmessage;
      }

      terminate(): void {}
    }

    vi.stubGlobal('Worker', WorkerMock as any);

    const exporter = new VideoExporter();
    const promise = exporter.export(createBook(), 'CREATOR');

    onMessage?.({
      data: {
        type: 'complete',
        buffer: new Uint8Array([1, 2, 3]).buffer,
      },
    });

    const result = await promise;
    expect(postedConfig.pages).toHaveLength(2);
    expect(result.filename).toBe('adventure-story.mp4');
    expect(result.blob.type).toBe('video/mp4');
  });

  it('uses high quality defaults for studio and empire tiers', async () => {
    let onMessage: ((event: { data: any }) => void) | null = null;
    let postedConfig: any;

    class WorkerMock {
      onmessage: ((event: { data: any }) => void) | null = null;

      postMessage(message: any): void {
        postedConfig = message.config;
        onMessage = this.onmessage;
      }

      terminate(): void {}
    }

    vi.stubGlobal('Worker', WorkerMock as any);

    const exporter = new VideoExporter();
    const promise = exporter.export(createBook(), 'STUDIO');

    onMessage?.({
      data: {
        type: 'complete',
        buffer: new Uint8Array([1]).buffer,
      },
    });

    await promise;
    expect(postedConfig.quality).toBe('high');
  });

  it('falls back to media recorder when worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined as any);

    const exporter = new VideoExporter();
    const fallbackSpy = vi.spyOn(exporter as any, 'exportWithMediaRecorder').mockResolvedValue({
      blob: new Blob(['x'], { type: 'video/webm' }),
      filename: 'fallback.webm',
    });

    const result = await exporter.export(createBook(), 'SPARK');

    expect(fallbackSpy).toHaveBeenCalledOnce();
    expect(result.filename).toBe('fallback.webm');
  });
});
