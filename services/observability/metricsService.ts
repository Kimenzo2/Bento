/**
 * Metrics Service - RED & USE Method Implementation
 *
 * THE RED METHOD (For Services):
 * - Rate: Requests per second/minute
 * - Error: Error rate (% of requests that fail)
 * - Duration: Response time (p50, p95, p99)
 *
 * THE USE METHOD (For Resources):
 * - Utilization: % of resource capacity used
 * - Saturation: Queue depth or pending work
 * - Errors: Resource-specific errors
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceMetrics {
  // Rate
  requestsPerSecond: number;
  requestsPerMinute: number;

  // Error
  errorRate: number; // 0.00 - 1.00
  errorsByType: Record<string, number>;

  // Duration
  p50Latency: number; // milliseconds
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
}

export interface ResourceMetrics {
  // Utilization
  cpuUtilization: number;
  memoryUtilization: number;
  connectionUtilization: number;

  // Saturation
  queueDepth: number;
  pendingOperations: number;
  avgWaitTime: number;

  // Errors
  failedConnections: number;
  timeouts: number;
  resourceErrors: number;
}

export interface AIMetrics {
  // Generation metrics
  generationsPerMinute: number;
  tokensPerMinute: number;
  costPerMinute: number;

  // Quality metrics
  successRate: number;
  retryRate: number;
  regenerationRate: number; // Based on user regenerations

  // Performance metrics
  avgGenerationTime: number;
  p95GenerationTime: number;
  cacheHitRate: number;

  // Cost metrics
  costPerGeneration: number;
  costPerUser: number;
  costByModel: Record<string, number>;
}

interface EndpointMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  errors: Record<string, number>;
  lastReset: number;
}

// ============================================================================
// ALERT THRESHOLDS
// ============================================================================

export const THRESHOLDS = {
  errorRate: 0.05, // Alert if >5% errors
  p95Latency: 2000, // Alert if p95 >2s
  p99Latency: 5000, // Alert if p99 >5s
  connectionUtilization: 0.8, // Alert if >80% connections used
  queueDepth: 100, // Alert if queue >100 items
  aiCostPerHour: 10, // Alert if >$10/hour AI spend
};

// ============================================================================
// METRICS STORAGE (In-memory with windowing)
// ============================================================================

const WINDOW_SIZE_MS = 60_000; // 1 minute window
const endpointMetrics = new Map<string, EndpointMetrics>();

function getOrCreateEndpointMetrics(endpoint: string): EndpointMetrics {
  let metrics = endpointMetrics.get(endpoint);
  const now = Date.now();

  if (!metrics || now - metrics.lastReset > WINDOW_SIZE_MS) {
    metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      errors: {},
      lastReset: now,
    };
    endpointMetrics.set(endpoint, metrics);
  }

  return metrics;
}

// ============================================================================
// PERCENTILE CALCULATION
// ============================================================================

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// METRICS COLLECTION API
// ============================================================================

/**
 * Record a request for an endpoint
 */
export function recordRequest(
  endpoint: string,
  latencyMs: number,
  success: boolean,
  errorType?: string
): void {
  const metrics = getOrCreateEndpointMetrics(endpoint);

  metrics.totalRequests++;
  metrics.latencies.push(latencyMs);

  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
    if (errorType) {
      metrics.errors[errorType] = (metrics.errors[errorType] || 0) + 1;
    }
  }

  // Keep latencies bounded
  if (metrics.latencies.length > 1000) {
    metrics.latencies = metrics.latencies.slice(-500);
  }
}

/**
 * Get metrics for a specific endpoint
 */
