/**
 * @module ErrorHandler
 * @description Centralized error handling utilities with typed errors and user-friendly messages
 * 
 * Features:
 * - Custom error classes for different error types
 * - User-friendly error messages
 * - Error boundary integration helpers
 * - Async error wrapper for consistent handling
 * 
 * @example
 * ```typescript
 * import { AppError, handleError, tryCatch } from '@services/errorHandler';
 * 
 * // Throw typed errors
 * throw new AppError('NETWORK_ERROR', 'Failed to fetch data', { endpoint: '/api' });
 * 
 * // Wrap async operations
 * const [data, error] = await tryCatch(fetchData());
 * if (error) {
 *   handleError(error);
 * }
 * ```
 */

import { logger } from './logger';

/**
 * Error codes with user-friendly messages
 */
export const ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request timed out. Please try again.',
  
  // Authentication errors
  AUTH_ERROR: 'Authentication failed. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  
  // Validation errors
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'The provided input is invalid.',
  
  // Resource errors
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action conflicts with existing data.',
  
  // Server errors
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  
  // Application errors
  UNKNOWN_ERROR: 'An unexpected error occurred.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  QUOTA_EXCEEDED: 'You have reached your usage limit.',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Custom application error with code and context
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message?: string,
    context?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message || ERROR_CODES[code]);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return ERROR_CODES[this.code];
  }

  /**
   * Convert to plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Network-specific error
 */
export class NetworkError extends AppError {
  constructor(message?: string, context?: Record<string, unknown>) {
    super('NETWORK_ERROR', message, context);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication-specific error
 */
export class AuthError extends AppError {
  constructor(code: 'AUTH_ERROR' | 'SESSION_EXPIRED' | 'UNAUTHORIZED' = 'AUTH_ERROR', context?: Record<string, unknown>) {
    super(code, undefined, context);
    this.name = 'AuthError';
  }
}

/**
 * Validation-specific error
 */
export class ValidationError extends AppError {
  public readonly fields?: string[];

  constructor(message?: string, fields?: string[], context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, { ...context, fields });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Handle error with logging and optional user notification
 */
export function handleError(
  error: unknown,
  context?: Record<string, unknown>
): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    logger.error(error.message, error, { ...error.context, ...context });
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    const appError = new AppError('UNKNOWN_ERROR', error.message, context);
    logger.error(error.message, error, context);
    return appError;
  }

  // Unknown error type
  const appError = new AppError('UNKNOWN_ERROR', String(error), context);
  logger.error('Unknown error type', null, { error, ...context });
  return appError;
}

/**
 * Try-catch wrapper for async operations
 * Returns [result, null] on success or [null, error] on failure
 */
export async function tryCatch<T>(
  promise: Promise<T>
): Promise<[T, null] | [null, AppError]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, handleError(error)];
  }
}

/**
 * Sync version of tryCatch
 */
export function tryCatchSync<T>(
  fn: () => T
): [T, null] | [null, AppError] {
  try {
    const result = fn();
    return [result, null];
  } catch (error) {
    return [null, handleError(error)];
  }
}

/**
 * Create error from HTTP response
 */
export function createErrorFromResponse(
  response: Response,
  context?: Record<string, unknown>
): AppError {
  const statusCodeMap: Record<number, ErrorCode> = {
    400: 'VALIDATION_ERROR',
    401: 'AUTH_ERROR',
    403: 'UNAUTHORIZED',
    404: 'NOT_FOUND',
    408: 'TIMEOUT_ERROR',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    500: 'SERVER_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };

  const code = statusCodeMap[response.status] || 'UNKNOWN_ERROR';
  return new AppError(code, response.statusText, {
    ...context,
    status: response.status,
    url: response.url,
  });
}

/**
 * Check if error is a specific type
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof AppError && error.code === code;
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational;
}
