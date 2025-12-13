/**
 * @module Logger
 * @description Professional logging service with structured output, levels, and environment awareness
 * 
 * Features:
 * - Environment-aware logging (silenced in production for non-errors)
 * - Structured log format with timestamps
 * - Log levels: debug, info, warn, error
 * - Context support for tracing
 * - Performance measurement utilities
 * 
 * @example
 * ```typescript
 * import { logger } from '@services/logger';
 * 
 * logger.info('User action', { userId: '123', action: 'login' });
 * logger.error('Failed to load data', new Error('Network error'), { endpoint: '/api/data' });
 * 
 * // Performance measurement
 * const timer = logger.startTimer('API call');
 * await fetchData();
 * timer.end({ endpoint: '/api/data' });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface TimerResult {
  end: (context?: LogContext) => number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;
  private appName: string;

  constructor() {
    this.isProduction = import.meta.env.PROD;
    this.minLevel = this.isProduction ? 'warn' : 'debug';
    this.appName = 'Genesis';
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Format log entry for console output
   */
  private formatEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${this.appName}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    return parts.join(' ');
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, error?: Error | null, context?: LogContext): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formattedMessage = this.formatEntry(entry);
    const logMethod = level === 'error' ? console.error :
                      level === 'warn' ? console.warn :
                      level === 'debug' ? console.debug :
                      console.log;

    logMethod(formattedMessage);

    if (entry.error && level === 'error') {
      console.error(entry.error.stack);
    }

    // In production, you might want to send errors to a service like Sentry
    if (this.isProduction && level === 'error') {
      this.reportToErrorService(entry);
    }
  }

  /**
   * Placeholder for error reporting service integration
   */
  private reportToErrorService(entry: LogEntry): void {
    // TODO: Integrate with Sentry, LogRocket, or similar
    // Example: Sentry.captureException(entry.error);
  }

  /**
   * Debug level logging - development only
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, null, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, null, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, null, context);
  }

  /**
   * Error level logging with optional Error object
   */
  error(message: string, error?: Error | null, context?: LogContext): void {
    this.log('error', message, error, context);
  }

  /**
   * Start a performance timer
   * @returns Object with end() method that logs duration and returns ms elapsed
   */
  startTimer(label: string): TimerResult {
    const start = performance.now();
    return {
      end: (context?: LogContext): number => {
        const duration = performance.now() - start;
        this.debug(`${label} completed`, { ...context, durationMs: Math.round(duration) });
        return duration;
      },
    };
  }

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger that inherits parent context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | null, context?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types
export type { LogLevel, LogContext, LogEntry, TimerResult };
