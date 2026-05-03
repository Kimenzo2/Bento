/**
 * AnimationController
 *
 * Manages Gen's animation state machine with priority-based transitions.
 * Provides smooth blending between states and handles lip sync data.
 */

import {
  type AnimationState,
  type LipSyncData,
  type TransitionConfig,
  Easing,
  STATE_PRIORITIES,
} from '../types';

interface BlendState {
  from: AnimationState;
  to: AnimationState;
  progress: number;
  startTime: number;
  config: TransitionConfig;
}

interface AnimationInstruction {
  state: AnimationState;
  priority: number;
  timestamp: number;
  onComplete?: () => void;
}

const DEFAULT_TRANSITION: TransitionConfig = {
  duration: 300,
  easing: Easing.easeOutQuad,
  blendMode: 'crossfade',
};

const TRANSITION_OVERRIDES: Record<string, Partial<TransitionConfig>> = {
  '*->speaking': { duration: 200, easing: Easing.easeInQuad },
  '*->reacting': { duration: 100, easing: Easing.snap },
  '*->celebrating': { duration: 150, easing: Easing.snap },
  'speaking->idle': { duration: 400, easing: Easing.easeOutCubic },
  '*->sleeping': { duration: 800, easing: Easing.easeInOutQuad },
  'sleeping->*': { duration: 600, easing: Easing.easeOutCubic },
  '*->moving': { duration: 250, easing: Easing.easeInOutQuad },
  'moving->idle': { duration: 350, easing: Easing.easeOutCubic },
};

export interface AnimationControllerOptions {
  onStateChange?: (state: AnimationState, blendWeight: number) => void;
  onLipSyncUpdate?: (data: LipSyncData) => void;
}

export class AnimationController {
  private currentState: AnimationState = 'idle';
  private targetState: AnimationState = 'idle';
  private blendState: BlendState | null = null;
  private instructionQueue: AnimationInstruction[] = [];
  private lipSyncData: LipSyncData = {
    mouthOpenness: 0,
    jawPosition: 0,
    lipTension: 0,
  };
  private animationFrameId: number | null = null;
  private onStateChange?: (state: AnimationState, blendWeight: number) => void;
  private onLipSyncUpdate?: (data: LipSyncData) => void;

  constructor(options?: AnimationControllerOptions) {
    this.onStateChange = options?.onStateChange;
    this.onLipSyncUpdate = options?.onLipSyncUpdate;
  }

  /**
   * Request a state change.
   * The controller decides if/when to transition based on priority and queue.
   */
  setState(state: AnimationState, onComplete?: () => void): void {
    const instruction: AnimationInstruction = {
      state,
      priority: STATE_PRIORITIES[state],
      timestamp: performance.now(),
      onComplete,
    };

    if (this.canInterrupt(instruction)) {
      this.processInstruction(instruction);
    } else {
      this.queueInstruction(instruction);
    }
  }

  /**
   * Update lip sync data from voice package.
   * This runs at audio frame rate (~344 Hz).
   */
  setLipSync(data: LipSyncData): void {
    this.lipSyncData = { ...data };
    this.onLipSyncUpdate?.(this.lipSyncData);
  }

  /**
   * Force immediate state change (for emergencies like barge-in).
   */
  forceState(state: AnimationState): void {
    this.clearQueue();
    this.blendState = null;
    this.currentState = state;
    this.targetState = state;
    this.onStateChange?.(state, 1);
  }

  /**
   * Get current state info for renderer.
   */
  getState(): {
    current: AnimationState;
    target: AnimationState;
    blendProgress: number;
    lipSync: LipSyncData;
  } {
    return {
      current: this.currentState,
      target: this.targetState,
      blendProgress: this.blendState?.progress ?? 1,
      lipSync: { ...this.lipSyncData },
    };
  }

  /**
   * Check if currently transitioning.
   */
  get isTransitioning(): boolean {
    return this.blendState !== null;
  }

  /**
   * Start the animation loop.
   */
  start(): void {
    if (this.animationFrameId === null) {
      this.tick();
    }
  }

  /**
   * Stop the animation loop.
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stop();
    this.clearQueue();
  }

  private tick = (): void => {
    const now = performance.now();

    if (this.blendState) {
      const elapsed = now - this.blendState.startTime;
      const rawProgress = Math.min(elapsed / this.blendState.config.duration, 1);
      const easedProgress = this.blendState.config.easing(rawProgress);

      this.blendState.progress = easedProgress;
      this.onStateChange?.(this.blendState.to, easedProgress);

      if (rawProgress >= 1) {
        this.currentState = this.blendState.to;
        this.blendState = null;
        this.processNextInQueue();
      }
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private canInterrupt(instruction: AnimationInstruction): boolean {
    if (!this.blendState) return true;

    // Higher priority can always interrupt
    if (instruction.priority > STATE_PRIORITIES[this.blendState.to]) return true;

    // Same priority: newer timestamp wins
    if (
      instruction.priority === STATE_PRIORITIES[this.blendState.to] &&
      instruction.timestamp > this.blendState.startTime
    ) {
      return true;
    }

    return false;
  }

  private processInstruction(instruction: AnimationInstruction): void {
    // Skip if already in target state
    if (instruction.state === this.currentState && !this.blendState) {
      instruction.onComplete?.();
      return;
    }

    const config = this.getTransitionConfig(this.currentState, instruction.state);

    this.targetState = instruction.state;
    this.blendState = {
      from: this.currentState,
      to: instruction.state,
      progress: 0,
      startTime: performance.now(),
      config,
    };

    this.start();
  }

  private queueInstruction(instruction: AnimationInstruction): void {
    // Insert based on priority (higher priority = earlier in queue)
    const insertIndex = this.instructionQueue.findIndex((i) => i.priority < instruction.priority);

    if (insertIndex === -1) {
      this.instructionQueue.push(instruction);
    } else {
      this.instructionQueue.splice(insertIndex, 0, instruction);
    }

    // Cap queue size
    if (this.instructionQueue.length > 10) {
      this.instructionQueue.pop();
    }
  }

  private processNextInQueue(): void {
    if (this.instructionQueue.length === 0) return;

    const next = this.instructionQueue.shift();
    if (next) {
      this.processInstruction(next);
    }
  }

  private clearQueue(): void {
    this.instructionQueue = [];
  }

  private getTransitionConfig(from: AnimationState, to: AnimationState): TransitionConfig {
    const specificKey = `${from}->${to}`;
    const wildcardKey = `*->${to}`;

    const override = TRANSITION_OVERRIDES[specificKey] ?? TRANSITION_OVERRIDES[wildcardKey];

    if (override) {
      return { ...DEFAULT_TRANSITION, ...override };
    }

    return DEFAULT_TRANSITION;
  }
}

export function createAnimationController(
  options?: AnimationControllerOptions
): AnimationController {
  return new AnimationController(options);
}
