/**
 * Mars-Class Infrastructure - Bootstrap Module
 *
 * This module orchestrates the initialization of all infrastructure services
 * in the correct order with proper dependency resolution.
 *
 * Usage:
 * ```typescript
 * import { bootstrapInfrastructure, shutdownInfrastructure } from '@/services/infrastructure/bootstrap';
 *
 * // On app startup
 * await bootstrapInfrastructure();
 *
 * // On app shutdown (cleanup)
 * await shutdownInfrastructure();
 * ```
 */

import { type InfrastructureConfig, config, validateOnStartup } from '../../config/infrastructure';
import {
  type CircuitBreaker,
  aiGatewayCircuitBreaker,
  imagenCircuitBreaker,
  storageCircuitBreaker,
  supabaseCircuitBreaker,
} from './circuitBreaker';
import { type JobQueueClient, jobQueue } from './jobQueue';
import { type R2StorageClient, r2Storage } from './r2Storage';
import { type GlobalRateLimiter, globalRateLimiter } from './rateLimiter';
import { type SemanticCacheService, semanticCache } from './semanticCache';
import { connectionHealthMonitor, getSupabaseClient } from './supavisorConfig';
import { DEFAULT_TRACER_CONFIG, Tracer } from './tracing';

// ============================================================================
// TYPES
// ============================================================================

export interface InfrastructureServices {
  config: InfrastructureConfig;
  cache: SemanticCacheService | null;
  storage: R2StorageClient | null;
  jobs: JobQueueClient | null;
  tracer: Tracer | null;
  circuitBreakers: {
    aiGateway: CircuitBreaker;
    imagen: CircuitBreaker;
    supabase: CircuitBreaker;
    storage: CircuitBreaker;
  };
  rateLimiter: GlobalRateLimiter;
  isInitialized: boolean;
  initializationTime: number;
}

export interface BootstrapOptions {
  skipValidation?: boolean;
  services?: {
    cache?: boolean;
    storage?: boolean;
    jobs?: boolean;
    tracing?: boolean;
  };
}

export type BootstrapPhase =
  | 'pending'
  | 'validating'
  | 'tracing'
  | 'cache'
  | 'storage'
  | 'jobs'
  | 'complete'
  | 'failed';

export interface BootstrapProgress {
  phase: BootstrapPhase;
  progress: number; // 0-100
  message: string;
  error?: Error;
}

type ProgressCallback = (progress: BootstrapProgress) => void;

// ============================================================================
// SINGLETON STATE
// ============================================================================

let _services: InfrastructureServices | null = null;
let _isInitializing = false;
let _isShuttingDown = false;

// ============================================================================
// BOOTSTRAP LOGIC
// ============================================================================

/**
 * Bootstrap all infrastructure services in the correct order.
 * This is idempotent - calling multiple times will return the same instance.
 */
