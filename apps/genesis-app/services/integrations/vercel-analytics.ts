/**
 * Vercel Analytics & Speed Insights Integration
 *
 * Wraps @vercel/analytics and @vercel/speed-insights with:
 * - Custom event tracking
 * - Conversion funnels
 * - Feature usage metrics
 * - User journey tracking
 *
 * @packageDocumentation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
}

export interface ConversionStep {
  step: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UserJourney {
  sessionId: string;
  userId?: string;
  steps: ConversionStep[];
  startedAt: number;
  completedAt?: number;
}

export type EventCategory =
  | 'book_creation'
  | 'authentication'
  | 'subscription'
  | 'ai_generation'
  | 'sharing'
  | 'gamification'
  | 'curriculum'
  | 'export'
  | 'error'
  | 'navigation'
  | 'engagement';

// ============================================================================
// PREDEFINED EVENTS
// ============================================================================

export const ANALYTICS_EVENTS = {
  // Book Creation Flow
  BOOK_STARTED: 'book_creation_started',
  BOOK_TITLE_SET: 'book_title_set',
  BOOK_CHAPTERS_DEFINED: 'book_chapters_defined',
  BOOK_GENERATION_STARTED: 'book_generation_started',
  BOOK_GENERATION_COMPLETED: 'book_generation_completed',
  BOOK_GENERATION_FAILED: 'book_generation_failed',
  BOOK_SAVED: 'book_saved',
  BOOK_DELETED: 'book_deleted',

  // AI Features
  AI_GENERATION_REQUESTED: 'ai_generation_requested',
  AI_GENERATION_COMPLETED: 'ai_generation_completed',
  AI_GENERATION_FAILED: 'ai_generation_failed',
  AI_PROVIDER_SWITCHED: 'ai_provider_switched',
  AI_TOKENS_USED: 'ai_tokens_used',

  // Authentication
  AUTH_SIGNUP_STARTED: 'auth_signup_started',
  AUTH_SIGNUP_COMPLETED: 'auth_signup_completed',
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_PASSWORD_RESET: 'auth_password_reset',
  AUTH_EMAIL_VERIFIED: 'auth_email_verified',

  // Subscription
  SUBSCRIPTION_PAGE_VIEWED: 'subscription_page_viewed',
  SUBSCRIPTION_PLAN_SELECTED: 'subscription_plan_selected',
  SUBSCRIPTION_CHECKOUT_STARTED: 'subscription_checkout_started',
  SUBSCRIPTION_COMPLETED: 'subscription_completed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',

  // Sharing
  BOOK_SHARED: 'book_shared',
  SHARE_LINK_COPIED: 'share_link_copied',
  SHARE_VIEWED: 'share_viewed',
  CURRICULUM_SHARED: 'curriculum_shared',

  // Gamification
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  LEVEL_UP: 'level_up',
  STREAK_CONTINUED: 'streak_continued',
  CHALLENGE_COMPLETED: 'challenge_completed',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',

  // Export
  EXPORT_STARTED: 'export_started',
  EXPORT_COMPLETED: 'export_completed',
  EXPORT_FAILED: 'export_failed',

  // Engagement
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  FEATURE_USED: 'feature_used',
  ERROR_DISPLAYED: 'error_displayed',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ============================================================================
// CONVERSION FUNNELS
// ============================================================================

export const CONVERSION_FUNNELS = {
  BOOK_CREATION: [
    'book_creation_started',
    'book_title_set',
    'book_chapters_defined',
    'book_generation_started',
    'book_generation_completed',
    'book_saved',
  ],

  SUBSCRIPTION: [
    'subscription_page_viewed',
    'subscription_plan_selected',
    'subscription_checkout_started',
    'subscription_completed',
  ],

  ONBOARDING: [
    'auth_signup_started',
    'auth_signup_completed',
    'auth_email_verified',
    'book_creation_started',
    'book_generation_completed',
  ],

  SHARING: ['book_saved', 'book_shared', 'share_link_copied'],
} as const;

export type FunnelName = keyof typeof CONVERSION_FUNNELS;

// ============================================================================
// SESSION STORAGE
// ============================================================================

const JOURNEY_KEY = 'genesis_user_journey';
const SESSION_KEY = 'genesis_session_id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getJourney(): UserJourney {
  if (typeof window === 'undefined') {
    return {
      sessionId: 'server',
      steps: [],
      startedAt: Date.now(),
    };
  }

  const stored = sessionStorage.getItem(JOURNEY_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid data
    }
  }

  const journey: UserJourney = {
    sessionId: getSessionId(),
    steps: [],
    startedAt: Date.now(),
  };

  sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
  return journey;
}

function saveJourney(journey: UserJourney): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

class VercelAnalyticsService {
  private initialized = false;
  private queue: AnalyticsEvent[] = [];
  private trackFn:
    | ((eventName: string, properties?: Record<string, string | number | boolean | null>) => void)
    | null = null;

  constructor() {
    // Auto-initialize in browser
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialize Vercel Analytics
   */
  async initialize(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') return;

    try {
      // Dynamic import to support SSR
      const { track } = await import('@vercel/analytics');
      this.trackFn = track;

      // Process queued events
      this.queue.forEach((event) => {
        this.trackFn!(event.name, event.properties);
      });
      this.queue = [];

      this.initialized = true;

      // Track session start
      this.trackEvent(ANALYTICS_EVENTS.SESSION_STARTED, {
        session_id: getSessionId(),
        referrer: document.referrer || 'direct',
        landing_page: window.location.pathname,
      });
    } catch (error) {
      console.warn('[VercelAnalytics] Failed to initialize:', error);
    }
  }

  /**
   * Track an event
   */
  trackEvent(
    name: AnalyticsEventName | string,
    properties?: Record<string, string | number | boolean | null>
  ): void {
    const event: AnalyticsEvent = { name, properties };

    if (!this.initialized || !this.trackFn) {
      this.queue.push(event);
      return;
    }

    try {
      this.trackFn(name, properties ?? undefined);

      // Also add to user journey
      this.addJourneyStep(name, properties);
    } catch (error) {
      console.warn('[VercelAnalytics] Failed to track event:', error);
    }
  }

  /**
   * Track a categorized event
   */
  trackCategorizedEvent(
    category: EventCategory,
    action: string,
    properties?: Record<string, string | number | boolean | null>
  ): void {
    this.trackEvent(`${category}_${action}`, {
      category,
      action,
      ...properties,
    });
  }

  /**
   * Add step to user journey
   */
  private addJourneyStep(step: string, metadata?: Record<string, unknown>): void {
    const journey = getJourney();

    journey.steps.push({
      step,
      timestamp: Date.now(),
      metadata,
    });

    saveJourney(journey);
  }

  /**
   * Get current user journey
   */
  getJourney(): UserJourney {
    return getJourney();
  }

  /**
   * Set user ID for journey tracking
   */
  setUserId(userId: string): void {
    const journey = getJourney();
    journey.userId = userId;
    saveJourney(journey);
  }

  /**
   * Complete a conversion funnel
   */
  completeFunnel(funnelName: FunnelName): void {
    const journey = getJourney();
    journey.completedAt = Date.now();
    saveJourney(journey);

    this.trackEvent('funnel_completed', {
      funnel: funnelName,
      steps_completed: journey.steps.length,
      duration_ms: journey.completedAt - journey.startedAt,
    });
  }

  /**
   * Get funnel progress
   */
  getFunnelProgress(funnelName: FunnelName): {
    funnel: FunnelName;
    steps: readonly string[];
    completed: string[];
    progress: number;
    dropOffStep?: string;
  } {
    const funnel = CONVERSION_FUNNELS[funnelName];
    const journey = getJourney();
    const completedSteps = journey.steps.map((s) => s.step);

    const completed = funnel.filter((step) => completedSteps.includes(step));
    const progress = completed.length / funnel.length;

    // Find drop-off point
    let dropOffStep: string | undefined;
    for (const step of funnel) {
      if (!completedSteps.includes(step)) {
        dropOffStep = step;
        break;
      }
    }

    return {
      funnel: funnelName,
      steps: funnel,
      completed: completed as string[],
      progress,
      dropOffStep,
    };
  }

  /**
   * Track page view (usually automatic, but can be called manually for SPAs)
   */
  trackPageView(path?: string): void {
    const pagePath = path ?? window.location.pathname;

    this.trackEvent('page_view', {
      path: pagePath,
      referrer: document.referrer || 'direct',
      session_id: getSessionId(),
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    feature: string,
    properties?: Record<string, string | number | boolean | null>
  ): void {
    this.trackEvent(ANALYTICS_EVENTS.FEATURE_USED, {
      feature,
      ...properties,
    });
  }

  /**
   * Track error occurrence
   */
  trackError(
    errorType: string,
    message: string,
    properties?: Record<string, string | number | boolean | null>
  ): void {
    this.trackEvent(ANALYTICS_EVENTS.ERROR_DISPLAYED, {
      error_type: errorType,
      error_message: message.substring(0, 100),
      ...properties,
    });
  }

  /**
   * Track timing metrics
   */
  trackTiming(
    category: string,
    name: string,
    durationMs: number,
    properties?: Record<string, string | number | boolean | null>
  ): void {
    this.trackEvent(`timing_${category}`, {
      metric_name: name,
      duration_ms: durationMs,
      ...properties,
    });
  }

  /**
   * End session
   */
  endSession(): void {
    const journey = getJourney();
    const duration = Date.now() - journey.startedAt;

    this.trackEvent(ANALYTICS_EVENTS.SESSION_ENDED, {
      session_id: getSessionId(),
      duration_ms: duration,
      steps_count: journey.steps.length,
    });
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const analytics = new VercelAnalyticsService();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const trackEvent = analytics.trackEvent.bind(analytics);
export const trackFeatureUsage = analytics.trackFeatureUsage.bind(analytics);
export const trackError = analytics.trackError.bind(analytics);
export const trackTiming = analytics.trackTiming.bind(analytics);
export const getFunnelProgress = analytics.getFunnelProgress.bind(analytics);

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useCallback, useEffect } from 'react';

/**
 * Hook to track page views
 */
export function usePageTracking(): void {
  useEffect(() => {
    analytics.trackPageView();
  }, []);
}

/**
 * Hook to get analytics tracker
 */
export function useAnalytics() {
  const track = useCallback(
    (
      name: AnalyticsEventName | string,
      properties?: Record<string, string | number | boolean | null>
    ) => {
      analytics.trackEvent(name, properties);
    },
    []
  );

  const trackTimed = useCallback(<T>(eventName: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();

    return fn().finally(() => {
      const duration = performance.now() - start;
      analytics.trackTiming('function', eventName, duration);
    });
  }, []);

  const trackFeature = useCallback(
    (feature: string, properties?: Record<string, string | number | boolean | null>) => {
      analytics.trackFeatureUsage(feature, properties);
    },
    []
  );

  return {
    track,
    trackTimed,
    trackFeature,
    getFunnelProgress: analytics.getFunnelProgress.bind(analytics),
    getJourney: analytics.getJourney.bind(analytics),
  };
}

/**
 * Hook to track component mount/unmount
 */
export function useComponentTracking(componentName: string): void {
  useEffect(() => {
    analytics.trackEvent('component_mounted', { component: componentName });

    return () => {
      analytics.trackEvent('component_unmounted', { component: componentName });
    };
  }, [componentName]);
}

export default analytics;
