/**
 * Mars-Class Infrastructure - Cloudflare R2 Zero-Egress Storage
 *
 * Eliminates bandwidth costs for high-volume asset delivery.
 *
 * THE PROBLEM (Egress Bankruptcy):
 * - 1M users viewing 10 images/day @ 500KB each = 5TB/day
 * - AWS/Supabase egress: $0.09/GB = $450/day = $13,500/month
 * - This scales linearly with viral content
 *
 * THE SOLUTION (Cloudflare R2):
 * - S3-compatible storage with ZERO egress fees
 * - Integrated CDN with global edge caching
 * - Immutable content cached forever (max-age=31536000)
 * - Reduces bandwidth costs by 95%+
 *
 * ARCHITECTURE:
 * 1. Generated assets → R2 bucket
 * 2. CDN in front of R2 with aggressive caching
 * 3. Public assets via R2, private via Supabase Storage
 * 4. Media optimization pipeline for WebP/AVIF
 */

import { authenticatedFetch } from '../api/authenticatedFetch';

// ============================================================================
// TYPES
// ============================================================================

export interface R2Config {
  /** R2 bucket name */
  bucketName: string;
  /** Account ID */
  accountId: string;
  /** API endpoint (usually auto-derived) */
  endpoint?: string;
  /** Access key ID */
  accessKeyId: string;
  /** Secret access key */
  secretAccessKey: string;
  /** Public URL prefix for CDN access */
  publicUrlPrefix: string;
  /** Custom domain for CDN (optional) */
  customDomain?: string;
}

export interface UploadOptions {
  /** Content type (auto-detected if not provided) */
  contentType?: string;
  /** Cache control header */
  cacheControl?: string;
  /** Whether asset is publicly accessible */
  public?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Asset category for organization */
  category?: AssetCategory;
}

export enum AssetCategory {
  BOOK_COVERS = 'covers',
  ILLUSTRATIONS = 'illustrations',
  AVATARS = 'avatars',
  EXPORTS = 'exports',
  THUMBNAILS = 'thumbnails',
  TEMP = 'temp',
}

export interface StoredAsset {
  /** Unique asset key */
  key: string;
  /** Public URL (CDN) */
  url: string;
  /** Direct R2 URL (private) */
  directUrl: string;
  /** Content type */
  contentType: string;
  /** Size in bytes */
  size: number;
  /** ETag for cache validation */
  etag: string;
  /** Upload timestamp */
  uploadedAt: Date;
  /** Custom metadata */
  metadata: Record<string, string>;
}

export interface OptimizedAsset extends StoredAsset {
  /** Original asset this was derived from */
  originalKey?: string;
  /** Variants (different sizes/formats) */
  variants: AssetVariant[];
}

export interface AssetVariant {
  /** Variant identifier (e.g., "thumb_200", "webp_800") */
  id: string;
  /** Format */
  format: 'jpeg' | 'webp' | 'avif' | 'png';
  /** Width in pixels */
  width: number;
  /** Height in pixels (optional, auto-calculated) */
  height?: number;
  /** Quality (1-100) */
  quality: number;
  /** URL */
  url: string;
  /** Size in bytes */
  size: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const DEFAULT_R2_CONFIG: Partial<R2Config> = {
  bucketName: 'genesis-assets',
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  publicUrlPrefix: getEnv('VITE_R2_PUBLIC_URL') || '',
  customDomain: getEnv('VITE_R2_CUSTOM_DOMAIN'),
};

// Immutable cache control for generated assets (1 year)
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Short cache for dynamic content (1 hour)
export const DYNAMIC_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

// No cache for private content
export const PRIVATE_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate';

// ============================================================================
// ASSET KEY GENERATION
// ============================================================================

/**
 * Generate a unique, organized asset key.
 * Format: {category}/{year}/{month}/{day}/{userId}/{hash}.{ext}
 */
export function generateAssetKey(
  userId: string,
  filename: string,
  category: AssetCategory = AssetCategory.ILLUSTRATIONS
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Generate unique hash
  const hash = generateHash(`${userId}-${filename}-${Date.now()}`);

  // Extract extension
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';

  return `${category}/${year}/${month}/${day}/${userId.slice(0, 8)}/${hash}.${ext}`;
}

/**
 * Generate a simple hash for uniqueness.
 */
function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + Date.now().toString(36);
}

