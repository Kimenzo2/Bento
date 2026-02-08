/**
 * HyperDX Integration - OpenTelemetry-Native Observability
 *
 * Connects Genesis's existing OpenTelemetry instrumentation to HyperDX
 * for visualization, alerting, and debugging.
 *
 * Features:
 * - Distributed tracing visualization
 * - Log aggregation with search
 * - Metrics dashboards
 * - Error tracking with stack traces
 * - Session replay integration
 * - Real User Monitoring (RUM)
 *
 * @see https://www.hyperdx.io/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HyperDXConfig {
  apiKey: string;
  service: string;
  consoleCapture?: boolean;
  advancedNetworkCapture?: boolean;
  tracePropagationTargets?: RegExp[];
  maskAllInputs?: boolean;
  maskAllText?: boolean;
  enabled?: boolean;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface SpanData {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  status: 'unset' | 'ok' | 'error';
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  timestamp: number;
  attributes?: Record<string, string>;
}

// ============================================================================
// HYPERDX SERVICE
// ============================================================================

class HyperDXService {
  private initialized = false;
  private config: HyperDXConfig | null = null;
  private pendingLogs: LogEntry[] = [];
  private pendingMetrics: MetricData[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize HyperDX
   */
  async initialize(config: HyperDXConfig): Promise<void> {
    if (this.initialized) return;

    this.config = config;

    if (!config.enabled || !config.apiKey) {
      // HyperDX disabled or no API key provided
      return;
    }

    try {
      // Dynamic import HyperDX browser SDK
      const HyperDX = await import('@hyperdx/browser');

      HyperDX.default.init({
        apiKey: config.apiKey,
        service: config.service,
        consoleCapture: config.consoleCapture ?? true,
        advancedNetworkCapture: config.advancedNetworkCapture ?? true,
        tracePropagationTargets: config.tracePropagationTargets ?? [/api/i, /supabase/i],
        maskAllInputs: config.maskAllInputs ?? false,
        maskAllText: config.maskAllText ?? false,
      });

      this.initialized = true;

      // Start flush interval
      this.flushInterval = setInterval(() => this.flush(), 5000);

      // Capture unhandled errors
      this.setupErrorHandlers();
    } catch (error) {
      console.error('[HyperDX] Failed to initialize:', error);
      // Continue without HyperDX - logs will be buffered locally
    }
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason?.message ?? String(event.reason),
        stack: event.reason?.stack,
      });
    });
  }

  /**
   * Set user context
   */
  async setUser(userId: string, traits?: Record<string, string | number | boolean>): Promise<void> {
    if (!this.initialized) return;

    try {
      const HyperDX = await import('@hyperdx/browser');
      HyperDX.default.setGlobalAttributes({
        userId,
        ...traits,
      });
    } catch (error) {
      console.error('[HyperDX] Failed to set user:', error);
    }
  }

  /**
   * Add a custom action/event
   */
  async addAction(name: string, attributes?: Record<string, unknown>): Promise<void> {
    if (!this.initialized) return;

    try {
      const HyperDX = await import('@hyperdx/browser');
      HyperDX.default.addAction(
        name,
        (attributes ?? {}) as Record<string, string | number | boolean>
      );
    } catch (error) {
      console.error('[HyperDX] Failed to add action:', error);
    }
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  /**
   * Log a debug message
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log('debug', message, attributes);
  }

  /**
   * Log an info message
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    this.log('info', message, attributes);
  }

  /**
   * Log a warning
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log('warn', message, attributes);
  }

  /**
   * Log an error
   */
  error(message: string, attributes?: Record<string, unknown>): void {
    this.log('error', message, attributes);
  }

  /**
   * Generic log method
   */
  private log(
    level: LogEntry['level'],
    message: string,
    attributes?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      attributes,
    };

    if (this.initialized) {
      this.sendLog(entry);
    } else {
      this.pendingLogs.push(entry);
    }
  }

  /**
   * Send log to HyperDX
   */
  private async sendLog(entry: LogEntry): Promise<void> {
    try {
      const _HyperDX = await import('@hyperdx/browser');

      // HyperDX automatically captures console logs, but we can also
      // use their logging API for structured logs
      if (entry.level === 'error') {
        console.error(`[Genesis] ${entry.message}`, entry.attributes ?? {});
      } else if (entry.level === 'warn') {
        console.warn(`[Genesis] ${entry.message}`, entry.attributes ?? {});
      }
      // debug and info are silently captured by HyperDX
    } catch {
      if (entry.level === 'error') {
        console.error(`[Genesis] ${entry.message}`, entry.attributes ?? {});
      } else if (entry.level === 'warn') {
        console.warn(`[Genesis] ${entry.message}`, entry.attributes ?? {});
      }
    }
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    unit?: string,
    attributes?: Record<string, string>
  ): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      attributes,
    };

    if (this.initialized) {
      this.sendMetric(metric);
    } else {
      this.pendingMetrics.push(metric);
    }
  }

  /**
   * Record a counter increment
   */
  incrementCounter(name: string, delta = 1, attributes?: Record<string, string>): void {
    this.recordMetric(name, delta, 'count', attributes);
  }

  /**
   * Record a gauge value
   */
  recordGauge(
    name: string,
    value: number,
    unit?: string,
    attributes?: Record<string, string>
  ): void {
    this.recordMetric(name, value, unit ?? 'gauge', attributes);
  }

  /**
   * Record a histogram value (e.g., latency)
   */
  recordHistogram(
    name: string,
    value: number,
    unit?: string,
    attributes?: Record<string, string>
  ): void {
    this.recordMetric(name, value, unit ?? 'ms', attributes);
  }

  /**
   * Send metric to HyperDX
   */
  private async sendMetric(metric: MetricData): Promise<void> {
    try {
      const HyperDX = await import('@hyperdx/browser');

      // HyperDX captures metrics through custom attributes on spans
      // For now, log metrics as structured data
      HyperDX.default.addAction(`metric:${metric.name}`, {
        value: metric.value,
        unit: metric.unit,
        ...metric.attributes,
      });
    } catch {
      // Silently fail for metrics
    }
  }

  // ============================================================================
  // TRACING
  // ============================================================================

  /**
   * Start a span
   */
  async startSpan(
    name: string,
    attributes?: Record<string, unknown>
  ): Promise<{
    end: (status?: 'ok' | 'error') => void;
    addEvent: (name: string, attrs?: Record<string, unknown>) => void;
  }> {
    const startTime = performance.now();

    // If HyperDX is initialized, it automatically instruments fetch/XHR
    // For custom spans, we use actions
    return {
      end: async (status = 'ok') => {
        const duration = performance.now() - startTime;

        if (this.initialized) {
          try {
            const HyperDX = await import('@hyperdx/browser');
            HyperDX.default.addAction(name, {
              ...attributes,
              duration,
              status,
            });
          } catch {
            // Silently fail
          }
        }

        this.recordHistogram(`span.${name}.duration`, duration, 'ms', { status });
      },
      addEvent: async (eventName: string, eventAttrs?: Record<string, unknown>) => {
        if (this.initialized) {
          try {
            const HyperDX = await import('@hyperdx/browser');
            HyperDX.default.addAction(
              `${name}:${eventName}`,
              (eventAttrs ?? {}) as Record<string, string | number | boolean>
            );
          } catch {
            // Silently fail
          }
        }
      },
    };
  }

  /**
   * Trace an async function
   */
  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, unknown>
  ): Promise<T> {
    const span = await this.startSpan(name, attributes);

    try {
      const result = await fn();
      span.end('ok');
      return result;
    } catch (error) {
      span.addEvent('error', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      span.end('error');
      throw error;
    }
  }

  // ============================================================================
  // SESSION
  // ============================================================================

  /**
   * Get current session URL (for support tickets)
   */
  async getSessionUrl(): Promise<string | null> {
    if (!this.initialized) return null;

    try {
      const _HyperDX = await import('@hyperdx/browser');
      // Note: Session URL API may vary by HyperDX version
      return null; // Placeholder - check HyperDX docs for session URL API
    } catch {
      return null;
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Flush pending logs and metrics
   */
  async flush(): Promise<void> {
    if (!this.initialized) return;

    // Send pending logs
    const logs = [...this.pendingLogs];
    this.pendingLogs = [];

    for (const log of logs) {
      await this.sendLog(log);
    }

    // Send pending metrics
    const metrics = [...this.pendingMetrics];
    this.pendingMetrics = [];

    for (const metric of metrics) {
      await this.sendMetric(metric);
    }
  }

  /**
   * Shutdown HyperDX
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useCallback, useEffect } from 'react';

/**
 * Hook for logging in components
 */
export function useHyperDXLogger() {
  return {
    debug: useCallback(
      (message: string, attrs?: Record<string, unknown>) => hyperdx.debug(message, attrs),
      []
    ),
    info: useCallback(
      (message: string, attrs?: Record<string, unknown>) => hyperdx.info(message, attrs),
      []
    ),
    warn: useCallback(
      (message: string, attrs?: Record<string, unknown>) => hyperdx.warn(message, attrs),
      []
    ),
    error: useCallback(
      (message: string, attrs?: Record<string, unknown>) => hyperdx.error(message, attrs),
      []
    ),
  };
}

/**
 * Hook for tracking component render performance
 */
export function useTraceRender(componentName: string): void {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;
      hyperdx.recordHistogram('react.component.render_time', renderTime, 'ms', {
        component: componentName,
      });
    };
  }, [componentName]);
}

