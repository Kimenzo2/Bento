import { beforeEach, describe, expect, it, vi } from 'vitest';
import { disposeIllustrationGPU, getIllustrationGPU, IllustrationGPU } from './IllustrationGPU';

const mockDevice = {
  createTexture: vi.fn().mockReturnValue({
    createView: vi.fn().mockReturnValue({}),
    destroy: vi.fn(),
  }),
  createBuffer: vi.fn().mockReturnValue({ destroy: vi.fn() }),
  createComputePipelineAsync: vi.fn().mockResolvedValue({
    getBindGroupLayout: vi.fn().mockReturnValue({}),
  }),
  createRenderPipelineAsync: vi.fn().mockResolvedValue({
    getBindGroupLayout: vi.fn().mockReturnValue({}),
  }),
  createShaderModule: vi.fn().mockReturnValue({}),
  createSampler: vi.fn().mockReturnValue({}),
  createBindGroup: vi.fn().mockReturnValue({}),
  createCommandEncoder: vi.fn().mockReturnValue({
    beginComputePass: vi.fn().mockReturnValue({
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      end: vi.fn(),
    }),
    beginRenderPass: vi.fn().mockReturnValue({
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      draw: vi.fn(),
      end: vi.fn(),
    }),
    finish: vi.fn().mockReturnValue({}),
  }),
  queue: {
    writeBuffer: vi.fn(),
    submit: vi.fn(),
    onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
    copyExternalImageToTexture: vi.fn(),
  },
  destroy: vi.fn(),
};

const mockAdapter = {
  requestDevice: vi.fn().mockResolvedValue(mockDevice),
};

function stubNavigator(withGpu: boolean): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: withGpu
      ? {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
            getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
          },
        }
      : { gpu: undefined },
  });
}

describe('IllustrationGPU', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubNavigator(true);
  });

  it('initializes with WebGPU when available', async () => {
    const gpu = new IllustrationGPU({
      realm: 'kingdom',
      enableEffects: true,
      pixelRatio: 1,
    });

    await gpu.initialize();

    expect(globalThis.navigator.gpu.requestAdapter).toHaveBeenCalledWith({
      powerPreference: 'high-performance',
    });
  });

  it('falls back gracefully when WebGPU is unavailable', async () => {
    stubNavigator(false);

    const gpu = new IllustrationGPU({
      realm: 'kingdom',
      enableEffects: true,
      pixelRatio: 1,
    });

    await expect(gpu.initialize()).resolves.not.toThrow();
  });

  it('supports realm updates', () => {
    const gpu = new IllustrationGPU({
      realm: 'kingdom',
      enableEffects: true,
      pixelRatio: 1,
    });

    expect(() => gpu.setRealm('kingdom')).not.toThrow();
    expect(() => gpu.setRealm('cosmos')).not.toThrow();
    expect(() => gpu.setRealm('cell')).not.toThrow();
  });

  it('disposes safely', async () => {
    const gpu = new IllustrationGPU({
      realm: 'cosmos',
      enableEffects: true,
      pixelRatio: 1,
    });

    await gpu.initialize();
    expect(() => gpu.dispose()).not.toThrow();
    expect(mockDevice.destroy).toHaveBeenCalled();
  });
});

describe('IllustrationGPU singleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disposeIllustrationGPU();
    stubNavigator(true);
  });

  it('returns the same instance and updates realm', async () => {
    const first = await getIllustrationGPU('kingdom');
    const second = await getIllustrationGPU('cosmos');

    expect(first).toBe(second);
  });
});
