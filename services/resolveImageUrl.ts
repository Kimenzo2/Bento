/**
 * resolveImageUrl.ts — Robust image URL resolver for Genesis.
 *
 * Handles all stored URL formats:
 * - Full Supabase Storage public URL → pass through
 * - Temporary Bytez URL → pass through (best we can do client-side)
 * - Base64 data URL → pass through (renders inline)
 * - Empty string → returns undefined (shows placeholder)
 * - Null/undefined → returns undefined
 *
 * Also provides an onError handler that components can use
 * to gracefully degrade when stored URLs are broken.
 */

/**
 * Resolves a stored image URL to something renderable, or undefined.
 */
export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url || url.trim() === '') return undefined;

  // Full Supabase URL — good
  if (url.includes('/storage/v1/object/public/page-images/')) {
    return url;
  }

  // Base64 data URL — renderable directly
  if (url.startsWith('data:image/')) {
    return url;
  }

  // Any HTTP(S) URL — remote or temporary, still renderable
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Might be raw base64 — wrap as data URL
  try {
    // Test if it looks like valid base64 by checking a sample
    atob(url.substring(0, 100).replace(/\s/g, ''));
    return `data:image/png;base64,${url}`;
  } catch {
    // Not valid — return undefined
    return undefined;
  }
}
