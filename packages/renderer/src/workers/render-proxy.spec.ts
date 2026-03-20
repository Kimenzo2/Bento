/**
 * GenRendererProxy Tests
 *
 * Tests the proxy interface implementation.
 * Full Worker behavior is tested via browser integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenRendererProxy } from './render-proxy';

// Mock browser globals
vi.stubGlobal('window', {
  devicePixelRatio: 2,
  innerWidth: 1920,
  innerHeight: 1080,
});

// Track worker instances
let mockWorkerInstance: {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((error: ErrorEvent) => void) | null;
} | null = null;

// Mock Worker as a class
class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;

  constructor(_url: URL, _options?: { type: string }) {
    mockWorkerInstance = this;
  }
}

vi.stubGlobal('Worker', MockWorker);

// Mock URL
vi.stubGlobal('URL', class {
  constructor(public href: string, public base?: string) {}
});

// Mock OffscreenCanvas
vi.stubGlobal('OffscreenCanvas', class {});

// Mock SharedArrayBuffer
vi.stubGlobal('SharedArrayBuffer', ArrayBuffer);

// Simulate worker ready
function simulateWorkerReady(): void {
  setTimeout(() => {
    if (mockWorkerInstance?.onmessage) {
      mockWorkerInstance.onmessage({ data: { type: 'ready' } } as MessageEvent);
    }
  }, 5);
}

// Create mock canvas
function createMockCanvas(): HTMLCanvasElement {
  return {
    transferControlToOffscreen: vi.fn().mockReturnValue({}),
    style: { cssText: '' },
    getBoundingClientRect: vi.fn().mockReturnValue({ width: 160, height: 180 }),
  } as unknown as HTMLCanvasElement;
}

describe('GenRendererProxy', () => {
  beforeEach(() => {
    mockWorkerInstance = null;
  });

  describe('Instantiation', () => {
    it('should create a proxy instance', () => {
      const proxy = new GenRendererProxy();
      expect(proxy).toBeDefined();
      expect(proxy.ready).toBe(false);
    });

    it('should create proxy quickly (< 10ms)', () => {
      const start = performance.now();
      new GenRendererProxy();
      expect(performance.now() - start).toBeLessThan(10);
    });
  });

  describe('Initialization', () => {
    it('should create a Worker on initialize', async () => {
      const proxy = new GenRendererProxy();
      const canvas = createMockCanvas();

      simulateWorkerReady();
      await proxy.initialize(canvas, 'kingdom');

      expect(mockWorkerInstance).not.toBeNull();
    });

    it('should transfer canvas to worker', async () => {
      const proxy = new GenRendererProxy();
      const canvas = createMockCanvas();

      simulateWorkerReady();
      await proxy.initialize(canvas, 'kingdom');

      expect(canvas.transferControlToOffscreen).toHaveBeenCalled();
    });

    it('should be ready after successful init', async () => {
      const proxy = new GenRendererProxy();
      const canvas = createMockCanvas();

      expect(proxy.ready).toBe(false);

      simulateWorkerReady();
      await proxy.initialize(canvas, 'kingdom');

      expect(proxy.ready).toBe(true);
    });

    it('should timeout if worker does not respond', async () => {
      const proxy = new GenRendererProxy();
      const canvas = createMockCanvas();

      // Don't simulate ready - let it timeout
      await expect(proxy.initialize(canvas, 'kingdom')).rejects.toThrow('Init timeout');
    }, 6000);
  });

  describe('Commands Before Ready', () => {
    it('should not throw when setState called before ready', () => {
      const proxy = new GenRendererProxy();
      expect(() => proxy.setState('celebrating')).not.toThrow();
    });

    it('should not throw when setRealm called before ready', () => {
      const proxy = new GenRendererProxy();
      expect(() => proxy.setRealm('cosmos')).not.toThrow();
    });

    it('should not throw when setLipSync called before ready', () => {
      const proxy = new GenRendererProxy();
      expect(() =>
        proxy.setLipSync({ mouthOpenness: 0.5, jawPosition: 0.3, lipTension: 0.2 })
      ).not.toThrow();
    });

    it('should not throw when moveTo called before ready', () => {
      const proxy = new GenRendererProxy();
      expect(() => proxy.moveTo({ x: 100, y: 200 })).not.toThrow();
    });

    it('should not throw when setPosition called before ready', () => {
      const proxy = new GenRendererProxy();
      expect(() => proxy.setPosition(0.5, 0.5)).not.toThrow();
    });
  });

  describe('Commands After Ready', () => {
    let proxy: GenRendererProxy;

    beforeEach(async () => {
      proxy = new GenRendererProxy();
      const canvas = createMockCanvas();
      simulateWorkerReady();
      await proxy.initialize(canvas, 'kingdom');
    });

    it('should send resize command via postMessage', () => {
      proxy.resize(800, 600);

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'resize', width: 800, height: 600 })
      );
    });

    it('should send setRealm command via postMessage', () => {
      // Clear SAB so it falls back to postMessage
      (proxy as unknown as { sharedArray: null }).sharedArray = null;

      proxy.setRealm('cosmos');

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setRealm', realm: 'cosmos' })
      );
    });

    it('should terminate worker on dispose', () => {
      proxy.dispose();
      expect(mockWorkerInstance?.terminate).toHaveBeenCalled();
    });

    it('should mark as not ready after dispose', () => {
      proxy.dispose();
      expect(proxy.ready).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle rapid lip sync updates efficiently', async () => {
      const proxy = new GenRendererProxy();
      const canvas = createMockCanvas();
      simulateWorkerReady();
      await proxy.initialize(canvas, 'kingdom');

      const start = performance.now();

      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        proxy.setLipSync({
          mouthOpenness: Math.sin(i * 0.1),
          jawPosition: Math.cos(i * 0.1),
          lipTension: 0.5,
        });
      }

      expect(performance.now() - start).toBeLessThan(50);
    });
  });
});
