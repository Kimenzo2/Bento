/**
 * Mars-Class Infrastructure Module
 *
 * Enterprise-grade infrastructure for scaling Genesis to 1,000,000+ concurrent users.
 *
 * ARCHITECTURE PILLARS:
 * 1. PERSISTENCE - Supavisor connection pooling, optimized RLS
 * 2. COGNITION - Semantic caching for AI cost reduction
 * 3. ASYNCHRONY - BullMQ job queue for long-running tasks
 * 4. DELIVERY - Cloudflare R2 zero-egress storage
 * 5. OBSERVABILITY - Distributed tracing with OpenTelemetry
 * 6. RESILIENCE - Circuit breakers, bulkheads, retry patterns
 * 7. PROTECTION - Tiered rate limiting, DDoS protection
 *
 * USAGE:
 * ```typescript
 * import {
 *   // Connection pooling
 *   executeQuery,
 *   connectionHealthMonitor,
 *
 *   // Job queue
 *   jobQueue,
 *   JobType,
 *
 *   // Semantic caching
 *   semanticCache,
 *   createCachedAIService,
 *
 *   // Storage
 *   r2Storage,
 *
 *   // Media optimization
 *   mediaOptimizer,
 *
 *   // Tracing
 *   tracer,
 *   createInstrumentedFetch,
 * } from '@services/infrastructure';
 *
 * // Example: Cached AI call
 * const cachedGemini = createCachedAIService(semanticCache, geminiService.chat);
 * const response = await cachedGemini("How does photosynthesis work?", { subject: "science" });
 *
 * // Example: Job queue submission
 * const jobId = await jobQueue.submitJob(JobType.GENERATE_BOOK, {
 *   userId: 'user123',
 *   topic: 'Space Adventure',
 *   pageCount: 10,
 * });
 *
 * // Example: R2 storage upload
 * const asset = await r2Storage.upload(file, { userId: 'user123', category: 'illustrations' });
 *
 * // Example: Distributed tracing
 * await tracer.trace('generateBook', async (span) => {
 *   span.setAttribute('book.topic', 'Space');
 *   // ... generation logic
 * });
 *
 * // Example: Bootstrap infrastructure on app startup
 * import { bootstrapInfrastructure, shutdownInfrastructure } from '@services/infrastructure';
 * await bootstrapInfrastructure();
 * // ... app runs ...
 * await shutdownInfrastructure();
 * ```
 */

// ============================================================================
// BOOTSTRAP & LIFECYCLE
// ============================================================================

export {
  // Lifecycle
  bootstrapInfrastructure,
  shutdownInfrastructure,
  // Service access
  getInfrastructure,
  getInfrastructureOrNull,
  isInfrastructureReady,
  getInfrastructureStatus,
  // Health
  checkInfrastructureHealth,
  // React integration
  createInfrastructureContext,
  // Types
  type InfrastructureServices,
  type BootstrapOptions,
  type BootstrapPhase,
  type BootstrapProgress,
  type InfrastructureHealthCheck,
} from './bootstrap';

// ============================================================================
// SUPAVISOR CONNECTION POOLING
// ============================================================================

export {
  // Configuration
  DEFAULT_POOL_CONFIG,
  buildPoolerUrl,
  getConnectionUrl,
  // Client management
  getSupabaseClient,
  executeQuery,
  // Health monitoring
  connectionHealthMonitor,
  getPoolMetrics,
  // Types
  type PoolConfig,
  type ConnectionHealth,
  type QueryOptions,
} from './supavisorConfig';

// ============================================================================
// JOB QUEUE SYSTEM
// ============================================================================

export {
  // Queue client
  JobQueueClient,
  jobQueue,
  createJobQueueHook,
  // Configuration
  QUEUE_CONFIGS,
  // Enums
  JobType,
  JobStatus,
  JobPriority,
  // Types
  type BaseJobData,
  type GenerateBookJobData,
  type GeneratePageImageJobData,
  type OptimizeImageJobData,
  type ExportPDFJobData,
  type GenerateCurriculumJobData,
  type JobData,
  type JobResult,
  type JobProgress,
  type QueueConfig,
  type UseJobQueueOptions,
  type JobQueueHookResult,
} from './jobQueue';

export {
  // Worker management
  WorkerManager,
  workerManager,
  // Processors
  PROCESSORS,
  bookGenerationProcessor,
  imageOptimizationProcessor,
  curriculumProcessor,
  // Types
  type WorkerConfig,
  type JobProcessor,
} from './jobWorker';

