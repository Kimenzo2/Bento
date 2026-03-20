/**
 * @module SecurityBootstrap
 * @description Initialize all security layers on app startup
 *
 * This module ensures all security measures are properly initialized
 * and provides a single entry point for security configuration.
 *
 * @example
 * ```typescript
 * import { initializeSecurity, getSecurityStatus } from '@services/security';
 *
 * // In your app entry point
 * await initializeSecurity();
 *
 * // Check security status
 * const status = getSecurityStatus();
 * console.log('Security initialized:', status.initialized);
 * ```
 */

import { generateCsrfToken } from '../../utils/crypto';
import { errorReporter } from '../errorReporting';
import { securityGuard } from './securityGuard';

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityConfig {
  enableCsrf: boolean;
  enableContentSecurityPolicy: boolean;
  enableRateLimiting: boolean;
  enableInputValidation: boolean;
  reportSecurityViolations: boolean;
  allowedOrigins: string[];
}

export interface SecurityStatus {
  initialized: boolean;
  csrfEnabled: boolean;
  cspEnabled: boolean;
  rateLimitingEnabled: boolean;
  inputValidationEnabled: boolean;
  initializationTime: Date | null;
  lastSecurityCheck: Date | null;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SecurityConfig = {
  enableCsrf: true,
  enableContentSecurityPolicy: true,
  enableRateLimiting: true,
  enableInputValidation: true,
  reportSecurityViolations: true,
  allowedOrigins: ['https://iamazeyou.me', 'https://www.iamazeyou.me', 'https://*.vercel.app'],
};

// ============================================================================
// STATE
// ============================================================================

const securityStatus: SecurityStatus = {
  initialized: false,
  csrfEnabled: false,
  cspEnabled: false,
  rateLimitingEnabled: false,
  inputValidationEnabled: false,
  initializationTime: null,
  lastSecurityCheck: null,
};

let currentConfig: SecurityConfig = DEFAULT_CONFIG;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all security layers
 */
export async function initializeSecurity(
  config: Partial<SecurityConfig> = {}
): Promise<SecurityStatus> {
  currentConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Security] Initializing security layers...');

  try {
    // Initialize error reporting first (for security violation reporting)
    errorReporter.initialize();

    // Initialize CSRF protection
    if (currentConfig.enableCsrf) {
      initializeCsrf();
      securityStatus.csrfEnabled = true;
      console.log('[Security] CSRF protection enabled');
    }

    // Set up CSP violation reporting
    if (currentConfig.enableContentSecurityPolicy) {
      initializeCspReporting();
      securityStatus.cspEnabled = true;
      console.log('[Security] CSP violation reporting enabled');
    }

    // Initialize rate limiting
    if (currentConfig.enableRateLimiting) {
      initializeRateLimiting();
      securityStatus.rateLimitingEnabled = true;
      console.log('[Security] Rate limiting enabled');
    }

    // Enable input validation
    if (currentConfig.enableInputValidation) {
      securityStatus.inputValidationEnabled = true;
      console.log('[Security] Input validation enabled');
    }

    securityStatus.initialized = true;
    securityStatus.initializationTime = new Date();

    console.log('[Security] All security layers initialized successfully');

    return securityStatus;
  } catch (error) {
    console.error('[Security] Failed to initialize security:', error);
    errorReporter.captureException(error as Error, {
      action: 'security_initialization',
    });
    throw error;
  }
}

/**
 * Initialize CSRF protection
 */
function initializeCsrf(): void {
  // Generate initial CSRF token
  const token = generateCsrfToken();

  // Add token to meta tag for easy access
  if (typeof document !== 'undefined') {
    let metaTag = document.querySelector('meta[name="csrf-token"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'csrf-token');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', token);
  }
}

/**
 * Initialize CSP violation reporting
 */
