/**
 * @module ExternalServiceWrapper
 * @description ENFORCED circuit breaker wrapper for ALL external service calls
 *
 * This module provides resilient wrappers around external services:
 * - AI providers (Bytez, Grok, Gemini)
 * - Payment providers (Dodo Payments)
 * - Storage services (Supabase Storage)
 *
 * ALL external calls should go through these wrappers to ensure:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 * - Timeout protection
 * - Audit logging
 * - Metrics collection
 */

import { type AppError, InfrastructureError, type Result, err, ok } from '../errorHandler';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  CircuitOpenError,
} from '../infrastructure/circuitBreaker';
import { logger } from '../logger';
import { securityAudit } from '../security/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export type ExternalServiceType =
  | 'ai:bytez'
  | 'ai:grok'
  | 'ai:gemini'
  | 'payment:dodo'
  | 'storage:supabase'
  | 'email:resend'
  | 'analytics:sentry';

export interface ExternalCallOptions {
  /** Service identifier */
  service: ExternalServiceType;
  /** Operation name for logging */
  operation: string;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
  /** Number of retries (default: 3) */
  retries?: number;
  /** User ID for audit logging */
  userId?: string;
  /** Skip circuit breaker (use with caution) */
  skipCircuitBreaker?: boolean;
}

export interface ExternalCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  retryCount: number;
}

// ============================================================================
// CIRCUIT BREAKER CONFIGURATIONS
// ============================================================================

const CIRCUIT_CONFIGS: Record<ExternalServiceType, CircuitBreakerConfig> = {
  'ai:bytez': {
    name: 'bytez-ai',
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute cooldown
    successThreshold: 2,
    callTimeoutMs: 60000, // AI can be slow
    monitorWindowMs: 120000,
  },
  'ai:grok': {
    name: 'grok-ai',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    successThreshold: 2,
    callTimeoutMs: 45000,
    monitorWindowMs: 120000,
  },
  'ai:gemini': {
    name: 'gemini-ai',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    successThreshold: 2,
    callTimeoutMs: 60000,
    monitorWindowMs: 120000,
  },
  'payment:dodo': {
    name: 'dodo-payments',
    failureThreshold: 3, // Lower threshold for payments
    resetTimeoutMs: 30000,
    successThreshold: 2,
    callTimeoutMs: 30000,
    monitorWindowMs: 60000,
  },
  'storage:supabase': {
    name: 'supabase-storage',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    successThreshold: 3,
    callTimeoutMs: 30000,
    monitorWindowMs: 60000,
  },
  'email:resend': {
    name: 'resend-email',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    successThreshold: 2,
    callTimeoutMs: 15000,
    monitorWindowMs: 120000,
  },
  'analytics:sentry': {
    name: 'sentry',
    failureThreshold: 10, // Higher threshold for analytics
    resetTimeoutMs: 120000,
    successThreshold: 3,
    callTimeoutMs: 10000,
    monitorWindowMs: 300000,
  },
};

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

class CircuitBreakerRegistry {
  private breakers = new Map<ExternalServiceType, CircuitBreaker>();

  getBreaker(service: ExternalServiceType): CircuitBreaker {
    if (!this.breakers.has(service)) {
      this.breakers.set(service, new CircuitBreaker(CIRCUIT_CONFIGS[service]));
    }
    return this.breakers.get(service)!;
  }

  getAllStats() {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    this.breakers.forEach((breaker, service) => {
      stats[service] = breaker.getStats();
    });
    return stats;
  }
}

const registry = new CircuitBreakerRegistry();

// ============================================================================
// MAIN WRAPPER FUNCTION
// ============================================================================

/**
 * Execute an external service call with full protection
 */
