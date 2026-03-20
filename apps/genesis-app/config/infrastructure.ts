/**
 * Mars-Class Infrastructure - Configuration Validation
 *
 * Validates all required environment variables and provides safe defaults.
 * This module should be imported early in the application lifecycle.
 *
 * Usage:
 * ```typescript
 * import { validateConfig, config } from '@/config/infrastructure';
 *
 * // Validate all required config on startup
 * const errors = validateConfig();
 * if (errors.length > 0) {
 *   console.error('Configuration errors:', errors);
 *   process.exit(1);
 * }
 *
 * // Use config values
 * const supabaseUrl = config.supabase.url;
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InfrastructureConfig {
  // Application
  app: {
    environment: 'development' | 'staging' | 'production';
    version: string;
    debug: boolean;
  };

  // Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    poolerUrl: string;
  };

  // Redis (BullMQ)
  redis: {
    url: string;
    maxRetries: number;
    retryDelayMs: number;
    enableTls: boolean;
  };

  // Cloudflare R2
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
    customDomain: string;
  };

  // OpenTelemetry
  tracing: {
    enabled: boolean;
    endpoint: string;
    headers: string;
    serviceName: string;
    serviceVersion: string;
    samplingRatio: number;
  };

  // Semantic Cache
  cache: {
    similarityThreshold: number;
    maxEntries: number;
    ttlHours: number;
  };

  // Job Queue
  jobs: {
    concurrency: number;
    maxRetries: number;
    retryDelayMs: number;
    timeoutBookGeneration: number;
    timeoutImageOptimization: number;
  };

  // Rate Limiting
  rateLimits: {
    globalRps: number;
    booksPerHourFree: number;
    booksPerHourCreator: number;
    booksPerHourPro: number;
  };

  // Feature Flags
  features: {
    semanticCache: boolean;
    r2Storage: boolean;
    jobQueue: boolean;
    distributedTracing: boolean;
    mediaOptimization: boolean;
  };
}

export interface ConfigValidationError {
  key: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULTS = {
  // App
  environment: 'development' as const,
  version: '2.0.0',
  debug: true,

  // Redis
  redisMaxRetries: 3,
  redisRetryDelay: 1000,
  redisEnableTls: true,

  // R2
  r2BucketName: 'genesis-assets',

  // Tracing
  tracingEnabled: true,
  tracingSamplingRatio: 0.1,
  tracingServiceName: 'genesis',

  // Cache
  cacheSimilarityThreshold: 0.92,
  cacheMaxEntries: 10000,
  cacheTtlHours: 168, // 7 days

  // Jobs
  jobConcurrency: 10,
  jobMaxRetries: 3,
  jobRetryDelay: 5000,
  jobTimeoutBookGeneration: 180000, // 3 minutes
  jobTimeoutImageOptimization: 60000, // 1 minute

  // Rate Limits
  globalRps: 10000,
  booksPerHourFree: 3,
  booksPerHourCreator: 20,
  booksPerHourPro: 100,

  // Features (all enabled by default)
  featureSemanticCache: true,
  featureR2Storage: true,
  featureJobQueue: true,
  featureDistributedTracing: true,
  featureMediaOptimization: true,
};

// ============================================================================
// ENVIRONMENT VARIABLE HELPERS
// ============================================================================

type ImportMetaWithEnv = { env?: Record<string, string | undefined> };

function getEnv(key: string, defaultValue?: string): string {
  // Check both VITE_ prefixed and non-prefixed versions
  const importMetaEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as ImportMetaWithEnv).env
      : undefined;

  const value =
    importMetaEnv?.[key] ??
    (typeof process !== 'undefined' ? process.env[key] : undefined) ??
    importMetaEnv?.[`VITE_${key}`] ??
    (typeof process !== 'undefined' ? process.env[`VITE_${key}`] : undefined) ??
    defaultValue;

  return value ?? '';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnv(key);
  const parsed = Number.parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const value = getEnv(key);
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = getEnv(key).toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return defaultValue;
}

// ============================================================================
// CONFIGURATION BUILDER
// ============================================================================

export function buildConfig(): InfrastructureConfig {
  const environment = getEnv(
    'NODE_ENV',
    DEFAULTS.environment
  ) as InfrastructureConfig['app']['environment'];

  return {
    app: {
      environment,
      version: getEnv('npm_package_version', DEFAULTS.version),
      debug: environment !== 'production',
    },

    supabase: {
      url: getEnv('SUPABASE_URL', ''),
      anonKey: getEnv('SUPABASE_ANON_KEY', ''),
      serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
      poolerUrl: getEnv('SUPAVISOR_DATABASE_URL', ''),
    },

    redis: {
      url: getEnv('REDIS_URL', ''),
      maxRetries: getEnvNumber('REDIS_MAX_RETRIES', DEFAULTS.redisMaxRetries),
      retryDelayMs: getEnvNumber('REDIS_RETRY_DELAY', DEFAULTS.redisRetryDelay),
      enableTls: getEnvBoolean('REDIS_ENABLE_TLS', DEFAULTS.redisEnableTls),
    },

    r2: {
      accountId: getEnv('R2_ACCOUNT_ID', ''),
      accessKeyId: getEnv('R2_ACCESS_KEY_ID', ''),
      secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY', ''),
      bucketName: getEnv('R2_BUCKET_NAME', DEFAULTS.r2BucketName),
      publicUrl: getEnv('R2_PUBLIC_BUCKET_URL', ''),
      customDomain: getEnv('R2_CUSTOM_DOMAIN', ''),
    },

    tracing: {
      enabled: getEnvBoolean('OTEL_ENABLED', DEFAULTS.tracingEnabled),
      endpoint: getEnv('OTEL_EXPORTER_OTLP_ENDPOINT', ''),
      headers: getEnv('OTEL_EXPORTER_OTLP_HEADERS', ''),
      serviceName: getEnv('OTEL_SERVICE_NAME', DEFAULTS.tracingServiceName),
      serviceVersion: getEnv('OTEL_SERVICE_VERSION', DEFAULTS.version),
      samplingRatio: getEnvFloat('OTEL_SAMPLING_RATIO', DEFAULTS.tracingSamplingRatio),
    },

    cache: {
      similarityThreshold: getEnvFloat(
        'SEMANTIC_CACHE_SIMILARITY_THRESHOLD',
        DEFAULTS.cacheSimilarityThreshold
      ),
      maxEntries: getEnvNumber('SEMANTIC_CACHE_MAX_ENTRIES', DEFAULTS.cacheMaxEntries),
      ttlHours: getEnvNumber('SEMANTIC_CACHE_TTL_HOURS', DEFAULTS.cacheTtlHours),
    },

    jobs: {
      concurrency: getEnvNumber('JOB_QUEUE_CONCURRENCY', DEFAULTS.jobConcurrency),
      maxRetries: getEnvNumber('JOB_QUEUE_MAX_RETRIES', DEFAULTS.jobMaxRetries),
      retryDelayMs: getEnvNumber('JOB_QUEUE_RETRY_DELAY', DEFAULTS.jobRetryDelay),
      timeoutBookGeneration: getEnvNumber(
        'JOB_TIMEOUT_BOOK_GENERATION',
        DEFAULTS.jobTimeoutBookGeneration
      ),
      timeoutImageOptimization: getEnvNumber(
        'JOB_TIMEOUT_IMAGE_OPTIMIZATION',
        DEFAULTS.jobTimeoutImageOptimization
      ),
    },

    rateLimits: {
      globalRps: getEnvNumber('RATE_LIMIT_GLOBAL_RPS', DEFAULTS.globalRps),
      booksPerHourFree: getEnvNumber('RATE_LIMIT_BOOKS_FREE', DEFAULTS.booksPerHourFree),
      booksPerHourCreator: getEnvNumber('RATE_LIMIT_BOOKS_CREATOR', DEFAULTS.booksPerHourCreator),
      booksPerHourPro: getEnvNumber('RATE_LIMIT_BOOKS_PRO', DEFAULTS.booksPerHourPro),
    },

    features: {
      semanticCache: getEnvBoolean('FEATURE_SEMANTIC_CACHE', DEFAULTS.featureSemanticCache),
      r2Storage: getEnvBoolean('FEATURE_R2_STORAGE', DEFAULTS.featureR2Storage),
      jobQueue: getEnvBoolean('FEATURE_JOB_QUEUE', DEFAULTS.featureJobQueue),
      distributedTracing: getEnvBoolean(
        'FEATURE_DISTRIBUTED_TRACING',
        DEFAULTS.featureDistributedTracing
      ),
      mediaOptimization: getEnvBoolean(
        'FEATURE_MEDIA_OPTIMIZATION',
        DEFAULTS.featureMediaOptimization
      ),
    },
  };
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

export function validateConfig(config?: InfrastructureConfig): ConfigValidationError[] {
  const cfg = config ?? buildConfig();
  const errors: ConfigValidationError[] = [];

  // Production-only validations
  if (cfg.app.environment === 'production') {
    // Required for production
    if (!cfg.supabase.url) {
      errors.push({
        key: 'SUPABASE_URL',
        message: 'Supabase URL is required in production',
        severity: 'error',
      });
    }
    if (!cfg.supabase.anonKey) {
      errors.push({
        key: 'SUPABASE_ANON_KEY',
        message: 'Supabase anon key is required in production',
        severity: 'error',
      });
    }
    if (!cfg.supabase.poolerUrl) {
      errors.push({
        key: 'SUPAVISOR_DATABASE_URL',
        message: 'Supavisor URL recommended for production',
        severity: 'warning',
      });
    }

    // Redis required for job queue
    if (cfg.features.jobQueue && !cfg.redis.url) {
      errors.push({
        key: 'REDIS_URL',
        message: 'Redis URL required when job queue is enabled',
        severity: 'error',
      });
    }

    // R2 required for storage feature
    if (cfg.features.r2Storage) {
      if (!cfg.r2.accountId) {
        errors.push({
          key: 'R2_ACCOUNT_ID',
          message: 'R2 account ID required when R2 storage is enabled',
          severity: 'error',
        });
      }
      if (!cfg.r2.accessKeyId) {
        errors.push({
          key: 'R2_ACCESS_KEY_ID',
          message: 'R2 access key required when R2 storage is enabled',
          severity: 'error',
        });
      }
      if (!cfg.r2.secretAccessKey) {
        errors.push({
          key: 'R2_SECRET_ACCESS_KEY',
          message: 'R2 secret key required when R2 storage is enabled',
          severity: 'error',
        });
      }
    }

    // Tracing endpoint required when enabled
    if (cfg.features.distributedTracing && !cfg.tracing.endpoint) {
      errors.push({
        key: 'OTEL_EXPORTER_OTLP_ENDPOINT',
        message: 'OTLP endpoint recommended when tracing is enabled',
        severity: 'warning',
      });
    }
  }

  // Always validate
  if (cfg.cache.similarityThreshold < 0.8 || cfg.cache.similarityThreshold > 1.0) {
    errors.push({
      key: 'SEMANTIC_CACHE_SIMILARITY_THRESHOLD',
      message: 'Similarity threshold should be between 0.8 and 1.0',
      severity: 'warning',
    });
  }

  if (cfg.tracing.samplingRatio < 0 || cfg.tracing.samplingRatio > 1) {
    errors.push({
      key: 'OTEL_SAMPLING_RATIO',
      message: 'Sampling ratio must be between 0 and 1',
      severity: 'error',
    });
  }

  return errors;
}

// ============================================================================
// SINGLETON CONFIG INSTANCE
// ============================================================================

let _config: InfrastructureConfig | null = null;

export function getConfig(): InfrastructureConfig {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

// Export singleton
export const config = getConfig();

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

/**
 * Validate configuration on startup.
 * Call this in your application entry point.
 */
export function validateOnStartup(): void {
  const errors = validateConfig();
  const criticalErrors = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');

  if (warnings.length > 0) {
    console.warn('[Config] Warnings:');
    warnings.forEach((w) => console.warn(`  - ${w.key}: ${w.message}`));
  }

  if (criticalErrors.length > 0) {
    console.error('[Config] Critical errors:');
    criticalErrors.forEach((e) => console.error(`  - ${e.key}: ${e.message}`));

    if (config.app.environment === 'production') {
      throw new Error(`Configuration invalid: ${criticalErrors.length} critical errors`);
    }
  }

  console.warn(`[Config] Loaded for environment: ${config.app.environment}`);
}
