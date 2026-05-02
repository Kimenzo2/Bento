import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLifeInColourGeneration } from './useLifeInColourGeneration';

const {
  mockStartGeneration,
  mockGetGeneration,
  mockUploadLifeInColourSource,
  mockUseColouringPagePipeline,
} = vi.hoisted(() => ({
  mockStartGeneration: vi.fn(),
  mockGetGeneration: vi.fn(),
  mockUploadLifeInColourSource: vi.fn(),
  mockUseColouringPagePipeline: vi.fn(),
}));

vi.mock('../src/services/mastraClient', () => ({
  mastra: {
    lifeInColour: {
      startGeneration: mockStartGeneration,
      getGeneration: mockGetGeneration,
    },
  },
}));

vi.mock('../services/lifeInColourStorage', () => ({
  uploadLifeInColourSource: mockUploadLifeInColourSource,
}));

vi.mock('./useColouringPagePipeline', () => ({
  useColouringPagePipeline: mockUseColouringPagePipeline,
}));

describe('useLifeInColourGeneration', () => {
  const photo = {
    name: 'memory.jpg',
    file: new File(['photo'], 'memory.jpg', { type: 'image/jpeg' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadLifeInColourSource.mockResolvedValue({
      sourcePath: 'user-1/memory.jpg',
      sourceMimeType: 'image/jpeg',
      sourceFileName: 'memory.jpg',
    });
  });

  it('returns the Andrew result when AI generation succeeds', async () => {
    mockUseColouringPagePipeline.mockReturnValue({
      phase: 'ready',
      message: 'Colouring page ready.',
      error: null,
      width: 1200,
      height: 900,
      outlinePixels: new Uint8ClampedArray(1200 * 900 * 4),
      sourceName: 'memory.jpg',
    });
    mockStartGeneration.mockResolvedValue({
      generationId: 'gen-1',
      status: 'queued',
      fallbackEligible: true,
    });
    mockGetGeneration.mockResolvedValue({
      active: false,
      fallbackEligible: true,
      generation: {
        id: 'gen-1',
        userId: 'user-1',
        status: 'ready',
        title: 'Life in Colour',
        brief: 'Keep the family scene clear.',
        outlineMode: 'detailed',
        sourceBucket: 'life-in-colour-sources',
        sourcePath: 'user-1/memory.jpg',
        sourceMimeType: 'image/jpeg',
        sourceFileName: 'memory.jpg',
        generatedBucket: 'life-in-colour-pages',
        generatedPath: 'user-1/page.png',
        generatedPublicUrl: 'https://example.com/page.png',
        provider: 'openai',
        model: 'gpt-image-1',
        normalizedPrompt: 'prompt',
        critiqueSummary: null,
        qualityFlags: null,
        fallbackEligible: true,
        errorMessage: null,
        startedAt: '2026-05-02T00:00:00.000Z',
        completedAt: '2026-05-02T00:00:01.000Z',
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:01.000Z',
      },
    });

    const { result } = renderHook(() =>
      useLifeInColourGeneration({
        photo,
        title: 'Life in Colour',
        brief: 'Keep the family scene clear.',
        outlineMode: 'detailed',
      })
    );

    await waitFor(() => {
      expect(result.current.phase).toBe('ready_ai');
    });

    expect(result.current.aiImageUrl).toBe('https://example.com/page.png');
    expect(result.current.generationId).toBe('gen-1');
  });

  it('falls back to the local pipeline when Andrew fails', async () => {
    mockUseColouringPagePipeline.mockReturnValue({
      phase: 'ready',
      message: 'Colouring page ready.',
      error: null,
      width: 1200,
      height: 900,
      outlinePixels: new Uint8ClampedArray(1200 * 900 * 4),
      sourceName: 'memory.jpg',
    });
    mockStartGeneration.mockResolvedValue({
      generationId: 'gen-2',
      status: 'queued',
      fallbackEligible: true,
    });
    mockGetGeneration.mockResolvedValue({
      active: false,
      fallbackEligible: true,
      generation: {
        id: 'gen-2',
        userId: 'user-1',
        status: 'failed',
        title: 'Life in Colour',
        brief: 'Keep the family scene clear.',
        outlineMode: 'detailed',
        sourceBucket: 'life-in-colour-sources',
        sourcePath: 'user-1/memory.jpg',
        sourceMimeType: 'image/jpeg',
        sourceFileName: 'memory.jpg',
        generatedBucket: null,
        generatedPath: null,
        generatedPublicUrl: null,
        provider: null,
        model: null,
        normalizedPrompt: null,
        critiqueSummary: null,
        qualityFlags: null,
        fallbackEligible: true,
        errorMessage: 'Andrew failed',
        startedAt: '2026-05-02T00:00:00.000Z',
        completedAt: '2026-05-02T00:00:01.000Z',
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:01.000Z',
      },
    });

    const { result } = renderHook(() =>
      useLifeInColourGeneration({
        photo,
        title: 'Life in Colour',
        brief: 'Keep the family scene clear.',
        outlineMode: 'detailed',
      })
    );

    await waitFor(() => {
      expect(result.current.phase).toBe('fallback_local');
    });

    expect(result.current.fallbackReason).toBe('Andrew failed');
    expect(result.current.localPipeline.phase).toBe('ready');
  });
});
