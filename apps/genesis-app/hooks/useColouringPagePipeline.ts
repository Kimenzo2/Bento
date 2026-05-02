import { useEffect, useState } from 'react';
import {
  buildColouringPageOutline,
  fitContainDimensions,
  type ImageDataLike,
} from '../src/lib/colouringPagePipeline';

export interface ColouringPageSource {
  file: File | null;
  name: string;
}

export interface ColouringPagePipelineState {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  error: Error | null;
  width: number;
  height: number;
  outlinePixels: Uint8ClampedArray | null;
  sourceName: string | null;
}

const INITIAL_STATE: ColouringPagePipelineState = {
  phase: 'idle',
  message: '',
  error: null,
  width: 0,
  height: 0,
  outlinePixels: null,
  sourceName: null,
};

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });
}

async function decodeSourceFile(file: File) {
  const decodeWithImageElement = async () => {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.decoding = 'async';
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => {
          reject(new Error('Unable to decode the selected image.'));
        };
        nextImage.src = objectUrl;
      });

      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        throw new Error('The selected image could not be read.');
      }

      return {
        source: image as CanvasImageSource,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(objectUrl),
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  };

  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file);

      if (bitmap.width <= 0 || bitmap.height <= 0) {
        bitmap.close();
        throw new Error('The selected image could not be read.');
      }

      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch (bitmapError) {
      try {
        return await decodeWithImageElement();
      } catch (fallbackError) {
        const bitmapMessage = bitmapError instanceof Error ? bitmapError.message : 'Bitmap decoding failed.';
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Image element decoding failed.';

        throw new Error(
          `Unable to decode the selected image. ${bitmapMessage} ${fallbackMessage} Try exporting the file as JPG or PNG.`
        );
      }
    }
  }

  try {
    return await decodeWithImageElement();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to decode the selected image.';
    throw new Error(`${message} Try exporting the file as JPG or PNG.`);
  }
}

export function useColouringPagePipeline(
  sourcePhoto: ColouringPageSource | null,
  maxDimension = 1200
): ColouringPagePipelineState {
  const [state, setState] = useState<ColouringPagePipelineState>(INITIAL_STATE);

  useEffect(() => {
    if (!sourcePhoto?.file || typeof window === 'undefined') {
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;
    const file = sourcePhoto.file;

    const runPipeline = async () => {
      try {
        setState({
          phase: 'loading',
          message: 'Decoding photo...',
          error: null,
          width: 0,
          height: 0,
          outlinePixels: null,
          sourceName: sourcePhoto.name,
        });

        await waitForFrame();

        const decodedSource = await decodeSourceFile(file);

        if (cancelled) {
          decodedSource.dispose();
          return;
        }

        setState({
          phase: 'loading',
          message: 'Tracing outlines...',
          error: null,
          width: 0,
          height: 0,
          outlinePixels: null,
          sourceName: sourcePhoto.name,
        });

        await waitForFrame();

        const dimensions = fitContainDimensions(decodedSource.width, decodedSource.height, maxDimension);
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const context = canvas.getContext('2d');
        if (!context) {
          decodedSource.dispose();
          throw new Error('Unable to access a 2D canvas context.');
        }

        try {
          context.clearRect(0, 0, dimensions.width, dimensions.height);
          context.drawImage(decodedSource.source, 0, 0, dimensions.width, dimensions.height);

          const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height) as ImageDataLike;
          const outline = buildColouringPageOutline(imageData);

          if (cancelled) {
            return;
          }

          setState({
            phase: 'ready',
            message: 'Colouring page ready.',
            error: null,
            width: outline.width,
            height: outline.height,
            outlinePixels: outline.outlinePixels,
            sourceName: sourcePhoto.name,
          });
        } finally {
          decodedSource.dispose();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to process the image.';
        setState({
          phase: 'error',
          message,
          error: error instanceof Error ? error : new Error(message),
          width: 0,
          height: 0,
          outlinePixels: null,
          sourceName: sourcePhoto.name,
        });
      }
    };

    void runPipeline();

    return () => {
      cancelled = true;
    };
  }, [maxDimension, sourcePhoto?.file, sourcePhoto?.name]);

  return state;
}