export function getEndpointMetrics(endpoint: string): ServiceMetrics {
  const metrics = getOrCreateEndpointMetrics(endpoint);
  const windowSeconds = (Date.now() - metrics.lastReset) / 1000;

  return {
    requestsPerSecond: windowSeconds > 0 ? metrics.totalRequests / windowSeconds : 0,
    requestsPerMinute: metrics.totalRequests,
    errorRate: metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0,
    errorsByType: { ...metrics.errors },
    p50Latency: percentile(metrics.latencies, 0.5),
    p95Latency: percentile(metrics.latencies, 0.95),
    p99Latency: percentile(metrics.latencies, 0.99),
    maxLatency: Math.max(...metrics.latencies, 0),
  };
}

/**
 * Get aggregated metrics across all endpoints
 */
export function getAllMetrics(): Record<string, ServiceMetrics> {
  const result: Record<string, ServiceMetrics> = {};

  for (const endpoint of endpointMetrics.keys()) {
    result[endpoint] = getEndpointMetrics(endpoint);
  }

  return result;
}

// ============================================================================
// AI-SPECIFIC METRICS
// ============================================================================

interface AIUsageRecord {
  timestamp: number;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  success: boolean;
  retryCount: number;
  model: string;
  userId: string;
}

const aiUsageRecords: AIUsageRecord[] = [];
const MAX_AI_RECORDS = 10000;

/**
 * Record AI generation metrics
 */
export function recordAIUsage(record: Omit<AIUsageRecord, 'timestamp'>): void {
  aiUsageRecords.push({
    ...record,
    timestamp: Date.now(),
  });

  // Keep bounded
  if (aiUsageRecords.length > MAX_AI_RECORDS) {
    aiUsageRecords.splice(0, aiUsageRecords.length - MAX_AI_RECORDS / 2);
  }
}

/**
 * Get AI metrics for a time window
 */
export function getAIMetrics(windowMs = 3600_000): AIMetrics {
  const cutoff = Date.now() - windowMs;
  const windowRecords = aiUsageRecords.filter((r) => r.timestamp > cutoff);

  if (windowRecords.length === 0) {
    return {
      generationsPerMinute: 0,
      tokensPerMinute: 0,
      costPerMinute: 0,
      successRate: 0,
      retryRate: 0,
      regenerationRate: 0,
      avgGenerationTime: 0,
      p95GenerationTime: 0,
      cacheHitRate: 0,
      costPerGeneration: 0,
      costPerUser: 0,
      costByModel: {},
    };
  }

  const windowMinutes = windowMs / 60_000;
  const totalTokens = windowRecords.reduce((sum, r) => sum + r.tokensUsed, 0);
  const totalCost = windowRecords.reduce((sum, r) => sum + r.costUsd, 0);
  const successfulRecords = windowRecords.filter((r) => r.success);
  const retriedRecords = windowRecords.filter((r) => r.retryCount > 0);
  const durations = windowRecords.map((r) => r.durationMs);
  const uniqueUsers = new Set(windowRecords.map((r) => r.userId));

  // Cost by model
  const costByModel: Record<string, number> = {};
  for (const record of windowRecords) {
    costByModel[record.model] = (costByModel[record.model] || 0) + record.costUsd;
  }

  return {
    generationsPerMinute: windowRecords.length / windowMinutes,
    tokensPerMinute: totalTokens / windowMinutes,
    costPerMinute: totalCost / windowMinutes,
    successRate: successfulRecords.length / windowRecords.length,
    retryRate: retriedRecords.length / windowRecords.length,
    regenerationRate: 0, // TODO: Track from user actions
    avgGenerationTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95GenerationTime: percentile(durations, 0.95),
    cacheHitRate: 0, // TODO: Integrate with cache service
    costPerGeneration: totalCost / windowRecords.length,
    costPerUser: uniqueUsers.size > 0 ? totalCost / uniqueUsers.size : 0,
    costByModel,
  };
}

// ============================================================================
// THRESHOLD CHECKS
// ============================================================================

export interface ThresholdAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Check all thresholds and return alerts
 */
