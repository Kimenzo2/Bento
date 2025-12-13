/**
 * @module Security
 * @description Security utilities and Content Security Policy configuration
 * 
 * Features:
 * - CSP nonce generation
 * - Security headers configuration for Vercel/server
 * - Input sanitization utilities
 * - XSS protection helpers
 */

/**
 * Generate a random nonce for inline scripts
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Sanitize HTML to prevent XSS
 * For more robust sanitization, consider using DOMPurify
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Validate URL to prevent open redirect
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow same-origin redirects
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Rate limiter for client-side protection
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Filter out old timestamps
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < this.windowMs
    );
    
    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

/**
 * Secure storage wrapper with encryption support placeholder
 */
export const secureStorage = {
  /**
   * Store item securely
   * In production, consider encrypting sensitive data
   */
  setItem(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to store item:', error);
    }
  },

  /**
   * Get item from secure storage
   */
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Remove item from storage
   */
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};
