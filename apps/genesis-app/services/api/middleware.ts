/**
 * @module ApiMiddleware
 * @description ENFORCING middleware layer - ALL API calls MUST go through this
 *
 * This is the single point of enforcement for:
 * - Input validation (Zod schemas)
 * - Security checks (XSS, SQLi, path traversal)
 * - Circuit breaker protection
 * - Rate limiting
 * - Audit logging
 * - Error handling with Result type
 *
 * @example
 * ```typescript
 * // WRONG - Direct API call (bypasses security)
 * const { data } = await supabase.from('books').select('*');
 *
 * // RIGHT - Through middleware (enforced security)
 * const result = await apiMiddleware.execute({
 *   operation: 'query',
 *   table: 'books',
 *   action: async () => supabase.from('books').select('*'),
 *   schema: BookQuerySchema,
 * });
 * ```
 */

import { type ZodSchema, z } from 'zod';
import {
  AppError,
  InfrastructureError,
  type Result,
  SecurityError,
  ValidationError,
  err,
  ok,
} from '../errorHandler';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
} from '../infrastructure/circuitBreaker';
import { logger } from '../logger';
import { type SecurityValidationResult, securityGuard } from '../security/securityGuard';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiOperation<TInput, TOutput> {
  /** Operation name for logging/metrics */
  name: string;
  /** The table/resource being accessed */
  table: string;
  /** Type of operation */
  operation: 'query' | 'mutation' | 'delete';
  /** Input data to validate */
  input?: TInput;
  /** Zod schema for input validation */
  schema?: ZodSchema<TInput>;
  /** The actual API function to execute */
  action: () => Promise<TOutput>;
  /** Skip security checks (DANGER - only for internal operations) */
  skipSecurity?: boolean;
  /** Custom circuit breaker config */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

export interface ApiMiddlewareConfig {
  /** Enable security checks */
  security: boolean;
  /** Enable circuit breaker */
  circuitBreaker: boolean;
  /** Enable audit logging */
  auditLog: boolean;
  /** Enable rate limiting */
  rateLimiting: boolean;
  /** Max requests per minute per operation */
  maxRequestsPerMinute: number;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  table: string;
  userId?: string;
  success: boolean;
  duration: number;
  error?: string;
  securityViolation?: boolean;
  ipAddress?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ApiMiddlewareConfig = {
  security: true,
  circuitBreaker: true,
  auditLog: true,
  rateLimiting: true,
  maxRequestsPerMinute: 100,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  name: 'api',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 3,
  callTimeoutMs: 30000,
  monitorWindowMs: 60000,
};

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private requests = new Map<string, { count: number; windowStart: number }>();

  check(key: string, maxRequests: number, windowMs = 60000): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now - record.windowStart > windowMs) {
      this.requests.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (record.count >= maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingRequests(key: string, maxRequests: number): number {
    const record = this.requests.get(key);
    if (!record) return maxRequests;
    return Math.max(0, maxRequests - record.count);
  }
}

// ============================================================================
// AUDIT LOGGER
// ============================================================================

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private readonly maxLogs = 10000;

  log(entry: AuditLogEntry): void {
    this.logs.push(entry);

    // Trim if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2);
    }

    // Also send to main logger for persistence
    const logLevel = entry.securityViolation ? 'warn' : entry.success ? 'debug' : 'error';
    logger[logLevel](
      `[Audit] ${entry.operation} on ${entry.table} - ${entry.success ? 'success' : 'failed'}`
    );

    // Security violations get special treatment
    if (entry.securityViolation) {
      logger.warn(`[SECURITY VIOLATION] ${entry.operation} blocked - ${entry.error}`);
    }
  }

  getRecentLogs(count = 100): AuditLogEntry[] {
    return this.logs.slice(-count);
  }

  getSecurityViolations(): AuditLogEntry[] {
    return this.logs.filter((l) => l.securityViolation);
  }
}

// ============================================================================
// API MIDDLEWARE CLASS
// ============================================================================

class ApiMiddleware {
  private config: ApiMiddlewareConfig;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rateLimiter = new RateLimiter();
  private auditLogger = new AuditLogger();

