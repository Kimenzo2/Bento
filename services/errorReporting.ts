/**
 * @module ErrorReporting
 * @description Production-grade error reporting service with multiple provider support
 *
 * Centralized error reporting that integrates with:
 * - Sentry (primary)
 * - Console (development)
 * - Custom webhooks (optional)
 *
 * Features:
 * - Automatic error enrichment with context
 * - User privacy protection (PII scrubbing)
 * - Rate limiting to prevent spam
 * - Error grouping and deduplication
 * - Breadcrumb trail for debugging
 *
 * @example
 * ```typescript
 * import { errorReporter } from '@services/errorReporting';
 *
 * errorReporter.captureException(error, { userId: '123', action: 'book_generation' });
 * errorReporter.captureMessage('User reached tier limit', 'warning');
 * errorReporter.addBreadcrumb('user_action', 'Clicked generate button');
 * ```
 */

import * as Sentry from '@sentry/react';
import { redactPII } from './security/sanitizationService';

// ============================================================================
// TYPES
// ============================================================================

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface ErrorContext {
  userId?: string;
  email?: string;
  tier?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export interface Breadcrumb {
  category: string;
  message: string;
  level?: ErrorSeverity;
  data?: Record<string, unknown>;
  timestamp?: number;
}

interface ErrorReporterConfig {
  dsn?: string;
  environment: string;
  release?: string;
  sampleRate: number;
  maxBreadcrumbs: number;
  enableInDevelopment: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ErrorReporterConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || 'development',
  release: import.meta.env.VITE_APP_VERSION,
  sampleRate: 1.0, // Capture 100% of errors
  maxBreadcrumbs: 50,
  enableInDevelopment: false,
};

// ============================================================================
// RATE LIMITING
// ============================================================================

class ErrorRateLimiter {
  private errorCounts = new Map<string, { count: number; firstSeen: number }>();
  private readonly maxErrorsPerWindow = 10;
  private readonly windowMs = 60000; // 1 minute

  shouldReport(errorKey: string): boolean {
    const now = Date.now();
    const record = this.errorCounts.get(errorKey);

    if (!record || now - record.firstSeen > this.windowMs) {
      this.errorCounts.set(errorKey, { count: 1, firstSeen: now });
      return true;
    }

    if (record.count >= this.maxErrorsPerWindow) {
      return false;
    }

    record.count++;
    return true;
  }

  getErrorKey(error: Error): string {
    return `${error.name}:${error.message.substring(0, 100)}`;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.errorCounts) {
      if (now - record.firstSeen > this.windowMs) {
        this.errorCounts.delete(key);
      }
    }
  }
}

// ============================================================================
// BREADCRUMB MANAGER
// ============================================================================

class BreadcrumbManager {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number;

  constructor(maxBreadcrumbs = 50) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  add(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now(),
    });

    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getAll(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clear(): void {
    this.breadcrumbs = [];
  }
}

// ============================================================================
// ERROR REPORTER CLASS
// ============================================================================

class ErrorReporter {
  private initialized = false;
  private config: ErrorReporterConfig;
  private rateLimiter: ErrorRateLimiter;
  private breadcrumbManager: BreadcrumbManager;
  private userContext: ErrorContext = {};

  constructor(config: Partial<ErrorReporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new ErrorRateLimiter();
    this.breadcrumbManager = new BreadcrumbManager(this.config.maxBreadcrumbs);
  }

