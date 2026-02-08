/**
 * Integrations Context - React Provider for All Services
 *
 * Provides centralized access to all integration services with:
 * - Automatic initialization on mount
 * - User context synchronization
 * - Health monitoring
 * - Error boundaries
 *
 * @example
 * ```tsx
 * // In your app root
 * <IntegrationsProvider user={user}>
 *   <App />
 * </IntegrationsProvider>
 *
 * // In any component
 * const { isReady, health, sentry, upstash } = useIntegrationsContext();
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
  type BootstrapResult,
  type IntegrationConfig,
  type IntegrationHealth,
  bootstrapIntegrations,
  clearIntegrationUser,
  getIntegrationHealth,
  isIntegrationsReady,
  updateIntegrationUser,
} from '../services/integrations/bootstrap';

import { arcjet } from '../services/integrations/arcjet';
import { checkly } from '../services/integrations/checkly';
import { hyperdx } from '../services/integrations/hyperdx';
import { sentry } from '../services/integrations/sentry';
import {
  FEATURE_FLAGS,
  type FeatureFlagName,
  type StatsigUser,
  statsig,
} from '../services/integrations/statsig';
import { type UpstashRedis, getUpstashOrNull } from '../services/integrations/upstash';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationsContextValue {
  // Status
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  health: IntegrationHealth | null;
  result: BootstrapResult | null;

  // Services
  sentry: typeof sentry;
  statsig: typeof statsig;
  hyperdx: typeof hyperdx;
  upstash: UpstashRedis | null;
  checkly: typeof checkly;
  arcjet: typeof arcjet;

  // Methods
  checkFeature: (flag: FeatureFlagName) => boolean;
  refreshHealth: () => Promise<void>;
  updateUser: (user: StatsigUser) => Promise<void>;
  clearUser: () => Promise<void>;
}

export interface IntegrationsProviderProps {
  children: ReactNode;

  /**
   * Initial user for feature flags and error tracking
   */
  user?: StatsigUser;

  /**
   * Configuration overrides
   */
  config?: IntegrationConfig;

  /**
   * Component to show while initializing
   */
  loadingComponent?: ReactNode;

  /**
   * Component to show on initialization error
   */
  errorComponent?: (error: Error, retry: () => void) => ReactNode;

  /**
   * Callback when ready
   */
  onReady?: (result: BootstrapResult) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const IntegrationsContext = createContext<IntegrationsContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function IntegrationsProvider({
  children,
  user,
  config,
  loadingComponent,
  errorComponent,
  onReady,
  onError,
}: IntegrationsProviderProps): React.ReactElement {
  const [isReady, setIsReady] = useState(isIntegrationsReady());
  const [isInitializing, setIsInitializing] = useState(!isIntegrationsReady());
  const [error, setError] = useState<Error | null>(null);
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [result, setResult] = useState<BootstrapResult | null>(null);

  // Feature flag cache for synchronous access
  const [flagCache, setFlagCache] = useState<Map<string, boolean>>(new Map());

  // Initialize on mount
  useEffect(() => {
    if (isReady) return;

    let cancelled = false;

    async function init() {
      try {
        const bootstrapResult = await bootstrapIntegrations(config, user);

        if (cancelled) return;

        setResult(bootstrapResult);
        setIsReady(true);
        setIsInitializing(false);

        // Pre-fetch common feature flags
        const flagNames = Object.values(FEATURE_FLAGS) as string[];
        const flags = await Promise.all(
          flagNames.map(async (flag) => ({
            flag,
            value: await statsig.checkGate(flag as FeatureFlagName),
          }))
        );

        const newCache = new Map<string, boolean>();
        flags.forEach(({ flag, value }) => newCache.set(flag, value));
        setFlagCache(newCache);

        // Get initial health
        const initialHealth = await getIntegrationHealth();
        setHealth(initialHealth);

        onReady?.(bootstrapResult);
      } catch (err) {
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsInitializing(false);
        onError?.(error);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [config, user, isReady, onReady, onError]);

  // Update user when it changes
  useEffect(() => {
    if (!isReady || !user) return;

    updateIntegrationUser(user);
  }, [isReady, user]);

  // Health check interval
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(async () => {
      const newHealth = await getIntegrationHealth();
      setHealth(newHealth);
    }, 60000);

    return () => clearInterval(interval);
  }, [isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't shutdown on unmount - other parts of the app may still need services
      // shutdownIntegrations();
    };
  }, []);

  // Methods
  const checkFeature = useCallback(
    (flag: FeatureFlagName): boolean => {
      return flagCache.get(flag) ?? false;
    },
    [flagCache]
  );

  const refreshHealth = useCallback(async () => {
    const newHealth = await getIntegrationHealth();
    setHealth(newHealth);
  }, []);

  const updateUser = useCallback(async (newUser: StatsigUser) => {
    await updateIntegrationUser(newUser);
  }, []);

  const clearUser = useCallback(async () => {
    await clearIntegrationUser();
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setIsInitializing(true);
    setIsReady(false);
  }, []);

  // Context value
  const contextValue = useMemo<IntegrationsContextValue>(
    () => ({
      isReady,
      isInitializing,
      error,
      health,
      result,
      sentry,
      statsig,
      hyperdx,
      upstash: getUpstashOrNull(),
      checkly,
      arcjet,
      checkFeature,
      refreshHealth,
      updateUser,
      clearUser,
    }),
    [
      isReady,
      isInitializing,
      error,
      health,
      result,
      checkFeature,
      refreshHealth,
      updateUser,
      clearUser,
    ]
  );

  // Render states
  if (error && errorComponent) {
    return <>{errorComponent(error, retry)}</>;
  }

  if (isInitializing && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  return (
    <IntegrationsContext.Provider value={contextValue}>{children}</IntegrationsContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access integrations context
 */
export function useIntegrationsContext(): IntegrationsContextValue {
  const context = useContext(IntegrationsContext);

  if (!context) {
    throw new Error('useIntegrationsContext must be used within IntegrationsProvider');
  }

  return context;
}

/**
 * Check if integrations are ready (safe to use outside provider)
 */
export function useIntegrationsReady(): boolean {
  const context = useContext(IntegrationsContext);
  return context?.isReady ?? false;
}

/**
 * Get integration health (safe to use outside provider)
 */
export function useIntegrationsHealth(): IntegrationHealth | null {
  const context = useContext(IntegrationsContext);
  return context?.health ?? null;
}

// ============================================================================
// HOC
// ============================================================================

/**
 * Higher-order component to require integrations
 */
export function withIntegrations<P extends object>(
  Component: React.ComponentType<P & { integrations: IntegrationsContextValue }>
): React.ComponentType<P> {
  return function WithIntegrations(props: P) {
    const integrations = useIntegrationsContext();
    return <Component {...props} integrations={integrations} />;
  };
}

/**
 * Higher-order component to require a feature flag
 */
export function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  flag: FeatureFlagName,
  Fallback?: React.ComponentType<P>
): React.ComponentType<P> {
  return function WithFeatureFlag(props: P) {
    const { checkFeature, isReady } = useIntegrationsContext();

    if (!isReady) {
      return null;
    }

    if (!checkFeature(flag)) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}

export default IntegrationsProvider;
