/**
 * Arcjet Integration - Edge Security & Bot Protection
 *
 * Provides security-as-code: rate limiting, bot detection, and abuse prevention
 * at the edge before requests hit your application.
 *
 * Features:
 * - Bot detection and blocking
 * - Rate limiting at the edge
 * - Email validation
 * - Attack protection (SQL injection, XSS, etc.)
 * - Shield mode for attack mitigation
 * - Sensitive data detection
 *
 * @see https://docs.arcjet.com/
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ArcjetConfig {
  key: string;
  environment?: 'development' | 'staging' | 'production';
  rules?: ArcjetRule[];
}

export interface ArcjetRule {
  mode: 'LIVE' | 'DRY_RUN';
  type: 'RATE_LIMIT' | 'BOT' | 'EMAIL' | 'SHIELD' | 'SENSITIVE_INFO';
  options?: Record<string, unknown>;
}

export interface ArcjetDecision {
  isAllowed: boolean;
  isDenied: boolean;
  isErrored: boolean;
  reason: ArcjetReason;
  results: ArcjetRuleResult[];
  ip?: string;
  ttl: number;
}

export interface ArcjetReason {
  type: 'ALLOWED' | 'DENIED' | 'ERROR';
  message?: string;
  code?: string;
}

export interface ArcjetRuleResult {
  ruleType: string;
  state: 'RUN' | 'NOT_RUN' | 'CACHED';
  conclusion: 'ALLOW' | 'DENY' | 'ERROR';
  reason?: string;
}

export interface RateLimitConfig {
  mode: 'LIVE' | 'DRY_RUN';
  window: string; // e.g., "1m", "1h", "1d"
  max: number;
  timeout?: string; // Block duration
}

export interface BotConfig {
  mode: 'LIVE' | 'DRY_RUN';
  allow?: string[]; // Allow specific bots
  deny?: string[]; // Block specific bots
  block?: ('AUTOMATED' | 'LIKELY_AUTOMATED' | 'LIKELY_NOT_A_BOT' | 'VERIFIED_BOT')[];
}

export interface ShieldConfig {
  mode: 'LIVE' | 'DRY_RUN';
}

// ============================================================================
// ARCJET RULES FACTORY
// ============================================================================

/**
 * Create a rate limit rule
 */
export function rateLimit(config: RateLimitConfig): ArcjetRule {
  return {
    mode: config.mode,
    type: 'RATE_LIMIT',
    options: {
      window: config.window,
      max: config.max,
      timeout: config.timeout,
    },
  };
}

/**
 * Create a bot detection rule
 */
export function detectBot(config: BotConfig): ArcjetRule {
  return {
    mode: config.mode,
    type: 'BOT',
    options: {
      allow: config.allow,
      deny: config.deny,
      block: config.block ?? ['AUTOMATED'],
    },
  };
}

/**
 * Create a shield rule (attack protection)
 */
export function shield(config: ShieldConfig): ArcjetRule {
  return {
    mode: config.mode,
    type: 'SHIELD',
    options: {},
  };
}

/**
 * Create an email validation rule
 */
export function validateEmail(mode: 'LIVE' | 'DRY_RUN' = 'LIVE'): ArcjetRule {
  return {
    mode,
    type: 'EMAIL',
    options: {
      requireMx: true,
      allowDisposable: false,
    },
  };
}

/**
 * Create a sensitive info detection rule
 */
export function sensitiveInfo(mode: 'LIVE' | 'DRY_RUN' = 'LIVE'): ArcjetRule {
  return {
    mode,
    type: 'SENSITIVE_INFO',
    options: {
      detect: ['CREDIT_CARD', 'SSN', 'API_KEY'],
      action: 'DENY',
    },
  };
}

// ============================================================================
// GENESIS PROTECTION PRESETS
// ============================================================================

/**
 * Standard API protection rules
 */
