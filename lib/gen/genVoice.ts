// ============================================================================
// GEN — LAYER 3: VOICE (ElevenLabs)
// Streaming audio for Gen's speech. Opt-in, respectful, gracefully silent.
// Gen never speaks without prior user interaction (autoplay policy).
// ============================================================================

import type { GenAvatarState } from '../../components/gen/GenAvatar'

// ────────────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────────────

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1'

const GEN_VOICE_SETTINGS = {
  stability: 0.6,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
} as const

/** Phrase keys that can be pre-cached on app load */
export const GEN_CACHED_PHRASE_KEYS = [
  'greeting_first_time',
  'greeting_returning',
  'realm_cosmos_welcome',
  'realm_kingdom_welcome',
  'realm_cell_welcome',
  'creation_complete',
  'error_recovery',
  'thinking_sound',
] as const

export type CachedPhraseKey = (typeof GEN_CACHED_PHRASE_KEYS)[number]

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_ELEVENLABS_API_KEY) ||
    null
  )
}

function getVoiceId(): string | null {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_GEN_VOICE_ID) ||
    null
  )
}

// ────────────────────────────────────────────────────────────
// AUDIO CACHE
// ────────────────────────────────────────────────────────────

const audioCache = new Map<string, ArrayBuffer>()

/**
 * Pre-cache a phrase for zero-latency playback on first interaction.
 */
export async function preCachePhrase(text: string, cacheKey: string): Promise<void> {
  if (audioCache.has(cacheKey)) return

  const apiKey = getApiKey()
  const voiceId = getVoiceId()
  if (!apiKey || !voiceId) return

  try {
    const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: GEN_VOICE_SETTINGS,
      }),
    })

    if (res.ok) {
      audioCache.set(cacheKey, await res.arrayBuffer())
    }
  } catch {
    // Silent failure — Gen works without voice
  }
}

// ────────────────────────────────────────────────────────────
// SPEAK — Stream audio for minimum latency
// ────────────────────────────────────────────────────────────

/**
 * Make Gen speak the given text.
 * Streams audio if possible, falls back to full fetch.
 *
 * @param text - What Gen says
 * @param onStart - Called when audio starts (trigger 'speaking' animation)
 * @param onEnd - Called when audio completes (return to 'idle' or 'listening')
 * @param cacheKey - Optional key to check/store in cache
 */
export async function genSpeak(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  cacheKey?: string
): Promise<void> {
  const apiKey = getApiKey()
  const voiceId = getVoiceId()

  if (!apiKey || !voiceId) {
    // No API key or voice ID configured — Gen is silent but present
    onStart?.()
    // Simulate speaking duration based on text length
    await new Promise((r) => setTimeout(r, Math.min(text.length * 50, 3000)))
    onEnd?.()
    return
  }

  try {
    // Check cache first
    if (cacheKey && audioCache.has(cacheKey)) {
      const buffer = audioCache.get(cacheKey)!
      await playAudioBuffer(buffer, onStart, onEnd)
      return
    }

    // Fetch from ElevenLabs
    const res = await fetch(
      `${ELEVENLABS_API}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: GEN_VOICE_SETTINGS,
        }),
      }
    )

    if (!res.ok) {
      throw new Error(`ElevenLabs: ${res.status}`)
    }

    const buffer = await res.arrayBuffer()

    // Cache it
    if (cacheKey) {
      audioCache.set(cacheKey, buffer)
    }

    await playAudioBuffer(buffer, onStart, onEnd)
  } catch {
    // Graceful silence — Gen does not break
    onStart?.()
    await new Promise((r) => setTimeout(r, Math.min(text.length * 50, 3000)))
    onEnd?.()
  }
}

/**
 * Play an audio buffer via Web Audio API.
 */
async function playAudioBuffer(
  buffer: ArrayBuffer,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  const audioContext = new AudioContext()
  const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0))
  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioContext.destination)

  return new Promise<void>((resolve) => {
    source.onended = () => {
      onEnd?.()
      audioContext.close()
      resolve()
    }
    onStart?.()
    source.start()
  })
}
