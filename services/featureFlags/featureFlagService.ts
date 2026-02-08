/**
 * Feature Flag Service
 *
 * Enables progressive rollouts and A/B testing for Genesis.
 *
 * Features:
 * - Simple on/off flags
 * - Percentage-based rollouts
 * - User-specific targeting
 * - A/B testing variants
 *
 * For now, uses in-memory configuration.
 * Can be upgraded to Flagsmith, LaunchDarkly, or Supabase-based flags.
 */

import { hashToPercentageSync } from '../../utils/crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  allowedUserIds?: string[];
  allowedTiers?: string[];
  variants?: Record<string, number>; // variant name -> percentage
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagContext {
  userId?: string;
  tier?: string;
  email?: string;
  sessionId?: string;
}

// ============================================================================
// FLAG DEFINITIONS
// ============================================================================

const FLAGS: Record<string, FeatureFlag> = {
  // New image generation engine
  imagen_v2: {
    name: 'imagen_v2',
    description: 'Use Imagen 4 instead of Imagen 3',
    enabled: true,
    rolloutPercentage: 100, // Fully rolled out
  },

  // New editor experience
  new_editor: {
    name: 'new_editor',
    description: 'Enhanced book editor with AI suggestions',
    enabled: false,
    rolloutPercentage: 0,
  },

  // AI cost optimization
  smart_model_selection: {
    name: 'smart_model_selection',
    description: 'Automatically select cheaper models for simple tasks',
    enabled: true,
    rolloutPercentage: 50,
  },

  // Curriculum alignment feature
  curriculum_ai_alignment: {
    name: 'curriculum_ai_alignment',
    description: 'AI-powered curriculum standards alignment',
    enabled: true,
    allowedTiers: ['CREATOR', 'STUDIO', 'EMPIRE'],
  },

  // Green Room enhancements
  green_room_v2: {
    name: 'green_room_v2',
    description: 'Enhanced Green Room with voice support',
    enabled: false,
    rolloutPercentage: 10, // 10% of users
  },

  // A/B test: recommendation algorithm
  recommendation_algorithm: {
    name: 'recommendation_algorithm',
    description: 'Test different recommendation strategies',
    enabled: true,
    variants: {
      collaborative: 33,
      content_based: 33,
      hybrid: 34,
    },
  },

  // Caching experiment
  aggressive_caching: {
    name: 'aggressive_caching',
    description: 'More aggressive caching for AI responses',
    enabled: true,
    rolloutPercentage: 25,
  },

  // Premium features preview
  premium_preview: {
    name: 'premium_preview',
    description: 'Preview premium features for free users',
    enabled: false,
    allowedUserIds: [], // Add specific user IDs here
  },
};

