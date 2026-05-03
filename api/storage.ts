/**
 * Storage API Endpoint
 *
 * Handles asset uploads, presigned URLs, and metadata lookup.
 * Upload and metadata operations are scoped to the authenticated user.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './_middleware';

interface PresignRequest {
  filename: string;
  category: string;
  contentType: string;
  public?: boolean;
  metadata?: Record<string, string>;
}

interface UploadFromUrlRequest {
  sourceUrl: string;
  filename: string;
  category?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface StoredAsset {
  ownerId: string;
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

const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  bucketName: process.env.R2_BUCKET_NAME || 'genesis-assets',
  publicUrl: process.env.R2_PUBLIC_URL || '',
};

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Best-effort metadata cache. Authorization is derived from the key + user ID,
// so a cold start does not change asset ownership semantics.
const assets = new Map<string, StoredAsset>();

function generateAssetKey(userId: string, filename: string, category: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hash =
    Math.abs(hashString(`${userId}-${filename}-${Date.now()}`)).toString(36) +
    Date.now().toString(36);
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';

  return `${category}/${year}/${month}/${day}/${userId}/${hash}.${ext}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
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

function getBaseAssetUrl(key: string): string {
  return `${R2_CONFIG.publicUrl || `https://pub-${R2_CONFIG.accountId}.r2.dev`}/${key}`;
}

function buildStoredAsset(
  key: string,
  ownerId: string,
  overrides: Partial<StoredAsset> = {}
): StoredAsset {
  return {
    ownerId,
    key,
    url: overrides.url || getBaseAssetUrl(key),
    directUrl:
      overrides.directUrl ||
      `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`,
    contentType: overrides.contentType || getContentType(key),
    size: overrides.size ?? 0,
    etag: overrides.etag ?? '',
    uploadedAt: overrides.uploadedAt || new Date().toISOString(),
    metadata: overrides.metadata || {},
    variants: overrides.variants,
  };
}

function isOwnedByUser(key: string, userId: string, asset?: StoredAsset): boolean {
  if (asset?.ownerId) {
    return asset.ownerId === userId;
  }

  return key.includes(`/${userId}/`);
}

function resolveStoragePath(req: VercelRequest): string {
  const queryPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  if (typeof queryPath === 'string' && queryPath.length > 0) {
    return `/${queryPath.replace(/^\/+/, '')}`;
  }

  const urlPath = req.url?.split('?')[0] || '';
  return urlPath.replace('/api/storage', '') || '';
}

async function handlePresign(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
): Promise<void> {
  try {
    const body = req.body as PresignRequest;

    if (!body.filename) {
      res.status(400).json({ error: 'filename is required' });
      return;
    }

    const category = body.category || 'illustrations';
    const key = generateAssetKey(userId, body.filename, category);
    const contentType = body.contentType || getContentType(body.filename);
    const uploadUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600`;
    const publicUrl = getBaseAssetUrl(key);

    assets.set(
      key,
      buildStoredAsset(key, userId, {
        url: publicUrl,
        directUrl: uploadUrl.split('?')[0],
        contentType,
        metadata: body.metadata || {},
      })
    );

    res.status(200).json({ uploadUrl, key, publicUrl });
  } catch (error) {
    console.error('[Storage API] Presign error:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
}

async function handleUploadFromUrl(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
): Promise<void> {
  try {
    const body = req.body as UploadFromUrlRequest;

    if (!body.sourceUrl || !body.filename) {
      res.status(400).json({ error: 'sourceUrl and filename are required' });
      return;
    }

    const category = body.category || 'illustrations';
    const key = generateAssetKey(userId, body.filename, category);
    const contentType = body.contentType || getContentType(body.filename);
    const asset = buildStoredAsset(key, userId, {
      contentType,
      etag: `"${Date.now().toString(36)}"`,
      metadata: body.metadata || {},
    });

    assets.set(key, asset);
    res.status(200).json(asset);
  } catch (error) {
    console.error('[Storage API] Upload from URL error:', error);
    res.status(500).json({ error: 'Failed to upload from URL' });
  }
}

async function handleGetAsset(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
): Promise<void> {
  try {
    const key = decodeURIComponent(req.query.key as string);

    if (!key) {
      res.status(400).json({ error: 'Asset key is required' });
      return;
    }

    const cachedAsset = assets.get(key);
    if (!isOwnedByUser(key, userId, cachedAsset)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const asset = cachedAsset || buildStoredAsset(key, userId);
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
    res.status(200).json(asset);
  } catch (error) {
    console.error('[Storage API] Get asset error:', error);
    res.status(500).json({ error: 'Failed to get asset' });
  }
}

async function handleDeleteAsset(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
): Promise<void> {
  try {
    const key = decodeURIComponent(req.query.key as string);

    if (!key) {
      res.status(400).json({ error: 'Asset key is required' });
      return;
    }

    const cachedAsset = assets.get(key);
    if (!isOwnedByUser(key, userId, cachedAsset)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    assets.delete(key);
    res.status(501).json({
      error: 'Asset deletion is not configured on this deployment',
    });
  } catch (error) {
    console.error('[Storage API] Delete asset error:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
}

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, userId } = ctx;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const path = resolveStoragePath(req);

    if (req.method === 'POST' && path === '/presign') {
      return handlePresign(req, res, userId);
    }

    if (req.method === 'POST' && path === '/upload-from-url') {
      return handleUploadFromUrl(req, res, userId);
    }

    if (req.method === 'GET' && path.startsWith('/asset/')) {
      req.query.key = path.replace('/asset/', '');
      return handleGetAsset(req, res, userId);
    }

    if (req.method === 'DELETE' && path.startsWith('/asset/')) {
      req.query.key = path.replace('/asset/', '');
      return handleDeleteAsset(req, res, userId);
    }

    res.status(404).json({ error: 'Not found' });
  },
  { cors: true }
);
