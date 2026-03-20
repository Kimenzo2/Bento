// ============================================================================
// GEN — LAYER 2: RIVE STATE MACHINE
// Full interactive Gen with smooth state transitions.
// Falls back to GenAvatar (Layer 1) → GenStatic (Layer 0).
// ============================================================================

import { useEffect, useState } from 'react'
import { GenStatic, type GenSize, type GenState } from './GenStatic'
import type { Realm } from '../../lib/gen/genPersonality'

// Extended state type matching GenAvatar
type GenAvatarState = GenState | 'speaking' | 'listening'

const GEN_RIVE_PATH = '/gen/gen-character.riv'
const STATE_MACHINE = 'Gen_Brain'

/** Numeric realm IDs for Rive state machine inputs */
const REALM_IDS: Record<string, number> = {
  default: 0,
  cosmos: 1,
  kingdom: 2,
  cell: 3,
}

export interface GenRiveProps {
  size?: GenSize
  realm?: Realm | null
  state?: GenAvatarState
  emotionLevel?: number
  className?: string
}

/**
 * Checks whether the .riv file exists.
 */
async function riveFileExists(): Promise<boolean> {
  try {
    const res = await fetch(GEN_RIVE_PATH, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * GenRive — Layer 2
 *
 * When the .riv file is available, renders full interactive Gen via Rive.
 * When it is not, falls back to GenAvatar → GenStatic.
 *
 * This component is lazy-loaded by the master Gen component.
 */
export function GenRive({
  size = 'md',
  realm = null,
  state = 'idle',
  emotionLevel = 50,
  className,
}: GenRiveProps) {
  const [riveAvailable, setRiveAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    riveFileExists().then(setRiveAvailable)
  }, [])

  // Not available — fall back to Layer 0 (static Gen)
  if (riveAvailable === null || riveAvailable === false) {
    const fallbackState: GenState =
      state === 'speaking' || state === 'listening' ? 'idle' : state
    return <GenStatic size={size} realm={realm} state={fallbackState} className={className} />
  }

  return (
    <RiveRenderer
      size={size}
      realm={realm}
      state={state}
      emotionLevel={emotionLevel}
      className={className}
    />
  )
}

/**
 * Internal Rive renderer — only instantiated when .riv file is confirmed present.
 */
function RiveRenderer({
  size = 'md',
  realm = null,
  state = 'idle',
  emotionLevel = 50,
  className,
}: GenRiveProps) {
  const [riveModule, setRiveModule] = useState<any>(null)

  useEffect(() => {
    import(/* @vite-ignore */ '@rive-app/react-canvas')
      .then(setRiveModule)
      .catch(() => setRiveModule(null))
  }, [])

  // Fallback if @rive-app/react-canvas failed to load
  if (!riveModule) {
    const fallbackState: GenState =
      state === 'speaking' || state === 'listening' ? 'idle' : state
    return <GenStatic size={size} realm={realm} state={fallbackState} className={className} />
  }

  const { useRive, useStateMachineInput } = riveModule
  const sizeMap: Record<GenSize, number> = { sm: 64, md: 120, lg: 200, xl: 320 }
  const px = sizeMap[size]

  return (
    <RiveCanvas
      useRive={useRive}
      useStateMachineInput={useStateMachineInput}
      size={px}
      realm={realm}
      state={state}
      emotionLevel={emotionLevel}
      className={className}
    />
  )
}

/**
 * The actual Rive canvas — separated so hooks are called at the component level.
 */
function RiveCanvas({
  useRive,
  useStateMachineInput,
  size,
  realm,
  state = 'idle',
  emotionLevel = 50,
  className,
}: {
  useRive: any
  useStateMachineInput: any
  size: number
  realm: Realm | null
  state: GenAvatarState
  emotionLevel: number
  className?: string
}) {
  const { rive, RiveComponent } = useRive({
    src: GEN_RIVE_PATH,
    stateMachines: STATE_MACHINE,
    autoplay: true,
  })

  // Boolean inputs
  const isThinking = useStateMachineInput(rive, STATE_MACHINE, 'isThinking')
  const isSpeaking = useStateMachineInput(rive, STATE_MACHINE, 'isSpeaking')
  const isCelebrating = useStateMachineInput(rive, STATE_MACHINE, 'isCelebrating')
  const isListening = useStateMachineInput(rive, STATE_MACHINE, 'isListening')
  const isSleeping = useStateMachineInput(rive, STATE_MACHINE, 'isSleeping')

  // Number inputs
  const realmIdInput = useStateMachineInput(rive, STATE_MACHINE, 'realmId')
  const emotionInput = useStateMachineInput(rive, STATE_MACHINE, 'emotionLevel')

  // Sync state to Rive inputs
  useEffect(() => {
    if (isThinking) isThinking.value = state === 'thinking'
    if (isSpeaking) isSpeaking.value = state === 'speaking'
    if (isCelebrating) isCelebrating.value = state === 'celebrating'
    if (isListening) isListening.value = state === 'listening'
    if (isSleeping) isSleeping.value = state === 'sleeping'
  }, [state, isThinking, isSpeaking, isCelebrating, isListening, isSleeping])

  // Sync realm
  useEffect(() => {
    if (realmIdInput) realmIdInput.value = REALM_IDS[realm ?? 'default']
  }, [realm, realmIdInput])

  // Sync emotion level
  useEffect(() => {
    if (emotionInput) emotionInput.value = emotionLevel
  }, [emotionLevel, emotionInput])

  return (
    <div className={className} style={{ width: size, height: size }}>
      <RiveComponent style={{ width: size, height: size }} />
    </div>
  )
}

export default GenRive