// ============================================================================
// SEMANTIC CACHING
// ============================================================================

export {
  // Cache service
  SemanticCacheService,
  semanticCache,
  createCachedAIService,
  // Configuration
  DEFAULT_CACHE_CONFIG,
  COMMON_EDUCATIONAL_QUESTIONS,
  // Types
  type CacheEntry,
  type CacheContext,
  type CacheSearchResult,
  type SemanticCacheConfig,
  type CacheStats,
  type EmbeddingService,
  type VectorStore,
  type AICallFunction,
} from './semanticCache';

// ============================================================================
// CLOUDFLARE R2 STORAGE
// ============================================================================

export {
  // Storage client
  R2StorageClient,
  r2Storage,
  // Utilities
  generateAssetKey,
  getResponsiveImageProps,
  migrateToR2,
  // Configuration
  DEFAULT_R2_CONFIG,
  IMMUTABLE_CACHE_CONTROL,
  DYNAMIC_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
  // Enums
  AssetCategory,
  // Types
  type R2Config,
  type UploadOptions,
  type StoredAsset,
  type OptimizedAsset,
  type AssetVariant,
  type ResponsiveImageProps,
  type MigrationProgress,
} from './r2Storage';

// ============================================================================
// MEDIA OPTIMIZATION
// ============================================================================

export {
  // Optimizer
  MediaOptimizer,
  mediaOptimizer,
  // Utilities
  detectSupportedFormats,
  selectBestFormat,
  generatePictureSources,
  createLazyLoader,
  // Configuration
  OPTIMIZATION_PRESETS,
  // Performance tracking
  mediaPerformanceTracker,
  // Types
  type ImageFormat,
  type OptimizationConfig,
  type ImageMetadata,
  type OptimizedImageResult,
  type OptimizationJob,
  type LazyImageOptions,
  type MediaPerformanceMetrics,
} from './mediaOptimizer';

// ============================================================================
// DISTRIBUTED TRACING
// ============================================================================

export {
  // Tracer
  Tracer,
  tracer,
  // Context propagation
  generateTraceId,
  generateSpanId,
  parseTraceParent,
  createTraceParent,
  extractContext,
  injectContext,
  // Instrumentation
  createInstrumentedFetch,
  observeWebVitals,
  // Enums
  SpanKind,
  SpanStatus,
  // Types
  type SpanContext,
  type SpanAttributes,
  type SpanEvent,
  type Span,
  type Trace,
  type TracerConfig,
} from './tracing';

// ============================================================================
// LOAD TESTING & CHAOS ENGINEERING
// ============================================================================

export {
  // Configuration
  K6_CONFIG,
  K6_SCRIPTS,
  CHAOS_EXPERIMENTS,
  // Utilities
  getK6ScriptContent,
  getAllK6Scripts,
  // Types
  type TestResult,
  type ChaosExperiment,
} from './loadTesting';

// ============================================================================
// CIRCUIT BREAKER & RESILIENCE
// ============================================================================

export {
  // Circuit Breaker
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  TimeoutError,
  // Pre-configured breakers
  geminiCircuitBreaker,
  imagenCircuitBreaker,
  supabaseCircuitBreaker,
  storageCircuitBreaker,
  // Retry
  retryWithBackoff,
  DEFAULT_RETRY_CONFIG,
  // Bulkhead
  Bulkhead,
  BulkheadFullError,
  BulkheadQueueTimeoutError,
  aiGenerationBulkhead,
  imageProcessingBulkhead,
  databaseBulkhead,
  // Combined
  resilientCall,
  getResilienceHealth,
  // Types
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type RetryConfig,
  type BulkheadConfig,
  type ResilientCallConfig,
} from './circuitBreaker';

// ============================================================================
// RATE LIMITING
// ============================================================================

export {
  // Token Bucket
  TokenBucketRateLimiter,
  // Sliding Window
  SlidingWindowRateLimiter,
  // Tiered (per user tier)
  TieredRateLimiter,
  tieredRateLimiter,
  TIER_LIMITS,
  // Global (DDoS protection)
  GlobalRateLimiter,
  globalRateLimiter,
  // Middleware helpers
  createRateLimitHeaders,
  createRateLimitResponse,
  // Types
  type RateLimitConfig,
  type RateLimitResult,
  type SlidingWindowConfig,
  type TierLimits,
  type RateLimitCategory,
  type RateLimitHeaders,
} from './rateLimiter';

// ============================================================================
// INITIALIZATION (LEGACY - Use bootstrap module for new code)
// ============================================================================

let infrastructureInitialized = false;

