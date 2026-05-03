/**
 * @lorenzootieno/gen-renderer
 *
 * Gen's rendering engine with OffscreenCanvas Web Worker support.
 * Automatically uses Web Worker when OffscreenCanvas is available,
 * falls back to main thread rendering otherwise.
 *
 * The main thread has zero render work when OffscreenCanvas is active.
 */

import type { AnimationState, LipSyncData, Realm, Position, RendererConfig } from './types';
import { AnimationController, createAnimationController } from './animation/controller';

// Re-export types and constants
export type {
  AnimationState,
  LipSyncData,
  Realm,
  Position,
  RendererConfig,
  TransitionConfig,
  EasingFunction,
  GenCharacterState,
} from './types';

export { REALM_COLORS, GEN_COLORS, Easing, STATE_PRIORITIES, EXPRESSION_PRESETS } from './types';

export { AnimationController, createAnimationController } from './animation/controller';
export { GenCharacter, createGenCharacter } from './gen/character';
export { GenRendererProxy, createRendererProxy } from './workers/render-proxy';

// ============================================================================
// GenRenderer Interface
// ============================================================================

export interface SpatialPresence {
  readonly position: Position;
  readonly isMoving: boolean;
  moveTo(target: Position): void;
  moveToElement(selector: string): void;
  returnHome(): void;
  setHomePosition(position: Position): void;
}

export interface GenRenderer {
  readonly isWarmed: boolean;
  readonly animation: AnimationController;
  readonly spatial: SpatialPresence;
  warm(): Promise<void>;
  mount(): void;
  unmount(): void;
  setRealm(realm: Realm): void;
  setVoiceAmplitude(amplitude: number): void;
  dispose(): void;
}

// ============================================================================
// Check WebGPU Support
// ============================================================================

export function isWebGPUSupported(): boolean {
  return 'gpu' in navigator;
}

// ============================================================================
// Check OffscreenCanvas Support
// ============================================================================

export function isOffscreenCanvasSupported(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    'transferControlToOffscreen' in HTMLCanvasElement.prototype
  );
}

// ============================================================================
// Create Renderer
// ============================================================================

/**
 * Create a GenRenderer instance.
 * Automatically uses Web Worker when OffscreenCanvas is supported.
 */
export async function createRenderer(config: RendererConfig): Promise<GenRenderer> {
  const supportsOffscreen = isOffscreenCanvasSupported();
  const preferredMode = supportsOffscreen ? 'OffscreenCanvas' : 'main-thread';

  // WHY: the Playwright suite needs a deterministic signal for which render path
  // the engine selected, and production debugging needs the same visibility.
  console.info(`[gen-engine] Renderer: ${preferredMode}`);

  if (supportsOffscreen) {
    try {
      // WHY: if worker boot fails after capability detection succeeds, falling back
      // keeps Gen visible instead of leaving the container empty on public routes.
      return await createOffscreenRenderer(config);
    } catch (error) {
      console.error(
        '[gen-engine] OffscreenCanvas initialization failed, falling back to main-thread renderer.',
        error
      );
      return createMainThreadRenderer(config);
    }
  }

  // Fallback — main thread renderer
  return createMainThreadRenderer(config);
}

// ============================================================================
// OffscreenCanvas Renderer (Web Worker)
// ============================================================================

