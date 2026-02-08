/**
 * @module Crypto
 * @description Browser-compatible cryptographic utilities
 *
 * Platform-grade cryptographic operations using Web Crypto API.
 * No Node.js dependencies - works in all modern browsers.
 *
 * @example
 * ```typescript
 * import { generateUUID, hashToPercentage, generateSecureToken } from '@utils/crypto';
 *
 * const id = generateUUID();
 * const bucket = await hashToPercentage('user:feature', 'user123');
 * const token = generateSecureToken(32);
 * ```
 */

// ============================================================================
// UUID GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure UUID v4
 * Uses crypto.randomUUID() when available, falls back to manual generation
 */
export function generateUUID(): string {
  // Modern browsers support crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers using crypto.getRandomValues()
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant (RFC4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort fallback (not cryptographically secure, but functional)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// HASHING UTILITIES
// ============================================================================

/**
 * Hash a string using SHA-256 (Web Crypto API)
 * Returns hex-encoded hash
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash input to a percentage (0-99) for feature flag bucketing
 * Deterministic - same input always produces same output
 */
export async function hashToPercentage(namespace: string, identifier: string): Promise<number> {
  const input = `${namespace}:${identifier}`;
  const hash = await sha256(input);
  // Use first 8 hex characters (32 bits) for percentage calculation
  const num = Number.parseInt(hash.substring(0, 8), 16);
  return Math.abs(num) % 100;
}

/**
 * Synchronous hash to percentage using simple but deterministic algorithm
 * For cases where async is not suitable (e.g., React render)
 */
export function hashToPercentageSync(namespace: string, identifier: string): number {
  const input = `${namespace}:${identifier}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure random token
 * @param length - Length of token in bytes (output will be hex, so 2x length)
 */
export function generateSecureToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a URL-safe base64 token
 */
export function generateUrlSafeToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  // Make URL-safe by replacing + with -, / with _, and removing =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ============================================================================
// HMAC UTILITIES
// ============================================================================

/**
 * Generate HMAC-SHA256 signature
 */
export async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const signatureArray = new Uint8Array(signature);
  return Array.from(signatureArray, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify HMAC-SHA256 signature (constant-time comparison)
 */
export async function verifyHmac(key: string, data: string, signature: string): Promise<boolean> {
  const expectedSignature = await hmacSha256(key, data);

  // Constant-time comparison to prevent timing attacks
  if (expectedSignature.length !== signature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// CSRF TOKEN UTILITIES
// ============================================================================

const CSRF_TOKEN_KEY = 'genesis_csrf_token';

/**
 * Generate and store a CSRF token for the session
 */
export function generateCsrfToken(): string {
  const token = generateSecureToken(32);
  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  } catch {
    // If sessionStorage is not available, return token anyway
  }
  return token;
}

/**
 * Get the current CSRF token
 */
export function getCsrfToken(): string | null {
  try {
    return sessionStorage.getItem(CSRF_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Validate a CSRF token (constant-time comparison)
 */
export function validateCsrfToken(token: string): boolean {
  const storedToken = getCsrfToken();
  if (!storedToken || !token) {
    return false;
  }

  if (storedToken.length !== token.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < storedToken.length; i++) {
    result |= storedToken.charCodeAt(i) ^ token.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// ENCRYPTION UTILITIES (for sensitive local storage)
// ============================================================================

/**
 * Derive an encryption key from a password using PBKDF2
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Convert Uint8Array to ArrayBuffer to satisfy TypeScript strict typing
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  return {
    iv: Array.from(iv, (b) => b.toString(16).padStart(2, '0')).join(''),
    ciphertext: Array.from(new Uint8Array(ciphertext), (b) => b.toString(16).padStart(2, '0')).join(
      ''
    ),
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();

  const ivBytes = new Uint8Array(iv.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)));
  const ciphertextBytes = new Uint8Array(
    ciphertext.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16))
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  );

  return decoder.decode(plaintext);
}

export default {
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
};
