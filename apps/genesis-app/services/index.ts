/**
 * Services barrel export
 * @module services
 */

export { logger } from './logger';
export type { LogLevel, LogContext, LogEntry, TimerResult } from './logger';

export {
  // Error Classes
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  SecurityError,
  InfrastructureError,
  RateLimitError,
  // Error Handling
  handleError,
  tryCatch,
  tryCatchSync,
  createErrorFromResponse,
  isErrorCode,
  isOperationalError,
  ERROR_CODES,
  // Result Type (Functional Error Handling)
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  toResult,
  toResultSync,
  // Error Recovery
  withRetry,
  withTimeout,
} from './errorHandler';
export type { ErrorCode, Result } from './errorHandler';

// Error Reporting
export {
  errorReporter,
  captureException,
  captureMessage,
  addBreadcrumb,
  setErrorUser,
} from './errorReporting';
export type { ErrorSeverity, ErrorContext, Breadcrumb } from './errorReporting';

// Security
export { securityGuard } from './security/securityGuard';
export type {
  SecurityValidationResult,
  RequestValidationOptions,
  SecurityHeaders,
} from './security/securityGuard';

export {
  sanitizeInput,
  containsPII,
  containsInjection,
  redactPII,
  validatePayloadSize,
  sanitizeBookRequest,
  sanitizeInterviewQuestion,
  sanitizeImagePrompt,
} from './security/sanitizationService';
export type {
  SanitizationResult,
  SanitizationIssue,
  SanitizationOptions,
} from './security/sanitizationService';

// Security Audit Logging
export {
  securityAudit,
  auditLoginSuccess,
  auditLoginFailed,
  auditAccessDenied,
  auditAttackBlocked,
  auditRateLimitExceeded,
} from './security/auditLogger';
export type {
  AuditEventType,
  AuditSeverity,
  AuditEvent,
  AuditQueryOptions,
} from './security/auditLogger';

// API Middleware (Enforced Security Layer)
export {
  apiMiddleware,
  secureQuery,
  secureMutation,
  secureDelete,
} from './api/middleware';
export type { ApiOperation, ApiMiddlewareConfig, AuditLogEntry } from './api/middleware';

// API Validation Schemas
export * from './api/schemas';

// ============================================================================
// MARS-CLASS INFRASTRUCTURE
// ============================================================================
// Enterprise-grade infrastructure for 1M+ concurrent users

export {
  // Initialization
  initializeInfrastructure,
  shutdownInfrastructure,
  getInfrastructureHealth,
  // Connection pooling
  executeQuery,
  connectionHealthMonitor,
  getPoolMetrics,
  // Job queue
  jobQueue,
  JobType,
  JobStatus,
  JobPriority,
  // Semantic caching
  semanticCache,
  createCachedAIService,
  // R2 storage
  r2Storage,
  AssetCategory,
  // Media optimization
  mediaOptimizer,
  detectSupportedFormats,
  // Tracing
  tracer,
  createInstrumentedFetch,
  SpanKind,
  SpanStatus,
  // Circuit Breaker & Resilience
  CircuitBreaker,
  CircuitState,
  geminiCircuitBreaker,
  imagenCircuitBreaker,
  supabaseCircuitBreaker,
  storageCircuitBreaker,
  retryWithBackoff,
  Bulkhead,
  aiGenerationBulkhead,
  imageProcessingBulkhead,
  databaseBulkhead,
  resilientCall,
  getResilienceHealth,
  // Rate Limiting
  TieredRateLimiter,
  tieredRateLimiter,
  GlobalRateLimiter,
  globalRateLimiter,
  TIER_LIMITS,
  createRateLimitHeaders,
  createRateLimitResponse,
  // Types
  type InfrastructureHealth,
  type CacheStats,
  type JobProgress,
  type JobResult,
  type StoredAsset,
  type Trace,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type RetryConfig,
  type BulkheadConfig,
  type RateLimitConfig,
  type RateLimitResult,
  type TierLimits,
  type RateLimitCategory,
} from './infrastructure';

// External Service Wrapper (Circuit Breaker for External APIs)
export {
  callExternalService,
  callAIService,
  callPaymentService,
  callStorageService,
  getCircuitBreakerStatus,
  isServiceAvailable,
  getDegradedServices,
} from './infrastructure/externalServiceWrapper';
export type {
  ExternalServiceType,
  ExternalCallOptions,
  ExternalCallResult,
} from './infrastructure/externalServiceWrapper';

// Service Wrapper (Result-based Error Handling)
export {
  safeCall,
  safeCallSync,
  safeCallAll,
  safeCallAllStrict,
  mapResult as mapServiceResult,
  mapError,
  chainResult,
  unwrapOr as unwrapOrDefault,
  unwrapOrThrow,
  resultToPromise,
} from './serviceWrapper';
export type { ServiceFunction, SyncServiceFunction, SafeCallOptions } from './serviceWrapper';
