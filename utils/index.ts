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
  reportWebVitals,
  mark,
  measure,
  measureAsync,
  getMemoryUsage,
  logMemoryUsage,
} from './performance';
export type { PerformanceMetric, WebVitalCallback } from './performance';
