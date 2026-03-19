/**
 * GenContext
 *
 * STUBBED VERSION - gen-engine packages temporarily removed for deployment.
 * The gen-engine SDK uses file: dependencies to ../gen-engine/ which doesn't
 * exist on Vercel. This stub provides the same interface but does nothing.
 *
 * TODO: Restore full functionality when gen-engine packages are published to npm.
 */
import type React from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

// Stub types that match @gen-engine/bridge
type Gen = object;
type AppContext = Record<string, unknown>;
type TriggerType = string;

interface GenContextValue {
  gen: Gen | null;
  isReady: boolean;
  isMounted: boolean;
  publishContext: (partial: Partial<AppContext>) => void;
  fireTrigger: (type: TriggerType) => void;
}

const GenContext = createContext<GenContextValue | null>(null);

export function GenProvider({ children }: { children: React.ReactNode }) {
  const [gen] = useState<Gen | null>(null);
  const [isReady] = useState(false);
  const [isMounted] = useState(false);

  // Stub implementations - no-op until gen-engine is properly integrated
  const publishContext = useCallback((_partial: Partial<AppContext>) => {
    // No-op: gen-engine not available
  }, []);

  const fireTrigger = useCallback((_type: TriggerType) => {
    // No-op: gen-engine not available
  }, []);

  return (
    <GenContext.Provider value={{ gen, isReady, isMounted, publishContext, fireTrigger }}>
      {children}
    </GenContext.Provider>
  );
}

export function useGen() {
  const ctx = useContext(GenContext);
  if (!ctx) throw new Error('useGen must be used within GenProvider');
  return ctx;
}