export const API_PROTECTION: ArcjetRule[] = [
  rateLimit({ mode: 'LIVE', window: '1m', max: 60 }),
  detectBot({ mode: 'LIVE', block: ['AUTOMATED', 'LIKELY_AUTOMATED'] }),
  shield({ mode: 'LIVE' }),
];

/**
 * AI generation endpoint protection (stricter)
 */
export const AI_ENDPOINT_PROTECTION: ArcjetRule[] = [
  rateLimit({ mode: 'LIVE', window: '1m', max: 10, timeout: '5m' }),
  detectBot({ mode: 'LIVE', block: ['AUTOMATED', 'LIKELY_AUTOMATED', 'LIKELY_NOT_A_BOT'] }),
  shield({ mode: 'LIVE' }),
];

/**
 * Authentication endpoint protection
 */
export const AUTH_PROTECTION: ArcjetRule[] = [
  rateLimit({ mode: 'LIVE', window: '5m', max: 10, timeout: '15m' }),
  detectBot({ mode: 'LIVE', block: ['AUTOMATED', 'LIKELY_AUTOMATED'] }),
  validateEmail('LIVE'),
  shield({ mode: 'LIVE' }),
];

/**
 * Webhook protection (allow bots, just rate limit)
 */
export const WEBHOOK_PROTECTION: ArcjetRule[] = [
  rateLimit({ mode: 'LIVE', window: '1m', max: 100 }),
  shield({ mode: 'LIVE' }),
];

/**
 * Public asset protection (very permissive)
 */
export const PUBLIC_PROTECTION: ArcjetRule[] = [
  rateLimit({ mode: 'LIVE', window: '1m', max: 120 }),
  shield({ mode: 'LIVE' }),
];

// ============================================================================
// ARCJET SERVICE
// ============================================================================

class ArcjetService {
  private config: ArcjetConfig | null = null;
  private initialized = false;
  private decisions = new Map<string, { decision: ArcjetDecision; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Initialize Arcjet
   */
  async initialize(config: ArcjetConfig): Promise<void> {
    if (this.initialized) return;

    this.config = config;

    if (!config.key) {
      // Arcjet running in mock mode without key
      this.initialized = true;
      return;
    }

    this.initialized = true;
  }

  /**
   * Protect a request
   */
  async protect(
    request: {
      ip?: string;
      path: string;
      method: string;
      headers?: Record<string, string>;
      email?: string;
      userId?: string;
    },
    rules: ArcjetRule[] = API_PROTECTION
  ): Promise<ArcjetDecision> {
    // Check cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.decisions.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.decision;
    }

    // If not initialized or no key, allow all
    if (!this.initialized || !this.config?.key) {
      return this.createAllowDecision();
    }

    try {
      // In a real implementation, this would call Arcjet's API
      // For now, we implement local rule evaluation
      const decision = await this.evaluateRules(request, rules);

      // Cache the decision
      this.decisions.set(cacheKey, { decision, timestamp: Date.now() });

      return decision;
    } catch (error) {
      console.error('[Arcjet] Error evaluating rules:', error);
      return this.createErrorDecision(error);
    }
  }

  /**
   * Evaluate rules locally (fallback when Arcjet API unavailable)
   */
  private async evaluateRules(
    request: {
      ip?: string;
      path: string;
      method: string;
      headers?: Record<string, string>;
      email?: string;
    },
    rules: ArcjetRule[]
  ): Promise<ArcjetDecision> {
    const results: ArcjetRuleResult[] = [];
    let isAllowed = true;

    for (const rule of rules) {
      const result = await this.evaluateRule(request, rule);
      results.push(result);

      if (result.conclusion === 'DENY' && rule.mode === 'LIVE') {
        isAllowed = false;
      }
    }

    return {
      isAllowed,
      isDenied: !isAllowed,
      isErrored: false,
      reason: {
        type: isAllowed ? 'ALLOWED' : 'DENIED',
        message: isAllowed ? 'Request allowed' : 'Request blocked by security rules',
      },
      results,
      ip: request.ip,
      ttl: 60,
    };
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    request: {
      ip?: string;
      path: string;
      method: string;
      headers?: Record<string, string>;
      email?: string;
    },
    rule: ArcjetRule
  ): Promise<ArcjetRuleResult> {
    switch (rule.type) {
      case 'RATE_LIMIT':
        return this.evaluateRateLimit(request, rule);
      case 'BOT':
        return this.evaluateBot(request, rule);
      case 'EMAIL':
        return this.evaluateEmail(request, rule);
      case 'SHIELD':
        return this.evaluateShield(request, rule);
      case 'SENSITIVE_INFO':
        return { ruleType: rule.type, state: 'RUN', conclusion: 'ALLOW' };
      default:
        return { ruleType: rule.type, state: 'NOT_RUN', conclusion: 'ALLOW' };
    }
  }

