/**
 * GenContext
 *
 * Manages Gen's lifecycle within Genesis.
 * Handles mount/unmount, context publishing, and trigger firing.
 *
 * Phase 2 Features:
 * - Automatic OffscreenCanvas detection (rendering moves to Web Worker)
 * - SharedArrayBuffer support for 344Hz lip sync (requires COOP/COEP)
 * - Graceful fallback to main thread rendering when unavailable
 */
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  preload,
  mount,
  unmount,
  publish,
  trigger,
  type Gen,
  type AppContext,
  type Realm,
  type TriggerType,
} from '@lorenzootieno/gen-bridge';
import {
  detectGenCapabilities,
  logGenCapabilities,
  type GenCapabilities,
} from '../lib/gen/genCapabilities';

interface GenContextValue {
  gen: Gen | null;
  isReady: boolean;
  isMounted: boolean;
  /** Detected rendering capabilities (OffscreenCanvas, SharedArrayBuffer, etc.) */
  capabilities: GenCapabilities | null;
  publishContext: (partial: Partial<AppContext>) => void;
  fireTrigger: (type: TriggerType) => void;
}

const GenContext = createContext<GenContextValue | null>(null);

function resolveGeminiApiKey(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const directKey = env.VITE_GEMINI_API_KEY?.trim();

  if (directKey) {
    return directKey;
  }

  // WHY: production envs in this repo already use numbered Gemini keys, so the
  // public Gen mount must accept that configuration instead of treating it as missing.
  for (let index = 1; index <= 11; index += 1) {
    const candidate = env[`VITE_GEMINI_API_KEY_${index}`]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export function GenProvider({ children }: { children: React.ReactNode }) {
  const [gen, setGen] = useState<Gen | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [capabilities, setCapabilities] = useState<GenCapabilities | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentContextRef = useRef<Partial<AppContext>>({});
  const mountAttemptedRef = useRef(false);
  const mountedGenRef = useRef<Gen | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const caps = detectGenCapabilities();
    setCapabilities(caps);
    logGenCapabilities(caps);
  }, []);

  // Preload on idle
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const id = requestIdleCallback(() => {
      preload({
        // PLACEHOLDER: Replace with real GLTF path when model is commissioned
        // File should be placed at: public/gen-engine/gen-character.glb
        modelUrl: '/gen-engine/gen-character.glb',
      });
    });
    return () => cancelIdleCallback(id);
  }, []);

  // Mount Gen when container is ready
  useEffect(() => {
    if (!containerRef.current || isMounted || mountAttemptedRef.current) return;
    mountAttemptedRef.current = true;

    const geminiApiKey = resolveGeminiApiKey();
    const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
    const voiceId = import.meta.env.VITE_GEN_VOICE_ID as string | undefined;

    if (!geminiApiKey) {
      // WHY: Gen's renderer can mount without AI credentials, which keeps the public
      // companion visible while still surfacing that voice/brain features are limited.
      console.warn('[GenContext] Gemini API key not configured. Mounting renderer-only Gen.');
    }

    // Default to kingdom realm
    const initialRealm: Realm = (currentContextRef.current.realm as Realm) ?? 'kingdom';

    mount(
      {
        realm: initialRealm,
        geminiApiKey,
        elevenLabsApiKey,
        voiceId,
        homePosition: { x: window.innerWidth - 100, y: window.innerHeight - 120 },
      },
      containerRef.current
    )
      .then((instance) => {
        mountedGenRef.current = instance;
        setGen(instance);
        setIsMounted(true);
        setIsReady(true);
        if (import.meta.env.DEV) {
          console.log('[GenContext] Gen mounted successfully');
        }
      })
      .catch((error) => {
        console.error('[GenContext] Mount failed:', error);
        mountAttemptedRef.current = false; // Allow retry
      });

    return () => {
      const mountedGen = mountedGenRef.current;
      if (mountedGen) {
        // WHY: the mounted instance is created asynchronously, so cleanup must read
        // from a ref instead of a stale effect closure to avoid leaking the renderer.
        unmount(mountedGen);
        mountedGenRef.current = null;
      }

      setGen(null);
      setIsMounted(false);
      setIsReady(false);
      mountAttemptedRef.current = false;
    };
  }, [isMounted]);

  const publishContext = useCallback((partial: Partial<AppContext>) => {
    currentContextRef.current = { ...currentContextRef.current, ...partial };
    publish(partial);
  }, []);

  const fireTrigger = useCallback((type: TriggerType) => {
    trigger(type);
  }, []);

  return (
    <GenContext.Provider value={{ gen, isReady, isMounted, capabilities, publishContext, fireTrigger }}>
      {children}
      {/* Gen's render container - positioned fixed, always on top */}
      <div
        ref={containerRef}
        id="gen-container"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 160,
          height: 180,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
    </GenContext.Provider>
  );
}

export function useGen() {
  const ctx = useContext(GenContext);
  if (!ctx) throw new Error('useGen must be used within GenProvider');
  return ctx;
}
