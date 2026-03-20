// ============================================================================
// useGen — React hook for Gen state management
// Wires together the brain, voice, and animation state.
// ============================================================================

import { useCallback, useRef, useState } from 'react'
import { GenBrain, type GenThinkResult } from '../lib/gen/genBrain'
import { genSpeak } from '../lib/gen/genVoice'
import { getGreeting, type Realm, type GreetingContext } from '../lib/gen/genPersonality'
import type { GenAvatarState } from '../components/gen/GenAvatar'

export interface UseGenOptions {
  realm?: Realm | null
  projectContext?: string
  userName?: string
  voiceEnabled?: boolean
}

export interface UseGenReturn {
  /** Current animation state */
  animationState: GenAvatarState
  /** The last message Gen said */
  lastMessage: string
  /** Whether Gen is currently thinking/speaking */
  isActive: boolean
  /** Send a message to Gen and get a response */
  sendMessage: (message: string) => Promise<GenThinkResult>
  /** Trigger a greeting based on context */
  greet: (context: GreetingContext, projectName?: string) => Promise<void>
  /** Change Gen's realm */
  setRealm: (realm: Realm | null) => void
  /** Set voice on/off */
  setVoiceEnabled: (enabled: boolean) => void
  /** Reset conversation */
  reset: () => void
}

export function useGen(options: UseGenOptions = {}): UseGenReturn {
  const brainRef = useRef(
    new GenBrain({
      realm: options.realm ?? null,
      projectContext: options.projectContext ?? '',
      userName: options.userName ?? '',
    })
  )

  const [animationState, setAnimationState] = useState<GenAvatarState>('idle')
  const [lastMessage, setLastMessage] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [voiceEnabled, setVoiceEnabledState] = useState(options.voiceEnabled ?? false)

  const sendMessage = useCallback(
    async (message: string): Promise<GenThinkResult> => {
      setIsActive(true)
      setAnimationState('thinking')

      const result = await brainRef.current.think(message)

      setLastMessage(result.text)

      if (voiceEnabled && result.shouldSpeak) {
        setAnimationState('speaking')
        await genSpeak(
          result.text,
          () => setAnimationState('speaking'),
          () => setAnimationState('idle')
        )
      } else {
        setAnimationState(result.animationState)
        // Return to idle after a brief display period
        setTimeout(() => setAnimationState('idle'), 3000)
      }

      setIsActive(false)
      return result
    },
    [voiceEnabled]
  )

  const greet = useCallback(
    async (context: GreetingContext, projectName?: string) => {
      const greeting = getGreeting(context, projectName)
      setLastMessage(greeting)

      if (voiceEnabled) {
        setAnimationState('speaking')
        await genSpeak(
          greeting,
          () => setAnimationState('speaking'),
          () => setAnimationState('idle'),
          context
        )
      } else {
        setAnimationState('speaking')
        setTimeout(() => setAnimationState('idle'), 3000)
      }
    },
    [voiceEnabled]
  )

  const setRealm = useCallback((realm: Realm | null) => {
    brainRef.current.setRealm(realm)
  }, [])

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled)
  }, [])

  const reset = useCallback(() => {
    brainRef.current.resetConversation()
    setAnimationState('idle')
    setLastMessage('')
    setIsActive(false)
  }, [])

  return {
    animationState,
    lastMessage,
    isActive,
    sendMessage,
    greet,
    setRealm,
    setVoiceEnabled,
    reset,
  }
}