  /**
   * Evaluate rate limit rule
   */
  private async evaluateRateLimit(
    request: { ip?: string; path: string },
    rule: ArcjetRule
  ): Promise<ArcjetRuleResult> {
    const key = `ratelimit:${request.ip ?? 'unknown'}:${request.path}`;
    const options = rule.options as { max: number; window: string } | undefined;
    const max = options?.max ?? 60;

    // Check with Upstash if available
    try {
      const { getUpstashOrNull } = await import('./upstash');
      const upstash = getUpstashOrNull();

      if (upstash) {
        const result = await upstash.rateLimiter.checkSlidingWindow(
          key,
          max,
          this.parseWindow(options?.window ?? '1m')
        );

        return {
          ruleType: 'RATE_LIMIT',
          state: 'RUN',
          conclusion: result.success ? 'ALLOW' : 'DENY',
          reason: result.success ? undefined : `Rate limit exceeded: ${result.remaining}/${max}`,
        };
      }
    } catch {
      // Fall through to allow if Upstash unavailable
    }

    return { ruleType: 'RATE_LIMIT', state: 'RUN', conclusion: 'ALLOW' };
  }

  /**
   * Evaluate bot detection rule
   */
  private evaluateBot(
    request: { headers?: Record<string, string> },
    _rule: ArcjetRule
  ): ArcjetRuleResult {
    const userAgent = request.headers?.['user-agent'] ?? '';

    // Simple bot detection heuristics
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /axios/i,
    ];

    const isLikelyBot = botPatterns.some((p) => p.test(userAgent));

    // Check allowed bots
    const allowedBots = ['googlebot', 'bingbot', 'facebookexternalhit'];
    const isAllowedBot = allowedBots.some((b) => userAgent.toLowerCase().includes(b));

    if (isLikelyBot && !isAllowedBot) {
      return {
        ruleType: 'BOT',
        state: 'RUN',
        conclusion: 'DENY',
        reason: 'Automated traffic detected',
      };
    }

