/**
 * @module ServiceWrapper
 * @description Wraps service functions to return Result<T, E> instead of throwing
 *
 * This is the ENFORCING layer that converts legacy throw-based code to Result-based.
 * Use this to wrap any service function that might throw.
 *
 * @example
 * ```typescript
 * // Before (throws)
 * const book = await shareService.getSharedBook(code);
 *
 * // After (returns Result)
 * const result = await safeCall(() => shareService.getSharedBook(code));
 * if (isErr(result)) {
 *   // Handle error without try/catch
 *   logger.error('Failed to get book', result.error);
 *   return;
 * }
 * const book = result.data;
 * ```
 */

import {
  AppError,
  InfrastructureError,
  NetworkError,
  type Result,
  SecurityError,
  ValidationError,
  err,
  isErr,
  isOk,
  ok,
} from './errorHandler';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export type ServiceFunction<T> = () => Promise<T>;
export type SyncServiceFunction<T> = () => T;

export interface SafeCallOptions {
  /** Context for error logging */
  context?: string;
  /** Whether to log errors automatically */
  logErrors?: boolean;
  /** Custom error transformer */
  transformError?: (error: unknown) => AppError;
  /** Retry configuration */
  retry?: {
    attempts: number;
    delayMs: number;
    backoff?: 'linear' | 'exponential';
  };
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an unknown error into a typed AppError
 */
function classifyError(error: unknown, context?: string): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused')
    ) {
      return new NetworkError(error.message, { context });
    }

    // Auth/Security errors
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('authentication') ||
      message.includes('permission')
    ) {
      return new SecurityError('CSRF_INVALID', { context, originalMessage: error.message });
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('must be')
    ) {
      return new ValidationError(error.message, undefined, { context });
    }

    // Infrastructure errors
    if (
      message.includes('database') ||
      message.includes('supabase') ||
      message.includes('storage') ||
      message.includes('quota')
    ) {
      return new InfrastructureError('SERVICE_UNAVAILABLE', error.message, { context });
    }

    // Generic error
    return new AppError('UNKNOWN_ERROR', error.message, { context, originalError: error });
  }

  // Unknown error type
  return new AppError('UNKNOWN_ERROR', String(error), { context });
}

// ============================================================================
// SAFE CALL WRAPPERS
// ============================================================================

/**
 * Wrap an async function to return Result instead of throwing
 */
export async function safeCall<T>(
  fn: ServiceFunction<T>,
  options: SafeCallOptions = {}
): Promise<Result<T, AppError>> {
  const { context, logErrors = true, transformError, retry } = options;

  let lastError: AppError | null = null;
  const maxAttempts = retry?.attempts ?? 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return ok(result);
    } catch (error) {
      lastError = transformError ? transformError(error) : classifyError(error, context);

      if (logErrors) {
        logger.warn(`Service call failed (attempt ${attempt}/${maxAttempts})`, {
          context,
          error: lastError.message,
          code: lastError.code,
          component: 'ServiceWrapper',
        });
      }

      // If we have retries left, wait and try again
      if (attempt < maxAttempts && retry) {
        const delay =
          retry.backoff === 'exponential'
            ? retry.delayMs * Math.pow(2, attempt - 1)
            : retry.delayMs * attempt;
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  if (logErrors && lastError) {
    logger.error(`Service call failed after ${maxAttempts} attempts`, lastError, {
      context,
      component: 'ServiceWrapper',
    });
  }

  return err(lastError!);
}

/**
 * Wrap a sync function to return Result instead of throwing
 */
export function safeCallSync<T>(
  fn: SyncServiceFunction<T>,
  options: Omit<SafeCallOptions, 'retry'> = {}
): Result<T, AppError> {
  const { context, logErrors = true, transformError } = options;

  try {
    const result = fn();
    return ok(result);
  } catch (error) {
    const appError = transformError ? transformError(error) : classifyError(error, context);

    if (logErrors) {
      logger.error('Sync service call failed', appError, {
        context,
        component: 'ServiceWrapper',
      });
    }

    return err(appError);
  }
}

/**
 * Wrap multiple async operations, returning all results
 */
export async function safeCallAll<T>(
  fns: Array<ServiceFunction<T>>,
  options: SafeCallOptions = {}
): Promise<Array<Result<T, AppError>>> {
  return Promise.all(fns.map((fn) => safeCall(fn, options)));
}

/**
 * Wrap multiple async operations, fail fast on first error
 */
export async function safeCallAllStrict<T>(
  fns: Array<ServiceFunction<T>>,
  options: SafeCallOptions = {}
): Promise<Result<T[], AppError>> {
  const results: T[] = [];

  for (const fn of fns) {
    const result = await safeCall(fn, options);
    if (isErr(result)) {
      return result;
    }
    results.push(result.data);
  }

  return ok(results);
}

// ============================================================================
// RESULT UTILITIES
// ============================================================================

/**
 * Map a successful result to a new value
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result as Result<U, E>;
}

/**
 * Map an error result to a new error
 */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result as Result<T, F>;
}

/**
 * Chain Result operations (flatMap)
 */
export async function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result as Result<U, E>;
}

/**
 * Unwrap a result or return a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Unwrap a result or throw the error
 */
export function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Convert a Result to a Promise that rejects on error
 */
export function resultToPromise<T, E extends Error>(result: Result<T, E>): Promise<T> {
  if (isOk(result)) {
    return Promise.resolve(result.data);
  }
  return Promise.reject(result.error);
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type { Result };
export { ok, err, isOk, isErr, AppError };
