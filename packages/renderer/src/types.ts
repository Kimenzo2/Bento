/**
 * Shared types for @lorenzootieno/gen-renderer
 */

/** Gen's eight animation states */
export type AnimationState =
  | 'idle'
  | 'thinking'
  | 'speaking'
  | 'celebrating'
  | 'listening'
  | 'sleeping'
  | 'moving'
  | 'reacting';

/** Genesis realm colors */
export type Realm = 'kingdom' | 'cosmos' | 'cell';

/** Lip sync data from voice package */
export interface LipSyncData {
  mouthOpenness: number;
  jawPosition: number;
  lipTension: number;
}

/** Screen position */
export interface Position {
  x: number;
  y: number;
}

/** Renderer configuration */
export interface RendererConfig {
  container: HTMLElement;
  realm: Realm;
  enableParticles?: boolean;
  enablePhysics?: boolean;
  pixelRatio?: number;
}

/** Easing function type */
export type EasingFunction = (t: number) => number;

/** Animation transition configuration */
export interface TransitionConfig {
  duration: number;
  easing: EasingFunction;
  blendMode: 'crossfade' | 'additive' | 'override';
}

/** Realm color definitions (RGB normalized 0-1) */
export const REALM_COLORS: Record<Realm, [number, number, number]> = {
  kingdom: [1, 0.843, 0],
  cosmos: [0.118, 0.565, 1],
  cell: [0.18, 0.8, 0.251],
};

/** Gen's color palette extracted from reference */
export const GEN_COLORS = {
  bodyPrimary: [0.545, 0.494, 0.784] as [number, number, number],
  bodySecondary: [0.678, 0.847, 0.902] as [number, number, number],
  bodyGlow: [0.529, 0.808, 0.922] as [number, number, number],
  eyeWhite: [0.95, 0.97, 1] as [number, number, number],
  eyeIris: [0, 0.808, 0.82] as [number, number, number],
  eyePupil: [0.1, 0.1, 0.15] as [number, number, number],
  eyeGlow: [0.4, 0.9, 0.95] as [number, number, number],
  mouthInner: [0.4, 0.3, 0.5] as [number, number, number],
  quillTip: [1, 0.843, 0] as [number, number, number],
  quillFeather: [0, 0.808, 0.82] as [number, number, number],
  sparkleGold: [1, 0.9, 0.4] as [number, number, number],
  sparkleCyan: [0.4, 0.95, 1] as [number, number, number],
  sparkleWhite: [1, 1, 1] as [number, number, number],
};

/** Easing functions */
export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  snap: (t: number) => 1 - (1 - t) ** 4,
} as const;

/** Animation state priorities (higher = more urgent) */
export const STATE_PRIORITIES: Record<AnimationState, number> = {
  idle: 0,
  sleeping: 1,
  listening: 2,
  thinking: 3,
  moving: 4,
  speaking: 5,
  reacting: 6,
  celebrating: 7,
};

/** Gen character state */
export interface GenCharacterState {
  animationState: AnimationState;
  blendWeight: number;
  lipSync: LipSyncData;
  realm: Realm;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
}

/** Expression presets for animation states */
export const EXPRESSION_PRESETS: Record<
  AnimationState,
  {
    eye: { openness?: number; lookX?: number; lookY?: number; pupilSize?: number };
    mouth: { shape?: string; openness?: number; width?: number };
  }
> = {
  idle: {
    eye: { openness: 0.9 },
    mouth: { shape: 'neutral', openness: 0 },
  },
  thinking: {
    eye: { openness: 0.7, lookY: 0.3 },
    mouth: { shape: 'neutral', openness: 0.1 },
  },
  speaking: {
    eye: { openness: 1 },
    mouth: { shape: 'open', openness: 0.5 },
  },
  celebrating: {
    eye: { openness: 1, pupilSize: 1.2 },
    mouth: { shape: 'smile', width: 1.3, openness: 0.6 },
  },
  listening: {
    eye: { openness: 1, pupilSize: 1.1 },
    mouth: { shape: 'neutral', openness: 0.05 },
  },
  sleeping: {
    eye: { openness: 0.1 },
    mouth: { shape: 'neutral', openness: 0 },
  },
  moving: {
    eye: { openness: 0.95 },
    mouth: { shape: 'smile', openness: 0.2 },
  },
  reacting: {
    eye: { openness: 1, pupilSize: 1.3 },
    mouth: { shape: 'o', openness: 0.4 },
  },
};
