export const SoundFiles = {
  alarm: "/sounds/alarm.mp3",
  correct: "/sounds/correct.mp3",
  ringtone: "/sounds/ringtone.mp3",
  "guitar-loop": "/sounds/guitar-loop.mp3",
  "guitar-loop-alt": "/sounds/guitar-loop-alt.mp3",
  "fire-crackling": "/sounds/fire-crackling.mp3",
  "ocean-waves": "/sounds/ocean-waves.mp3",
  "river-flow": "/sounds/river-flow.mp3",
  "gentle-rain": "/sounds/gentle-rain.mp3",
  "forest-wind": "/sounds/forest-wind.mp3",
  "riser-wildfire": "/sounds/riser-wildfire.mp3",
  "cinematic-whoosh": "/sounds/cinematic-whoosh.mp3",
  "cinematic-whoosh-alt": "/sounds/cinematic-whoosh-alt.mp3",
} as const;

export type SoundName = keyof typeof SoundFiles;

// ─── AudioContext singleton ──────────────────────────────────────────────

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Ensure AudioContext is created + resumed inside a user gesture. */
export function ensureAudioContext() {
  getContext();
}

// ─── Preload cache ───────────────────────────────────────────────────────

const bufferCache = new Map<string, AudioBuffer>();

/** Fetch + decode a single sound file into an AudioBuffer. Idempotent. */
async function preloadSound(name: SoundName): Promise<AudioBuffer> {
  const cached = bufferCache.get(name);
  if (cached) return cached;

  const url = SoundFiles[name];
  const resp = await fetch(url);
  const arrayBuffer = await resp.arrayBuffer();
  const audioBuffer = await getContext().decodeAudioData(arrayBuffer);
  bufferCache.set(name, audioBuffer);
  return audioBuffer;
}

/** Preload multiple sounds in parallel. Call once at app startup. */
export function preloadSounds(names: SoundName[]): Promise<AudioBuffer[]> {
  return Promise.all(names.map(preloadSound));
}

/** Check if a sound is already buffered. */
export function isSoundLoaded(name: SoundName): boolean {
  return bufferCache.has(name);
}

// ─── Ambient sound player (Web Audio API) ────────────────────────────────
// Used by the Focus module for looped ambient tracks.
// Supports crossfade scheduling and smooth volume ramps.

export interface AmbientPlayer {
  readonly name: SoundName;
  readonly gainNode: GainNode;
  setVolume(v: number, rampMs?: number): void;
  stop(rampMs?: number): Promise<void>;
}

let activeAmbient: AmbientPlayer | null = null;

export function getActiveAmbient(): AmbientPlayer | null {
  return activeAmbient;
}

/**
 * Start an ambient sound with fade-in.
 * Stops any previously playing ambient sound with a quick crossfade.
 */
export async function startAmbient(
  name: SoundName,
  options?: { volume?: number; fadeInMs?: number },
): Promise<AmbientPlayer> {
  // Stop previous with a fast fade-out
  if (activeAmbient) {
    await activeAmbient.stop(80);
    activeAmbient = null;
  }

  const buffer = await preloadSound(name);
  const ac = getContext();

  // Master gain for this track
  const gainNode = ac.createGain();
  const targetVol = prefersReduced() ? (options?.volume ?? 0.5) * 0.5 : (options?.volume ?? 0.5);
  const fadeInMs = options?.fadeInMs ?? 200;

  gainNode.gain.setValueAtTime(0, ac.currentTime);
  gainNode.gain.linearRampToValueAtTime(targetVol, ac.currentTime + fadeInMs / 1000);
  gainNode.connect(ac.destination);

  // Create source node (single-use, one per playback)
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gainNode);
  source.start(0);

  const player: AmbientPlayer = {
    name,
    gainNode,
    setVolume(v: number, rampMs = 200) {
      gainNode.gain.linearRampToValueAtTime(v, ac.currentTime + rampMs / 1000);
    },
    stop(rampMs = 200): Promise<void> {
      return new Promise((resolve) => {
        const current = gainNode.gain.value;
        gainNode.gain.setValueAtTime(current, ac.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, ac.currentTime + rampMs / 1000);
        setTimeout(() => {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
          source.disconnect();
          gainNode.disconnect();
          resolve();
        }, rampMs + 50);
      });
    },
  };

  activeAmbient = player;
  return player;
}

/** Stop ambient without waiting. Used in onDestroy. */
export function stopAmbientImmediate() {
  if (activeAmbient) {
    const p = activeAmbient;
    activeAmbient = null;
    try {
      p.gainNode.gain.cancelScheduledValues(0);
      p.gainNode.gain.setValueAtTime(0, getContext().currentTime);
    } catch {
      /* ignore */
    }
  }
}

// ─── One-shot alarm sound ────────────────────────────────────────────────
// Used by RuntimeBridge for notification alarms (no AudioContext dependency).
// Fresh Audio() calls are cheap and the browser caches the URL after first fetch.

/** Warm the browser cache for alarm sounds. Call once at startup. */
export function preloadAlarmAudios(names: SoundName[]) {
  for (const name of names) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "audio";
    link.href = SoundFiles[name];
    document.head.appendChild(link);
  }
}

/** Check if the user prefers reduced motion (also used to respect reduced audio disruption). */
function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Play an alarm/notification sound. Loops by default. Respects prefers-reduced-motion (halves volume).
 *  Falls back to AudioContext-based playback when HTMLAudioElement autoplay is blocked. */
export function playAlarmSound(
  name: SoundName,
  options?: { loop?: boolean; volume?: number },
): HTMLAudioElement | null {
  try {
    const audio = new Audio(SoundFiles[name]);
    audio.loop = options?.loop ?? true;
    const baseVol = options?.volume ?? 0.6;
    audio.volume = prefersReduced() ? baseVol * 0.4 : baseVol;
    audio.play().catch(() => {
      playAlarmSoundViaContext(name, options).catch(() => {});
    });
    return audio;
  } catch {
    return null;
  }
}

/** Fallback: play via AudioContext when the browser blocks HTMLAudioElement autoplay. */
async function playAlarmSoundViaContext(
  name: SoundName,
  options?: { loop?: boolean; volume?: number },
): Promise<void> {
  const buffer = await preloadSound(name);
  const ac = getContext();
  const gainNode = ac.createGain();
  const baseVol = options?.volume ?? 0.6;
  gainNode.gain.value = prefersReduced() ? baseVol * 0.4 : baseVol;
  gainNode.connect(ac.destination);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = options?.loop ?? true;
  source.connect(gainNode);
  source.start(0);
}

/** Stop a playing alarm sound. */
export function stopAlarmSound(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* ignore */
  }
}
