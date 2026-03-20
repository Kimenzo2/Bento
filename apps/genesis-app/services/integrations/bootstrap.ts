/**
 * Integration Bootstrap - Initialize All Third-Party Services
 *
 * Orchestrates the initialization of all Vercel marketplace integrations
 * in the correct order with proper error handling and fallbacks.
 *
 * Initialization Order:
 * 1. Upstash Redis (required for rate limiting)
 * 2. Statsig (feature flags may control other services)
 * 3. Sentry (error tracking should be early)
 * 4. HyperDX (observability)
 * 5. Arcjet (security)
 * 6. Checkly (monitoring)
 *
 * @module services/integrations/bootstrap
 */

import { type UpstashConfig, getUpstashOrNull, initializeUpstash } from './upstash';

import { type SentryConfig, initializeSentry, sentry } from './sentry';

import {
  FEATURE_FLAGS,
  type StatsigConfig,
  type StatsigUser,
  initializeStatsig,
  statsig,
} from './statsig';

import { initializeCheckly } from './checkly';
import type { ChecklyConfig } from './checkly';

import { initializeArcjet } from './arcjet';
import type { ArcjetConfig } from './arcjet';

import { cloudinary } from './cloudinary';
import type { CloudinaryConfig } from './cloudinary';
import { braintrust, initializeBraintrust } from './braintrust';
import type { BraintrustConfig } from './braintrust';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationConfig {
  upstash?: Partial<UpstashConfig>;
  sentry?: Partial<SentryConfig>;
  statsig?: Partial<StatsigConfig>;
  checkly?: Partial<ChecklyConfig>;
  arcjet?: Partial<ArcjetConfig>;
  cloudinary?: Partial<CloudinaryConfig>;
  braintrust?: Partial<BraintrustConfig>;
}

export interface IntegrationStatus {
  name: string;
  initialized: boolean;
  error?: string;
  latency: number;
}

export interface BootstrapResult {
  success: boolean;
  initialized: boolean; // Alias for success - for React context callbacks
  services: IntegrationStatus[];
  totalTime: number;
  errors: string[];
}

export interface IntegrationHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    upstash: { healthy: boolean; latency?: number };
    sentry: { healthy: boolean };
    statsig: { healthy: boolean };
    checkly: { healthy: boolean };
    arcjet: { healthy: boolean };
    cloudinary: { healthy: boolean };
    braintrust: { healthy: boolean };
  };
  timestamp: number;
}

// ============================================================================
// BOOTSTRAP STATE
// ============================================================================

let bootstrapped = false;
let bootstrapResult: BootstrapResult | null = null;
let currentUser: StatsigUser | null = null;
let bootstrapPromise: Promise<BootstrapResult> | null = null;

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize Upstash Redis
 */
