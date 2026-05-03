import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColoringOutlineMode, LifeInColourGenerationRecord } from '../types';
import { mastra } from '../src/services/mastraClient';
import { useColouringPagePipeline } from './useColouringPagePipeline';
import { uploadLifeInColourSource } from '../services/lifeInColourStorage';

const POLL_INTERVAL_MS = 1800;
const POLL_TIMEOUT_MS = 120000;

export interface LifeInColourSourcePhoto {
  file: File;
  name: string;
}

export interface LifeInColourGenerationHookState {
  phase: 'idle' | 'uploading' | 'generating_ai' | 'ready_ai' | 'fallback_local' | 'error';
  message: string;
  errorMessage: string | null;
  generationId: string | null;
  generation: LifeInColourGenerationRecord | null;
  active: boolean;
  aiImageUrl: string | null;
  fallbackReason: string | null;
  localPipeline: ReturnType<typeof useColouringPagePipeline>;
}

interface UseLifeInColourGenerationInput {
  photo: LifeInColourSourcePhoto | null;
  title: string;
  brief: string;
  outlineMode: ColoringOutlineMode;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildGenerationMessage(record: LifeInColourGenerationRecord | null): string {
  if (!record) {
    return 'Preparing Andrew.';
  }

  if (record.status === 'queued') {
    return 'Uploading the source image to Andrew.';
  }

  if (record.status === 'processing') {
    return 'Andrew is drawing the colouring page.';
  }

  if (record.status === 'ready') {
    if (record.retryCount > 0) {
      return `Andrew finished the colouring page after ${record.retryCount} repair pass${record.retryCount === 1 ? '' : 'es'}.`;
    }

    return 'Andrew finished the colouring page.';
  }

  return record.errorMessage || 'Andrew could not finish this image.';
}

export function useLifeInColourGeneration({
  photo,
  title,
  brief,
  outlineMode,
}: UseLifeInColourGenerationInput): LifeInColourGenerationHookState {
  const localPipeline = useColouringPagePipeline(photo);
  const localPipelineRef = useRef(localPipeline);
  const [phase, setPhase] = useState<LifeInColourGenerationHookState['phase']>('idle');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generation, setGeneration] = useState<LifeInColourGenerationRecord | null>(null);
  const [active, setActive] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [pendingFallbackReason, setPendingFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    localPipelineRef.current = localPipeline;
  }, [localPipeline]);

  useEffect(() => {
    if (!pendingFallbackReason) {
      return;
    }

    if (localPipeline.phase === 'ready') {
      setPhase('fallback_local');
      setMessage('Andrew was unavailable. Using the browser fallback page.');
      setErrorMessage(null);
      setActive(false);
      setPendingFallbackReason(pendingFallbackReason);
      return;
    }

    if (localPipeline.phase === 'error') {
      setPhase('error');
      setMessage(pendingFallbackReason);
      setErrorMessage(pendingFallbackReason);
      setActive(false);
    }
  }, [localPipeline.phase, pendingFallbackReason]);

  useEffect(() => {
    if (!photo) {
      setPhase('idle');
      setMessage('');
      setErrorMessage(null);
      setGenerationId(null);
      setGeneration(null);
      setActive(false);
      setAiImageUrl(null);
      setPendingFallbackReason(null);
      return;
    }

    let cancelled = false;

    const failWithFallback = (nextMessage: string) => {
      if (cancelled) {
        return;
      }

      const currentLocal = localPipelineRef.current;
      if (currentLocal.phase === 'ready') {
        setPhase('fallback_local');
        setMessage('Andrew was unavailable. Using the browser fallback page.');
        setErrorMessage(null);
        setActive(false);
        setPendingFallbackReason(nextMessage);
        return;
      }

      if (currentLocal.phase === 'loading' || currentLocal.phase === 'idle') {
        setPhase('generating_ai');
        setMessage('Andrew could not finish the page. Preparing the browser fallback.');
        setErrorMessage(null);
        setActive(false);
        setPendingFallbackReason(nextMessage);
        return;
      }

      setPhase('error');
      setMessage(nextMessage);
      setErrorMessage(nextMessage);
      setActive(false);
    };

    const run = async () => {
      try {
        setPhase('uploading');
        setMessage('Uploading the photo for Andrew.');
        setErrorMessage(null);
        setGenerationId(null);
        setGeneration(null);
        setActive(true);
        setAiImageUrl(null);
        setPendingFallbackReason(null);

        const uploaded = await uploadLifeInColourSource(photo.file);
        if (cancelled) {
          return;
        }

        const started = await mastra.lifeInColour.startGeneration({
          title: title.trim(),
          brief: brief.trim(),
          outlineMode,
          sourcePath: uploaded.sourcePath,
          sourceMimeType: uploaded.sourceMimeType,
          sourceFileName: uploaded.sourceFileName,
        });

        if (cancelled) {
          return;
        }

        setGenerationId(started.generationId);
        setPhase('generating_ai');
        setMessage('Andrew is drawing the colouring page.');

        const startedAt = Date.now();

        while (!cancelled) {
          const response = await mastra.lifeInColour.getGeneration(started.generationId);
          if (cancelled) {
            return;
          }

          setGeneration(response.generation);
          setActive(response.active);
          setMessage(buildGenerationMessage(response.generation));

          if (response.generation.status === 'ready' && response.generation.generatedPublicUrl) {
            setAiImageUrl(response.generation.generatedPublicUrl);
            setPhase('ready_ai');
            setMessage('Andrew finished the colouring page.');
            setErrorMessage(null);
            return;
          }

          if (response.generation.status === 'failed') {
            failWithFallback(
              response.generation.errorMessage || 'Andrew could not finish this page.'
            );
            return;
          }

          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            failWithFallback('Andrew timed out before finishing the page.');
            return;
          }

          await sleep(POLL_INTERVAL_MS);
        }
      } catch (error) {
        const nextMessage =
          error instanceof Error ? error.message : 'Andrew could not finish this page.';
        failWithFallback(nextMessage);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [brief, outlineMode, photo, title]);

  return useMemo(
    () => ({
      phase,
      message,
      errorMessage,
      generationId,
      generation,
      active,
      aiImageUrl,
      fallbackReason: pendingFallbackReason,
      localPipeline,
    }),
    [
      active,
      aiImageUrl,
      errorMessage,
      generation,
      generationId,
      localPipeline,
      message,
      pendingFallbackReason,
      phase,
    ]
  );
}