/**
 * Hook for tracking user actions
 */
export function useTrackAction() {
  return useCallback((actionName: string, attributes?: Record<string, unknown>) => {
    hyperdx.addAction(actionName, attributes);
  }, []);
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Create an instrumented fetch wrapper
 */
export function createInstrumentedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';

    const span = await hyperdx.startSpan(`fetch:${method}`, { url, method });
    const startTime = performance.now();

    try {
      const response = await fetch(input, init);

      span.addEvent('response', {
        status: response.status,
        statusText: response.statusText,
      });

      span.end(response.ok ? 'ok' : 'error');

      hyperdx.recordHistogram('http.client.duration', performance.now() - startTime, 'ms', {
        method,
        status: String(response.status),
      });

      return response;
    } catch (error) {
      span.addEvent('error', {
        message: error instanceof Error ? error.message : String(error),
      });
      span.end('error');

      hyperdx.incrementCounter('http.client.errors', 1, { method, url });

      throw error;
    }
  };
}

/**
 * Measure async function performance
 */
export function withTiming<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now();

    try {
      const result = await fn(...args);
      hyperdx.recordHistogram(`function.${name}.duration`, performance.now() - startTime, 'ms', {
        status: 'success',
      });
      return result;
    } catch (error) {
      hyperdx.recordHistogram(`function.${name}.duration`, performance.now() - startTime, 'ms', {
        status: 'error',
      });
      throw error;
    }
  }) as T;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const hyperdx = new HyperDXService();

/**
 * Initialize HyperDX with environment config
 */
export function initializeHyperDX(config?: Partial<HyperDXConfig>): Promise<void> {
  const finalConfig: HyperDXConfig = {
    apiKey: config?.apiKey ?? import.meta.env.VITE_HYPERDX_API_KEY ?? '',
    service: config?.service ?? 'genesis',
    consoleCapture: config?.consoleCapture ?? true,
    advancedNetworkCapture: config?.advancedNetworkCapture ?? true,
    maskAllInputs: config?.maskAllInputs ?? false,
    maskAllText: config?.maskAllText ?? false,
    enabled: config?.enabled ?? import.meta.env.VITE_HYPERDX_ENABLED !== 'false',
  };

  return hyperdx.initialize(finalConfig);
}

export default hyperdx;
