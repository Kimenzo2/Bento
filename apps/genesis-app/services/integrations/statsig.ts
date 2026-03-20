/**
 * Statsig Integration - Feature Flags & Experimentation
 *
 * Provides enterprise-grade feature flags, A/B testing, and gradual rollouts.
 * Replaces simple env-based feature flags with targeting and analytics.
 *
 * Features:
 * - Feature gates with user targeting
 * - Dynamic configs for remote configuration
 * - A/B experiments with statistical analysis
 * - Gradual rollouts by percentage
 * - User segmentation by tier, country, etc.
 * - Real-time flag updates
 *
 * @see https://docs.statsig.com/client/javascript-sdk
 */

// ============================================================================
// TYPES
// ============================================================================

export interface StatsigConfig {
  clientKey: string;
  environment?: 'development' | 'staging' | 'production';
  initTimeoutMs?: number;
  disableCurrentPageLogging?: boolean;
  disableErrorLogging?: boolean;
}

export interface StatsigUser {
  userID: string;
  email?: string;
  custom?: {
    tier?: 'SPARK' | 'CREATOR' | 'STUDIO' | 'EMPIRE';
    country?: string;
    booksCreated?: number;
    signupDate?: string;
    [key: string]: string | number | boolean | undefined;
  };
  privateAttributes?: {
    ip?: string;
    userAgent?: string;
  };
}

export interface ExperimentConfig {
  name: string;
  defaultValue: Record<string, unknown>;
}

export interface FeatureGate {
  name: string;
  value: boolean;
  ruleID?: string;
}

export interface DynamicConfig {
  name: string;
  value: Record<string, unknown>;
  ruleID?: string;
}

export interface ExperimentResult {
  name: string;
  groupName: string;
  value: Record<string, unknown>;
  ruleID?: string;
}

// ============================================================================
// FEATURE FLAG DEFINITIONS
// ============================================================================

/**
 * All Genesis feature flags
 * Add new flags here to maintain type safety
 */
