/**
 * Mars-Class Infrastructure Context
 *
 * React context provider for Mars-Class infrastructure services.
 * Initializes all services on mount and provides access via hooks.
 *
 * Usage:
 * ```tsx
 * // In App.tsx or main entry
 * import { InfrastructureProvider } from '@/contexts/InfrastructureContext';
 *
 * function App() {
 *   return (
 *     <InfrastructureProvider>
 *       <YourApp />
 *     </InfrastructureProvider>
 *   );
 * }
 *
 * // In any component
 * import { useInfrastructureContext } from '@/contexts/InfrastructureContext';
 *
 * function MyComponent() {
 *   const { isReady, health, services } = useInfrastructureContext();
 *
 *   if (!isReady) return <LoadingSpinner />;
 *
 *   // Use services...
 * }
 * ```
 */

import type React from 'react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type BootstrapProgress,
  type InfrastructureHealthCheck,
  type InfrastructureServices,
  bootstrapInfrastructure,
  checkInfrastructureHealth,
  getInfrastructureOrNull,
  isInfrastructureReady,
  shutdownInfrastructure,
} from '../services/infrastructure/bootstrap';

// ============================================================================
// TYPES
// ============================================================================

export interface InfrastructureContextValue {
  // State
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  progress: BootstrapProgress | null;

  // Services (null if not ready)
  services: InfrastructureServices | null;

  // Health
  health: InfrastructureHealthCheck | null;
  refreshHealth: () => Promise<void>;

  // Actions
  reinitialize: () => Promise<void>;
}

export interface InfrastructureProviderProps {
  children: ReactNode;

  /**
   * Options for infrastructure initialization
   */
  options?: {
    /** Skip configuration validation (useful for testing) */
    skipValidation?: boolean;

    /** Enable/disable specific services */
    services?: {
      cache?: boolean;
      storage?: boolean;
      jobs?: boolean;
      tracing?: boolean;
    };

    /** Health check interval in ms (0 to disable) */
    healthCheckInterval?: number;
  };

  /**
   * Loading component shown during initialization
   */
  loadingComponent?: ReactNode;

  /**
   * Error component shown if initialization fails
   */
  errorComponent?: (error: Error, retry: () => void) => ReactNode;

  /**
   * Called when initialization completes
   */
  onReady?: (services: InfrastructureServices) => void;

  /**
   * Called if initialization fails
   */
  onError?: (error: Error) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const InfrastructureContext = createContext<InfrastructureContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function InfrastructureProvider({
  children,
  options = {},
  loadingComponent,
  errorComponent,
  onReady,
  onError,
}: InfrastructureProviderProps) {
  const [isReady, setIsReady] = useState(isInfrastructureReady());
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<BootstrapProgress | null>(null);
  const [services, setServices] = useState<InfrastructureServices | null>(
    getInfrastructureOrNull()
  );
  const [health, setHealth] = useState<InfrastructureHealthCheck | null>(null);

  const healthCheckInterval = options.healthCheckInterval ?? 60000; // 1 minute default

  // Initialize infrastructure
  const initialize = useCallback(async () => {
    if (isReady || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      const result = await bootstrapInfrastructure(
        {
          skipValidation: options.skipValidation,
          services: options.services,
        },
        (p) => setProgress(p)
      );

      setServices(result);
      setIsReady(true);
      onReady?.(result);

      // Initial health check
      const healthResult = await checkInfrastructureHealth();
      setHealth(healthResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsInitializing(false);
    }
  }, [isReady, isInitializing, options, onReady, onError]);

  // Reinitialize (e.g., after error)
  const reinitialize = useCallback(async () => {
    setIsReady(false);
    setServices(null);
    await shutdownInfrastructure();
    await initialize();
  }, [initialize]);

  // Refresh health check
  const refreshHealth = useCallback(async () => {
    if (!isReady) return;

    try {
      const result = await checkInfrastructureHealth();
      setHealth(result);
    } catch (err) {
      console.error('[InfrastructureContext] Health check failed:', err);
    }
  }, [isReady]);

  // Initialize on mount
  useEffect(() => {
    initialize();

    return () => {
      // Shutdown on unmount
      shutdownInfrastructure().catch(console.error);
    };
  }, [initialize]);

  // Periodic health checks
  useEffect(() => {
    if (!isReady || healthCheckInterval === 0) return;

    const interval = setInterval(refreshHealth, healthCheckInterval);
    return () => clearInterval(interval);
  }, [isReady, healthCheckInterval, refreshHealth]);

  // Context value
  const value = useMemo<InfrastructureContextValue>(
    () => ({
      isReady,
      isInitializing,
      error,
      progress,
      services,
      health,
      refreshHealth,
      reinitialize,
    }),
    [isReady, isInitializing, error, progress, services, health, refreshHealth, reinitialize]
  );

  // Render loading state
  if (isInitializing && !isReady) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {progress?.message ?? 'Initializing infrastructure...'}
          </p>
          {progress && (
            <div className="w-48 bg-muted rounded-full h-2 mt-2 mx-auto overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                data-progress={progress.progress}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isReady) {
    return errorComponent ? (
      <>{errorComponent(error, reinitialize)}</>
    ) : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-destructive text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Initialization Failed</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button
            onClick={reinitialize}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <InfrastructureContext.Provider value={value}>{children}</InfrastructureContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access infrastructure context.
 * Must be used within InfrastructureProvider.
 */
export function useInfrastructureContext(): InfrastructureContextValue {
  const context = useContext(InfrastructureContext);

  if (!context) {
    throw new Error('useInfrastructureContext must be used within InfrastructureProvider');
  }

  return context;
}

/**
 * Check if infrastructure is ready without throwing.
 * Useful for conditional rendering.
 */
export function useInfrastructureReady(): boolean {
  const context = useContext(InfrastructureContext);
  return context?.isReady ?? false;
}

/**
 * Get infrastructure services or null if not ready.
 */
export function useInfrastructureServices(): InfrastructureServices | null {
  const context = useContext(InfrastructureContext);
  return context?.services ?? null;
}

// ============================================================================
// HOC
// ============================================================================

/**
 * Higher-order component that ensures infrastructure is ready before rendering.
 */
export function withInfrastructure<P extends object>(
  Component: React.ComponentType<P & { infrastructure: InfrastructureServices }>
): React.FC<P> {
  return function WithInfrastructure(props: P) {
    const { isReady, services } = useInfrastructureContext();

    if (!isReady || !services) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    return <Component {...props} infrastructure={services} />;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { InfrastructureContext };
