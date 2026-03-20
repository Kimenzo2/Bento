/**
 * GenRenderWorker
 *
 * Runs the Gen character renderer entirely off the main thread.
 * Receives commands via postMessage, reads high-frequency data
 * via SharedArrayBuffer.
 *
 * This worker owns the OffscreenCanvas and never gives it back.
 * The main thread has zero involvement in rendering after init.
 *
 * RIVE INTEGRATION NOTE:
 * When Rive animations are commissioned, import the Rive runtime here:
 * import RiveCanvas from '@rive-app/canvas-advanced'
 * The OffscreenCanvas is already transferred — Rive works with it directly.
 * No architecture changes needed.
 */

import type { AnimationState, LipSyncData, Realm } from '../types';

// ============================================================================
// Message Protocol
// ============================================================================

export type WorkerCommand =
  | {
      type: 'init';
      canvas: OffscreenCanvas;
      pixelRatio: number;
      realm: Realm;
      width: number;
      height: number;
      sharedBuffer?: SharedArrayBuffer;
    }
  | { type: 'setState'; state: AnimationState; blendWeight?: number }
  | { type: 'setLipSync'; data: LipSyncData }
  | { type: 'setRealm'; realm: Realm }
  | { type: 'setPosition'; x: number; y: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'dispose' };

export type WorkerEvent =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'frame'; timestamp: number };

// SharedArrayBuffer layout (matches AudioWorklet in voice package):
// [0] mouthOpenness  [1] jawPosition  [2] lipTension
// [3] animStateIndex [4] realmIndex   [5] posX  [6] posY
const SAB_MOUTH = 0;
const SAB_JAW = 1;
const SAB_LIP = 2;
const SAB_STATE = 3;
const SAB_REALM = 4;
const SAB_POS_X = 5;
const SAB_POS_Y = 6;

// ============================================================================
// Worker State
// ============================================================================

let character: import('../gen/character').GenCharacter | null = null;
let animationFrameId: number | null = null;
let sharedArray: Float32Array | null = null;
let isInitialized = false;
let currentWidth = 0;
let currentHeight = 0;
let pixelRatio = 1;

// State tracking for SharedArrayBuffer reads
let lastState: AnimationState = 'idle';
let lastRealm: Realm = 'kingdom';

const ANIMATION_STATES: AnimationState[] = [
  'idle',
  'thinking',
  'speaking',
  'celebrating',
  'listening',
  'sleeping',
  'moving',
  'reacting',
];

const REALMS: Realm[] = ['kingdom', 'cosmos', 'cell'];

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const cmd = event.data;

  switch (cmd.type) {
    case 'init':
      await handleInit(cmd);
      break;
    case 'setState':
      handleSetState(cmd.state, cmd.blendWeight ?? 1);
      break;
    case 'setLipSync':
      handleSetLipSync(cmd.data);
      break;
    case 'setRealm':
      handleSetRealm(cmd.realm);
      break;
    case 'setPosition':
      handleSetPosition(cmd.x, cmd.y);
      break;
    case 'resize':
      handleResize(cmd.width, cmd.height);
      break;
    case 'dispose':
      handleDispose();
      break;
  }
};

// ============================================================================
// Handlers
// ============================================================================

async function handleInit(
  cmd: Extract<WorkerCommand, { type: 'init' }>
): Promise<void> {
  try {
    // Initialize SharedArrayBuffer for high-frequency comms
    if (cmd.sharedBuffer) {
      sharedArray = new Float32Array(cmd.sharedBuffer);
    }

    currentWidth = cmd.width;
    currentHeight = cmd.height;
    pixelRatio = cmd.pixelRatio;

    // Dynamic import — GenCharacter loads inside the worker, not the main thread
    const { GenCharacter } = await import('../gen/character');

    character = new GenCharacter({
      canvas: cmd.canvas,
      realm: cmd.realm,
      enableParticles: true,
      enablePhysics: true,
      pixelRatio: cmd.pixelRatio,
      width: cmd.width,
      height: cmd.height,
    });

    await character.initialize();

    isInitialized = true;
    lastRealm = cmd.realm;

    self.postMessage({ type: 'ready' } satisfies WorkerEvent);

    // Start render loop
    startRenderLoop();
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerEvent);
  }
}

function handleSetState(state: AnimationState, blendWeight: number): void {
  if (!isInitialized || !character) return;

  // Direct update when no SharedArrayBuffer
  character.setAnimationState(state, blendWeight);
  lastState = state;
}

function handleSetLipSync(data: LipSyncData): void {
  if (!isInitialized || !character) return;

  // Update directly when no SharedArrayBuffer
  character.setLipSync(data);
}

function handleSetRealm(realm: Realm): void {
  if (!isInitialized || !character) return;

  character.setRealm(realm);
  lastRealm = realm;
}

function handleSetPosition(x: number, y: number): void {
  if (!isInitialized || !character) return;

  character.setPosition(x, y);
}

function handleResize(width: number, height: number): void {
  if (!character) return;

  currentWidth = width;
  currentHeight = height;
  character.resize(width, height);
}

function handleDispose(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  character?.dispose();
  character = null;
  sharedArray = null;
  isInitialized = false;
}

// ============================================================================
// Render Loop
// ============================================================================

function startRenderLoop(): void {
  const loop = (): void => {
    if (!isInitialized || !character) return;

    // Read from SharedArrayBuffer if available (zero-copy path)
    if (sharedArray) {
      // Read lip sync values
      const lipSync: LipSyncData = {
        mouthOpenness: sharedArray[SAB_MOUTH],
        jawPosition: sharedArray[SAB_JAW],
        lipTension: sharedArray[SAB_LIP],
      };
      character.setLipSync(lipSync);

      // Read animation state
      const stateIndex = Math.floor(sharedArray[SAB_STATE]);
      if (stateIndex >= 0 && stateIndex < ANIMATION_STATES.length) {
        const newState = ANIMATION_STATES[stateIndex];
        if (newState !== lastState) {
          character.setAnimationState(newState);
          lastState = newState;
        }
      }

      // Read realm
      const realmIndex = Math.floor(sharedArray[SAB_REALM]);
      if (realmIndex >= 0 && realmIndex < REALMS.length) {
        const newRealm = REALMS[realmIndex];
        if (newRealm !== lastRealm) {
          character.setRealm(newRealm);
          lastRealm = newRealm;
        }
      }

      // Read position
      const posX = sharedArray[SAB_POS_X];
      const posY = sharedArray[SAB_POS_Y];
      if (posX !== 0 || posY !== 0) {
        character.setPosition(posX, posY);
      }
    }

    // Render frame
    character.renderFrame();

    animationFrameId = requestAnimationFrame(loop);
  };

  animationFrameId = requestAnimationFrame(loop);
}
