/**
 * Services barrel export
 * @module services
 */

export { logger } from './logger';
export type { LogLevel, LogContext, LogEntry, TimerResult } from './logger';

export {
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  handleError,
  tryCatch,
  tryCatchSync,
  createErrorFromResponse,
  isErrorCode,
  isOperationalError,
  ERROR_CODES,
} from './errorHandler';
export type { ErrorCode } from './errorHandler';
