/**
 * Bento Desktop structured logger.
 *
 * Provides consistent log formatting, production-silenceable levels,
 * and a single place to redirect logs (e.g. to telemetry or a file).
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.info('Alerts button clicked', { currentPage });
 *   logger.warn('Settings failed to load', error);
 *   logger.error('Theme toggle failed', error);
 */

/* eslint-disable no-console -- this is the single intentional console wrapper */

const PREFIX = '[Bento Desktop]';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (import.meta.env.VITE_PUBLIC_LOG_LEVEL as LogLevel | undefined) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  return `${PREFIX} ${level.toUpperCase()}: ${message}`;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (!shouldLog('debug')) return;
    console.debug(formatMessage('debug', message), ...args);
  },

  info(message: string, ...args: unknown[]) {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', message), ...args);
  },

  warn(message: string, error?: unknown) {
    if (!shouldLog('warn')) return;
    if (error !== undefined) {
      console.warn(formatMessage('warn', `${message} — ${formatError(error)}`));
    } else {
      console.warn(formatMessage('warn', message));
    }
  },

  error(message: string, error?: unknown) {
    if (!shouldLog('error')) return;
    if (error !== undefined) {
      console.error(formatMessage('error', `${message} — ${formatError(error)}`));
    } else {
      console.error(formatMessage('error', message));
    }
  },
};
