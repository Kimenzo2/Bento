/**
 * GenContext
 *
 * Manages Gen's lifecycle within Genesis.
 * Handles mount/unmount, context publishing, and trigger firing.
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

interface GenContextValue {
  gen: Gen | null;
  isReady: boolean;
  isMounted: boolean;
  publishContext: (partial: Partial<AppContext>) => void;
  fireTrigger: (type: TriggerType) => void;
}

const GenContext = createContext<GenContextValue | null>(null);

export function GenProvider({ children }: { children: React.ReactNode }) {
  const [gen, setGen] = useState<Gen | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentContextRef = useRef<Partial<AppContext>>({});
  const mountAttemptedRef = useRef(false);

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

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
    const voiceId = import.meta.env.VITE_GEN_VOICE_ID as string | undefined;

    // Skip mount if API keys are not configured
    if (!geminiApiKey) {
      if (import.meta.env.DEV) {
        console.warn('[GenContext] Skipping mount: VITE_GEMINI_API_KEY not configured');
      }
      return;
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
      if (gen) {
        unmount(gen);
        setGen(null);
        setIsMounted(false);
        setIsReady(false);
        mountAttemptedRef.current = false;
      }
    };
  }, [isMounted, gen]);

  const publishContext = useCallback((partial: Partial<AppContext>) => {
    currentContextRef.current = { ...currentContextRef.current, ...partial };
    publish(partial);
  }, []);

  const fireTrigger = useCallback((type: TriggerType) => {
    trigger(type);
  }, []);

  return (
    <GenContext.Provider value={{ gen, isReady, isMounted, publishContext, fireTrigger }}>
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
