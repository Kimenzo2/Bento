// ============================================================================
// GEN — MASTER COMPONENT
// The only component the rest of the app imports.
// Automatically uses the best available layer:
//   Layer 2 (Rive)   if .riv file present + VITE_GEN_LAYER=2
//   Layer 1 (Lottie)  if .json files present + VITE_GEN_LAYER=1
//   Layer 0 (Static)  always available — this is the real Gen
// ============================================================================

import { Suspense, lazy, useState, useEffect } from 'react';
import { GenStatic, type GenSize, type GenState } from './GenStatic';
import type { Realm } from '../../lib/gen/genPersonality';

// Re-export GenAvatarState as a union for external consumers
export type GenAvatarState = GenState | 'speaking' | 'listening';

export type GenMode =
  | 'landing' // Hero section — xl, idle, glow breathing
  | 'onboarding' // Flow steps — lg, speaking/celebrating
  | 'companion' // Sidebar — md, listening/thinking/speaking
  | 'celebration' // Full overlay — lg, celebrating
  | 'minimal'; // Errors, empty states — sm, idle/thinking

export interface GenProps {
  mode: GenMode;
  realm?: Realm | null;
  size?: GenSize;
  state?: GenAvatarState;
  voiceEnabled?: boolean;
  className?: string;
  /** Optional message handler — when Gen speaks */
  onMessage?: (message: string) => void;
}

/** Mode -> default size mapping */
const MODE_SIZE_MAP: Record<GenMode, GenSize> = {
  landing: 'xl',
  onboarding: 'lg',
  companion: 'md',
  celebration: 'lg',
  minimal: 'sm',
};

/** Mode -> default state mapping */
const MODE_STATE_MAP: Record<GenMode, GenState> = {
  landing: 'idle',
  onboarding: 'idle',
  companion: 'idle',
  celebration: 'celebrating',
  minimal: 'idle',
};

/**
 * Get the active layer from environment variable.
 * 0 = static (default), 1 = lottie, 2 = rive
 */
function getActiveLayer(): 0 | 1 | 2 {
  const env = import.meta.env?.VITE_GEN_LAYER;
  const parsed = parseInt(env ?? '0', 10);
  if (parsed === 1) return 1;
  if (parsed === 2) return 2;
  return 0;
}

/**
 * Gen — The master component.
 *
 * Import this everywhere. It handles layer detection, fallbacks,
 * and mode-appropriate defaults automatically.
 *
 * ```tsx
 * import { Gen } from '../components/gen/Gen'
 *
 * // Landing page hero
 * <Gen mode="landing" />
 *
 * // Sidebar companion
 * <Gen mode="companion" realm="cosmos" state="listening" />
 *
 * // Error state
 * <Gen mode="minimal" state="thinking" />
 * ```
 */
export function Gen({ mode, realm = null, size, state, className }: GenProps) {
  const resolvedSize = size ?? MODE_SIZE_MAP[mode];
  const resolvedState = state ?? MODE_STATE_MAP[mode];
  const layer = getActiveLayer();

  // Fallback state for GenStatic (which doesn't support 'speaking' or 'listening')
  const staticState: GenState =
    resolvedState === 'speaking' || resolvedState === 'listening' ? 'idle' : resolvedState;

  // Dynamic component for higher layers (loaded at runtime only when needed)
  const [DynamicLayer, setDynamicLayer] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (layer === 0) return;

    // Dynamic import paths constructed at runtime — invisible to Rollup's static analysis.
    // These modules are only resolved when VITE_GEN_LAYER is explicitly set to 1 or 2.
    const modulePath = layer === 2 ? './GenRive' : './GenAvatar';
    import(/* @vite-ignore */ modulePath)
      .then((mod) => setDynamicLayer(() => mod.default))
      .catch(() => setDynamicLayer(null));
  }, [layer]);

  // Layer 0 fallback — always rendered, instant, no loading state
  const fallback = (
    <GenStatic size={resolvedSize} realm={realm} state={staticState} className={className} />
  );

  // Layer 0 or dynamic layer not yet loaded — show static Gen
  if (layer === 0 || !DynamicLayer) {
    return fallback;
  }

  // Layer 1 or 2 — render the dynamically loaded component
  return (
    <Suspense fallback={fallback}>
      <DynamicLayer size={resolvedSize} realm={realm} state={resolvedState} className={className} />
    </Suspense>
  );
}

export default Gen;
