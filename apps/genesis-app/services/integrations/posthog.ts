/**
 * PostHog Product Analytics Integration
 *
 * Product analytics with feature flags, session replay, and A/B testing.
 * Features: Event tracking, funnels, cohorts, heatmaps.
 *
 * @see https://posthog.com/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PostHogUser {
  id: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface EventProperties {
  [key: string]: unknown;
}

export interface GroupProperties {
  id: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface FeatureFlagPayload {
  key: string;
  variant?: string;
  payload?: unknown;
}

export interface PostHogConfig {
  apiKey: string;
  apiHost?: string;
  autocapture?: boolean;
  capturePageview?: boolean;
  capturePageleave?: boolean;
  persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';
  sessionRecording?: boolean;
  maskAllInputs?: boolean;
}

// ============================================================================
// EVENT DEFINITIONS
// ============================================================================

export const POSTHOG_EVENTS = {
  // Core actions
  BOOK_CREATED: 'book_created',
  BOOK_PUBLISHED: 'book_published',
  BOOK_EXPORTED: 'book_exported',
  BOOK_SHARED: 'book_shared',
  BOOK_DELETED: 'book_deleted',

  // AI usage
  AI_GENERATION_STARTED: 'ai_generation_started',
  AI_GENERATION_COMPLETED: 'ai_generation_completed',
  AI_GENERATION_FAILED: 'ai_generation_failed',

  // Engagement
  CHAPTER_WRITTEN: 'chapter_written',
  COVER_DESIGNED: 'cover_designed',
  AUDIOBOOK_GENERATED: 'audiobook_generated',

  // Conversion funnel
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  TRIAL_STARTED: 'trial_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Feature usage
  FEATURE_USED: 'feature_used',
  PREMIUM_FEATURE_BLOCKED: 'premium_feature_blocked',
  TEMPLATE_SELECTED: 'template_selected',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  PAYMENT_FAILED: 'payment_failed',
} as const;

// ============================================================================
// POSTHOG SERVICE CLASS
// ============================================================================

class PostHogService {
  private initialized = false;
  private config: PostHogConfig | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;

  /**
   * Initialize PostHog
   */
  async initialize(config?: Partial<PostHogConfig>): Promise<boolean> {
    const apiKey = config?.apiKey || import.meta.env.VITE_POSTHOG_API_KEY;

    if (!apiKey) {
      return false;
    }

    this.config = {
      apiKey,
      apiHost: config?.apiHost || 'https://app.posthog.com',
      autocapture: config?.autocapture ?? true,
      capturePageview: config?.capturePageview ?? true,
      capturePageleave: config?.capturePageleave ?? true,
      persistence: config?.persistence || 'localStorage',
      sessionRecording: config?.sessionRecording ?? true,
      maskAllInputs: config?.maskAllInputs ?? true,
    };

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Auto-capture pageview
    if (this.config.capturePageview) {
      this.capture('$pageview', {
        $current_url: window.location.href,
        $pathname: window.location.pathname,
      });
    }

    this.initialized = true;
    return true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get distinct ID (user or anonymous)
   */
  private getDistinctId(): string {
    if (this.userId) return this.userId;

    // Check localStorage for anonymous ID
    let anonId = localStorage.getItem('posthog_anon_id');
    if (!anonId) {
      anonId = `anon-${this.generateSessionId()}`;
      localStorage.setItem('posthog_anon_id', anonId);
    }
    return anonId;
  }

  /**
   * Make API request to PostHog
   */
  private async request(endpoint: string, data: Record<string, unknown>): Promise<void> {
    if (!this.config) return;

    try {
      await fetch(`${this.config.apiHost}${endpoint}?ip=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          ...data,
        }),
      });
    } catch {
      // Silently fail analytics
    }
  }

  // ============================================================================
  // IDENTIFICATION
  // ============================================================================

  /**
   * Identify user
   */
  identify(userId: string, properties?: PostHogUser): void {
    const previousId = this.getDistinctId();
    this.userId = userId;

    this.request('/capture/', {
      event: '$identify',
      distinct_id: userId,
      $anon_distinct_id: previousId,
      properties: {
        $set: properties,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reset user (logout)
   */
  reset(): void {
    this.userId = null;
    localStorage.removeItem('posthog_anon_id');
  }

  /**
   * Alias user
   */
  alias(alias: string): void {
    this.request('/capture/', {
      event: '$create_alias',
      distinct_id: this.getDistinctId(),
      properties: {
        alias,
      },
    });
  }

  /**
   * Set user properties
   */
  setPersonProperties(properties: Record<string, unknown>): void {
    this.request('/capture/', {
      event: '$set',
      distinct_id: this.getDistinctId(),
      properties: {
        $set: properties,
      },
    });
  }

  /**
   * Set user properties once (won't overwrite)
   */
  setPersonPropertiesOnce(properties: Record<string, unknown>): void {
    this.request('/capture/', {
      event: '$set',
      distinct_id: this.getDistinctId(),
      properties: {
        $set_once: properties,
      },
    });
  }

  // ============================================================================
  // EVENT TRACKING
  // ============================================================================

  /**
   * Capture event
   */
  capture(event: string, properties?: EventProperties): void {
    if (!this.isInitialized()) return;

    this.request('/capture/', {
      event,
      distinct_id: this.getDistinctId(),
      properties: {
        ...properties,
        $session_id: this.sessionId,
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        $screen_width: window.screen.width,
        $screen_height: window.screen.height,
        $lib: 'genesis-posthog',
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Capture pageview
   */
  capturePageview(url?: string): void {
    this.capture('$pageview', {
      $current_url: url || window.location.href,
      $pathname: url ? new URL(url).pathname : window.location.pathname,
    });
  }

  /**
   * Capture pageleave
   */
  capturePageleave(): void {
    this.capture('$pageleave', {
      $current_url: window.location.href,
    });
  }

  // ============================================================================
  // GROUPS
  // ============================================================================

  /**
   * Associate user with group
   */
  group(type: string, key: string, properties?: Record<string, unknown>): void {
    this.request('/capture/', {
      event: '$groupidentify',
      distinct_id: this.getDistinctId(),
      properties: {
        $group_type: type,
        $group_key: key,
        $group_set: properties,
      },
    });
  }

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================

  /**
   * Get feature flag value
   */
  async getFeatureFlag(key: string): Promise<boolean | string | undefined> {
    if (!this.config) return undefined;

    try {
      const response = await fetch(`${this.config.apiHost}/decide/?v=3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          distinct_id: this.getDistinctId(),
        }),
      });

      const data = await response.json();
      return data.featureFlags?.[key];
    } catch {
      return undefined;
    }
  }

  /**
   * Check if feature is enabled
   */
  async isFeatureEnabled(key: string): Promise<boolean> {
    const value = await this.getFeatureFlag(key);
    return value === true || value === 'true';
  }

  /**
   * Get feature flag payload
   */
  async getFeatureFlagPayload(key: string): Promise<unknown> {
    if (!this.config) return undefined;

    try {
      const response = await fetch(`${this.config.apiHost}/decide/?v=3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          distinct_id: this.getDistinctId(),
        }),
      });

      const data = await response.json();
      return data.featureFlagPayloads?.[key];
    } catch {
      return undefined;
    }
  }

  // ============================================================================
  // GENESIS-SPECIFIC HELPERS
  // ============================================================================

  /**
   * Track book creation
   */
  trackBookCreated(data: {
    bookId: string;
    title: string;
    genre: string;
    template?: string;
  }): void {
    this.capture(POSTHOG_EVENTS.BOOK_CREATED, {
      book_id: data.bookId,
      book_title: data.title,
      genre: data.genre,
      template: data.template,
    });
  }

  /**
   * Track AI generation
   */
  trackAIGeneration(data: {
    type: 'chapter' | 'cover' | 'audiobook' | 'translation';
    bookId: string;
    model?: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): void {
    const event = data.success
      ? POSTHOG_EVENTS.AI_GENERATION_COMPLETED
      : POSTHOG_EVENTS.AI_GENERATION_FAILED;

    this.capture(event, {
      generation_type: data.type,
      book_id: data.bookId,
      model: data.model,
      duration_ms: data.duration,
      error: data.error,
    });
  }

  /**
   * Track subscription event
   */
  trackSubscription(data: {
    action: 'started' | 'upgraded' | 'cancelled';
    plan: string;
    previousPlan?: string;
    amount?: number;
    currency?: string;
  }): void {
    const eventMap = {
      started: POSTHOG_EVENTS.SUBSCRIPTION_STARTED,
      upgraded: POSTHOG_EVENTS.SUBSCRIPTION_UPGRADED,
      cancelled: POSTHOG_EVENTS.SUBSCRIPTION_CANCELLED,
    };

    this.capture(eventMap[data.action], {
      plan: data.plan,
      previous_plan: data.previousPlan,
      amount: data.amount,
      currency: data.currency,
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsed(feature: string, properties?: Record<string, unknown>): void {
    this.capture(POSTHOG_EVENTS.FEATURE_USED, {
      feature,
      ...properties,
    });
  }

  /**
   * Track premium feature blocked (for conversion analysis)
   */
  trackPremiumBlocked(feature: string, currentPlan: string): void {
    this.capture(POSTHOG_EVENTS.PREMIUM_FEATURE_BLOCKED, {
      feature,
      current_plan: currentPlan,
    });
  }

  /**
   * Track error
   */
  trackError(error: {
    message: string;
    stack?: string;
    context?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }): void {
    this.capture(POSTHOG_EVENTS.ERROR_OCCURRED, {
      error_message: error.message,
      error_stack: error.stack,
      error_context: error.context,
      severity: error.severity || 'medium',
    });
  }

  /**
   * Track funnel step
   */
  trackFunnelStep(funnel: string, step: number, stepName: string): void {
    this.capture(`${funnel}_step_${step}`, {
      funnel,
      step,
      step_name: stepName,
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const posthog = new PostHogService();

export function initializePostHog(config?: Partial<PostHogConfig>): Promise<boolean> {
  return posthog.initialize(config);
}

export default posthog;