async function initUpstash(config?: Partial<UpstashConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    // Build full config from env vars if partial provided
    const fullConfig = config?.url && config?.token ? (config as UpstashConfig) : undefined;
    initializeUpstash(fullConfig);

    // Verify connection
    const upstash = getUpstashOrNull();
    if (upstash) {
      await upstash.ping();
    }

    return {
      name: 'upstash',
      initialized: true,
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'upstash',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Initialize Sentry
 */
async function initSentry(config?: Partial<SentryConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    await initializeSentry(config);

    return {
      name: 'sentry',
      initialized: sentry.isInitialized(),
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'sentry',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Initialize Statsig
 */
async function initStatsig(
  config?: Partial<StatsigConfig>,
  user?: StatsigUser
): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    await initializeStatsig(user, config);

    return {
      name: 'statsig',
      initialized: statsig.isInitialized(),
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'statsig',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Initialize Checkly
 */
async function initCheckly(config?: Partial<ChecklyConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    await initializeCheckly(config);

    return {
      name: 'checkly',
      initialized: true,
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'checkly',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Initialize Arcjet
 */
async function initArcjet(config?: Partial<ArcjetConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    // Check if enabled via feature flag
    const enabled = statsig.isInitialized()
      ? await statsig.checkGate(FEATURE_FLAGS.ARCJET_SECURITY)
      : true;

    if (!enabled) {
      return {
        name: 'arcjet',
        initialized: false,
        error: 'Disabled by feature flag',
        latency: performance.now() - start,
      };
    }

    await initializeArcjet(config);

    return {
      name: 'arcjet',
      initialized: true,
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'arcjet',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

// ============================================================================
// MAIN BOOTSTRAP FUNCTION
// ============================================================================

/**
 * Initialize Cloudinary
 */
async function initCloudinary(config?: Partial<CloudinaryConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    await cloudinary.initialize(config);

    return {
      name: 'cloudinary',
      initialized: cloudinary.isInitialized(),
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'cloudinary',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Initialize Braintrust
 */
async function initBraintrust(config?: Partial<BraintrustConfig>): Promise<IntegrationStatus> {
  const start = performance.now();

  try {
    const configured =
      Boolean(config?.apiKey && config?.projectId) ||
      (typeof process !== 'undefined' &&
        Boolean(process.env.BRAINTRUST_API_KEY && process.env.BRAINTRUST_PROJECT_ID));

    if (!configured) {
      return {
        name: 'braintrust',
        initialized: true,
        latency: performance.now() - start,
      };
    }

    await initializeBraintrust(config);

    return {
      name: 'braintrust',
      initialized: braintrust.isInitialized(),
      latency: performance.now() - start,
    };
  } catch (error) {
    return {
      name: 'braintrust',
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: performance.now() - start,
    };
  }
}

/**
 * Bootstrap all integrations
 */
export async function bootstrapIntegrations(
  config?: IntegrationConfig,
  user?: StatsigUser
): Promise<BootstrapResult> {
  if (bootstrapped && bootstrapResult) {
    return bootstrapResult;
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const startTime = performance.now();
    const services: IntegrationStatus[] = [];
    const errors: string[] = [];

    currentUser = user ?? null;

    // Phase 1: Critical services (sequential)
    // Upstash first - needed for rate limiting
    const upstashStatus = await initUpstash(config?.upstash);
    services.push(upstashStatus);
    if (!upstashStatus.initialized) {
      errors.push(`Upstash: ${upstashStatus.error}`);
    }

    // Statsig second - controls feature flags
    const statsigStatus = await initStatsig(config?.statsig, user);
    services.push(statsigStatus);
    if (!statsigStatus.initialized) {
      errors.push(`Statsig: ${statsigStatus.error}`);
    }

    // Sentry third - error tracking
    const sentryStatus = await initSentry(config?.sentry);
    services.push(sentryStatus);
    if (!sentryStatus.initialized) {
      errors.push(`Sentry: ${sentryStatus.error}`);
    }

    // Phase 2: Non-critical services (parallel)
    const [checklyStatus, arcjetStatus, cloudinaryStatus, braintrustStatus] = await Promise.all([
      initCheckly(config?.checkly),
      initArcjet(config?.arcjet),
      initCloudinary(config?.cloudinary),
      initBraintrust(config?.braintrust),
    ]);

    services.push(checklyStatus);
    if (!checklyStatus.initialized) {
      errors.push(`Checkly: ${checklyStatus.error}`);
    }

    services.push(arcjetStatus);
    if (!arcjetStatus.initialized && !arcjetStatus.error?.includes('feature flag')) {
      errors.push(`Arcjet: ${arcjetStatus.error}`);
    }

    services.push(cloudinaryStatus);
    if (!cloudinaryStatus.initialized) {
      errors.push(`Cloudinary: ${cloudinaryStatus.error}`);
    }

    services.push(braintrustStatus);
    if (!braintrustStatus.initialized && braintrustStatus.error) {
      errors.push(`Braintrust: ${braintrustStatus.error}`);
    }

    const totalTime = performance.now() - startTime;
    const successCount = services.filter((s) => s.initialized).length;
    const isSuccess = errors.length === 0;

    bootstrapResult = {
      success: isSuccess,
      initialized: isSuccess,
      services,
      totalTime,
      errors,
    };

    bootstrapped = true;

    return bootstrapResult;
  })();

  try {
    return await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

/**
 * Update user across all integrations
 */
export async function updateIntegrationUser(user: StatsigUser): Promise<void> {
  currentUser = user;

  // Update all services that support user context
  await Promise.all([
    statsig.updateUser(user),
    sentry.setUser({
      id: user.userID,
      email: user.email,
      tier: user.custom?.tier,
    }),
  ]);
}

/**
 * Clear user from all integrations (logout)
 */
export async function clearIntegrationUser(): Promise<void> {
  currentUser = null;

  await Promise.all([sentry.setUser(null)]);
}

/**
 * Get health status of all integrations
 */
export async function getIntegrationHealth(): Promise<IntegrationHealth> {
  const upstash = getUpstashOrNull();
  const upstashHealthy = upstash ? await upstash.ping() : false;

  let upstashLatency: number | undefined;
  if (upstash) {
    const start = performance.now();
    await upstash.ping();
    upstashLatency = performance.now() - start;
  }

  const braintrustConfigured =
    typeof process !== 'undefined' &&
    Boolean(process.env.BRAINTRUST_API_KEY && process.env.BRAINTRUST_PROJECT_ID);

  const services = {
    upstash: { healthy: upstashHealthy, latency: upstashLatency },
    sentry: { healthy: sentry.isInitialized() },
    statsig: { healthy: statsig.isInitialized() },
    checkly: { healthy: true }, // Checkly is external
    arcjet: { healthy: true }, // Arcjet is stateless
    cloudinary: { healthy: cloudinary.isInitialized() },
    braintrust: { healthy: braintrustConfigured ? braintrust.isInitialized() : true },
  };

  const healthyCount = Object.values(services).filter((s) => s.healthy).length;
  const overall = healthyCount === 7 ? 'healthy' : healthyCount >= 5 ? 'degraded' : 'unhealthy';

  return {
    overall,
    services,
    timestamp: Date.now(),
  };
}

/**
 * Shutdown all integrations
 */
export async function shutdownIntegrations(): Promise<void> {
  await Promise.all([statsig.shutdown(), sentry.flush(), braintrust.flush()]);

  bootstrapped = false;
  bootstrapResult = null;
  bootstrapPromise = null;
}

/**
 * Check if integrations are bootstrapped
 */
export function isIntegrationsReady(): boolean {
  return bootstrapped;
}

/**
 * Get bootstrap result
 */
export function getBootstrapResult(): BootstrapResult | null {
  return bootstrapResult;
}

/**
 * Get current user
 */
export function getCurrentUser(): StatsigUser | null {
  return currentUser;
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for integration status
 */
export function useIntegrations(
  config?: IntegrationConfig,
  user?: StatsigUser
): {
  ready: boolean;
  health: IntegrationHealth | null;
  result: BootstrapResult | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [ready, setReady] = useState(bootstrapped);
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [result, setResult] = useState<BootstrapResult | null>(bootstrapResult);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapped) {
      bootstrapIntegrations(config, user)
        .then((res) => {
          setResult(res);
          setReady(true);
          if (!res.success) {
            setError(res.errors.join(', '));
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Bootstrap failed');
        });
    }
  }, [config, user]);

  useEffect(() => {
    if (ready) {
      getIntegrationHealth().then(setHealth);

      // Refresh health every minute
      const interval = setInterval(() => {
        getIntegrationHealth().then(setHealth);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [ready]);

  const refresh = useCallback(async () => {
    const newHealth = await getIntegrationHealth();
    setHealth(newHealth);
  }, []);

  return { ready, health, result, error, refresh };
}

export default bootstrapIntegrations;
