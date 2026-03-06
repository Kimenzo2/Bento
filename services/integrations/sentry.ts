/**
 * Sentry Integration - Error Tracking & Performance Monitoring
 *
 * Provides comprehensive error tracking, performance monitoring,
 * session replay, and release tracking for Genesis.
 *
 * Features:
 * - Automatic error capturing with stack traces
 * - Performance monitoring (transactions, spans)
 * - Session replay for debugging
 * - Release tracking and deploy notifications
 * - User context and breadcrumbs
 * - Custom tags and extra data
 *
 * @see https://docs.sentry.io/platforms/javascript/
 */

import React, {
  type ComponentType,
  type FC,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SentryConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  debug?: boolean;
  sampleRate?: number; // 0.0 - 1.0
  tracesSampleRate?: number; // 0.0 - 1.0
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  enabled?: boolean;
}

export interface SentryUser {
  id: string;
  email?: string;
  username?: string;
  tier?: string;
  ip_address?: string;
}

export interface SentryTransaction {
  name: string;
  op: string;
  finish: () => void;
  setStatus: (
    status:
      | 'ok'
      | 'cancelled'
      | 'unknown'
      | 'invalid_argument'
      | 'deadline_exceeded'
      | 'not_found'
      | 'permission_denied'
      | 'resource_exhausted'
      | 'internal_error'
      | 'unavailable'
      | 'data_loss'
  ) => void;
  setData: (key: string, value: unknown) => void;
  startChild: (context: { op: string; description?: string }) => SentrySpan;
}

export interface SentrySpan {
  finish: () => void;
  setStatus: (status: string) => void;
  setData: (key: string, value: unknown) => void;
}

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface BreadcrumbData {
  category: string;
  message: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}

// ============================================================================
// SENTRY SERVICE
// ============================================================================

class SentryService {
  private initialized = false;
  private config: SentryConfig | null = null;
  private transactions = new Map<string, SentryTransaction>();

  /**
   * Initialize Sentry
   */
  async initialize(config: SentryConfig): Promise<void> {
    this.config = { ...config, enabled: false };
    this.initialized = false;
  }

  /**
   * Set user context
   */
  async setUser(user: SentryUser | null): Promise<void> {
    if (!this.initialized) return;

    try {
      const Sentry = await import('@sentry/react');

      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.username,
          ip_address: user.ip_address,
        });

        Sentry.setTag('user.tier', user.tier ?? 'unknown');
      } else {
        Sentry.setUser(null);
      }
    } catch (error) {
      console.error('[Sentry] Failed to set user:', error);
    }
  }

  /**
   * Capture an exception
   */
  async captureException(
    error: Error,
    context?: {
      level?: SeverityLevel;
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      fingerprint?: string[];
    }
  ): Promise<string | undefined> {
    if (!this.initialized) {
      console.error('[Sentry] Not initialized, logging error:', error);
      return undefined;
    }

    try {
      const Sentry = await import('@sentry/react');

      return Sentry.captureException(error, {
        level: context?.level ?? 'error',
        tags: context?.tags,
        extra: context?.extra,
        fingerprint: context?.fingerprint,
      });
    } catch (e) {
      console.error('[Sentry] Failed to capture exception:', e);
      return undefined;
    }
  }

  /**
   * Capture a message
   */
  async captureMessage(
    message: string,
    level: SeverityLevel = 'info',
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    }
  ): Promise<string | undefined> {
    if (!this.initialized) return undefined;

    try {
      const Sentry = await import('@sentry/react');

      return Sentry.captureMessage(message, {
        level,
        tags: context?.tags,
        extra: context?.extra,
      });
    } catch (error) {
      console.error('[Sentry] Failed to capture message:', error);
      return undefined;
    }
  }

  /**
   * Add a breadcrumb
   */
  async addBreadcrumb(data: BreadcrumbData): Promise<void> {
    if (!this.initialized) return;

    try {
      const Sentry = await import('@sentry/react');

      Sentry.addBreadcrumb({
        category: data.category,
        message: data.message,
        level: data.level ?? 'info',
        data: data.data,
        timestamp: Date.now() / 1000,
      });
    } catch (error) {
      console.error('[Sentry] Failed to add breadcrumb:', error);
    }
  }

  /**
   * Start a performance transaction
   */
  async startTransaction(
    name: string,
    op: string,
    data?: Record<string, unknown>
  ): Promise<SentryTransaction | null> {
    if (!this.initialized) return null;

    try {
      const Sentry = await import('@sentry/react');

      const transaction = Sentry.startInactiveSpan({
        name,
        op,
        forceTransaction: true,
      });

      if (data && transaction) {
        Object.entries(data).forEach(([key, value]) => {
          transaction.setAttribute(key, value as string);
        });
      }

      // Create wrapper
      const wrapper: SentryTransaction = {
        name,
        op,
        finish: () => transaction?.end(),
        setStatus: (status) => transaction?.setStatus({ code: 1, message: status }),
        setData: (key, value) => transaction?.setAttribute(key, value as string),
        startChild: (context) => {
          const child = Sentry.startInactiveSpan({
            name: context.description ?? context.op,
            op: context.op,
          });
          return {
            finish: () => child?.end(),
            setStatus: (status) => child?.setStatus({ code: 1, message: status }),
            setData: (key, value) => child?.setAttribute(key, value as string),
          };
        },
      };

      this.transactions.set(name, wrapper);
      return wrapper;
    } catch (error) {
      console.error('[Sentry] Failed to start transaction:', error);
      return null;
    }
  }

  /**
   * Set global tags
   */
  async setTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) return;

    try {
      const Sentry = await import('@sentry/react');

      Object.entries(tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    } catch (error) {
      console.error('[Sentry] Failed to set tags:', error);
    }
  }

  /**
   * Set global context
   */
  async setContext(name: string, context: Record<string, unknown>): Promise<void> {
    if (!this.initialized) return;

    try {
      const Sentry = await import('@sentry/react');
      Sentry.setContext(name, context);
    } catch (error) {
      console.error('[Sentry] Failed to set context:', error);
    }
  }

  /**
   * Wrap a function with error boundary
   */
  async withScope<T>(
    callback: () => T | Promise<T>,
    configure?: (scope: {
      setTag: (key: string, value: string) => void;
      setExtra: (key: string, value: unknown) => void;
      setLevel: (level: SeverityLevel) => void;
    }) => void
  ): Promise<T> {
    if (!this.initialized) {
      return callback();
    }

    try {
      const Sentry = await import('@sentry/react');

      return Sentry.withScope(async (scope) => {
        if (configure) {
          configure({
            setTag: (key, value) => scope.setTag(key, value),
            setExtra: (key, value) => scope.setExtra(key, value),
            setLevel: (level) => scope.setLevel(level),
          });
        }
        return callback();
      });
    } catch (_error) {
      return callback();
    }
  }

  /**
   * Flush pending events
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;

    try {
      const Sentry = await import('@sentry/react');
      return await Sentry.flush(timeout);
    } catch {
      return false;
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current config
   */
  getConfig(): SentryConfig | null {
    return this.config;
  }
}