  constructor(config: Partial<ApiMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute an API operation with full enforcement
   */
  async execute<TInput, TOutput>(
    operation: ApiOperation<TInput, TOutput>
  ): Promise<Result<TOutput, AppError>> {
    const startTime = Date.now();
    const operationKey = `${operation.table}:${operation.operation}`;

    try {
      // 1. Rate limiting
      if (this.config.rateLimiting) {
        if (!this.rateLimiter.check(operationKey, this.config.maxRequestsPerMinute)) {
          this.logAudit(operation, false, Date.now() - startTime, 'Rate limit exceeded');
          return err(
            new InfrastructureError(
              'SERVICE_UNAVAILABLE',
              'Rate limit exceeded. Please try again later.',
              { operation: operationKey, remaining: 0 }
            )
          );
        }
      }

      // 2. Input validation with Zod
      if (operation.schema && operation.input !== undefined) {
        const validation = await this.validateInput(operation.input, operation.schema);
        if (!validation.valid) {
          this.logAudit(operation, false, Date.now() - startTime, validation.error);
          return err(new ValidationError(validation.error || 'Validation failed'));
        }
      }

      // 3. Security checks
      if (this.config.security && !operation.skipSecurity) {
        const securityCheck = this.performSecurityChecks(operation);
        if (!securityCheck.valid) {
          this.logAudit(operation, false, Date.now() - startTime, securityCheck.reason, true);
          const securityCode = securityCheck.reason?.includes('XSS')
            ? 'XSS_DETECTED'
            : securityCheck.reason?.includes('SQL')
              ? 'INJECTION_DETECTED'
              : 'CSRF_INVALID';
          return err(
            new SecurityError(securityCode, {
              severity: securityCheck.severity,
              action: securityCheck.action,
              reason: securityCheck.reason,
            })
          );
        }
      }

      // 4. Execute through circuit breaker
      let result: TOutput;

      if (this.config.circuitBreaker) {
        const breaker = this.getOrCreateCircuitBreaker(operation);
        result = await breaker.execute(operation.action);
      } else {
        result = await operation.action();
      }

      // 5. Log success
      this.logAudit(operation, true, Date.now() - startTime);

      return ok(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logAudit(operation, false, duration, errorMessage);

      // Wrap in appropriate error type
      if (errorMessage.includes('Circuit is open')) {
        return err(
          new InfrastructureError(
            'CIRCUIT_OPEN',
            'Service temporarily unavailable. Please try again later.',
            { circuitOpen: true }
          )
        );
      }

      return err(new AppError('SERVER_ERROR', errorMessage, { originalError: errorMessage }));
    }
  }

  /**
   * Validate input against Zod schema
   */
  private async validateInput<T>(
    input: T,
    schema: ZodSchema<T>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      await schema.parseAsync(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = error.issues.map(
          (e: any) => `${String(e.path?.join?.('.') || 'input')}: ${e.message}`
        );
        return { valid: false, error: messages.join('; ') };
      }
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Perform security checks on input
   */
  private performSecurityChecks<TInput, TOutput>(
    operation: ApiOperation<TInput, TOutput>
  ): SecurityValidationResult {
    // If there's input, check it for attacks
    if (operation.input) {
      const inputStr =
        typeof operation.input === 'string' ? operation.input : JSON.stringify(operation.input);

      // Check XSS
      const xssCheck = securityGuard.detectXss(inputStr);
      if (!xssCheck.valid) return xssCheck;

      // Check SQL injection
      const sqlCheck = securityGuard.detectSqlInjection(inputStr);
      if (!sqlCheck.valid) return sqlCheck;

      // Check path traversal
      const pathCheck = securityGuard.detectPathTraversal(inputStr);
      if (!pathCheck.valid) return pathCheck;
    }

    return { valid: true, severity: 'low', action: 'allow' };
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateCircuitBreaker<TInput, TOutput>(
    operation: ApiOperation<TInput, TOutput>
  ): CircuitBreaker {
    const key = `${operation.table}:${operation.operation}`;

    if (!this.circuitBreakers.has(key)) {
      const config: CircuitBreakerConfig = {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        name: key,
        ...operation.circuitBreakerConfig,
      };
      this.circuitBreakers.set(key, new CircuitBreaker(config));
    }

    return this.circuitBreakers.get(key)!;
  }

  /**
   * Log to audit trail
   */
  private logAudit<TInput, TOutput>(
    operation: ApiOperation<TInput, TOutput>,
    success: boolean,
    duration: number,
    error?: string,
    securityViolation?: boolean
  ): void {
    if (!this.config.auditLog) return;

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      operation: operation.name || `${operation.operation}:${operation.table}`,
      table: operation.table,
      success,
      duration,
      error,
      securityViolation,
    });
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats(): Array<{ name: string; state: CircuitState; failureRate: number }> {
    const stats: Array<{ name: string; state: CircuitState; failureRate: number }> = [];

    this.circuitBreakers.forEach((breaker, name) => {
      const s = breaker.getStats();
      stats.push({ name, state: s.state, failureRate: s.failureRate });
    });

    return stats;
  }

  /**
   * Get recent audit logs
   */
  getAuditLogs(count?: number): AuditLogEntry[] {
    return this.auditLogger.getRecentLogs(count);
  }

  /**
   * Get security violations
   */
  getSecurityViolations(): AuditLogEntry[] {
    return this.auditLogger.getSecurityViolations();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const apiMiddleware = new ApiMiddleware();

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Execute a query operation with full enforcement
 */
export async function secureQuery<T>(
  table: string,
  action: () => Promise<T>,
  schema?: ZodSchema<unknown>,
  input?: unknown
): Promise<Result<T, AppError>> {
  return apiMiddleware.execute({
    name: `query:${table}`,
    table,
    operation: 'query',
    action,
    schema,
    input,
  });
}

/**
 * Execute a mutation operation with full enforcement
 */
export async function secureMutation<TInput, TOutput>(
  table: string,
  action: () => Promise<TOutput>,
  schema: ZodSchema<TInput>,
  input: TInput
): Promise<Result<TOutput, AppError>> {
  return apiMiddleware.execute({
    name: `mutation:${table}`,
    table,
    operation: 'mutation',
    action,
    schema,
    input,
  });
}

/**
 * Execute a delete operation with full enforcement
 */
export async function secureDelete<T>(
  table: string,
  action: () => Promise<T>,
  id: string
): Promise<Result<T, AppError>> {
  // Validate ID format
  const IdSchema = z.string().uuid();

  return apiMiddleware.execute({
    name: `delete:${table}`,
    table,
    operation: 'delete',
    action,
    schema: IdSchema,
    input: id,
  });
}