// ============================================================================
// FEATURE FLAG SERVICE
// ============================================================================

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private overrides: Map<string, boolean> = new Map(); // Runtime overrides

  constructor() {
    // Initialize flags from definitions
    for (const [name, flag] of Object.entries(FLAGS)) {
      this.flags.set(name, flag);
    }
  }

  /**
   * Hash a string to a consistent number between 0-99
   * Uses browser-compatible Web Crypto API
   */
  private hashToPercentage(input: string): number {
    return hashToPercentageSync('feature-flag', input);
  }

  /**
   * Check if a feature is enabled for a given context
   */
  isEnabled(flagName: string, context: FeatureFlagContext = {}): boolean {
    // Check runtime override first
    if (this.overrides.has(flagName)) {
      return this.overrides.get(flagName)!;
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`[Feature Flag] Unknown flag: ${flagName}`);
      return false;
    }

    // Check if globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check user allowlist
    if (flag.allowedUserIds && flag.allowedUserIds.length > 0) {
      if (context.userId && flag.allowedUserIds.includes(context.userId)) {
        return true;
      }
    }

    // Check tier restrictions
    if (flag.allowedTiers && flag.allowedTiers.length > 0) {
      if (!context.tier || !flag.allowedTiers.includes(context.tier)) {
        return false;
      }
    }

    // Check percentage rollout
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const identifier = context.userId || context.sessionId || 'anonymous';
      const userPercentage = this.hashToPercentage(`${flagName}:${identifier}`);
      return userPercentage < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get variant for A/B test
   */
  getVariant(flagName: string, context: FeatureFlagContext = {}): string | null {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled || !flag.variants) {
      return null;
    }

    const identifier = context.userId || context.sessionId || 'anonymous';
    const userPercentage = this.hashToPercentage(`${flagName}:${identifier}`);

    let cumulative = 0;
    for (const [variant, percentage] of Object.entries(flag.variants)) {
      cumulative += percentage;
      if (userPercentage < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return Object.keys(flag.variants)[0];
  }

  /**
   * Get feature value with default
   */
  getValue<T>(flagName: string, context: FeatureFlagContext, defaultValue: T): T {
    if (!this.isEnabled(flagName, context)) {
      return defaultValue;
    }

    const flag = this.flags.get(flagName);
    if (flag?.metadata) {
      return (flag.metadata.value as T) ?? defaultValue;
    }

    return defaultValue;
  }

  /**
   * Set runtime override (useful for testing)
   */
  setOverride(flagName: string, value: boolean): void {
    this.overrides.set(flagName, value);
    // eslint-disable-next-line no-console
    console.log(`[Feature Flag] Override set: ${flagName} = ${value}`);
  }

  /**
   * Clear runtime override
   */
  clearOverride(flagName: string): void {
    this.overrides.delete(flagName);
    // eslint-disable-next-line no-console
    console.log(`[Feature Flag] Override cleared: ${flagName}`);
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    this.overrides.clear();
    // eslint-disable-next-line no-console
    console.log('[Feature Flag] All overrides cleared');
  }

  /**
   * Get all flags with their current state
   */
  getAllFlags(
    context: FeatureFlagContext = {}
  ): Record<string, { enabled: boolean; variant?: string }> {
    const result: Record<string, { enabled: boolean; variant?: string }> = {};

    for (const [name, flag] of this.flags) {
      result[name] = {
        enabled: this.isEnabled(name, context),
        variant: flag.variants ? (this.getVariant(name, context) ?? undefined) : undefined,
      };
    }

    return result;
  }

  /**
   * Update flag configuration at runtime
   */
  updateFlag(flagName: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`[Feature Flag] Cannot update unknown flag: ${flagName}`);
      return;
    }

    this.flags.set(flagName, { ...flag, ...updates });
    // eslint-disable-next-line no-console
    console.log(`[Feature Flag] Updated: ${flagName}`, updates);
  }

  /**
   * Log flag evaluation for analytics
   */
  private logEvaluation(
    flagName: string,
    context: FeatureFlagContext,
    result: boolean,
    variant?: string
  ): void {
    // TODO: Send to analytics
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        `[Feature Flag] ${flagName} -> ${result}${variant ? ` (${variant})` : ''}`,
        context
      );
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const featureFlags = new FeatureFlagService();

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Check if feature is enabled for current user
 */
export function isFeatureEnabled(flagName: string, userId?: string, tier?: string): boolean {
  return featureFlags.isEnabled(flagName, { userId, tier });
}

/**
 * Get variant for A/B test
 */
export function getFeatureVariant(flagName: string, userId?: string): string | null {
  return featureFlags.getVariant(flagName, { userId });
}

// ============================================================================
// REACT HOOK (if using React)
// ============================================================================

// Usage in React component:
// const isNewEditorEnabled = useFeatureFlag('new_editor', userId, tier);

export function createFeatureFlagHook() {
  return function useFeatureFlag(flagName: string, userId?: string, tier?: string): boolean {
    // In a real implementation, this would use React state
    return featureFlags.isEnabled(flagName, { userId, tier });
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  featureFlags,
  isFeatureEnabled,
  getFeatureVariant,
  FLAGS,
};
