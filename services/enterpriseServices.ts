/**
 * Enterprise Services - Barrel Export
 * 
 * Central export point for all enterprise-grade services.
 * Import from here to get access to:
 * - Usage Analytics (cost tracking, usage monitoring)
 * - Circuit Breaker (spending limits, rate control)
 * - Sanitization (PII detection, input validation)
 * - Observability (tracing, metrics)
 */

// Analytics
export {
  trackUsage,
  trackImageGeneration,
  trackTextGeneration,
  trackBookCreation,
  estimateCost,
  getUserCostSummary,
  getSessionId,
  resetSession,
  type UsageEvent,
  type CostSummary
} from './analytics/usageAnalyticsService';

// Circuit Breaker
export {
  checkCircuitBreaker,
  recordSpend,
  getSpendingStatus,
  getDowngradedModel,
  selectModelWithBudget,
  grantUnlimitedAccess,
  revokeUnlimitedAccess,
  hasUnlimitedAccess,
  syncSpendingLimitsFromDB,
  persistUnlimitedAccess,
  checkSpendingLimitFromDB,
  getUserUsageSummaryFromDB,
  type CircuitBreakerResult,
  type SpendingLimits
} from './analytics/circuitBreakerService';

export { default as circuitBreakerConfig } from './analytics/circuitBreakerService';

// Security
export {
  sanitizeInput,
  containsPII,
  containsInjection,
  redactPII,
  validatePayloadSize,
  sanitizeBookRequest,
  sanitizeInterviewQuestion,
  sanitizeImagePrompt,
  type SanitizationResult,
  type SanitizationIssue,
  type SanitizationOptions
} from './security/sanitizationService';

// Observability
export {
  startTrace,
  startSpan,
  endTrace,
  failTrace,
  getRecentTraces,
  getTracesByOperation,
  getFailedTraces,
  getTrace,
  getMetrics,
  traced,
  type AITrace,
  type SpanContext,
  type AIMetrics
} from './observability/aiObservabilityService';
