/**
 * Structured Logger Service
 *
 * Enhanced logging with:
 * - Structured JSON output for production
 * - Correlation IDs for request tracing
 * - Performance measurement utilities
 * - Log sampling for high-volume events
 * - External log service integration (Axiom, Logflare, etc.)
 */

// ============================================================================
// TYPES
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;

  // Correlation
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;

  // Performance
  duration?: number;

  // Error details
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Metadata
  service: string;
  environment: string;
}

type LogContext = Record<string, unknown>;

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// Sample rates by environment
const SAMPLE_RATES: Record<string, number> = {
  development: 1.0, // Log everything
  staging: 0.5, // 50%
  production: 0.1, // 10%
};

// ============================================================================
// STRUCTURED LOGGER CLASS
// ============================================================================

export class StructuredLogger {
  private serviceName: string;
  private environment: string;
  private minLevel: LogLevel;
  private sampleRate: number;

  // Request context (for correlation)
  private requestId?: string;
  private userId?: string;
  private traceId?: string;
  private spanId?: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.environment = import.meta.env.MODE || 'development';
    this.minLevel = this.environment === 'production' ? 'info' : 'debug';
    this.sampleRate = SAMPLE_RATES[this.environment] || 1.0;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: {
    requestId?: string;
    userId?: string;
    traceId?: string;
    spanId?: string;
  }): StructuredLogger {
    const child = new StructuredLogger(this.serviceName);
    child.requestId = context.requestId || this.requestId;
    child.userId = context.userId || this.userId;
    child.traceId = context.traceId || this.traceId;
    child.spanId = context.spanId || this.spanId;
    return child;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, error?: Error | null, context?: LogContext): void {
    // Check level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    // Apply sampling for non-error logs
    if (level !== 'error' && level !== 'fatal') {
      if (Math.random() > this.sampleRate) {
        return;
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      context: context || {},
      requestId: this.requestId,
      userId: this.userId,
      traceId: this.traceId,
      spanId: this.spanId,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }

    // Output based on environment
    if (this.environment === 'development') {
      this.outputDev(entry);
    } else {
      this.outputJson(entry);
    }

    // Send to external service in production
    if (this.environment === 'production') {
      this.sendToLogService(entry).catch(() => {
        // Fail silently
      });
    }
  }

  /**
   * Human-readable output for development
   */
  private outputDev(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

    if (Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.duration !== undefined) {
      output += ` (${entry.duration}ms)`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  ${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}`;
      }
    }

    // eslint-disable-next-line no-console
    console.log(output);
  }

  /**
   * JSON output for production
   */
  private outputJson(entry: LogEntry): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  /**
   * Send to external logging service
   */
  private async sendToLogService(entry: LogEntry): Promise<void> {
    const axiomApiKey = import.meta.env.VITE_AXIOM_API_KEY;
    if (!axiomApiKey) return;

    try {
      await fetch('https://api.axiom.co/v1/datasets/genesis-logs/ingest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${axiomApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([entry]),
      });
    } catch {
      // Fail silently
    }
  }

  // ========================================
  // LOG LEVEL METHODS
  // ========================================

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, null, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, null, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, null, context);
  }

  error(message: string, error: Error, context?: LogContext): void {
    this.log('error', message, error, context);
  }

  fatal(message: string, error: Error, context?: LogContext): void {
    this.log('fatal', message, error, context);
  }

  // ========================================
  // PERFORMANCE MEASUREMENT
  // ========================================

  /**
   * Measure async function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.log('info', `${name} completed`, null, {
        ...context,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.log('error', `${name} failed`, error as Error, {
        ...context,
        duration,
      });

      throw error;
    }
  }

  /**
   * Create a timer for manual measurement
   */
  startTimer(name: string): { end: (context?: LogContext) => number } {
    const start = Date.now();

    return {
      end: (context?: LogContext) => {
        const duration = Date.now() - start;

        this.log('info', `${name} completed`, null, {
          ...context,
          duration,
        });

        return duration;
      },
    };
  }

  // ========================================
  // SPECIAL LOGGING METHODS
  // ========================================

  /**
   * Log important events (always logged, never sampled)
   */
  important(message: string, context?: LogContext): void {
    const originalSampleRate = this.sampleRate;
    this.sampleRate = 1.0;
    this.log('info', message, null, { ...context, important: true });
    this.sampleRate = originalSampleRate;
  }

  /**
   * Log AI generation events
   */
  aiGeneration(
    event: 'start' | 'complete' | 'error',
    details: {
      model: string;
      tokensUsed?: number;
      costUsd?: number;
      durationMs?: number;
      error?: Error;
    }
  ): void {
    const context: LogContext = {
      model: details.model,
      tokensUsed: details.tokensUsed,
      costUsd: details.costUsd,
      durationMs: details.durationMs,
    };

    if (event === 'error' && details.error) {
      this.log('error', `AI generation ${event}`, details.error, context);
    } else {
      this.log('info', `AI generation ${event}`, null, context);
    }
  }

  /**
   * Log HTTP request (for API endpoints)
   */
  httpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `${method} ${path} ${statusCode}`, null, {
      ...context,
      method,
      path,
      statusCode,
      duration: durationMs,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const logger = new StructuredLogger('genesis-app');
export const aiLogger = new StructuredLogger('genesis-ai');
export const apiLogger = new StructuredLogger('genesis-api');

// ============================================================================
// CORRELATION ID UTILITIES
// ============================================================================

let requestIdCounter = 0;

export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  StructuredLogger,
  logger,
  aiLogger,
  apiLogger,
  generateRequestId,
  generateTraceId,
};
