// ============================================================================
// GEN — LAYER 1: LOTTIE ANIMATION
// Activates when professional Lottie JSON files are placed in public/gen/lottie/
// Falls back silently to GenStatic (Layer 0) if files are absent.
// ============================================================================

import { useEffect, useState, type ComponentProps } from 'react'
import { GenStatic } from './GenStatic'
import type { GenState, GenSize } from './GenStatic'
import type { Realm } from '../../lib/gen/genPersonality'

// Map GenState to Lottie animation states (Lottie has more states)
type LottieState = 'idle' | 'thinking' | 'speaking' | 'celebrating' | 'listening' | 'sleeping'

const LOTTIE_PATHS: Record<LottieState, string> = {
  idle: '/gen/lottie/gen-idle.json',
  thinking: '/gen/lottie/gen-thinking.json',
  speaking: '/gen/lottie/gen-speaking.json',
  celebrating: '/gen/lottie/gen-celebrating.json',
  listening: '/gen/lottie/gen-listening.json',
  sleeping: '/gen/lottie/gen-sleeping.json',
}

/** Extended state type for Lottie (includes speaking and listening) */
export type GenAvatarState = LottieState

export interface GenAvatarProps {
  size?: GenSize
  realm?: Realm | null
  state?: GenAvatarState
  className?: string
}

/**
 * Checks whether a Lottie JSON file exists at the given path.
 * Returns false if the fetch fails or returns non-JSON.
 */
async function lottieFileExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * GenAvatar — Layer 1
 *
 * When Lottie files are available, renders animated Gen.
 * When they are not, renders GenStatic (Layer 0) — no loading state, instant fallback.
 *
 * This component is lazy-loaded by the master Gen component.
 */
export function GenAvatar({ size = 'md', realm = null, state = 'idle', className }: GenAvatarProps) {
  const [lottieAvailable, setLottieAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if idle animation exists — if it does, assume all states are present
    lottieFileExists(LOTTIE_PATHS.idle).then(setLottieAvailable)
  }, [])

  // Map extended avatar states back to GenState for fallback
  const fallbackState: GenState =
    state === 'speaking' || state === 'listening' ? 'idle' : state

  // Still checking — render static Gen (no loading spinner, instant presence)
  if (lottieAvailable === null || lottieAvailable === false) {
    return <GenStatic size={size} realm={realm} state={fallbackState} className={className} />
  }

  // Lottie files exist — render with lottie-react
  // This import is dynamic to avoid bundling lottie-react unless Layer 1 is active
  return <LottieRenderer size={size} realm={realm} state={state} className={className} />
}

/**
 * Internal Lottie renderer — only instantiated when files are confirmed present.
 */
function LottieRenderer({
  size = 'md',
  realm = null,
  state = 'idle',
  className,
}: GenAvatarProps) {
  const [LottieComponent, setLottieComponent] = useState<React.ComponentType<any> | null>(null)
  const [animationData, setAnimationData] = useState<object | null>(null)

  // Dynamically import lottie-react — may not be installed yet
  useEffect(() => {
    import(/* @vite-ignore */ 'lottie-react')
      .then((mod) => setLottieComponent(() => mod.default))
      .catch(() => setLottieComponent(null))
  }, [])

  // Load the appropriate animation JSON
  useEffect(() => {
    const path = LOTTIE_PATHS[state] ?? LOTTIE_PATHS.idle
    fetch(path)
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null))
  }, [state])

  // Fallback if lottie-react failed to load or animation data is missing
  if (!LottieComponent || !animationData) {
    const fallbackState: GenState =
      state === 'speaking' || state === 'listening' ? 'idle' : state
    return <GenStatic size={size} realm={realm} state={fallbackState} className={className} />
  }

  const sizeMap: Record<GenSize, number> = { sm: 64, md: 120, lg: 200, xl: 320 }
  const px = sizeMap[size]

  return (
    <div className={className} style={{ width: px, height: px }}>
      <LottieComponent
        animationData={animationData}
        loop
        autoplay
        style={{ width: px, height: px }}
      />
    </div>
  )
}

export default GenAvatar
