/// <reference lib="webworker" />

import type { Page, UserTier } from '../../types';

export interface ExportJobConfig {
  title: string;
  pages: Array<{
    illustrationUrl: string;
    pageNumber: number;
    text?: string;
  }>;
  width: number;
  height: number;
  fps: number;
  durationPerPage: number;
  transitionDuration: number;
  realm: 'kingdom' | 'cosmos' | 'cell' | string;
  quality: 'standard' | 'high';
  tier: UserTier;
}

export type WorkerMessage = { type: 'start'; config: ExportJobConfig } | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'progress'; percent: number; stage: string }
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'error'; message: string };

interface EncodedChunkCopy {
  type: EncodedVideoChunkType;
  timestamp: number;
  duration: number;
  data: Uint8Array;
}

let isCancelled = false;
let encoder: VideoEncoder | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === 'cancel') {
    isCancelled = true;
    encoder?.close();
    return;
  }

  if (event.data.type === 'start') {
    isCancelled = false;
    await runExport(event.data.config);
  }
};

async function runExport(config: ExportJobConfig): Promise<void> {
  try {
    postProgress(0, 'Checking browser support...');

    const supported = await checkCodecSupport(config);
    if (!supported) {
      self.postMessage({ type: 'error', message: 'WEBCODECS_UNSUPPORTED' } satisfies WorkerResponse);
      return;
    }

    postProgress(5, 'Fetching illustrations...');
    const imageBuffers = await fetchIllustrations(config.pages);
    if (isCancelled) return;

    postProgress(20, 'Preparing video encoder...');

    const chunks: EncodedChunkCopy[] = [];
    encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration ?? Math.round(1_000_000 / config.fps),
          data,
        });
      },
      error: (error) => {
        throw error;
      },
    });

    encoder.configure(getCodecConfig(config));

    postProgress(25, 'Encoding frames...');

    const framesPerPage = Math.max(1, Math.round(config.fps * config.durationPerPage));
    const framesPerTransition = Math.max(1, Math.round(config.fps * config.transitionDuration));
    const totalFrameCount =
      framesPerPage * config.pages.length + framesPerTransition * Math.max(0, config.pages.length - 1);

    let frameIndex = 0;

    for (let i = 0; i < config.pages.length; i++) {
      if (isCancelled) return;

      const imageBuffer = imageBuffers[i];
      if (!imageBuffer) continue;

      const blob = new Blob([imageBuffer]);
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: config.width,
        resizeHeight: config.height,
        resizeQuality: 'high',
      });

      for (let f = 0; f < framesPerPage; f++) {
        if (isCancelled) {
          bitmap.close();
          return;
        }

        const timestamp = Math.round((frameIndex / config.fps) * 1_000_000);
        const frame = new VideoFrame(bitmap, {
          timestamp,
          duration: Math.round(1_000_000 / config.fps),
        });

        encoder.encode(frame, { keyFrame: frameIndex === 0 || frameIndex % (config.fps * 2) === 0 });
        frame.close();

        frameIndex++;
        if (frameIndex % config.fps === 0) {
          const percent = 25 + Math.round((frameIndex / totalFrameCount) * 60);
          postProgress(percent, `Encoding page ${i + 1} of ${config.pages.length}...`);
        }
      }

      bitmap.close();

      if (i < config.pages.length - 1) {
        const nextBuffer = imageBuffers[i + 1];
        if (nextBuffer) {
          await encodeTransition(imageBuffer, nextBuffer, config, framesPerTransition, frameIndex);
          frameIndex += framesPerTransition;
        }
      }
    }

    postProgress(85, 'Flushing encoder...');
    await encoder.flush();
    encoder.close();
    encoder = null;

    if (isCancelled) return;

    postProgress(90, 'Muxing MP4...');
    const mp4Buffer = await muxToMP4(chunks, config);

    postProgress(100, 'Complete!');
    self.postMessage({ type: 'complete', buffer: mp4Buffer } satisfies WorkerResponse, [mp4Buffer]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
}

async function checkCodecSupport(config: ExportJobConfig): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;

  const support = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42001f',
    width: config.width,
    height: config.height,
    framerate: config.fps,
    bitrate: config.quality === 'high' ? 4_000_000 : 2_000_000,
  });

  return support.supported === true;
}

function getCodecConfig(config: ExportJobConfig): VideoEncoderConfig {
  return {
    codec: 'avc1.42001f',
    width: config.width,
    height: config.height,
    framerate: config.fps,
    bitrate: config.quality === 'high' ? 4_000_000 : 2_000_000,
    bitrateMode: 'variable',
    latencyMode: 'quality',
  };
}

async function fetchIllustrations(
  pages: Array<Pick<Page, 'pageNumber'> & { illustrationUrl: string }>
): Promise<(ArrayBuffer | null)[]> {
  return Promise.all(
    pages.map(async (page) => {
      try {
        const response = await fetch(page.illustrationUrl);
        if (!response.ok) return null;
        return await response.arrayBuffer();
      } catch {
        return null;
      }
    })
  );
}

async function encodeTransition(
  fromBuffer: ArrayBuffer,
  toBuffer: ArrayBuffer,
  config: ExportJobConfig,
  frameCount: number,
  startFrameIndex: number
): Promise<void> {
  if (!encoder) return;

  const fromBlob = new Blob([fromBuffer]);
  const toBlob = new Blob([toBuffer]);

  const [fromBitmap, toBitmap] = await Promise.all([
    createImageBitmap(fromBlob, {
      resizeWidth: config.width,
      resizeHeight: config.height,
      resizeQuality: 'high',
    }),
    createImageBitmap(toBlob, {
      resizeWidth: config.width,
      resizeHeight: config.height,
      resizeQuality: 'high',
    }),
  ]);

  const canvas = new OffscreenCanvas(config.width, config.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    fromBitmap.close();
    toBitmap.close();
    return;
  }

  for (let f = 0; f < frameCount; f++) {
    if (isCancelled) break;

    const progress = f / frameCount;
    const alpha = easeInOut(progress);

    ctx.clearRect(0, 0, config.width, config.height);
    ctx.globalAlpha = 1 - alpha;
    ctx.drawImage(fromBitmap, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(toBitmap, 0, 0);
    ctx.globalAlpha = 1;

    const frameIndex = startFrameIndex + f;
    const timestamp = Math.round((frameIndex / config.fps) * 1_000_000);
    const frame = new VideoFrame(canvas, {
      timestamp,
      duration: Math.round(1_000_000 / config.fps),
    });

    encoder.encode(frame, { keyFrame: false });
    frame.close();
  }

  fromBitmap.close();
  toBitmap.close();
}

async function muxToMP4(chunks: EncodedChunkCopy[], config: ExportJobConfig): Promise<ArrayBuffer> {
  const mp4 = await import('mp4-muxer');
  const { Muxer, ArrayBufferTarget } = mp4 as unknown as {
    Muxer: new (opts: any) => any;
    ArrayBufferTarget: new () => { buffer: ArrayBuffer };
  };

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: config.width,
      height: config.height,
    },
    firstTimestampBehavior: 'offset',
    fastStart: 'in-memory',
  });

  for (const chunk of chunks) {
    muxer.addVideoChunkRaw(chunk.data, {
      type: chunk.type,
      timestamp: chunk.timestamp,
      duration: chunk.duration,
    });
  }

  muxer.finalize();
  return target.buffer;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function postProgress(percent: number, stage: string): void {
  self.postMessage({ type: 'progress', percent, stage } satisfies WorkerResponse);
}
