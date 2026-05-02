/**
 * Observability Module Index
 *
 * Central export point for all observability services.
 *
 * Services:
 * - aiObservabilityService: AI operation tracing
 * - metricsService: RED/USE method metrics
 * - sloTracker: SLO monitoring and error budgets
 * - alertManager: Multi-channel alerting
 * - structuredLogger: Production-ready structured logging
 *
 * Usage:
 * ```typescript
 * import {
 *   startObservability,
 *   logger,
 *   recordRequest,
 *   recordAIUsage,
 *   featureFlags
 * } from '@services/observability';
 *
 * // Initialize on app startup
 * startObservability();
 *
 * // Use throughout app
 * logger.info('User action', { userId, action });
 * recordRequest('/api/books', 150, true);
 * recordAIUsage({ model: 'openai/gpt-4o', tokensUsed: 1000, ... });
 * ```
 */

// ============================================================================
// RE-EXPORTS
// ============================================================================

// AI Observability (Tracing)
export {
  startTrace,
  startSpan,
  endTrace,
  failTrace,
  getRecentTraces,
  getTracesByOperation,
  getFailedTraces,
  getTrace,
  getMetrics as getTraceMetrics,
  traced,
  type AITrace,
  type SpanContext,
} from './aiObservabilityService';

// Metrics (RED/USE Method)
export {
  recordRequest,
  recordAIUsage,
  getEndpointMetrics,
  getAllMetrics,
  getAIMetrics,
  checkThresholds,
  exportPrometheusMetrics,
  THRESHOLDS,
  type ServiceMetrics,
  type AIMetrics,
  type ThresholdAlert,
} from './metricsService';

// SLO Tracking
export {
  sloTracker,
  startSLOMonitoring,
  stopSLOMonitoring,
  type SLOReport,
  type SLOAlert,
} from './sloTracker';

// Alert Manager
export {
  alertManager,
  startAlertMonitoring,
  stopAlertMonitoring,
  type Alert,
} from './alertManager';

// Structured Logger
export {
  StructuredLogger,
  logger,
  aiLogger,
  apiLogger,
  generateRequestId,
  generateTraceId,
} from './structuredLogger';

// ============================================================================
// INITIALIZATION
// ============================================================================

let initialized = false;

/**
 * Start all observability services
 * Call this on app startup
 */
export function startObservability(
  options: {
    sloCheckIntervalMs?: number;
    alertCheckIntervalMs?: number;
  } = {}
): void {
  if (initialized) {
    console.warn('[Observability] Already initialized');
    return;
  }

  const {
    sloCheckIntervalMs = 5 * 60 * 1000, // 5 minutes
    alertCheckIntervalMs = 60 * 1000, // 1 minute
  } = options;

  // Import and start monitoring services
  import('./sloTracker').then(({ startSLOMonitoring }) => {
    startSLOMonitoring(sloCheckIntervalMs);
  });

  import('./alertManager').then(({ startAlertMonitoring }) => {
    startAlertMonitoring(alertCheckIntervalMs);
  });

  initialized = true;
  // eslint-disable-next-line no-console
  console.log('[Observability] Started');
}

/**
 * Stop all observability services
 * Call this on app shutdown
 */
export function stopObservability(): void {
  if (!initialized) {
    return;
  }

  import('./sloTracker').then(({ stopSLOMonitoring }) => {
    stopSLOMonitoring();
  });

  import('./alertManager').then(({ stopAlertMonitoring }) => {
    stopAlertMonitoring();
  });

  initialized = false;
  // eslint-disable-next-line no-console
  console.log('[Observability] Stopped');
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log and record a request with metrics
 */
export async function traceRequest<T>(
  endpoint: string,
  handler: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const { logger, generateRequestId } = await import('./structuredLogger');
  const { recordRequest } = await import('./metricsService');

  const requestId = generateRequestId();
  const start = Date.now();
  let success = true;
  let errorType: string | undefined;

  try {
    const result = await handler();
    return result;
  } catch (error) {
    success = false;
    errorType = error instanceof Error ? error.name : 'Unknown';
    throw error;
  } finally {
    const duration = Date.now() - start;

    // Record metrics
    recordRequest(endpoint, duration, success, errorType);

    // Log request
    logger.httpRequest('POST', endpoint, success ? 200 : 500, duration, {
      requestId,
      ...context,
    });
  }
}

/**
 * Wrap an AI generation with full tracing
 */
export async function traceAIGeneration<T>(
  operation: string,
  model: string,
  generator: () => Promise<T & { tokensUsed?: number; costUsd?: number }>
): Promise<T> {
  const { startTrace, endTrace, failTrace } = await import('./aiObservabilityService');
  const { recordAIUsage } = await import('./metricsService');
  const { aiLogger } = await import('./structuredLogger');

  const context = startTrace(operation, model, {
    promptLength: 0,
    hasImages: false,
    tier: 'unknown',
  });

  const start = Date.now();

  try {
    const result = await generator();
    const duration = Date.now() - start;

    // End trace
    endTrace(context, {
      tokensUsed: result.tokensUsed,
      responseLength: 0,
      hasImages: false,
    });

    // Record metrics
    recordAIUsage({
      tokensUsed: result.tokensUsed || 0,
      costUsd: result.costUsd || 0,
      durationMs: duration,
      success: true,
      retryCount: 0,
      model,
      userId: 'unknown',
    });

    // Log
    aiLogger.aiGeneration('complete', {
      model,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    // End trace with error
    failTrace(context, {
      code: (error as Error).name,
      message: (error as Error).message,
      retryable: true,
    });

    // Record metrics
    recordAIUsage({
      tokensUsed: 0,
      costUsd: 0,
      durationMs: duration,
      success: false,
      retryCount: 0,
      model,
      userId: 'unknown',
    });

    // Log
    aiLogger.aiGeneration('error', {
      model,
      durationMs: duration,
      error: error as Error,
    });

    throw error;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  startObservability,
  stopObservability,
  traceRequest,
  traceAIGeneration,
};