export function checkThresholds(): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];
  const allMetrics = getAllMetrics();
  const aiMetrics = getAIMetrics();

  // Check each endpoint
  for (const [endpoint, metrics] of Object.entries(allMetrics)) {
    if (metrics.errorRate > THRESHOLDS.errorRate) {
      alerts.push({
        metric: `${endpoint}.errorRate`,
        value: metrics.errorRate,
        threshold: THRESHOLDS.errorRate,
        severity: metrics.errorRate > 0.1 ? 'critical' : 'warning',
        message: `Error rate for ${endpoint} is ${(metrics.errorRate * 100).toFixed(2)}%`,
      });
    }

    if (metrics.p95Latency > THRESHOLDS.p95Latency) {
      alerts.push({
        metric: `${endpoint}.p95Latency`,
        value: metrics.p95Latency,
        threshold: THRESHOLDS.p95Latency,
        severity: metrics.p95Latency > THRESHOLDS.p99Latency ? 'critical' : 'warning',
        message: `P95 latency for ${endpoint} is ${metrics.p95Latency}ms`,
      });
    }
  }

  // Check AI cost
  const costPerHour = aiMetrics.costPerMinute * 60;
  if (costPerHour > THRESHOLDS.aiCostPerHour) {
    alerts.push({
      metric: 'ai.costPerHour',
      value: costPerHour,
      threshold: THRESHOLDS.aiCostPerHour,
      severity: costPerHour > THRESHOLDS.aiCostPerHour * 2 ? 'critical' : 'warning',
      message: `AI spend is $${costPerHour.toFixed(2)}/hour`,
    });
  }

  return alerts;
}

// ============================================================================
// METRICS MIDDLEWARE (For API Routes)
// ============================================================================

export function createMetricsMiddleware() {
  return async (endpoint: string, handler: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now();
    let success = true;
    let errorType: string | undefined;

    try {
      const response = await handler();
      success = response.ok;
      if (!response.ok) {
        errorType = `HTTP_${response.status}`;
      }
      return response;
    } catch (error) {
      success = false;
      errorType = error instanceof Error ? error.name : 'Unknown';
      throw error;
    } finally {
      const latency = Date.now() - startTime;
      recordRequest(endpoint, latency, success, errorType);
    }
  };
}

// ============================================================================
// EXPORT METRICS (For External Monitoring)
// ============================================================================

/**
 * Export metrics in Prometheus format
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];
  const allMetrics = getAllMetrics();
  const aiMetrics = getAIMetrics();

  // Endpoint metrics
  for (const [endpoint, metrics] of Object.entries(allMetrics)) {
    const label = endpoint.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`# HELP genesis_requests_total Total requests for ${endpoint}`);
    lines.push(`genesis_requests_rate{endpoint="${label}"} ${metrics.requestsPerMinute}`);
    lines.push(`genesis_error_rate{endpoint="${label}"} ${metrics.errorRate}`);
    lines.push(`genesis_latency_p95{endpoint="${label}"} ${metrics.p95Latency}`);
    lines.push(`genesis_latency_p99{endpoint="${label}"} ${metrics.p99Latency}`);
  }

  // AI metrics
  lines.push(`# HELP genesis_ai_metrics AI generation metrics`);
  lines.push(`genesis_ai_generations_per_minute ${aiMetrics.generationsPerMinute}`);
  lines.push(`genesis_ai_tokens_per_minute ${aiMetrics.tokensPerMinute}`);
  lines.push(`genesis_ai_cost_per_minute ${aiMetrics.costPerMinute}`);
  lines.push(`genesis_ai_success_rate ${aiMetrics.successRate}`);
  lines.push(`genesis_ai_p95_duration ${aiMetrics.p95GenerationTime}`);

  return lines.join('\n');
}

export default {
  recordRequest,
  recordAIUsage,
  getEndpointMetrics,
  getAllMetrics,
  getAIMetrics,
  checkThresholds,
  exportPrometheusMetrics,
  THRESHOLDS,
};