// ============================================================================
// R2 STORAGE CLIENT (Browser-compatible wrapper)
// ============================================================================

/**
 * R2 Storage Client for browser use.
 * Uses presigned URLs for uploads and CDN URLs for downloads.
 */
export class R2StorageClient {
  private readonly apiBase: string;
  private readonly publicUrlPrefix: string;

  constructor(apiBase = '/api/storage', publicUrlPrefix?: string) {
    this.apiBase = apiBase;
    this.publicUrlPrefix = publicUrlPrefix || DEFAULT_R2_CONFIG.publicUrlPrefix || '';
  }

  /**
   * Upload a file to R2.
   * Uses presigned URL from backend for secure upload.
   */
  async upload(
    file: File | Blob,
    options: UploadOptions & { userId: string; filename?: string } = { userId: '' }
  ): Promise<StoredAsset> {
    const filename = options.filename || (file instanceof File ? file.name : 'upload.bin');
    const category = options.category || AssetCategory.ILLUSTRATIONS;

    // Get presigned upload URL from backend
    const presignedResponse = await authenticatedFetch(`${this.apiBase}/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        category,
        contentType: options.contentType || file.type || 'application/octet-stream',
        public: options.public ?? true,
        metadata: options.metadata,
      }),
    });

    if (!presignedResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadUrl, key, publicUrl } = await presignedResponse.json();

    // Upload directly to R2
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': options.contentType || file.type || 'application/octet-stream',
        'Cache-Control': options.cacheControl || IMMUTABLE_CACHE_CONTROL,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return {
      key,
      url: publicUrl,
      directUrl: uploadUrl.split('?')[0], // Remove presigned params
      contentType: options.contentType || file.type || 'application/octet-stream',
      size: file.size,
      etag: uploadResponse.headers.get('etag') || '',
      uploadedAt: new Date(),
      metadata: options.metadata || {},
    };
  }

  /**
   * Upload from a URL (server-side fetch and upload).
   */
  async uploadFromUrl(
    sourceUrl: string,
    options: UploadOptions & { filename: string; userId?: string }
  ): Promise<StoredAsset> {
    const response = await authenticatedFetch(`${this.apiBase}/upload-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUrl,
        filename: options.filename,
        category: options.category,
        contentType: options.contentType,
        metadata: options.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to upload from URL');
    }

    return response.json();
  }

