/**
 * IllustrationGPU
 *
 * WebGPU pipeline for Genesis illustration processing.
 * Handles realm-aware color grading, effects, and transitions.
 *
 * Falls back to Canvas 2D if WebGPU is unavailable.
 */

import type { Realm } from '@lorenzootieno/gen-bridge';

type GPUNavigatorLike = {
  requestAdapter: (options?: { powerPreference?: 'high-performance' | 'low-power' }) => Promise<GPUAdapterLike | null>;
  getPreferredCanvasFormat: () => string;
};

type GPUAdapterLike = {
  requestDevice: (options?: {
    requiredLimits?: { maxTextureDimension2D?: number };
  }) => Promise<GPUDeviceLike>;
};

type GPUCanvasContextLike = {
  configure: (config: { device: GPUDeviceLike; format: string; alphaMode?: string }) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

type GPUDeviceLike = {
  createTexture: (descriptor: {
    label?: string;
    size: [number, number, number];
    format: string;
    usage: number;
  }) => GPUTextureLike;
  createBuffer: (descriptor: { size: number; usage: number }) => { destroy: () => void };
  createComputePipelineAsync: (descriptor: unknown) => Promise<{
    getBindGroupLayout: (index: number) => unknown;
  }>;
  createRenderPipelineAsync: (descriptor: unknown) => Promise<{
    getBindGroupLayout: (index: number) => unknown;
  }>;
  createShaderModule: (descriptor: { code: string }) => unknown;
  createSampler: (descriptor: { magFilter: 'linear'; minFilter: 'linear' }) => unknown;
  createBindGroup: (descriptor: unknown) => unknown;
  createCommandEncoder: () => {
    beginComputePass: () => {
      setPipeline: (pipeline: unknown) => void;
      setBindGroup: (index: number, bindGroup: unknown) => void;
      dispatchWorkgroups: (x: number, y: number) => void;
      end: () => void;
    };
    beginRenderPass: (descriptor: unknown) => {
      setPipeline: (pipeline: unknown) => void;
      setBindGroup: (index: number, bindGroup: unknown) => void;
      draw: (vertices: number) => void;
      end: () => void;
    };
    finish: () => unknown;
  };
  queue: {
    copyExternalImageToTexture: (
      source: { source: ImageBitmap },
      destination: { texture: GPUTextureLike },
      copySize: [number, number]
    ) => void;
    writeBuffer: (buffer: { destroy: () => void }, offset: number, data: Float32Array) => void;
    submit: (commands: unknown[]) => void;
    onSubmittedWorkDone: () => Promise<void>;
  };
  destroy: () => void;
};

type GPUTextureLike = {
  createView: () => unknown;
  destroy: () => void;
};

const GPU_TEXTURE_USAGE = (globalThis as { GPUTextureUsage?: Record<string, number> }).GPUTextureUsage ?? {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
};

const GPU_BUFFER_USAGE = (globalThis as { GPUBufferUsage?: Record<string, number> }).GPUBufferUsage ?? {
  COPY_DST: 0x08,
  UNIFORM: 0x40,
};

export interface IllustrationGPUConfig {
  realm: Realm;
  enableEffects: boolean;
  pixelRatio: number;
}

export interface ProcessedIllustration {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  dispose: () => void;
}

export class IllustrationGPU {
  private device: GPUDeviceLike | null = null;
  private renderPipeline: { getBindGroupLayout: (index: number) => unknown } | null = null;
  private effectsPipeline: { getBindGroupLayout: (index: number) => unknown } | null = null;
  private isWebGPU = false;
  private realm: Realm;
  private pixelRatio: number;
  private enableEffects: boolean;

  constructor(config: IllustrationGPUConfig) {
    this.realm = config.realm;
    this.pixelRatio = config.pixelRatio;
    this.enableEffects = config.enableEffects;
  }

  async initialize(): Promise<void> {
    const navGpu = (navigator as unknown as { gpu?: GPUNavigatorLike }).gpu;
    if (typeof navigator === 'undefined' || !navGpu) {
      this.isWebGPU = false;
      return;
    }

    try {
      const adapter = await navGpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        this.isWebGPU = false;
        return;
      }

      const requestedLimit = 8192;
      this.device = await adapter.requestDevice({
        requiredLimits: {
          maxTextureDimension2D: requestedLimit,
        },
      });

      await this.precompilePipelines();
      this.isWebGPU = true;
    } catch (error) {
      console.warn('[IllustrationGPU] WebGPU init failed, using fallback', error);
      this.device = null;
      this.renderPipeline = null;
      this.effectsPipeline = null;
      this.isWebGPU = false;
    }
  }

  async process(source: string, targetWidth: number, targetHeight: number): Promise<ProcessedIllustration> {
    if (this.isWebGPU && this.device && this.renderPipeline) {
      return this.processWebGPU(source, targetWidth, targetHeight);
    }

    return this.processCanvas2D(source, targetWidth, targetHeight);
  }

  setRealm(realm: Realm): void {
    this.realm = realm;
  }

  dispose(): void {
    this.device?.destroy();
    this.device = null;
    this.renderPipeline = null;
    this.effectsPipeline = null;
  }

  private async processWebGPU(source: string, width: number, height: number): Promise<ProcessedIllustration> {
    if (!this.device || !this.renderPipeline) {
      return this.processCanvas2D(source, width, height);
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load illustration: ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    const blob = new Blob([bytes]);

    const imageBitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });

    const inputTexture = this.device.createTexture({
      label: 'illustration-input',
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING |
        GPU_TEXTURE_USAGE.COPY_DST |
        GPU_TEXTURE_USAGE.RENDER_ATTACHMENT |
        GPU_TEXTURE_USAGE.STORAGE_BINDING,
    });

    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: inputTexture },
      [imageBitmap.width, imageBitmap.height]
    );

    imageBitmap.close();

    const outputTexture = this.enableEffects
      ? this.runEffectsPass(inputTexture, imageBitmap.width, imageBitmap.height)
      : inputTexture;

    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('webgpu') as GPUCanvasContextLike | null;
    const navGpu = (navigator as unknown as { gpu?: GPUNavigatorLike }).gpu;
    if (!context || !navGpu) {
      inputTexture.destroy();
      if (outputTexture !== inputTexture) outputTexture.destroy();
      return this.processCanvas2D(source, width, height);
    }

    context.configure({
      device: this.device,
      format: navGpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    });

    await this.renderToCanvas(outputTexture, context);

    return {
      canvas,
      width,
      height,
      dispose: () => {
        inputTexture.destroy();
        if (outputTexture !== inputTexture) {
          outputTexture.destroy();
        }
      },
    };
  }

  private runEffectsPass(inputTexture: GPUTextureLike, width: number, height: number): GPUTextureLike {
    if (!this.device || !this.effectsPipeline) {
      return inputTexture;
    }

    const outputTexture = this.device.createTexture({
      label: 'illustration-effects-output',
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage:
        GPU_TEXTURE_USAGE.STORAGE_BINDING |
        GPU_TEXTURE_USAGE.TEXTURE_BINDING |
        GPU_TEXTURE_USAGE.COPY_SRC |
        GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
    });

    const [realmR, realmG, realmB] = this.getRealmUniforms();
    const uniformData = new Float32Array([
      realmR,
      realmG,
      realmB,
      0.35,
      0.24,
      performance.now() / 1000,
      width,
      height,
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.effectsPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.effectsPipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
    computePass.end();
    this.device.queue.submit([commandEncoder.finish()]);

    uniformBuffer.destroy();
    return outputTexture;
  }

  private async renderToCanvas(texture: GPUTextureLike, context: GPUCanvasContextLike): Promise<void> {
    if (!this.device || !this.renderPipeline) return;

    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
  }

  private async precompilePipelines(): Promise<void> {
    if (!this.device) return;

    this.effectsPipeline = await this.device.createComputePipelineAsync({
      label: 'illustration-effects-pipeline',
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({
          code: ILLUSTRATION_EFFECTS_SHADER,
        }),
        entryPoint: 'main',
      },
    });

    const fullscreenModule = this.device.createShaderModule({
      code: FULLSCREEN_QUAD_SHADER,
    });

    const navGpu = (navigator as unknown as { gpu?: GPUNavigatorLike }).gpu;
    if (!navGpu) return;

    this.renderPipeline = await this.device.createRenderPipelineAsync({
      label: 'illustration-render-pipeline',
      layout: 'auto',
      vertex: {
        module: fullscreenModule,
        entryPoint: 'vs',
      },
      fragment: {
        module: fullscreenModule,
        entryPoint: 'fs',
        targets: [{ format: navGpu.getPreferredCanvasFormat() }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
  }

  private async processCanvas2D(source: string, width: number, height: number): Promise<ProcessedIllustration> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * this.pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * this.pixelRatio));

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.scale(this.pixelRatio, this.pixelRatio);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });

    ctx.drawImage(img, 0, 0, width, height);

    const [r, g, b] = this.getRealmUniforms();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    return {
      canvas,
      width,
      height,
      dispose: () => {
        // No explicit resources to release in 2D fallback.
      },
    };
  }

  private getRealmUniforms(): [number, number, number] {
    const colors: Record<Realm, [number, number, number]> = {
      kingdom: [1.0, 0.843, 0.0],
      cosmos: [0.118, 0.565, 1.0],
      cell: [0.18, 0.8, 0.251],
    };

    return colors[this.realm] ?? [1, 1, 1];
  }
}

