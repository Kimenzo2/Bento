/**
 * GenRendererProxy
 *
 * Main thread proxy for the render worker.
 * Exposes the same interface as the synchronous renderer
 * but all calls go to the Web Worker via postMessage.
 *
 * The main thread has zero knowledge of Canvas 2D, WebGPU,
 * or any rendering implementation.
 */

import type { AnimationState, LipSyncData, Realm, Position } from '../types';
import type { WorkerCommand, WorkerEvent } from './render.worker';

export class GenRendererProxy {
  private worker: Worker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private sharedBuffer: SharedArrayBuffer | null = null;
  private sharedArray: Float32Array | null = null;
  private isReady = false;
  private onReadyCallbacks: Array<() => void> = [];
  private onErrorCallbacks: Array<(msg: string) => void> = [];

  // SharedArrayBuffer layout
  private static readonly SAB_SIZE = 8;

  // State index mappings
  private static readonly STATE_INDICES: Record<AnimationState, number> = {
    idle: 0,
    thinking: 1,
    speaking: 2,
    celebrating: 3,
    listening: 4,
    sleeping: 5,
    moving: 6,
    reacting: 7,
  };

  private static readonly REALM_INDICES: Record<Realm, number> = {
    kingdom: 0,
    cosmos: 1,
    cell: 2,
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async initialize(
    canvas: HTMLCanvasElement,
    realm: Realm,
    pixelRatio = window.devicePixelRatio
  ): Promise<void> {
    this.canvas = canvas;

    // Create SharedArrayBuffer for zero-copy high-frequency data
    // Falls back to postMessage if SharedArrayBuffer unavailable
    // (requires COOP/COEP headers)
    try {
      this.sharedBuffer = new SharedArrayBuffer(
        GenRendererProxy.SAB_SIZE * Float32Array.BYTES_PER_ELEMENT
      );
      this.sharedArray = new Float32Array(this.sharedBuffer);
    } catch {
      console.warn('[GenRendererProxy] SharedArrayBuffer unavailable, using postMessage fallback');
    }

    // Create worker
    this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), {
      type: 'module',
    });

    // Listen for worker events
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const data = event.data;
      if (data.type === 'ready') {
        this.isReady = true;
        this.onReadyCallbacks.forEach((cb) => cb());
        this.onReadyCallbacks = [];
      } else if (data.type === 'error') {
        this.onErrorCallbacks.forEach((cb) => cb(data.message));
      }
    };

    this.worker.onerror = (error) => {
      console.error('[GenRendererProxy] Worker error:', error);
      this.onErrorCallbacks.forEach((cb) => cb(error.message));
    };

    // Get canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Transfer canvas to worker — it never comes back
    const offscreen = canvas.transferControlToOffscreen();

    const initMsg: WorkerCommand = {
      type: 'init',
      canvas: offscreen,
      pixelRatio,
      realm,
      width,
      height,
      ...(this.sharedBuffer ? { sharedBuffer: this.sharedBuffer } : {}),
    };

    // Transfer the OffscreenCanvas (SharedArrayBuffer is cloned, not transferred)
    this.worker.postMessage(initMsg, [offscreen]);

    // Wait for ready signal
    await new Promise<void>((resolve, reject) => {
      this.onReadyCallbacks.push(resolve);
      this.onErrorCallbacks.push((msg) => reject(new Error(msg)));
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('[GenRendererProxy] Init timeout')), 5000);
    });
  }

  // ============================================================================
  // Public API — matches GenRenderer interface
  // ============================================================================

  setState(state: AnimationState, blendWeight = 1): void {
    if (!this.isReady) return;

    // Use SharedArrayBuffer for immediate update if available
    if (this.sharedArray) {
      this.sharedArray[3] = GenRendererProxy.STATE_INDICES[state];
      return;
    }

    this.send({ type: 'setState', state, blendWeight });
  }

  setLipSync(data: LipSyncData): void {
    if (!this.isReady) return;

    // Zero-copy via SharedArrayBuffer — no postMessage overhead
    // This runs at 344Hz from the AudioWorklet
    if (this.sharedArray) {
      this.sharedArray[0] = data.mouthOpenness;
      this.sharedArray[1] = data.jawPosition;
      this.sharedArray[2] = data.lipTension;
      return;
    }

    this.send({ type: 'setLipSync', data });
  }

  setRealm(realm: Realm): void {
    if (!this.isReady) return;

    if (this.sharedArray) {
      this.sharedArray[4] = GenRendererProxy.REALM_INDICES[realm];
      return;
    }

    this.send({ type: 'setRealm', realm });
  }

  moveTo(position: Position): void {
    if (!this.isReady) return;

    if (this.sharedArray) {
      this.sharedArray[5] = position.x;
      this.sharedArray[6] = position.y;
      return;
    }

    this.send({ type: 'setPosition', x: position.x, y: position.y });
  }

  setPosition(x: number, y: number): void {
    this.moveTo({ x, y });
  }

  resize(width: number, height: number): void {
    this.send({ type: 'resize', width, height });
  }

  dispose(): void {
    this.send({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
  }

  get ready(): boolean {
    return this.isReady;
  }

  get hasSharedArrayBuffer(): boolean {
    return this.sharedArray !== null;
  }

  // ============================================================================
  // Private
  // ============================================================================

  private send(cmd: WorkerCommand): void {
    this.worker?.postMessage(cmd);
  }
}

export function createRendererProxy(): GenRendererProxy {
  return new GenRendererProxy();
}