/**
 * Initialize all infrastructure services.
 * Call this on application startup.
 *
 * @deprecated Use bootstrapInfrastructure() from './bootstrap' for new code
 */
export function initializeInfrastructure(
  options: {
    enableTracing?: boolean;
    enableCacheWarmup?: boolean;
    environment?: 'development' | 'staging' | 'production';
  } = {}
): void {
  if (infrastructureInitialized) {
    console.warn('[Infrastructure] Already initialized, skipping');
    return;
  }

  const { enableTracing = true, enableCacheWarmup = true, environment = 'development' } = options;

  console.warn(`[Infrastructure] Initializing Mars-Class architecture (${environment})...`);

  // Configure based on environment
  if (environment === 'production') {
    // Reduce sampling in production
    console.warn('[Infrastructure] Production mode: Reduced tracing sample rate');
  }

  // Warm up semantic cache
  if (enableCacheWarmup) {
    import('./semanticCache').then(({ semanticCache, COMMON_EDUCATIONAL_QUESTIONS }) => {
      semanticCache.warmup(COMMON_EDUCATIONAL_QUESTIONS).catch(console.error);
    });
  }

  // Initialize tracing
  if (enableTracing && typeof window !== 'undefined') {
    import('./tracing').then(({ observeWebVitals, tracer }) => {
      observeWebVitals(tracer);
    });
  }

  infrastructureInitialized = true;
  console.warn('[Infrastructure] Mars-Class architecture initialized ✓');
}

/**
 * Legacy shutdown function for backwards compatibility.
 * Call this before application termination.
 *
 * @deprecated Use the exported shutdownInfrastructure() function instead
 */
async function legacyShutdownInfrastructure(): Promise<void> {
  console.warn('[Infrastructure] Initiating graceful shutdown...');

  // Flush tracer
  const { tracer } = await import('./tracing');
  tracer.shutdown();

  // Shutdown workers
  const { workerManager } = await import('./jobWorker');
  await workerManager.shutdown();

  // Final cache maintenance
  const { semanticCache } = await import('./semanticCache');
  await semanticCache.maintenance();

  console.warn('[Infrastructure] Shutdown complete');
}

// Re-export as named export for backwards compatibility
export { legacyShutdownInfrastructure };

// ============================================================================
// HEALTH CHECK (LEGACY)
// ============================================================================

export interface InfrastructureHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    connectionPool: { healthy: boolean; details: Record<string, number> };
    jobQueue: { healthy: boolean; details: { pending: number; active: number } };
    semanticCache: { healthy: boolean; details: { hitRate: number; entries: number } };
    tracing: { healthy: boolean; details: { activeSpans: number } };
  };
  timestamp: Date;
}

/**
 * Get infrastructure health status.
 *
 * @deprecated Use checkInfrastructureHealth() from './bootstrap' for new code
 */
export async function getInfrastructureHealth(): Promise<InfrastructureHealth> {
  const health: InfrastructureHealth = {
    status: 'healthy',
    services: {
      connectionPool: { healthy: true, details: {} },
      jobQueue: { healthy: true, details: { pending: 0, active: 0 } },
      semanticCache: { healthy: true, details: { hitRate: 0, entries: 0 } },
      tracing: { healthy: true, details: { activeSpans: 0 } },
    },
    timestamp: new Date(),
  };

  try {
    // Check connection pool
    const poolMetrics = (await import('./supavisorConfig')).getPoolMetrics();
    health.services.connectionPool.details = poolMetrics;
    health.services.connectionPool.healthy = poolMetrics.supavisor_is_healthy === 1;

    // Check job queue
    try {
      const stats = await (await import('./jobQueue')).jobQueue.getQueueStats();
      health.services.jobQueue.details = { pending: stats.waiting, active: stats.active };
      health.services.jobQueue.healthy = stats.waiting < 10000;
    } catch {
      health.services.jobQueue.healthy = false;
    }

    // Check semantic cache
    const cacheStats = (await import('./semanticCache')).semanticCache.getStats();
    health.services.semanticCache.details = {
      hitRate: cacheStats.hitRate,
      entries: cacheStats.entriesCount,
    };
    health.services.semanticCache.healthy = true;

    // Determine overall health
    const allHealthy = Object.values(health.services).every((s) => s.healthy);
    const anyUnhealthy = Object.values(health.services).some((s) => !s.healthy);

    health.status = allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'unhealthy';
  } catch (error) {
    console.error('[Infrastructure] Health check failed:', error);
    health.status = 'unhealthy';
  }

  return health;
}