export async function bootstrapInfrastructure(
  options: BootstrapOptions = {},
  onProgress?: ProgressCallback
): Promise<InfrastructureServices> {
  // Return existing services if already initialized
  if (_services?.isInitialized) {
    return _services;
  }

  // Prevent concurrent initialization
  if (_isInitializing) {
    // Wait for existing initialization to complete
    while (_isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (_services?.isInitialized) {
      return _services;
    }
    throw new Error('Infrastructure initialization failed');
  }

  _isInitializing = true;
  const startTime = Date.now();

  const report = (phase: BootstrapPhase, progress: number, message: string, error?: Error) => {
    onProgress?.({ phase, progress, message, error });
    if (error) {
      console.error(`[Bootstrap] ${phase}: ${message}`, error);
    } else {
      console.warn(`[Bootstrap] ${phase}: ${message}`);
    }
  };

  try {
    report('pending', 0, 'Starting infrastructure bootstrap...');

    // Phase 1: Validate configuration
    report('validating', 10, 'Validating configuration...');
    if (!options.skipValidation) {
      validateOnStartup();
    }

    // Initialize services object
    _services = {
      config,
      cache: null,
      storage: null,
      jobs: null,
      tracer: null,
      circuitBreakers: {
        aiGateway: aiGatewayCircuitBreaker,
        imagen: imagenCircuitBreaker,
        supabase: supabaseCircuitBreaker,
        storage: storageCircuitBreaker,
      },
      rateLimiter: globalRateLimiter,
      isInitialized: false,
      initializationTime: 0,
    };

    // Phase 2: Initialize tracing (first, so other services can use it)
    const enableTracing = options.services?.tracing ?? config.features.distributedTracing;
    if (enableTracing && config.tracing.endpoint) {
      report('tracing', 20, 'Initializing distributed tracing...');
      try {
        _services.tracer = new Tracer({
          ...DEFAULT_TRACER_CONFIG,
          serviceName: config.tracing.serviceName,
          serviceVersion: config.tracing.serviceVersion,
          environment: config.app.environment,
        });
      } catch (error) {
        report('tracing', 20, 'Tracing initialization failed (non-critical)', error as Error);
        // Continue - tracing is non-critical
      }
    }

    // Phase 3: Initialize semantic cache
    const enableCache = options.services?.cache ?? config.features.semanticCache;
    if (enableCache) {
      report('cache', 40, 'Initializing semantic cache...');
      try {
        const supabaseUrl = config.supabase.url;
        const supabaseKey = config.supabase.anonKey;

        if (supabaseUrl && supabaseKey) {
          // Use the singleton semanticCache instance
          _services.cache = semanticCache;
        } else {
          report('cache', 40, 'Semantic cache skipped - missing Supabase credentials');
        }
      } catch (error) {
        report('cache', 40, 'Semantic cache initialization failed', error as Error);
        // Continue - cache is non-critical
      }
    }

    // Phase 4: Initialize R2 storage
    const enableStorage = options.services?.storage ?? config.features.r2Storage;
    if (enableStorage) {
      report('storage', 60, 'Initializing R2 storage...');
      try {
        if (config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey) {
          // Use the singleton r2Storage instance
          _services.storage = r2Storage;
        } else {
          report('storage', 60, 'R2 storage skipped - missing credentials');
        }
      } catch (error) {
        report('storage', 60, 'R2 storage initialization failed', error as Error);
        // Continue - storage can fall back to Supabase
      }
    }

    // Phase 5: Initialize job queue
    const enableJobs = options.services?.jobs ?? config.features.jobQueue;
    if (enableJobs) {
      report('jobs', 80, 'Initializing job queue...');
      try {
        if (config.redis.url) {
          // Use the singleton jobQueue instance
          _services.jobs = jobQueue;
        } else {
          report('jobs', 80, 'Job queue skipped - missing Redis URL');
        }
      } catch (error) {
        report('jobs', 80, 'Job queue initialization failed', error as Error);
        // Continue - jobs can fall back to synchronous processing
      }
    }

    // Complete
    _services.isInitialized = true;
    _services.initializationTime = Date.now() - startTime;

    report('complete', 100, `Infrastructure initialized in ${_services.initializationTime}ms`);

    return _services;
  } catch (error) {
    report('failed', 0, 'Infrastructure bootstrap failed', error as Error);
    _services = null;
    throw error;
  } finally {
    _isInitializing = false;
  }
}

/**
 * Gracefully shutdown all infrastructure services.
 */
export async function shutdownInfrastructure(): Promise<void> {
  if (!_services || _isShuttingDown) {
    return;
  }

  _isShuttingDown = true;
  console.warn('[Bootstrap] Shutting down infrastructure...');

  // Shutdown job queue first (stop accepting new jobs)
  // Note: JobQueueClient doesn't have a close method - it's a client-side queue
  // that uses HTTP requests, so no cleanup needed

  // Shutdown tracing (synchronous)
  if (_services.tracer) {
    try {
      _services.tracer.shutdown();
    } catch (err) {
      console.error('[Bootstrap] Error shutting down tracing:', err);
    }
  }

  _services = null;
  _isShuttingDown = false;

  console.warn('[Bootstrap] Infrastructure shutdown complete');
}

// ============================================================================
// SERVICE ACCESSORS
// ============================================================================

/**
 * Get the initialized infrastructure services.
 * Throws if not initialized.
 */
export function getInfrastructure(): InfrastructureServices {
  if (!_services?.isInitialized) {
    throw new Error('Infrastructure not initialized. Call bootstrapInfrastructure() first.');
  }
  return _services;
}

/**
 * Get infrastructure services if available, otherwise return null.
 */
export function getInfrastructureOrNull(): InfrastructureServices | null {
  return _services?.isInitialized ? _services : null;
}

/**
 * Check if infrastructure is initialized.
 */
export function isInfrastructureReady(): boolean {
  return _services?.isInitialized ?? false;
}

/**
 * Get initialization status.
 */
export function getInfrastructureStatus(): {
  isInitialized: boolean;
  isInitializing: boolean;
  isShuttingDown: boolean;
  initializationTime: number | null;
} {
  return {
    isInitialized: _services?.isInitialized ?? false,
    isInitializing: _isInitializing,
    isShuttingDown: _isShuttingDown,
    initializationTime: _services?.initializationTime ?? null,
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface InfrastructureHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    name: string;
    status: 'ok' | 'degraded' | 'error';
    message?: string;
    latency?: number;
  }[];
  metrics: {
    uptime: number;
    initializationTime: number;
  };
}

export async function checkInfrastructureHealth(): Promise<InfrastructureHealthCheck> {
  const services: InfrastructureHealthCheck['services'] = [];

  if (!_services?.isInitialized) {
    return {
      status: 'unhealthy',
      services: [{ name: 'infrastructure', status: 'error', message: 'Not initialized' }],
      metrics: {
        uptime: 0,
        initializationTime: 0,
      },
    };
  }

  // Check Supabase connection health
  try {
    const start = Date.now();
    const client = getSupabaseClient();
    const latency = Date.now() - start;

    if (client) {
      const health = connectionHealthMonitor.getHealth();
      services.push({
        name: 'database',
        status: health.isHealthy ? 'ok' : 'degraded',
        latency,
        message: health.isHealthy ? undefined : 'Connection issues detected',
      });
    } else {
      services.push({ name: 'database', status: 'degraded', message: 'No pooler connection' });
    }
  } catch (error) {
    services.push({ name: 'database', status: 'error', message: (error as Error).message });
  }

  // Check cache
  if (_services.cache) {
    try {
      const stats = _services.cache.getStats();
      services.push({
        name: 'cache',
        status: 'ok',
        message: `${stats.entriesCount} entries, ${(stats.hitRate * 100).toFixed(1)}% hit rate`,
      });
    } catch (error) {
      services.push({ name: 'cache', status: 'error', message: (error as Error).message });
    }
  } else {
    services.push({ name: 'cache', status: 'degraded', message: 'Not enabled' });
  }

  // Check storage
  if (_services.storage) {
    services.push({ name: 'storage', status: 'ok' });
  } else {
    services.push({ name: 'storage', status: 'degraded', message: 'Not enabled' });
  }

  // Check job queue
  if (_services.jobs) {
    try {
      const stats = await _services.jobs.getQueueStats();
      services.push({
        name: 'jobs',
        status: 'ok',
        message: `${stats.active} active, ${stats.waiting} waiting`,
      });
    } catch (error) {
      services.push({ name: 'jobs', status: 'error', message: (error as Error).message });
    }
  } else {
    services.push({ name: 'jobs', status: 'degraded', message: 'Not enabled' });
  }

  // Determine overall status
  const hasError = services.some((s) => s.status === 'error');
  const hasDegraded = services.some((s) => s.status === 'degraded');

  const status = hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status,
    services,
    metrics: {
      uptime:
        _services.initializationTime > 0
          ? Date.now() - (_services.initializationTime + Date.now())
          : 0,
      initializationTime: _services.initializationTime,
    },
  };
}

// ============================================================================
// REACT INTEGRATION HOOK
// ============================================================================

/**
 * Custom hook for React components to access infrastructure.
 * Use this in conjunction with a provider component.
 */
export function createInfrastructureContext() {
  return {
    services: _services,
    isReady: isInfrastructureReady(),
    status: getInfrastructureStatus(),
  };
}
