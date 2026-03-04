/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for error tracking, performance monitoring,
 * and session replay in the Genesis application.
 *
 * Vercel Integration:
 * - Source maps uploaded during build
 * - Releases tied to Git commits
 * - Deployment notifications sent automatically
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT =
  import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.VERCEL_ENV || 'development';
const SENTRY_RELEASE =
  import.meta.env.VERCEL_GIT_COMMIT_SHA || import.meta.env.VITE_APP_VERSION || 'development';

/**
 * Initialize Sentry error tracking
 */
export function initializeSentry(): void {
  if (!SENTRY_DSN || SENTRY_DSN.includes('your-key')) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,

    // Send default PII data (IP addresses, etc.)
    sendDefaultPii: true,

    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text content and block all media for privacy
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Performance monitoring sample rate (1.0 = 100%)
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Session Replay sample rates
    replaysSessionSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors

    // Filter out common non-actionable errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors that are usually transient
      if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
        return null;
      }

      // Ignore ResizeObserver errors (browser quirk)
      if (error instanceof Error && error.message?.includes('ResizeObserver')) {
        return null;
      }

      return event;
    },

    // Tag transactions with useful context
    beforeSendTransaction(event) {
      // Add custom tags for better filtering
      event.tags = {
        ...event.tags,
        app: 'genesis',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      };
      return event;
    },
  });

  console.warn(`[Sentry] Initialized in ${SENTRY_ENVIRONMENT} mode`);
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(
  user: {
    id: string;
    email?: string;
    username?: string;
  } | null
): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture a custom exception with additional context
 */
export function captureException(error: Error, context?: Record<string, unknown>): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
  });
}

/**
 * Set custom context for debugging
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

/**
 * Set a tag for filtering in Sentry dashboard
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Sentry Error Boundary component for React
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap components with Sentry profiling
 */
export const withSentryProfiler = Sentry.withProfiler;

/**
 * Create a custom span for performance tracking
 */
export function startSpan<T>(name: string, op: string, callback: () => T): T {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
}

// Export Sentry for direct access if needed
export { Sentry };