async function createOffscreenRenderer(config: RendererConfig): Promise<GenRenderer> {
  const { GenRendererProxy } = await import('./workers/render-proxy');
  const proxy = new GenRendererProxy();

  // Create the canvas element in the container
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  config.container.appendChild(canvas);

  // Animation controller runs on main thread for immediate response
  const animationController = createAnimationController({
    onStateChange: (state) => {
      proxy.setState(state);
    },
    onLipSyncUpdate: (data) => {
      proxy.setLipSync(data);
    },
  });

  // Initialize — transfers canvas to worker permanently
  await proxy.initialize(canvas, config.realm, config.pixelRatio ?? window.devicePixelRatio);

  // Spatial presence state
  let homePosition: Position = { x: 0.5, y: 0.5 };
  let currentPosition: Position = { x: 0.5, y: 0.5 };
  let moving = false;

  const spatial: SpatialPresence = {
    get position() {
      return { ...currentPosition };
    },
    get isMoving() {
      return moving;
    },
    moveTo(target: Position) {
      moving = true;
      currentPosition = { ...target };
      proxy.moveTo(target);
      moving = false;
    },
    moveToElement(selector: string) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        this.moveTo({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      }
    },
    returnHome() {
      this.moveTo(homePosition);
    },
    setHomePosition(position: Position) {
      homePosition = { ...position };
      currentPosition = { ...position };
    },
  };

  let isWarmed = false;
  let isMounted = false;

  return {
    get isWarmed() {
      return isWarmed;
    },
    animation: animationController,
    spatial,

    async warm() {
      if (!isWarmed) {
        // Worker is already initialized, just mark as warmed
        isWarmed = true;
      }
    },

    mount() {
      if (!isMounted) {
        animationController.start();
        isMounted = true;
      }
    },

    unmount() {
      if (isMounted) {
        animationController.stop();
        isMounted = false;
      }
    },

    setRealm(realm: Realm) {
      proxy.setRealm(realm);
    },

    setVoiceAmplitude(_amplitude: number) {
      // Voice amplitude can be used for additional effects
      // Currently handled via lip sync data
    },

    dispose() {
      animationController.dispose();
      proxy.dispose();
      canvas.remove();
    },
  };
}

// ============================================================================
// Main Thread Renderer (Fallback)
// ============================================================================

async function createMainThreadRenderer(config: RendererConfig): Promise<GenRenderer> {
  const { GenCharacter } = await import('./gen/character');

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  config.container.appendChild(canvas);

  const rect = config.container.getBoundingClientRect();

  const character = new GenCharacter({
    canvas,
    realm: config.realm,
    enableParticles: config.enableParticles ?? true,
    enablePhysics: config.enablePhysics ?? true,
    pixelRatio: config.pixelRatio ?? window.devicePixelRatio,
    width: rect.width,
    height: rect.height,
  });

  await character.initialize();

  // Animation controller
  const animationController = createAnimationController({
    onStateChange: (state, blendWeight) => {
      character.setAnimationState(state, blendWeight);
    },
    onLipSyncUpdate: (data) => {
      character.setLipSync(data);
    },
  });

  // Spatial presence state
  let homePosition: Position = { x: 0.5, y: 0.5 };
  let currentPosition: Position = { x: 0.5, y: 0.5 };
  let moving = false;

  const spatial: SpatialPresence = {
    get position() {
      return { ...currentPosition };
    },
    get isMoving() {
      return moving;
    },
    moveTo(target: Position) {
      moving = true;
      currentPosition = { ...target };
      character.setPosition(target.x, target.y);
      moving = false;
    },
    moveToElement(selector: string) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        this.moveTo({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      }
    },
    returnHome() {
      this.moveTo(homePosition);
    },
    setHomePosition(position: Position) {
      homePosition = { ...position };
      currentPosition = { ...position };
    },
  };

  let isWarmed = false;
  let isMounted = false;

  // Handle resize
  const handleResize = () => {
    const newRect = config.container.getBoundingClientRect();
    character.resize(newRect.width, newRect.height);
  };

  return {
    get isWarmed() {
      return isWarmed;
    },
    animation: animationController,
    spatial,

    async warm() {
      if (!isWarmed) {
        // Optional: Pre-warm WebGPU adapter if available
        if (isWebGPUSupported()) {
          try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
              await adapter.requestDevice();
            }
          } catch {
            // WebGPU warm-up failed, continue anyway
          }
        }
        isWarmed = true;
      }
    },

    mount() {
      if (!isMounted) {
        animationController.start();
        character.start();
        window.addEventListener('resize', handleResize);
        isMounted = true;
      }
    },

    unmount() {
      if (isMounted) {
        animationController.stop();
        character.stop();
        window.removeEventListener('resize', handleResize);
        isMounted = false;
      }
    },

    setRealm(realm: Realm) {
      character.setRealm(realm);
    },

    setVoiceAmplitude(_amplitude: number) {
      // Voice amplitude can be used for additional effects
    },

    dispose() {
      animationController.dispose();
      character.dispose();
      window.removeEventListener('resize', handleResize);
      canvas.remove();
    },
  };
}
