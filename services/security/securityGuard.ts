/**
 * @module SecurityGuard
 * @description Platform-grade security layer with defense-in-depth
 *
 * Comprehensive security utilities for:
 * - CSRF protection
 * - XSS prevention
 * - SQL injection detection
 * - Request validation
 * - Security headers
 * - Timing attack prevention
 *
 * @example
 * ```typescript
 * import { securityGuard } from '@services/security/securityGuard';
 *
 * // Validate request
 * const result = securityGuard.validateRequest(request);
 * if (!result.valid) {
 *   return { error: result.reason };
 * }
 *
 * // Check for XSS
 * const safeHtml = securityGuard.sanitizeForDisplay(userInput);
 * ```
 */

import { generateCsrfToken, getCsrfToken, validateCsrfToken } from '../../utils/crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityValidationResult {
  valid: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow' | 'block' | 'log' | 'challenge';
}

export interface RequestValidationOptions {
  requireCsrf?: boolean;
  maxPayloadSize?: number;
  allowedContentTypes?: string[];
  requireAuth?: boolean;
  rateLimit?: {
    key: string;
    maxRequests: number;
    windowMs: number;
  };
}

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security'?: string;
}

// ============================================================================
// XSS DETECTION PATTERNS
// ============================================================================

const XSS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script\b/gi,

  // Event handlers
  /\bon\w+\s*=/gi,

  // JavaScript URLs
  /javascript:/gi,
  /vbscript:/gi,
  /data:/gi,

  // SVG/Object exploitation
  /<svg\b[^>]*\bonload\s*=/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /<iframe\b/gi,

  // Expression/Binding
  /expression\s*\(/gi,
  /\{\{.*\}\}/g,

  // Base64 encoded scripts
  /base64[^"']*/gi,
];

// ============================================================================
// SQL INJECTION PATTERNS
// ============================================================================

const SQL_INJECTION_PATTERNS = [
  // Basic SQL keywords in suspicious context
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/gi,

  // Comment injection
  /(--|#|\/\*|\*\/)/g,

  // String termination attempts
  /(['"])\s*;\s*\1/g,
  /'\s*OR\s*'1'\s*=\s*'1/gi,
  /'\s*OR\s*1\s*=\s*1/gi,

  // UNION-based injection
  /UNION\s+(ALL\s+)?SELECT/gi,

  // Stacked queries
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
];

// ============================================================================
// PATH TRAVERSAL PATTERNS
// ============================================================================

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.%2[fF]/g,
  /\.\.%5[cC]/g,
  /%2[eE]%2[eE]%2[fF]/g,
  /\.\.\\/g,
];

// ============================================================================
// SECURITY GUARD CLASS
// ============================================================================

class SecurityGuard {
  private rateLimitStore = new Map<string, { count: number; resetAt: number }>();

  // ========================================================================
  // CSRF PROTECTION
  // ========================================================================

  /**
   * Generate a new CSRF token for the session
   */
  generateCsrf(): string {
    return generateCsrfToken();
  }

  /**
   * Get current CSRF token
   */
  getCsrf(): string | null {
    return getCsrfToken();
  }

  /**
   * Validate CSRF token (constant-time comparison)
   */
  validateCsrf(token: string): boolean {
    return validateCsrfToken(token);
  }

  // ========================================================================
  // XSS PROTECTION
  // ========================================================================

  /**
   * Detect potential XSS in input
   */
  detectXss(input: string): SecurityValidationResult {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        return {
          valid: false,
          reason: 'Potential XSS detected',
          severity: 'high',
          action: 'block',
        };
      }
    }

    return { valid: true, severity: 'low', action: 'allow' };
  }

  /**
   * Sanitize input for safe HTML display
   */
  sanitizeForDisplay(input: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };

    return input.replace(/[&<>"'`=/]/g, (char) => map[char] || char);
  }

  /**
   * Sanitize URL to prevent javascript: and data: URLs
   */
  sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url, window.location.origin);

      // Only allow http, https, and relative URLs
      if (
        !['http:', 'https:', ''].includes(parsed.protocol) ||
        parsed.protocol === 'javascript:' ||
        parsed.protocol === 'data:' ||
        parsed.protocol === 'vbscript:'
      ) {
        return null;
      }

      return parsed.href;
    } catch {
      // If it's a relative URL, it should be safe
      if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
      }
      return null;
    }
  }

  // ========================================================================
  // SQL INJECTION PROTECTION
  // ========================================================================

  /**
   * Detect potential SQL injection
   */
  detectSqlInjection(input: string): SecurityValidationResult {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          valid: false,
          reason: 'Potential SQL injection detected',
          severity: 'critical',
          action: 'block',
        };
      }
    }

    return { valid: true, severity: 'low', action: 'allow' };
  }

  // ========================================================================
  // PATH TRAVERSAL PROTECTION
  // ========================================================================

  /**
   * Detect path traversal attempts
   */
  detectPathTraversal(input: string): SecurityValidationResult {
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input)) {
        return {
          valid: false,
          reason: 'Path traversal attempt detected',
          severity: 'high',
          action: 'block',
        };
      }
    }

    return { valid: true, severity: 'low', action: 'allow' };
  }

  // ========================================================================
  // COMPREHENSIVE REQUEST VALIDATION
  // ========================================================================

  /**
   * Validate a request with multiple security checks
   */
  validateRequest(
    input: string | Record<string, unknown>,
    options: RequestValidationOptions = {}
  ): SecurityValidationResult {
    const {
      requireCsrf = false,
      maxPayloadSize = 1024 * 1024, // 1MB
    } = options;

    // Convert to string for analysis
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

    // Size check
    if (inputStr.length > maxPayloadSize) {
      return {
        valid: false,
        reason: 'Payload too large',
        severity: 'medium',
        action: 'block',
      };
    }

    // XSS check
    const xssResult = this.detectXss(inputStr);
    if (!xssResult.valid) return xssResult;

    // SQL injection check
    const sqlResult = this.detectSqlInjection(inputStr);
    if (!sqlResult.valid) return sqlResult;

    // Path traversal check
    const pathResult = this.detectPathTraversal(inputStr);
    if (!pathResult.valid) return pathResult;

    // CSRF check if required
    if (requireCsrf) {
      const csrfToken =
        typeof input === 'object' && input !== null
          ? ((input as Record<string, unknown>)['_csrf'] as string)
          : null;

      if (!csrfToken || !this.validateCsrf(csrfToken)) {
        return {
          valid: false,
          reason: 'Invalid CSRF token',
          severity: 'high',
          action: 'block',
        };
      }
    }

    return { valid: true, severity: 'low', action: 'allow' };
  }

  // ========================================================================
  // RATE LIMITING
  // ========================================================================

  /**
   * Check rate limit for a key
   */
  checkRateLimit(key: string, maxRequests: number, windowMs: number): SecurityValidationResult {
    const now = Date.now();
    const record = this.rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      this.rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return { valid: true, severity: 'low', action: 'allow' };
    }

    if (record.count >= maxRequests) {
      return {
        valid: false,
        reason: 'Rate limit exceeded',
        severity: 'medium',
        action: 'block',
      };
    }

    record.count++;
    return { valid: true, severity: 'low', action: 'allow' };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimitStore) {
      if (now > record.resetAt) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  // ========================================================================
  // SECURITY HEADERS
  // ========================================================================

  /**
   * Get recommended security headers
   */
  getSecurityHeaders(nonce?: string): SecurityHeaders {
    return {
      'Content-Security-Policy': this.buildCsp(nonce),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };
  }

  /**
   * Build Content Security Policy
   */
  private buildCsp(nonce?: string): string {
    const nonceStr = nonce ? `'nonce-${nonce}'` : '';

    return [
      `default-src 'self'`,
      `script-src 'self' ${nonceStr} 'strict-dynamic' https:`,
      `worker-src 'self' blob:`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `img-src 'self' data: https: blob:`,
      `font-src 'self' https://fonts.gstatic.com data:`,
      `connect-src 'self' https://*.supabase.co https://*.bytez.com https://fonts.googleapis.com https://fonts.gstatic.com wss://*.supabase.co`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `base-uri 'self'`,
      `upgrade-insecure-requests`,
    ].join('; ');
  }

  // ========================================================================
  // INPUT VALIDATION HELPERS
  // ========================================================================

  /**
   * Validate email format strictly
   */
  isValidEmail(email: string): boolean {
    // RFC 5322 compliant regex (simplified)
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate URL is safe for redirect
   */
  isValidRedirect(url: string, allowedDomains: string[] = []): boolean {
    try {
      const parsed = new URL(url, window.location.origin);

      // Only allow same-origin or explicitly allowed domains
      if (parsed.origin === window.location.origin) {
        return true;
      }

      return allowedDomains.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    valid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters');

    if (password.length >= 12) score += 1;

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    // Check for common patterns
    if (/^(?:password|123456|qwerty|abc123)/i.test(password)) {
      score = 0;
      feedback.push('Password is too common');
    }

    return {
      valid: score >= 4 && password.length >= 8,
      score,
      feedback,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const securityGuard = new SecurityGuard();

// Start periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(() => securityGuard.cleanupRateLimits(), 60000);
}

export default securityGuard;