function initializeCspReporting(): void {
  if (typeof document === 'undefined') return;

  // Listen for CSP violations
  document.addEventListener('securitypolicyviolation', (event) => {
    const violationData = {
      blockedUri: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
    };

    console.warn('[Security] CSP Violation:', violationData);

    if (currentConfig.reportSecurityViolations) {
      errorReporter.captureMessage('CSP Violation', 'warning', {
        action: 'csp_violation',
        metadata: violationData,
      });
    }
  });
}

/**
 * Initialize rate limiting cleanup
 */
function initializeRateLimiting(): void {
  // Clean up rate limit entries periodically
  if (typeof window !== 'undefined') {
    setInterval(() => {
      securityGuard.cleanupRateLimits();
    }, 60000); // Every minute
  }
}

// ============================================================================
// SECURITY CHECKS
// ============================================================================

/**
 * Perform a security health check
 */
export function performSecurityCheck(): {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
} {
  const checks: Array<{ name: string; passed: boolean; message?: string }> = [];

  // Check CSRF token exists
  if (currentConfig.enableCsrf) {
    const csrfToken = securityGuard.getCsrf();
    checks.push({
      name: 'csrf_token',
      passed: !!csrfToken,
      message: csrfToken ? 'CSRF token present' : 'CSRF token missing',
    });
  }

  // Check for secure context (HTTPS)
  if (typeof window !== 'undefined') {
    checks.push({
      name: 'secure_context',
      passed: window.isSecureContext,
      message: window.isSecureContext
        ? 'Running in secure context'
        : 'Not in secure context (HTTP)',
    });
  }

  // Check for same-origin
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const sameOrigin = window.location.origin === new URL(document.baseURI).origin;
      checks.push({
        name: 'same_origin',
        passed: sameOrigin,
        message: sameOrigin ? 'Same origin verified' : 'Origin mismatch detected',
      });
    } catch {
      checks.push({
        name: 'same_origin',
        passed: false,
        message: 'Could not verify origin',
      });
    }
  }

  // Check for framing (clickjacking protection)
  if (typeof window !== 'undefined') {
    const isFramed = window.self !== window.top;
    checks.push({
      name: 'framing_protection',
      passed: !isFramed,
      message: isFramed ? 'Page is framed (potential clickjacking)' : 'Not framed',
    });
  }

  securityStatus.lastSecurityCheck = new Date();

  const passed = checks.every((check) => check.passed);

  return { passed, checks };
}

/**
 * Get current security status
 */
export function getSecurityStatus(): SecurityStatus {
  return { ...securityStatus };
}

/**
 * Get current security configuration
 */
export function getSecurityConfig(): SecurityConfig {
  return { ...currentConfig };
}

// ============================================================================
// SECURITY MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create a security validation wrapper for functions
 */
export function withSecurityValidation<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: {
    validateInput?: boolean;
    requireCsrf?: boolean;
    rateLimit?: { key: string; maxRequests: number; windowMs: number };
  } = {}
): T {
  return ((...args: Parameters<T>) => {
    // Rate limit check
    if (options.rateLimit) {
      const result = securityGuard.checkRateLimit(
        options.rateLimit.key,
        options.rateLimit.maxRequests,
        options.rateLimit.windowMs
      );

      if (!result.valid) {
        throw new Error('Rate limit exceeded');
      }
    }

    // CSRF check
    if (options.requireCsrf) {
      const token =
        args[0] && typeof args[0] === 'object'
          ? ((args[0] as Record<string, unknown>)['_csrf'] as string)
          : null;

      if (!token || !securityGuard.validateCsrf(token)) {
        throw new Error('CSRF validation failed');
      }
    }

    // Input validation
    if (options.validateInput && args.length > 0) {
      for (const arg of args) {
        if (typeof arg === 'string' || typeof arg === 'object') {
          const result = securityGuard.validateRequest(arg as string | Record<string, unknown>);
          if (!result.valid) {
            throw new Error(`Security validation failed: ${result.reason}`);
          }
        }
      }
    }

    return fn(...args);
  }) as T;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initializeSecurity,
  performSecurityCheck,
  getSecurityStatus,
  getSecurityConfig,
  withSecurityValidation,
};
