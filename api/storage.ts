/**
 * Storage API Endpoint
 *
 * Handles asset uploads, presigned URLs, and media optimization.
 * Designed to work with Cloudflare R2 and Vercel Edge Functions.
 *
 * Endpoints:
 * - POST /api/storage/presign - Get presigned upload URL
 * - POST /api/storage/upload-from-url - Upload from external URL
 * - GET /api/storage/asset/:key - Get asset with variants
 * - DELETE /api/storage/asset/:key - Delete asset
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './middleware';

// ============================================================================
// TYPES
// ============================================================================

interface PresignRequest {
  userId: string;
  filename: string;
  category: string;
  contentType: string;
  public?: boolean;
  metadata?: Record<string, string>;
}

interface UploadFromUrlRequest {
  sourceUrl: string;
  userId: string;
  filename: string;
  category?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface StoredAsset {
  key: string;
  url: string;
  directUrl: string;
  contentType: string;
  size: number;
  etag: string;
  uploadedAt: string;
  metadata: Record<string, string>;
  variants?: Array<{
    id: string;
    format: string;
    width: number;
    height: number;
    url: string;
    size: number;
  }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || 'genesis-assets',
  publicUrl: process.env.R2_PUBLIC_URL || '',
};

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ============================================================================
// IN-MEMORY ASSET STORE (Replace with database in production)
// ============================================================================

const assets = new Map<string, StoredAsset>();

// ============================================================================
// UTILITIES
// ============================================================================

function generateAssetKey(userId: string, filename: string, category: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const hash =
    Math.abs(hashString(`${userId}-${filename}-${Date.now()}`)).toString(36) +
    Date.now().toString(36);

  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';

  return `${category}/${year}/${month}/${day}/${userId.slice(0, 8)}/${hash}.${ext}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handlePresign(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const body = req.body as PresignRequest;

    // Validate required fields
    if (!body.userId || !body.filename) {
      res.status(400).json({ error: 'userId and filename are required' });
      return;
    }

    const category = body.category || 'illustrations';
    const key = generateAssetKey(body.userId, body.filename, category);
    const contentType = body.contentType || getContentType(body.filename);

    // In production, generate actual presigned URL using AWS SDK v3
    // For now, return a mock URL
    const uploadUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600`;
    const publicUrl = `${R2_CONFIG.publicUrl || `https://pub-${R2_CONFIG.accountId}.r2.dev`}/${key}`;

    // Pre-register the asset
    assets.set(key, {
      key,
      url: publicUrl,
      directUrl: uploadUrl.split('?')[0],
      contentType,
      size: 0,
      etag: '',
      uploadedAt: new Date().toISOString(),
      metadata: body.metadata || {},
    });

    res.status(200).json({
      uploadUrl,
      key,
      publicUrl,
    });
  } catch (error) {
    console.error('[Storage API] Presign error:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
}

async function handleUploadFromUrl(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const body = req.body as UploadFromUrlRequest;

    // Validate required fields
    if (!body.sourceUrl || !body.userId || !body.filename) {
      res.status(400).json({ error: 'sourceUrl, userId, and filename are required' });
      return;
    }

    const category = body.category || 'illustrations';
    const key = generateAssetKey(body.userId, body.filename, category);
    const contentType = body.contentType || getContentType(body.filename);

    // In production:
    // 1. Fetch the source URL
    // 2. Upload to R2
    // 3. Trigger media optimization job

    // For now, simulate the upload
    const publicUrl = `${R2_CONFIG.publicUrl || `https://pub-${R2_CONFIG.accountId}.r2.dev`}/${key}`;

    const asset: StoredAsset = {
      key,
      url: publicUrl,
      directUrl: `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`,
      contentType,
      size: 0, // Would be actual size after upload
      etag: `"${Date.now().toString(36)}"`,
      uploadedAt: new Date().toISOString(),
      metadata: body.metadata || {},
    };

    assets.set(key, asset);

    res.status(200).json(asset);
  } catch (error) {
    console.error('[Storage API] Upload from URL error:', error);
    res.status(500).json({ error: 'Failed to upload from URL' });
  }
}

async function handleGetAsset(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const key = decodeURIComponent(req.query.key as string);

    if (!key) {
      res.status(400).json({ error: 'Asset key is required' });
      return;
    }

    const asset = assets.get(key);

    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // Add cache headers for immutable content
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);

    res.status(200).json(asset);
  } catch (error) {
    console.error('[Storage API] Get asset error:', error);
    res.status(500).json({ error: 'Failed to get asset' });
  }
}

async function handleDeleteAsset(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const key = decodeURIComponent(req.query.key as string);

    if (!key) {
      res.status(400).json({ error: 'Asset key is required' });
      return;
    }

    const deleted = assets.delete(key);

    if (!deleted) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // In production, also delete from R2 and all variants

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Storage API] Delete asset error:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res } = ctx;
    const path = req.url?.replace('/api/storage', '') || '';

    // Route requests
    if (req.method === 'POST' && path === '/presign') {
      return handlePresign(req, res);
    }

    if (req.method === 'POST' && path === '/upload-from-url') {
      return handleUploadFromUrl(req, res);
    }

    if (req.method === 'GET' && path.startsWith('/asset/')) {
      req.query.key = path.replace('/asset/', '');
      return handleGetAsset(req, res);
    }

    if (req.method === 'DELETE' && path.startsWith('/asset/')) {
      req.query.key = path.replace('/asset/', '');
      return handleDeleteAsset(req, res);
    }

    res.status(404).json({ error: 'Not found' });
  },
  { cors: true }
);
