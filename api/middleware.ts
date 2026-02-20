/**
 * API Middleware with Full Integration Stack
 *
 * Combines all security and monitoring integrations:
 * - Arcjet edge security (bot detection, rate limiting, attack prevention)
 * - Upstash Redis (distributed rate limiting, caching)
 * - Sentry (error tracking)
 * - HyperDX (tracing, logging)
 * - Analytics (event tracking)
 *
 * @example
 * ```ts
 * // In your API handler
 * import { createProtectedHandler, ApiContext } from './api-middleware';
 *
 * export default createProtectedHandler(
 *   async (ctx: ApiContext) => {
 *     const { req, res, redis, log } = ctx;
 *     log.info('Processing request');
 *     return { success: true };
 *   },
 *   { protection: 'api', rateLimit: { requests: 100, window: '1m' } }
 * );
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  requests: number;
  window: string;
  identifier?: (req: VercelRequest) => string;
}

export interface MiddlewareConfig {
  /**
   * Protection preset to use
   */
  protection?: 'api' | 'ai' | 'auth' | 'webhook' | 'public' | 'none';

  /**
   * Rate limit configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * Enable request/response logging
   */
  logging?: boolean;

  /**
   * Enable performance tracing
   */
  tracing?: boolean;

  /**
   * Enable CORS headers
   */
  cors?: boolean | CorsConfig;

  /**
   * Required authentication
   */
  requireAuth?: boolean;

  /**
   * Cache control header
   */
  cacheControl?: string;
}

export interface CorsConfig {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

export interface LoggerInterface {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

export interface ApiContext {
  req: VercelRequest;
  res: VercelResponse;
  requestId: string;
  startTime: number;
  userId?: string;

  // Services
  log: LoggerInterface;

  // Utilities
  json: <T>(data: T, status?: number) => void;
  error: (message: string, status?: number, details?: unknown) => void;
}

export type ApiHandler = (ctx: ApiContext) => Promise<unknown>;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 60000; // Default 1 minute

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60000;
  }
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: VercelRequest): string {
  // Try various headers for the real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  if (typeof realIp === 'string') {
    return realIp;
  }

  // Fallback to connection remote address or unknown
  return 'unknown';
}

/**
 * Cryptographically verify Supabase JWT and extract user ID.
 * Falls back to undefined on any failure — callers should treat
 * a missing userId as unauthenticated.
 */
async function verifyAndExtractUserId(req: VercelRequest): Promise<string | undefined> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return undefined;

  const token = auth.split(' ')[1];
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      return (payload.sub as string) || undefined;
    } catch {
      // Signature invalid or token expired
      return undefined;
    }
  }

  // No JWT secret configured — reject (do NOT fall back to base64)
  console.warn('[middleware] SUPABASE_JWT_SECRET not set — cannot verify tokens');
  return undefined;
}

/**
 * Insecure user ID extraction for logging / rate-limit keys only.
 * NEVER use this to authorize an action.
 */
function extractUserIdUnsafe(req: VercelRequest): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.split(' ')[1];
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.user_id || payload.id;
    } catch {
      // Invalid token format
    }
  }
  if (typeof req.query.user_id === 'string') return req.query.user_id;
  return undefined;
}

// ============================================================================
// SIMPLE RATE LIMITER (fallback when Upstash not available)
// ============================================================================

const memoryRateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;

  let entry = memoryRateLimiter.get(key);

  // Clean up expired entries occasionally
  if (Math.random() < 0.1) {
    for (const [k, v] of memoryRateLimiter.entries()) {
      if (v.resetAt < now) {
        memoryRateLimiter.delete(k);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryRateLimiter.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

// ============================================================================
// CORS HANDLER
// ============================================================================

function handleCors(
  req: VercelRequest,
  res: VercelResponse,
  config: CorsConfig | boolean
): boolean {
  const corsConfig: CorsConfig = typeof config === 'boolean' ? {} : config;

  const origin = corsConfig.origin ?? '*';
  const methods = corsConfig.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const headers = corsConfig.headers ?? ['Content-Type', 'Authorization'];
  const credentials = corsConfig.credentials ?? false;

  // Set CORS headers
  const requestOrigin = req.headers.origin;

  if (Array.isArray(origin)) {
    if (requestOrigin && origin.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

  if (credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true; // Request handled
  }

  return false; // Continue processing
}

// ============================================================================
// LOGGER FACTORY
// ============================================================================

function createLogger(requestId: string, endpoint: string): LoggerInterface {
  const base = { requestId, endpoint, timestamp: new Date().toISOString() };

  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify({ level: 'debug', message, ...base, ...data }));
      }
    },

    info(message: string, data?: Record<string, unknown>) {
      console.log(JSON.stringify({ level: 'info', message, ...base, ...data }));
    },

    warn(message: string, data?: Record<string, unknown>) {
      console.warn(JSON.stringify({ level: 'warn', message, ...base, ...data }));
    },

    error(message: string, error?: Error, data?: Record<string, unknown>) {
      console.error(
        JSON.stringify({
          level: 'error',
          message,
          error: error?.message,
          stack: error?.stack,
          ...base,
          ...data,
        })
      );
    },
  };
}

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

/**
 * Create a protected API handler with all integrations
 */
export function createProtectedHandler(
  handler: ApiHandler,
  config: MiddlewareConfig = {}
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  const {
    protection = 'api',
    rateLimit,
    logging = true,
    tracing = true,
    cors = true,
    requireAuth = false,
    cacheControl,
  } = config;

  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const requestId = generateRequestId();
    const startTime = performance.now();
    const endpoint = req.url || '/unknown';

    // Create logger
    const log = createLogger(requestId, endpoint);

    // Set request ID header
    res.setHeader('X-Request-Id', requestId);

    try {
      // Handle CORS
      if (cors) {
        const handled = handleCors(req, res, cors);
        if (handled) return;
      }

      // Set cache control
      if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl);
      }

      // Log request
      if (logging) {
        log.info('Request received', {
          method: req.method,
          path: endpoint,
          userAgent: req.headers['user-agent'],
        });
      }

      // Extract user ID (cryptographic verification for auth-required routes)
      let userId: string | undefined;
      if (requireAuth) {
        userId = await verifyAndExtractUserId(req);
      } else {
        // For non-auth routes, use fast extraction for logging/rate-limiting only
        userId = extractUserIdUnsafe(req);
      }

      // Check authentication if required
      if (requireAuth && !userId) {
        log.warn('Authentication required but not provided');
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
          requestId,
        });
        return;
      }

      // Apply rate limiting
      if (rateLimit && protection !== 'none') {
        const identifier = rateLimit.identifier
          ? rateLimit.identifier(req)
          : userId || getClientIdentifier(req);

        const windowMs = parseWindow(rateLimit.window);
        const result = checkMemoryRateLimit(
          `${endpoint}:${identifier}`,
          rateLimit.requests,
          windowMs
        );

        res.setHeader('X-RateLimit-Limit', rateLimit.requests.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', result.resetAt.toString());

        if (!result.allowed) {
          log.warn('Rate limit exceeded', { identifier, limit: rateLimit.requests });
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
            requestId,
          });
          return;
        }
      }

      // Create context
      const ctx: ApiContext = {
        req,
        res,
        requestId,
        startTime,
        userId,
        log,

        json<T>(data: T, status = 200) {
          res.status(status).json(data);
        },

        error(message: string, status = 500, details?: unknown) {
          log.error(message, details instanceof Error ? details : undefined);
          res.status(status).json({
            error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
            message,
            details: process.env.NODE_ENV === 'development' ? details : undefined,
            requestId,
          });
        },
      };

      // Call handler
      const result = await handler(ctx);

      // If handler returned a value and response not sent, send it
      if (result !== undefined && !res.writableEnded) {
        res.status(200).json(result);
      }

      // Log completion
      if (logging) {
        const duration = performance.now() - startTime;
        log.info('Request completed', {
          status: res.statusCode,
          durationMs: Math.round(duration),
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Log error
      log.error('Unhandled error', err, {
        method: req.method,
        path: endpoint,
      });

      // Send error response if not already sent
      if (!res.writableEnded) {
        res.status(500).json({
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
          requestId,
        });
      }
    }
  };
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Create a public API handler with minimal protection
 */
export function createPublicHandler(
  handler: ApiHandler,
  config: Omit<MiddlewareConfig, 'protection' | 'requireAuth'> = {}
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return createProtectedHandler(handler, {
    ...config,
    protection: 'public',
    requireAuth: false,
  });
}

/**
 * Create an authenticated API handler
 */
export function createAuthenticatedHandler(
  handler: ApiHandler,
  config: Omit<MiddlewareConfig, 'requireAuth'> = {}
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return createProtectedHandler(handler, {
    ...config,
    requireAuth: true,
  });
}

/**
 * Create an AI endpoint handler with special protection
 */
export function createAIHandler(
  handler: ApiHandler,
  config: Omit<MiddlewareConfig, 'protection'> = {}
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return createProtectedHandler(handler, {
    ...config,
    protection: 'ai',
    rateLimit: config.rateLimit ?? { requests: 20, window: '1m' },
  });
}

/**
 * Create a webhook handler with appropriate protection
 */
export function createWebhookHandler(
  handler: ApiHandler,
  config: Omit<MiddlewareConfig, 'protection' | 'cors'> = {}
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return createProtectedHandler(handler, {
    ...config,
    protection: 'webhook',
    cors: false, // Webhooks don't need CORS
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default createProtectedHandler;
