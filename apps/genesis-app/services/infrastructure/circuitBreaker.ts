/**
 * Mars-Class Infrastructure - Circuit Breaker & Resilience Patterns
 *
 * Implements the Circuit Breaker pattern to prevent cascade failures
 * at 1,000,000 concurrent user scale.
 *
 * THE PROBLEM (Cascade Failures):
 * - AI service goes down → All book generation requests queue up
 * - Queue fills → Memory exhaustion → Entire system crashes
 * - 1 failing service takes down 100% of functionality
 *
 * THE SOLUTION (Circuit Breaker):
 * - Monitor failure rates in real-time
 * - "Open" circuit when failures exceed threshold (stop calling)
 * - Periodically test recovery (half-open state)
 * - "Close" circuit when service recovers
 *
 * Additional patterns:
 * - Bulkhead: Isolate resources per service
 * - Retry with Jitter: Prevent thundering herd on recovery
 * - Timeout: Never wait forever
 */

// ============================================================================
// TYPES
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

export interface CircuitBreakerConfig {
  /** Name for logging/metrics */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms to wait before testing recovery */
  resetTimeoutMs: number;
  /** Number of successful calls to close circuit from half-open */
  successThreshold: number;
  /** Timeout for each call in ms */
  callTimeoutMs: number;
  /** Monitor window in ms for failure rate calculation */
  monitorWindowMs: number;
  /** Optional fallback function when circuit is open */
  fallback?: <T>() => T | Promise<T>;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveSuccesses: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  failureRate: number;
}

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date = new Date(0);
  private readonly requests: Array<{ timestamp: Date; success: boolean }> = [];

  constructor(private readonly config: CircuitBreakerConfig) {}

  /**
   * Execute a function through the circuit breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime.getTime()) {
        // Still in cooldown
        if (this.config.fallback) {
          return this.config.fallback<T>();
        }
        throw new CircuitOpenError(this.config.name, this.getRemainingCooldownMs());
      }

      // Time to test recovery
      this.state = CircuitState.HALF_OPEN;
      this.consecutiveSuccesses = 0;
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with timeout protection.
   */
  private executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TimeoutError(this.config.name, this.config.callTimeoutMs));
      }, this.config.callTimeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Handle successful call.
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.lastSuccessTime = new Date();
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        // Recovered! Close the circuit
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        console.warn(`[CircuitBreaker:${this.config.name}] Circuit CLOSED - Service recovered`);
      }
    }
  }

  /**
   * Handle failed call.
   */
  private onFailure(_error: Error): void {
    this.failures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    this.recordRequest(false);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test - reopen circuit
      this.openCircuit();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded failure threshold
      const recentFailureRate = this.getRecentFailureRate();
      if (recentFailureRate >= 0.5 || this.failures >= this.config.failureThreshold) {
        this.openCircuit();
      }
    }
  }

  /**
   * Open the circuit (start rejecting requests).
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
    console.error(
      `[CircuitBreaker:${this.config.name}] Circuit OPEN - Service failing. Retry at ${this.nextAttemptTime.toISOString()}`
    );
  }

  /**
   * Record request in sliding window.
   */
  private recordRequest(success: boolean): void {
    const now = new Date();
    this.requests.push({ timestamp: now, success });

    // Prune old requests outside window
    const windowStart = new Date(now.getTime() - this.config.monitorWindowMs);
    while (this.requests.length > 0 && this.requests[0].timestamp < windowStart) {
      this.requests.shift();
    }
  }

  /**
   * Calculate failure rate in recent window.
   */
  private getRecentFailureRate(): number {
    if (this.requests.length === 0) return 0;
    const failures = this.requests.filter((r) => !r.success).length;
    return failures / this.requests.length;
  }

  /**
   * Get remaining cooldown time.
   */
  private getRemainingCooldownMs(): number {
    return Math.max(0, this.nextAttemptTime.getTime() - Date.now());
  }

  /**
   * Get current circuit state and stats.
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.failures + this.successes,
      failureRate: this.getRecentFailureRate(),
    };
  }

  /**
   * Manually reset the circuit (for testing/admin).
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveSuccesses = 0;
    this.requests.length = 0;
    console.warn(`[CircuitBreaker:${this.config.name}] Circuit manually reset`);
  }
}

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly remainingMs: number
  ) {
    super(`Circuit "${circuitName}" is open. Retry in ${Math.ceil(remainingMs / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly timeoutMs: number
  ) {
    super(`Circuit "${circuitName}" call timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF + JITTER
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in ms */
  baseDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Jitter factor (0-1) to prevent thundering herd */
  jitterFactor: number;
  /** Error names to retry on (defaults to all) */
  retryOnNames?: string[];
  /** Error names to NOT retry on */
  noRetryOnNames?: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
  noRetryOnNames: ['CircuitOpenError'], // Don't retry when circuit is open
};