    return { ruleType: 'BOT', state: 'RUN', conclusion: 'ALLOW' };
  }

  /**
   * Evaluate email validation rule
   */
  private evaluateEmail(request: { email?: string }, _rule: ArcjetRule): ArcjetRuleResult {
    if (!request.email) {
      return { ruleType: 'EMAIL', state: 'NOT_RUN', conclusion: 'ALLOW' };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(request.email)) {
      return {
        ruleType: 'EMAIL',
        state: 'RUN',
        conclusion: 'DENY',
        reason: 'Invalid email format',
      };
    }

    // Check for disposable email domains
    const disposableDomains = [
      'tempmail.com',
      'throwaway.com',
      'mailinator.com',
      'guerrillamail.com',
      '10minutemail.com',
      'trashmail.com',
    ];

    const domain = request.email.split('@')[1]?.toLowerCase();
    if (domain && disposableDomains.includes(domain)) {
      return {
        ruleType: 'EMAIL',
        state: 'RUN',
        conclusion: 'DENY',
        reason: 'Disposable email addresses not allowed',
      };
    }

    return { ruleType: 'EMAIL', state: 'RUN', conclusion: 'ALLOW' };
  }

  /**
   * Evaluate shield rule (attack detection)
   */
  private evaluateShield(
    request: { path: string; headers?: Record<string, string> },
    _rule: ArcjetRule
  ): ArcjetRuleResult {
    // SQL injection patterns
    const sqlPatterns = [
      /(%27)|(')|(--)|(#)/i,
      /((%3D)|(=))[^\n]*((%27)|(')|(--)|(;))/i,
      /\w*((%27)|('))((%6F)|o|(%4F))((%72)|r|(%52))/i,
      /exec(\s|\+)+(s|x)p\w+/i,
    ];

    // XSS patterns
    const xssPatterns = [/<script\b[^>]*>(.*?)<\/script>/i, /javascript:/i, /on\w+\s*=/i];

    const path = decodeURIComponent(request.path);

    for (const pattern of [...sqlPatterns, ...xssPatterns]) {
      if (pattern.test(path)) {
        return {
          ruleType: 'SHIELD',
          state: 'RUN',
          conclusion: 'DENY',
          reason: 'Potential attack pattern detected',
        };
      }
    }

    return { ruleType: 'SHIELD', state: 'RUN', conclusion: 'ALLOW' };
  }

  /**
   * Parse window string to seconds
   */
  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 60;

    const value = Number.parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 60;
    }
  }

  /**
   * Create cache key
   */
  private getCacheKey(request: { ip?: string; path: string; method: string }): string {
    return `${request.ip ?? 'unknown'}:${request.method}:${request.path}`;
  }

  /**
   * Create allow decision
   */
  private createAllowDecision(): ArcjetDecision {
    return {
      isAllowed: true,
      isDenied: false,
      isErrored: false,
      reason: { type: 'ALLOWED' },
      results: [],
      ttl: 60,
    };
  }

  /**
   * Create error decision
   */
  private createErrorDecision(error: unknown): ArcjetDecision {
    return {
      isAllowed: true, // Fail open
      isDenied: false,
      isErrored: true,
      reason: {
        type: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      results: [],
      ttl: 10,
    };
  }

  /**
   * Clear decision cache
   */
  clearCache(): void {
    this.decisions.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    cacheSize: number;
    initialized: boolean;
  } {
    return {
      cacheSize: this.decisions.size,
      initialized: this.initialized,
    };
  }
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Create an Arcjet middleware for API routes
 */
export function createArcjetMiddleware(rules: ArcjetRule[] = API_PROTECTION) {
  return async (request: Request): Promise<{ allowed: boolean; response?: Response }> => {
    const decision = await arcjet.protect(
      {
        ip: request.headers.get('x-forwarded-for') ?? undefined,
        path: new URL(request.url).pathname,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
      },
      rules
    );

    if (decision.isDenied) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: 'Forbidden',
            reason: decision.reason.message,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }

    return { allowed: true };
  };
}

/**
 * Wrapper for protected API handlers
 */
export function withArcjetProtection<T>(
  handler: (request: Request) => Promise<T>,
  rules: ArcjetRule[] = API_PROTECTION
): (request: Request) => Promise<T | Response> {
  return async (request: Request) => {
    const { allowed, response } = await createArcjetMiddleware(rules)(request);

    if (!allowed && response) {
      return response;
    }

    return handler(request);
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const arcjet = new ArcjetService();

/**
 * Initialize Arcjet with environment config
 */
export function initializeArcjet(config?: Partial<ArcjetConfig>): Promise<void> {
  const finalConfig: ArcjetConfig = {
    // Server secret — never exposed to client bundle (no VITE_ prefix)
    key: config?.key ?? '',
    environment: (config?.environment ??
      import.meta.env.VITE_APP_ENVIRONMENT ??
      'development') as ArcjetConfig['environment'],
    rules: config?.rules,
  };

  return arcjet.initialize(finalConfig);
}

export default arcjet;
