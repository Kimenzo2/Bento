/**
 * IllustrationCanvas
 *
 * Replaces img for illustration display.
 * Uses WebGPU for GPU-accelerated effects where available.
 */

import { useEffect, useRef, useState } from 'react';
import type { Realm } from '@lorenzootieno/gen-bridge';

interface IllustrationCanvasProps {
  src: string;
  width: number;
  height: number;
  realm: Realm;
  alt?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function IllustrationCanvas({
  src,
  width,
  height,
  realm,
  alt = '',
  className,
  onLoad,
  onError,
}: IllustrationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src || !containerRef.current) return;

    let cancelled = false;

    const process = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const gpuModule = await import('../engine/IllustrationGPU');
        const gpu = await gpuModule.getIllustrationGPU(realm);
        const result = await gpu.process(src, width, height);

        if (cancelled) {
          result.dispose();
          return;
        }

        const container = containerRef.current;
        if (!container) {
          result.dispose();
          return;
        }

        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        disposeRef.current?.();
        disposeRef.current = result.dispose;

        if (result.canvas instanceof HTMLCanvasElement) {
          result.canvas.style.width = '100%';
          result.canvas.style.height = '100%';
          result.canvas.style.display = 'block';
          result.canvas.setAttribute('aria-label', alt);
          container.appendChild(result.canvas);
        } else {
          const displayCanvas = document.createElement('canvas');
          displayCanvas.width = width;
          displayCanvas.height = height;
          displayCanvas.style.width = '100%';
          displayCanvas.style.height = '100%';
          displayCanvas.style.display = 'block';
          displayCanvas.setAttribute('aria-label', alt);

          const bitmap =
            typeof result.canvas.transferToImageBitmap === 'function'
              ? result.canvas.transferToImageBitmap()
              : await createImageBitmap(result.canvas);

          const bitmapRenderer = displayCanvas.getContext('bitmaprenderer');
          if (bitmapRenderer) {
            bitmapRenderer.transferFromImageBitmap(bitmap);
          } else {
            const ctx = displayCanvas.getContext('2d');
            if (!ctx) {
              throw new Error('Unable to render OffscreenCanvas output');
            }
            ctx.drawImage(bitmap, 0, 0, width, height);
            bitmap.close();
          }

          container.appendChild(displayCanvas);
        }

        setIsLoading(false);
        onLoad?.();
      } catch (error) {
        if (cancelled) return;
        setIsLoading(false);
        setHasError(true);
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
      }
    };

    void process();

    return () => {
      cancelled = true;
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, [src, realm, width, height, alt, onLoad, onError]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${isLoading ? 'bg-surface' : 'bg-transparent'} ${className ?? ''}`}
      role="img"
      aria-label={alt}
    >
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-cocoa-light">
          Illustration unavailable
        </div>
      )}
    </div>
  );
}