/**
 * Execute a function with retry and exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const opts: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorName = (error as Error).name;

      // Check if we should retry
      if (attempt >= opts.maxRetries) break;
      if (opts.noRetryOnNames?.includes(errorName)) break;
      if (opts.retryOnNames && !opts.retryOnNames.includes(errorName)) break;

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
      const jitter = cappedDelay * opts.jitterFactor * Math.random();
      const finalDelay = cappedDelay + jitter;

      console.warn(
        `[Retry] Attempt ${attempt + 1} failed, retrying in ${Math.round(finalDelay)}ms:`,
        lastError.message
      );

      await sleep(finalDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// BULKHEAD PATTERN (Resource Isolation)
// ============================================================================

export interface BulkheadConfig {
  /** Name for logging */
  name: string;
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum queue size */
  maxQueue: number;
  /** Timeout for queued requests in ms */
  queueTimeoutMs: number;
}

interface QueuedTask {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  fn: () => Promise<unknown>;
  queuedAt: Date;
}

export class Bulkhead {
  private running = 0;
  private readonly queue: QueuedTask[] = [];

  constructor(private readonly config: BulkheadConfig) {}

  /**
   * Execute a function within the bulkhead.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can run immediately
    if (this.running < this.config.maxConcurrent) {
      return this.runTask(fn);
    }

    // Check if queue is full
    if (this.queue.length >= this.config.maxQueue) {
      throw new BulkheadFullError(this.config.name, this.running, this.queue.length);
    }

    // Add to queue
    return new Promise<T>((resolve, reject) => {
      const queuedAt = new Date();

      // Set timeout for queued request
      const timeout = setTimeout(() => {
        const index = this.queue.findIndex((t) => t.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new BulkheadQueueTimeoutError(this.config.name, this.config.queueTimeoutMs));
        }
      }, this.config.queueTimeoutMs);

      this.queue.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        fn: fn as () => Promise<unknown>,
        queuedAt,
      });
    });
  }

  /**
   * Run a task immediately.
   */
  private async runTask<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Process queued tasks.
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (this.running >= this.config.maxConcurrent) return;

    const task = this.queue.shift();
    if (!task) return;

    this.runTask(task.fn).then(task.resolve).catch(task.reject);
  }

  /**
   * Get current bulkhead status.
   */
  getStatus(): { running: number; queued: number; available: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      available: Math.max(0, this.config.maxConcurrent - this.running),
    };
  }
}

export class BulkheadFullError extends Error {
  constructor(
    public readonly bulkheadName: string,
    public readonly running: number,
    public readonly queued: number
  ) {
    super(`Bulkhead "${bulkheadName}" is full (${running} running, ${queued} queued)`);
    this.name = 'BulkheadFullError';
  }
}

export class BulkheadQueueTimeoutError extends Error {
  constructor(
    public readonly bulkheadName: string,
    public readonly timeoutMs: number
  ) {
    super(`Bulkhead "${bulkheadName}" queue timeout after ${timeoutMs}ms`);
    this.name = 'BulkheadQueueTimeoutError';
  }
}

// ============================================================================
// PRE-CONFIGURED CIRCUIT BREAKERS FOR GENESIS SERVICES
// ============================================================================