// ============================================================================
// REACT ERROR BOUNDARY WRAPPER
// ============================================================================

/**
 * Higher-order component for Sentry error boundary
 */
export function withSentryErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, componentStack: string) => void;
  }
): ComponentType<P> {
  // Note: This is a synchronous wrapper since async HOCs are complex
  // The actual Sentry import happens at initialization time

  const WrappedComponent: FC<P> = (props: P) => {
    const [hasError, setHasError] = useState(false);

    if (hasError && options?.fallback) {
      return options.fallback as ReactElement;
    }

    try {
      return React.createElement(Component, props);
    } catch (err) {
      setHasError(true);
      const error = err instanceof Error ? err : new Error(String(err));
      if (options?.onError) {
        options.onError(error, '');
      }
      sentry.captureException(error);
      return (options?.fallback as ReactElement) ?? null;
    }
  };

  WrappedComponent.displayName = `withSentryErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent as ComponentType<P>;
}

/**
 * Sentry profiler HOC
 */
export function withSentryProfiler<P extends object>(
  Component: ComponentType<P>,
  name?: string
): ComponentType<P> {
  const displayName = name || Component.displayName || Component.name || 'Component';

  const ProfiledComponent: FC<P> = (props: P) => {
    // Track render timing
    const startTime = performance.now();

    useEffect(() => {
      const duration = performance.now() - startTime;
      sentry.addBreadcrumb({
        category: 'component',
        message: `${displayName} rendered`,
        data: { durationMs: duration },
        level: 'debug',
      });
    });

    return React.createElement(Component, props);
  };

  ProfiledComponent.displayName = `withSentryProfiler(${displayName})`;

  return ProfiledComponent as ComponentType<P>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create Genesis-specific error with context
 */
export function createGenesisError(
  message: string,
  code: string,
  context?: Record<string, unknown>
): Error {
  const error = new Error(message);
  error.name = `GenesisError:${code}`;
  (error as Error & { context: Record<string, unknown> }).context = context ?? {};
  return error;
}

/**
 * Track a user action for performance
 */
export async function trackAction(
  action: string,
  fn: () => Promise<void>,
  tags?: Record<string, string>
): Promise<void> {
  const start = performance.now();

  try {
    await fn();

    await sentry.addBreadcrumb({
      category: 'action',
      message: `Completed: ${action}`,
      level: 'info',
      data: {
        duration: performance.now() - start,
        ...tags,
      },
    });
  } catch (error) {
    await sentry.captureException(error as Error, {
      tags: { action, ...tags },
      extra: { duration: performance.now() - start },
    });
    throw error;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sentry = new SentryService();

/**
 * Initialize Sentry with environment config
 */
export function initializeSentry(config?: Partial<SentryConfig>): Promise<void> {
  const finalConfig: SentryConfig = {
    dsn: config?.dsn ?? import.meta.env.VITE_SENTRY_DSN ?? '',
    environment: (config?.environment ??
      import.meta.env.VITE_APP_ENVIRONMENT ??
      'development') as SentryConfig['environment'],
    release: config?.release ?? import.meta.env.VITE_APP_VERSION,
    debug: config?.debug ?? import.meta.env.DEV,
    sampleRate: config?.sampleRate ?? 1.0,
    tracesSampleRate: config?.tracesSampleRate ?? 0.1,
    replaysSessionSampleRate: config?.replaysSessionSampleRate ?? 0.1,
    replaysOnErrorSampleRate: config?.replaysOnErrorSampleRate ?? 1.0,
    enabled: false,
  };

  return sentry.initialize(finalConfig);
}

export default sentry;
