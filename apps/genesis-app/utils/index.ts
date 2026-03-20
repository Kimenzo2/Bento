/**
 * Utils barrel export
 * @module utils
 */

export {
  generateNonce,
  sanitizeHtml,
  escapeHtml,
  isValidRedirectUrl,
  isValidEmail,
  RateLimiter,
  secureStorage,
} from './security';

export {
  generateUUID,
  sha256,
  hashToPercentage,
  hashToPercentageSync,
  generateSecureToken,
  generateUrlSafeToken,
  hmacSha256,
  verifyHmac,
  generateCsrfToken,
  getCsrfToken,
  validateCsrfToken,
  deriveKey,
  encrypt,
  decrypt,
} from './crypto';

export {
  reportWebVitals,
  mark,
  measure,
  measureAsync,
  getMemoryUsage,
  logMemoryUsage,
} from './performance';
export type { PerformanceMetric, WebVitalCallback } from './performance';