/** Circuit breaker for AI gateway calls */
export const aiGatewayCircuitBreaker = new CircuitBreaker({
  name: 'ai-gateway',
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 second cooldown
  successThreshold: 2, // 2 successes to close
  callTimeoutMs: 60000, // 60 second timeout (AI can be slow)
  monitorWindowMs: 60000, // 1 minute window
});

/** Circuit breaker for Imagen calls */
export const imagenCircuitBreaker = new CircuitBreaker({
  name: 'imagen',
  failureThreshold: 3,
  resetTimeoutMs: 45000, // 45 second cooldown
  successThreshold: 2,
  callTimeoutMs: 120000, // 2 minute timeout (image gen is slow)
  monitorWindowMs: 60000,
});

/** Circuit breaker for Supabase calls */
export const supabaseCircuitBreaker = new CircuitBreaker({
  name: 'supabase',
  failureThreshold: 10,
  resetTimeoutMs: 10000, // 10 second cooldown
  successThreshold: 3,
  callTimeoutMs: 10000, // 10 second timeout
  monitorWindowMs: 30000, // 30 second window
});

/** Circuit breaker for external storage (R2) */
export const storageCircuitBreaker = new CircuitBreaker({
  name: 'r2-storage',
  failureThreshold: 5,
  resetTimeoutMs: 15000,
  successThreshold: 2,
  callTimeoutMs: 30000,
  monitorWindowMs: 60000,
});

// ============================================================================
// PRE-CONFIGURED BULKHEADS FOR RESOURCE ISOLATION
// ============================================================================

/** Bulkhead for AI generation (prevent AI calls from consuming all resources) */
export const aiGenerationBulkhead = new Bulkhead({
  name: 'ai-generation',
  maxConcurrent: 50, // Max 50 concurrent AI calls
  maxQueue: 200, // Queue up to 200 more
  queueTimeoutMs: 120000, // 2 minute queue timeout
});

/** Bulkhead for image processing */
export const imageProcessingBulkhead = new Bulkhead({
  name: 'image-processing',
  maxConcurrent: 20, // Max 20 concurrent image ops
  maxQueue: 100,
  queueTimeoutMs: 60000,
});

/** Bulkhead for database operations */
export const databaseBulkhead = new Bulkhead({
  name: 'database',
  maxConcurrent: 100, // Max 100 concurrent DB ops
  maxQueue: 500,
  queueTimeoutMs: 30000,
});

// ============================================================================
// COMBINED RESILIENCE WRAPPER
// ============================================================================

export interface ResilientCallConfig {
  circuitBreaker?: CircuitBreaker;
  bulkhead?: Bulkhead;
  retry?: Partial<RetryConfig>;
}

/**
 * Execute a function with full resilience patterns.
 * Combines: Bulkhead → Circuit Breaker → Retry → Timeout
 */
export async function resilientCall<T>(
  fn: () => Promise<T>,
  config: ResilientCallConfig
): Promise<T> {
  // Layer 1: Bulkhead (resource isolation)
  const withBulkhead = config.bulkhead ? () => config.bulkhead!.execute(fn) : fn;

  // Layer 2: Circuit Breaker (failure prevention)
  const withCircuitBreaker = config.circuitBreaker
    ? () => config.circuitBreaker!.execute(withBulkhead)
    : withBulkhead;

  // Layer 3: Retry (transient failure handling)
  if (config.retry) {
    return retryWithBackoff(withCircuitBreaker, config.retry);
  }

  return withCircuitBreaker();
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export function getResilienceHealth(): {
  circuitBreakers: Record<string, CircuitBreakerStats>;
  bulkheads: Record<string, { running: number; queued: number; available: number }>;
} {
  return {
    circuitBreakers: {
      aiGateway: aiGatewayCircuitBreaker.getStats(),
      imagen: imagenCircuitBreaker.getStats(),
      supabase: supabaseCircuitBreaker.getStats(),
      storage: storageCircuitBreaker.getStats(),
    },
    bulkheads: {
      aiGeneration: aiGenerationBulkhead.getStatus(),
      imageProcessing: imageProcessingBulkhead.getStatus(),
      database: databaseBulkhead.getStatus(),
    },
  };
}