  /**
   * Get public URL for an asset.
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrlPrefix}/${key}`;
  }

  /**
   * Get asset with variants (for responsive images).
   */
  async getWithVariants(key: string): Promise<OptimizedAsset | null> {
    const response = await authenticatedFetch(`${this.apiBase}/asset/${encodeURIComponent(key)}`);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) return null;
      throw new Error('Failed to get asset');
    }

    return response.json();
  }

  /**
   * Delete an asset.
   */
  async delete(key: string): Promise<boolean> {
    const response = await authenticatedFetch(`${this.apiBase}/asset/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    return response.ok;
  }

  /**
   * Generate responsive srcset for an image.
   */
  generateSrcSet(asset: OptimizedAsset, widths: number[] = [320, 640, 960, 1280]): string {
    const srcSet: string[] = [];

    for (const width of widths) {
      // Find closest variant
      const variant = asset.variants.find((v) => v.width === width);
      if (variant) {
        srcSet.push(`${variant.url} ${width}w`);
      }
    }

    // Fall back to original if no variants
    if (srcSet.length === 0) {
      return asset.url;
    }

    return srcSet.join(', ');
  }

  /**
   * Get optimal image URL based on viewport and connection.
   */
  getOptimalUrl(asset: OptimizedAsset, viewportWidth: number, preferWebP = true): string {
    // Determine target width (2x for retina, capped at actual variants)
    const targetWidth = Math.min(viewportWidth * 2, 2560);

    // Prefer WebP/AVIF if supported
    const formatPriority = preferWebP ? ['avif', 'webp', 'jpeg', 'png'] : ['jpeg', 'png', 'webp'];

    // Find best matching variant
    for (const format of formatPriority) {
      const candidates = asset.variants
        .filter((v) => v.format === format)
        .sort((a, b) => a.width - b.width);

      // Find smallest variant that's >= target width
      const match = candidates.find((v) => v.width >= targetWidth);
      if (match) return match.url;

      // Fall back to largest available
      if (candidates.length > 0) {
        return candidates[candidates.length - 1].url;
      }
    }

    // Fall back to original
    return asset.url;
  }
}

// ============================================================================
// RESPONSIVE IMAGE COMPONENT HELPER
// ============================================================================

export interface ResponsiveImageProps {
  asset: OptimizedAsset;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
}

/**
 * Generate props for a responsive image element.
 *
 * Usage:
 * ```tsx
 * const imgProps = getResponsiveImageProps(asset, { alt: "Book cover" });
 * return <img {...imgProps} />;
 * ```
 */
export function getResponsiveImageProps(
  asset: OptimizedAsset,
  options: Omit<ResponsiveImageProps, 'asset'>
): React.ImgHTMLAttributes<HTMLImageElement> {
  // Find WebP variants for srcSet
  const webpVariants = asset.variants.filter((v) => v.format === 'webp');
  const fallbackVariants = asset.variants.filter((v) => v.format === 'jpeg');

  return {
    src: asset.url,
    srcSet:
      webpVariants.length > 0
        ? webpVariants.map((v) => `${v.url} ${v.width}w`).join(', ')
        : fallbackVariants.map((v) => `${v.url} ${v.width}w`).join(', '),
    sizes: options.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    alt: options.alt,
    className: options.className,
    loading: options.loading || (options.priority ? 'eager' : 'lazy'),
    decoding: options.priority ? 'sync' : 'async',
  };
}

// ============================================================================
// STORAGE MIGRATION HELPER
// ============================================================================

export interface MigrationProgress {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  currentAsset?: string;
}

/**
 * Migrate assets from Supabase Storage to R2.
 * Designed to run as a background job.
 */
export async function* migrateToR2(
  supabaseAssets: Array<{ path: string; url: string }>,
  options: { userId: string; dryRun?: boolean }
): AsyncGenerator<MigrationProgress> {
  const client = new R2StorageClient();
  const progress: MigrationProgress = {
    total: supabaseAssets.length,
    migrated: 0,
    failed: 0,
    skipped: 0,
  };

  for (const asset of supabaseAssets) {
    progress.currentAsset = asset.path;

    try {
      if (options.dryRun) {
        console.warn(`[DryRun] Would migrate: ${asset.path}`);
        progress.skipped++;
      } else {
        await client.uploadFromUrl(asset.url, {
          filename: asset.path.split('/').pop() || 'asset',
          category: detectCategory(asset.path),
        });
        progress.migrated++;
      }
    } catch (error) {
      console.error(`Failed to migrate ${asset.path}:`, error);
      progress.failed++;
    }

    yield progress;
  }
}

function detectCategory(path: string): AssetCategory {
  if (path.includes('cover')) return AssetCategory.BOOK_COVERS;
  if (path.includes('avatar')) return AssetCategory.AVATARS;
  if (path.includes('thumb')) return AssetCategory.THUMBNAILS;
  if (path.includes('export')) return AssetCategory.EXPORTS;
  return AssetCategory.ILLUSTRATIONS;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const r2Storage = new R2StorageClient();