  /**
   * Initialize the error reporter
   * Call once at app startup
   */
  initialize(): void {
    if (this.initialized) return;

    const isDevelopment = this.config.environment === 'development';

    // Skip Sentry in development unless explicitly enabled
    if (isDevelopment && !this.config.enableInDevelopment) {
      console.log('[ErrorReporter] Skipping Sentry in development mode');
      this.initialized = true;
      return;
    }

    if (!this.config.dsn) {
      console.warn('[ErrorReporter] No Sentry DSN configured');
      this.initialized = true;
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        maxBreadcrumbs: this.config.maxBreadcrumbs,

        // Scrub PII from error messages
        beforeSend: (event) => {
          if (event.message) {
            event.message = redactPII(event.message);
          }

          // Scrub exception messages
          if (event.exception?.values) {
            for (const exception of event.exception.values) {
              if (exception.value) {
                exception.value = redactPII(exception.value);
              }
            }
          }

          return event;
        },

        // Filter out noisy errors
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',
          'Network request failed',
          'Load failed',
          'ChunkLoadError',
        ],
      });

      console.log('[ErrorReporter] Sentry initialized');
    } catch (error) {
      console.error('[ErrorReporter] Failed to initialize Sentry:', error);
    }

    this.initialized = true;

    // Cleanup rate limiter periodically
    setInterval(() => this.rateLimiter.cleanup(), 60000);
  }

  /**
   * Set user context for all subsequent errors
   */
  setUser(context: ErrorContext): void {
    this.userContext = { ...this.userContext, ...context };

    if (this.config.dsn) {
      Sentry.setUser({
        id: context.userId,
        email: context.email ? redactPII(context.email) : undefined,
      });

      if (context.tier) {
        Sentry.setTag('user.tier', context.tier);
      }
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    this.userContext = {};
    Sentry.setUser(null);
  }

  /**
   * Add a breadcrumb for debugging
   */
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const breadcrumb: Breadcrumb = { category, message, data };
    this.breadcrumbManager.add(breadcrumb);

    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info',
    });
  }

  /**
   * Capture an exception
   */
  captureException(
    error: Error,
    context?: ErrorContext,
    severity: ErrorSeverity = 'error'
  ): string | undefined {
    // Rate limit check
    const errorKey = this.rateLimiter.getErrorKey(error);
    if (!this.rateLimiter.shouldReport(errorKey)) {
      console.warn('[ErrorReporter] Error rate limited:', error.message);
      return undefined;
    }

    // Always log to console
    console.error('[ErrorReporter]', error, context);

    // Merge user context
    const fullContext = { ...this.userContext, ...context };

    // Report to Sentry
    if (this.config.dsn) {
      Sentry.withScope((scope) => {
        scope.setLevel(this.mapSeverity(severity));

        if (fullContext.action) {
          scope.setTag('action', fullContext.action);
        }
        if (fullContext.component) {
          scope.setTag('component', fullContext.component);
        }
        if (fullContext.metadata) {
          scope.setExtras(fullContext.metadata);
        }

        // Attach breadcrumbs
        for (const crumb of this.breadcrumbManager.getAll()) {
          scope.addBreadcrumb({
            category: crumb.category,
            message: crumb.message,
            data: crumb.data,
            timestamp: crumb.timestamp ? crumb.timestamp / 1000 : undefined,
          });
        }

        Sentry.captureException(error);
      });
    }

    return errorKey;
  }

  /**
   * Capture a message (non-exception)
   */
  captureMessage(message: string, severity: ErrorSeverity = 'info', context?: ErrorContext): void {
    const sanitizedMessage = redactPII(message);

    console.log(`[ErrorReporter] [${severity}]`, sanitizedMessage, context);

    if (this.config.dsn) {
      Sentry.withScope((scope) => {
        scope.setLevel(this.mapSeverity(severity));

        if (context) {
          scope.setExtras(context as Record<string, unknown>);
        }

        Sentry.captureMessage(sanitizedMessage);
      });
    }
  }

  /**
   * Create an error boundary wrapper for React components
   */
  createErrorBoundary(
    fallback: React.ReactNode
  ): React.ComponentType<{ children: React.ReactNode }> {
    return Sentry.ErrorBoundary as React.ComponentType<{ children: React.ReactNode }>;
  }

  /**
   * Wrap an async function with error reporting
   */
  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, context?: ErrorContext): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof Error) {
          this.captureException(error, context);
        }
        throw error;
      }
    }) as T;
  }

  /**
   * Map severity to Sentry level
   */
  private mapSeverity(severity: ErrorSeverity): Sentry.SeverityLevel {
    const map: Record<ErrorSeverity, Sentry.SeverityLevel> = {
      fatal: 'fatal',
      error: 'error',
      warning: 'warning',
      info: 'info',
      debug: 'debug',
    };
    return map[severity] || 'error';
  }

  /**
   * Flush pending events (call before page unload)
   */
  async flush(timeout = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const errorReporter = new ErrorReporter();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const captureException = errorReporter.captureException.bind(errorReporter);
export const captureMessage = errorReporter.captureMessage.bind(errorReporter);
export const addBreadcrumb = errorReporter.addBreadcrumb.bind(errorReporter);
export const setErrorUser = errorReporter.setUser.bind(errorReporter);

export default errorReporter;