const ILLUSTRATION_EFFECTS_SHADER = /* wgsl */ `
struct EffectsUniforms {
  realmR: f32,
  realmG: f32,
  realmB: f32,
  intensity: f32,
  vignetteStrength: f32,
  time: f32,
  width: f32,
  height: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: EffectsUniforms;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let w = i32(uniforms.width);
  let h = i32(uniforms.height);
  if (i32(id.x) >= w || i32(id.y) >= h) {
    return;
  }

  let coord = vec2<i32>(i32(id.x), i32(id.y));
  let uv = vec2<f32>(f32(id.x) / uniforms.width, f32(id.y) / uniforms.height);

  var color = textureLoad(inputTexture, coord, 0);

  // Realm color grading.
  let realmColor = vec3<f32>(uniforms.realmR, uniforms.realmG, uniforms.realmB);
  let graded = mix(color.rgb, color.rgb * realmColor, uniforms.intensity * 0.12);

  // Soft vignette.
  let center = uv - vec2<f32>(0.5, 0.5);
  let vignette = 1.0 - dot(center, center) * uniforms.vignetteStrength * 2.0;
  let vignetted = graded * clamp(vignette, 0.0, 1.0);

  // Edge luminance boost.
  let luma = dot(vignetted, vec3<f32>(0.2126, 0.7152, 0.0722));
  let boosted = mix(vignetted, vignetted * 1.05, smoothstep(0.3, 0.8, luma));

  // Reveal modulation over time.
  let reveal = clamp((uv.x + uv.y) * 0.5 + sin(uniforms.time * 0.5) * 0.02, 0.0, 1.0);
  let finalColor = mix(vignetted, boosted, reveal);

  textureStore(outputTexture, coord, vec4<f32>(finalColor, color.a));
}
`;

const FULLSCREEN_QUAD_SHADER = /* wgsl */ `
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
  );

  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
  );

  var out: VertexOutput;
  out.position = vec4<f32>(positions[i], 0.0, 1.0);
  out.uv = uvs[i];
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4<f32> {
  return textureSample(tex, texSampler, in.uv);
}
`;

let gpuInstance: IllustrationGPU | null = null;

export async function getIllustrationGPU(realm: Realm): Promise<IllustrationGPU> {
  if (!gpuInstance) {
    gpuInstance = new IllustrationGPU({
      realm,
      enableEffects: true,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    });
    await gpuInstance.initialize();
  } else {
    gpuInstance.setRealm(realm);
  }

  return gpuInstance;
}

export function disposeIllustrationGPU(): void {
  gpuInstance?.dispose();
  gpuInstance = null;
}
