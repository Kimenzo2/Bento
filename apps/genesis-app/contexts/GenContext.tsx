/**
 * GenContext
 *
 * Local provider for the Gen companion state.
 *
 * The old external bridge is gone. Gen now stays inside the app and the
 * actual text intelligence comes from the Mastra-backed `GenBrain` path.
 * This provider only tracks shared UI state and capability detection so the
 * rest of the app can keep publishing updates without a second runtime.
 */
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  detectGenCapabilities,
  logGenCapabilities,
  type GenCapabilities,
} from '../lib/gen/genCapabilities';

type GenContextState = Record<string, unknown>;

type TriggerType =
  | 'page_change'
  | 'session_start'
  | 'generation_started'
  | 'generation_complete'
  | 'generation_error';

interface GenContextValue {
  gen: null;
  isReady: boolean;
  isMounted: boolean;
  /** Detected rendering capabilities (OffscreenCanvas, SharedArrayBuffer, etc.) */
  capabilities: GenCapabilities | null;
  publishContext: (partial: GenContextState) => void;
  fireTrigger: (type: TriggerType) => void;
}

const GenContext = createContext<GenContextValue | null>(null);

export function GenProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [capabilities, setCapabilities] = useState<GenCapabilities | null>(null);
  const currentContextRef = useRef<GenContextState>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const caps = detectGenCapabilities();
    setCapabilities(caps);
    logGenCapabilities(caps);
    setIsReady(true);
    setIsMounted(true);
  }, []);

  const publishContext = useCallback((partial: GenContextState) => {
    currentContextRef.current = { ...currentContextRef.current, ...partial };
  }, []);

  const fireTrigger = useCallback((_type: TriggerType) => {
    // The companion is local now. Trigger side-effects are handled by the
    // Mastra-backed GenBrain and the current app state, so there is nothing
    // to forward to an external runtime.
  }, []);

  return (
    <GenContext.Provider
      value={{ gen: null, isReady, isMounted, capabilities, publishContext, fireTrigger }}
    >
      {children}
    </GenContext.Provider>
  );
}

export function useGen() {
  const ctx = useContext(GenContext);
  if (!ctx) throw new Error('useGen must be used within GenProvider');
  return ctx;
}