export const FEATURE_FLAGS = {
  // Core Features
  SEMANTIC_CACHE: 'semantic_cache',
  JOB_QUEUE: 'job_queue',
  R2_STORAGE: 'r2_storage',
  DISTRIBUTED_TRACING: 'distributed_tracing',

  // UI Features
  NEW_ONBOARDING: 'new_onboarding',
  DARK_MODE: 'dark_mode',
  GAMIFICATION_V2: 'gamification_v2',
  AI_ASSISTANT: 'ai_assistant',

  // Premium Features
  VIDEO_EXPORT: 'video_export',
  VOICE_CLONING: 'voice_cloning',
  BRAND_HUB: 'brand_hub',
  COLLABORATION: 'collaboration',

  // Experiments
  CHECKOUT_FLOW_V2: 'checkout_flow_v2',
  PRICING_TEST: 'pricing_test',
  GENERATION_SPEED_TEST: 'generation_speed_test',

  // Rollouts
  UPSTASH_RATE_LIMITING: 'upstash_rate_limiting',
  HYPERDX_OBSERVABILITY: 'hyperdx_observability',
  ARCJET_SECURITY: 'arcjet_security',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Dynamic config definitions
 */
export const DYNAMIC_CONFIGS = {
  RATE_LIMITS: 'rate_limits',
  AI_MODELS: 'ai_models',
  PRICING: 'pricing',
  UI_CONFIG: 'ui_config',
} as const;

export type DynamicConfigName = (typeof DYNAMIC_CONFIGS)[keyof typeof DYNAMIC_CONFIGS];

// ============================================================================
// STATSIG SERVICE
// ============================================================================

// Store client instance
let statsigClient: unknown = null;

class StatsigService {
  private initialized = false;
  private user: StatsigUser | null = null;
  private initPromise: Promise<void> | null = null;

  // Local cache for flags (fallback when Statsig is down)
  private localCache: Map<string, boolean> = new Map();
  private configCache: Map<string, Record<string, unknown>> = new Map();

  /**
   * Initialize Statsig
   */
  async initialize(config: StatsigConfig, user?: StatsigUser): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize(config, user);
    return this.initPromise;
  }

  private async _doInitialize(config: StatsigConfig, user?: StatsigUser): Promise<void> {
    if (!config.clientKey) {
      console.warn('[Statsig] No client key provided, using local defaults');
      this.setLocalDefaults();
      return;
    }

    try {
      // Dynamic import - using new @statsig/js-client package
      const { StatsigClient } = await import('@statsig/js-client');

      const client = new StatsigClient(config.clientKey, user ?? { userID: 'anonymous' });

      await client.initializeAsync();

      statsigClient = client;
      this.user = user ?? null;
      this.initialized = true;
    } catch (error) {
      console.error('[Statsig] Failed to initialize:', error);
      this.setLocalDefaults();
    }
  }

  /**
   * Set local defaults when Statsig is unavailable
   */
  private setLocalDefaults(): void {
    // Enable all core features by default
    this.localCache.set(FEATURE_FLAGS.SEMANTIC_CACHE, true);
    this.localCache.set(FEATURE_FLAGS.JOB_QUEUE, true);
    this.localCache.set(FEATURE_FLAGS.R2_STORAGE, true);
    this.localCache.set(FEATURE_FLAGS.DISTRIBUTED_TRACING, true);
    this.localCache.set(FEATURE_FLAGS.GAMIFICATION_V2, true);

    // Disable experimental features
    this.localCache.set(FEATURE_FLAGS.VIDEO_EXPORT, false);
    this.localCache.set(FEATURE_FLAGS.VOICE_CLONING, false);
    this.localCache.set(FEATURE_FLAGS.UPSTASH_RATE_LIMITING, true);
    this.localCache.set(FEATURE_FLAGS.HYPERDX_OBSERVABILITY, true);
    this.localCache.set(FEATURE_FLAGS.ARCJET_SECURITY, true);
  }

  /**
   * Update user context
   */
  async updateUser(user: StatsigUser): Promise<void> {
    this.user = user;

    if (!this.initialized || !statsigClient) return;

    try {
      const client = statsigClient as { updateUserAsync: (user: StatsigUser) => Promise<void> };
      await client.updateUserAsync(user);
    } catch (error) {
      console.error('[Statsig] Failed to update user:', error);
    }
  }

  /**
   * Check a feature gate
   */
  async checkGate(gateName: FeatureFlagName): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(gateName)) {
      return this.localCache.get(gateName) ?? false;
    }

    if (!this.initialized || !statsigClient) {
      return this.getDefaultValue(gateName);
    }

    try {
      const client = statsigClient as { checkGate: (name: string) => boolean };
      return client.checkGate(gateName);
    } catch {
      return this.getDefaultValue(gateName);
    }
  }

  /**
   * Check gate synchronously (uses cached value)
   */
  checkGateSync(gateName: FeatureFlagName): boolean {
    if (this.localCache.has(gateName)) {
      return this.localCache.get(gateName) ?? false;
    }
    return this.getDefaultValue(gateName);
  }

  /**
   * Get a dynamic config
   */
  async getConfig<T extends Record<string, unknown>>(
    configName: DynamicConfigName,
    defaultValue: T
  ): Promise<T> {
    if (this.configCache.has(configName)) {
      return this.configCache.get(configName) as T;
    }

    if (!this.initialized || !statsigClient) {
      return defaultValue;
    }

    try {
      const client = statsigClient as {
        getDynamicConfig: (name: string) => { value: Record<string, unknown> };
      };
      const config = client.getDynamicConfig(configName);
      return (config.value as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Get an experiment
   */
  async getExperiment<T extends Record<string, unknown>>(
    experimentName: string,
    defaultValue: T
  ): Promise<{ value: T; groupName: string }> {
    if (!this.initialized || !statsigClient) {
      return { value: defaultValue, groupName: 'control' };
    }

    try {
      const client = statsigClient as {
        getExperiment: (name: string) => {
          value: Record<string, unknown>;
          groupName: string | null;
        };
      };
      const experiment = client.getExperiment(experimentName);

      return {
        value: (experiment.value as T) ?? defaultValue,
        groupName: experiment.groupName ?? 'control',
      };
    } catch {
      return { value: defaultValue, groupName: 'control' };
    }
  }

  /**
   * Log an event
   */
  async logEvent(
    eventName: string,
    value?: string | number,
    metadata?: Record<string, string>
  ): Promise<void> {
    if (!this.initialized || !statsigClient) return;

    try {
      const client = statsigClient as {
        logEvent: (
          name: string,
          value?: string | number,
          metadata?: Record<string, string>
        ) => void;
      };
      client.logEvent(eventName, value, metadata);
    } catch (error) {
      console.error('[Statsig] Failed to log event:', error);
    }
  }

  /**
   * Override a gate for testing
   */
  overrideGate(gateName: FeatureFlagName, value: boolean): void {
    this.localCache.set(gateName, value);
  }

  /**
   * Clear overrides
   */
  clearOverrides(): void {
    this.localCache.clear();
    this.configCache.clear();
  }

  /**
   * Get default value for a gate
   */
  private getDefaultValue(gateName: FeatureFlagName): boolean {
    const defaults: Record<string, boolean> = {
      [FEATURE_FLAGS.SEMANTIC_CACHE]: true,
      [FEATURE_FLAGS.JOB_QUEUE]: true,
      [FEATURE_FLAGS.R2_STORAGE]: true,
      [FEATURE_FLAGS.DISTRIBUTED_TRACING]: true,
      [FEATURE_FLAGS.GAMIFICATION_V2]: true,
      [FEATURE_FLAGS.NEW_ONBOARDING]: true,
      [FEATURE_FLAGS.DARK_MODE]: true,
      [FEATURE_FLAGS.VIDEO_EXPORT]: false,
      [FEATURE_FLAGS.VOICE_CLONING]: false,
      [FEATURE_FLAGS.BRAND_HUB]: false,
      [FEATURE_FLAGS.COLLABORATION]: false,
      [FEATURE_FLAGS.UPSTASH_RATE_LIMITING]: true,
      [FEATURE_FLAGS.HYPERDX_OBSERVABILITY]: true,
      [FEATURE_FLAGS.ARCJET_SECURITY]: true,
    };

    return defaults[gateName] ?? false;
  }

  /**
   * Shutdown Statsig
   */
  async shutdown(): Promise<void> {
    if (!this.initialized || !statsigClient) return;

    try {
      const client = statsigClient as { shutdown: () => void };
      client.shutdown();
      statsigClient = null;
      this.initialized = false;
    } catch (error) {
      console.error('[Statsig] Failed to shutdown:', error);
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current user
   */
  getUser(): StatsigUser | null {
    return this.user;
  }
}

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useCallback, useEffect, useState } from 'react';

/**
 * Hook to check a feature gate
 */
export function useFeatureFlag(gateName: FeatureFlagName): boolean {
  const [enabled, setEnabled] = useState(() => statsig.checkGateSync(gateName));

  useEffect(() => {
    statsig.checkGate(gateName).then(setEnabled);
  }, [gateName]);

  return enabled;
}

/**
 * Hook to get a dynamic config
 */
export function useDynamicConfig<T extends Record<string, unknown>>(
  configName: DynamicConfigName,
  defaultValue: T
): T {
  const [config, setConfig] = useState<T>(defaultValue);

  useEffect(() => {
    statsig.getConfig(configName, defaultValue).then(setConfig);
  }, [configName, defaultValue]);

  return config;
}

/**
 * Hook to get an experiment
 */
export function useExperiment<T extends Record<string, unknown>>(
  experimentName: string,
  defaultValue: T
): { value: T; groupName: string; isLoading: boolean } {
  const [result, setResult] = useState<{ value: T; groupName: string }>({
    value: defaultValue,
    groupName: 'control',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    statsig
      .getExperiment(experimentName, defaultValue)
      .then(setResult)
      .finally(() => setIsLoading(false));
  }, [experimentName, defaultValue]);

  return { ...result, isLoading };
}

/**
 * Hook for logging events
 */
export function useStatsigLogger() {
  return useCallback(
    (eventName: string, value?: string | number, metadata?: Record<string, string>) => {
      statsig.logEvent(eventName, value, metadata);
    },
    []
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check multiple gates at once
 */
export async function checkGates(
  gates: FeatureFlagName[]
): Promise<Record<FeatureFlagName, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    gates.map(async (gate) => {
      results[gate] = await statsig.checkGate(gate);
    })
  );

  return results as Record<FeatureFlagName, boolean>;
}

/**
 * Feature flag guard for routes/components
 */
export async function requireFeature(
  gateName: FeatureFlagName,
  fallback?: () => void
): Promise<boolean> {
  const enabled = await statsig.checkGate(gateName);

  if (!enabled && fallback) {
    fallback();
  }

  return enabled;
}

type UserTier = 'SPARK' | 'CREATOR' | 'STUDIO' | 'EMPIRE';

/**
 * Get tier-based feature access
 */
export function getTierFeatures(tier: UserTier | undefined): FeatureFlagName[] {
  const baseFeatures: FeatureFlagName[] = [
    FEATURE_FLAGS.SEMANTIC_CACHE,
    FEATURE_FLAGS.GAMIFICATION_V2,
    FEATURE_FLAGS.NEW_ONBOARDING,
    FEATURE_FLAGS.DARK_MODE,
  ];

  switch (tier) {
    case 'EMPIRE':
      return [
        ...baseFeatures,
        FEATURE_FLAGS.VIDEO_EXPORT,
        FEATURE_FLAGS.VOICE_CLONING,
        FEATURE_FLAGS.BRAND_HUB,
        FEATURE_FLAGS.COLLABORATION,
        FEATURE_FLAGS.AI_ASSISTANT,
      ];
    case 'STUDIO':
      return [
        ...baseFeatures,
        FEATURE_FLAGS.VIDEO_EXPORT,
        FEATURE_FLAGS.BRAND_HUB,
        FEATURE_FLAGS.COLLABORATION,
      ];
    case 'CREATOR':
      return [...baseFeatures, FEATURE_FLAGS.AI_ASSISTANT];
    case 'SPARK':
    default:
      return baseFeatures;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const statsig = new StatsigService();

/**
 * Initialize Statsig with environment config
 */
export function initializeStatsig(
  user?: StatsigUser,
  config?: Partial<StatsigConfig>
): Promise<void> {
  const finalConfig: StatsigConfig = {
    clientKey: config?.clientKey ?? import.meta.env.VITE_STATSIG_CLIENT_KEY ?? '',
    environment: (config?.environment ??
      import.meta.env.VITE_APP_ENVIRONMENT ??
      'development') as StatsigConfig['environment'],
    initTimeoutMs: config?.initTimeoutMs ?? 3000,
  };

  return statsig.initialize(finalConfig, user);
}

export default statsig;