export async function callExternalService<T>(
  fn: () => Promise<T>,
  options: ExternalCallOptions
): Promise<Result<T, AppError>> {
  const startTime = Date.now();
  let retryCount = 0;
  const maxRetries = options.retries ?? 3;
  const timeout = options.timeout ?? 30000;

  const executeWithRetry = async (): Promise<T> => {
    while (retryCount <= maxRetries) {
      try {
        // Add timeout
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeout)
          ),
        ]);
        return result;
      } catch (error) {
        retryCount++;

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (
            error.message.includes('unauthorized') ||
            error.message.includes('forbidden') ||
            error.message.includes('invalid')
          ) {
            throw error; // Don't retry auth errors
          }
        }

        if (retryCount > maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));

        logger.warn(`Retrying ${options.service}:${options.operation}`, {
          attempt: retryCount,
          maxRetries,
          component: 'ExternalServiceWrapper',
        });
      }
    }
    throw new Error('Max retries exceeded');
  };

  try {
    let result: T;

    if (options.skipCircuitBreaker) {
      result = await executeWithRetry();
    } else {
      const breaker = registry.getBreaker(options.service);
      result = await breaker.execute(executeWithRetry);
    }

    const duration = Date.now() - startTime;

    // Log success
    logger.debug(`External call succeeded: ${options.service}:${options.operation}`, {
      duration,
      retryCount,
      component: 'ExternalServiceWrapper',
    });

    return ok(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    logger.error(
      `External call failed: ${options.service}:${options.operation} - ${errorMessage}`,
      null,
      {
        duration,
        retryCount,
        component: 'ExternalServiceWrapper',
      }
    );

    // Audit log for circuit breaker events
    if (error instanceof CircuitOpenError) {
      securityAudit.logSecurityViolation('SECURITY_CIRCUIT_BREAKER_OPENED', options.userId, {
        service: options.service,
        operation: options.operation,
      });

      return err(
        new InfrastructureError(
          'CIRCUIT_OPEN',
          `Service temporarily unavailable: ${options.service}. Please try again in a few minutes.`,
          { service: options.service, circuitOpen: true }
        )
      );
    }

    return err(
      new InfrastructureError('DEPENDENCY_FAILURE', `External service error: ${errorMessage}`, {
        service: options.service,
        operation: options.operation,
        retryCount,
      })
    );
  }
}

// ============================================================================
// CONVENIENCE WRAPPERS FOR SPECIFIC SERVICES
// ============================================================================

/**
 * Call AI service with circuit breaker protection
 */
export async function callAIService<T>(
  provider: 'bytez' | 'grok' | 'gemini',
  operation: string,
  fn: () => Promise<T>,
  userId?: string
): Promise<Result<T, AppError>> {
  return callExternalService(fn, {
    service: `ai:${provider}` as ExternalServiceType,
    operation,
    userId,
    timeout: 60000, // AI operations can be slow
    retries: 2, // Limited retries for AI (expensive)
  });
}

/**
 * Call payment service with circuit breaker protection
 */
export async function callPaymentService<T>(
  operation: string,
  fn: () => Promise<T>,
  userId: string
): Promise<Result<T, AppError>> {
  // Log payment attempt for audit
  securityAudit.logPayment('PAYMENT_INITIATED', userId, true, { operation });

  const result = await callExternalService(fn, {
    service: 'payment:dodo',
    operation,
    userId,
    timeout: 30000,
    retries: 1, // Don't retry payments aggressively
  });

  // Log result
  if (result.success) {
    securityAudit.logPayment('PAYMENT_COMPLETED', userId, true, { operation });
  } else {
    securityAudit.logPayment('PAYMENT_FAILED', userId, false, {
      operation,
      error: result.error?.message,
    });
  }

  return result;
}

/**
 * Call storage service with circuit breaker protection
 */
export async function callStorageService<T>(
  operation: string,
  fn: () => Promise<T>,
  userId?: string
): Promise<Result<T, AppError>> {
  return callExternalService(fn, {
    service: 'storage:supabase',
    operation,
    userId,
    timeout: 30000,
    retries: 3,
  });
}

// ============================================================================
// MONITORING
// ============================================================================

/**
 * Get circuit breaker status for all services
 */
export function getCircuitBreakerStatus() {
  return registry.getAllStats();
}

/**
 * Check if a specific service is available
 */
export function isServiceAvailable(service: ExternalServiceType): boolean {
  const breaker = registry.getBreaker(service);
  const stats = breaker.getStats();
  return stats.state !== 'OPEN';
}

/**
 * Get degraded services list
 */
export function getDegradedServices(): ExternalServiceType[] {
  const allStats = registry.getAllStats();
  return Object.entries(allStats)
    .filter(([_, stats]) => stats.state !== 'CLOSED')
    .map(([service]) => service as ExternalServiceType);
}
