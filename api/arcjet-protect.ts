/**
 * Arcjet Server-Side Protection
 *
 * This uses the official @arcjet/node SDK for real protection.
 * Deploy to Vercel Edge Functions or Node.js server.
 *
 * @see https://docs.arcjet.com/
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isSpoofedBot } from '@arcjet/inspect';
import arcjet, { detectBot, shield, tokenBucket } from '@arcjet/node';

// ============================================================================
// ARCJET INSTANCE
// ============================================================================

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: 'LIVE' }),
    // Bot detection - allow search engines
    detectBot({
      mode: 'LIVE',
      allow: [
        'CATEGORY:SEARCH_ENGINE', // Google, Bing, etc
        'CATEGORY:MONITOR', // Uptime monitoring
        'CATEGORY:PREVIEW', // Link previews (Slack, Discord)
      ],
    }),
    // Rate limiting with token bucket
    tokenBucket({
      mode: 'LIVE',
      refillRate: 10, // Refill 10 tokens per interval
      interval: 60, // Refill every 60 seconds
      capacity: 30, // Bucket capacity of 30 tokens
    }),
  ],
});

// ============================================================================
// PROTECTION PRESETS
// ============================================================================

/**
 * Strict protection for AI generation endpoints
 */
export const ajAIGeneration = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: 'LIVE',
      allow: [], // No bots allowed on AI endpoints
    }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 2,
      interval: 60,
      capacity: 5, // Very limited for expensive AI calls
    }),
  ],
});

/**
 * Authentication endpoint protection
 */
export const ajAuth = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: 'LIVE',
      allow: [],
    }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 5,
      interval: 300, // 5 minute window
      capacity: 10, // 10 attempts per 5 minutes
    }),
  ],
});

/**
 * Webhook protection (allow automated traffic, just rate limit)
 */
export const ajWebhook = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: 'LIVE' }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 50,
      interval: 60,
      capacity: 100,
    }),
  ],
});

// ============================================================================
// PROTECTION HANDLER
// ============================================================================

export interface ProtectionResult {
  allowed: boolean;
  status: number;
  error?: string;
  decision?: {
    isDenied: boolean;
    isRateLimit: boolean;
    isBot: boolean;
    isSpoofed: boolean;
    isHosting: boolean;
  };
}

/**
 * Protect a request with Arcjet
 */
export async function protectRequest(
  req: IncomingMessage,
  tokensRequested = 1,
  client: typeof aj = aj
): Promise<ProtectionResult> {
  try {
    const decision = await client.protect(req, { requested: tokensRequested });

    console.log('[Arcjet] Decision:', {
      isDenied: decision.isDenied(),
      reason: decision.reason,
      ip: decision.ip,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return {
          allowed: false,
          status: 429,
          error: 'Too many requests',
          decision: {
            isDenied: true,
            isRateLimit: true,
            isBot: false,
            isSpoofed: false,
            isHosting: false,
          },
        };
      } else if (decision.reason.isBot()) {
        return {
          allowed: false,
          status: 403,
          error: 'Bot traffic not allowed',
          decision: {
            isDenied: true,
            isRateLimit: false,
            isBot: true,
            isSpoofed: false,
            isHosting: false,
          },
        };
      } else {
        return {
          allowed: false,
          status: 403,
          error: 'Forbidden',
          decision: {
            isDenied: true,
            isRateLimit: false,
            isBot: false,
            isSpoofed: false,
            isHosting: false,
          },
        };
      }
    }

    // Check for hosting/datacenter IPs
    if (decision.ip.isHosting()) {
      return {
        allowed: false,
        status: 403,
        error: 'Requests from hosting providers not allowed',
        decision: {
          isDenied: true,
          isRateLimit: false,
          isBot: false,
          isSpoofed: false,
          isHosting: true,
        },
      };
    }

    // Check for spoofed bots
    if (decision.results.some(isSpoofedBot)) {
      return {
        allowed: false,
        status: 403,
        error: 'Spoofed bot detected',
        decision: {
          isDenied: true,
          isRateLimit: false,
          isBot: true,
          isSpoofed: true,
          isHosting: false,
        },
      };
    }

    return {
      allowed: true,
      status: 200,
      decision: {
        isDenied: false,
        isRateLimit: false,
        isBot: false,
        isSpoofed: false,
        isHosting: false,
      },
    };
  } catch (error) {
    console.error('[Arcjet] Protection error:', error);
    // Fail open - allow request if Arcjet errors
    return {
      allowed: true,
      status: 200,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send error response
 */
export function sendErrorResponse(res: ServerResponse, result: ProtectionResult): void {
  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: result.error }));
}

// ============================================================================
// VERCEL EDGE MIDDLEWARE HANDLER
// ============================================================================

/**
 * Arcjet middleware for Vercel API routes
 */
export async function arcjetMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>,
  tokensRequested = 1
): Promise<void> {
  const result = await protectRequest(req, tokensRequested);

  if (!result.allowed) {
    sendErrorResponse(res, result);
    return;
  }

  await next();
}

// ============================================================================
// EXPRESS/CONNECT MIDDLEWARE
// ============================================================================

/**
 * Create Express-style middleware
 */
export function createArcjetMiddleware(tokensPerRequest = 1) {
  return async (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
    const result = await protectRequest(req, tokensPerRequest);

    if (!result.allowed) {
      sendErrorResponse(res, result);
      return;
    }

    next();
  };
}

/**
 * Create AI-specific middleware (stricter limits)
 */
export function createAIProtectionMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
    const result = await protectRequest(req, 5, ajAIGeneration);

    if (!result.allowed) {
      sendErrorResponse(res, result);
      return;
    }

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { aj as arcjetNode };
export default aj;
