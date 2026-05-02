import { createHash, randomBytes } from 'node:crypto';

export const COLOURING_ORIGINALS_BUCKET = 'colouring-originals';
export const COLOURING_R2_BUCKET = process.env.R2_BUCKET_NAME || 'genesis-assets';
export const COLOURING_R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

export const COLOURING_BOOK_STATUSES = [
  'draft',
  'uploading',
  'queued',
  'processing',
  'ready',
  'failed',
  'archived',
] as const;

export const COLOURING_SOURCE_STATUSES = [
  'uploading',
  'uploaded',
  'committed',
  'processing',
  'ready',
  'duplicate',
  'rejected',
  'failed',
] as const;

export const COLOURING_PAGE_STATUSES = ['queued', 'processing', 'ready', 'failed', 'skipped'] as const;
export const COLOURING_JOB_STATUSES = ['queued', 'processing', 'ready', 'failed', 'cancelled'] as const;
export const COLOURING_JOB_TYPES = ['build_book', 'retry_book', 'export_pdf'] as const;
export const COLOURING_MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export const COLOURING_MEMBER_STATUSES = ['pending', 'active', 'revoked'] as const;
export const COLOURING_INVITE_SCOPES = ['book', 'export'] as const;
export const COLOURING_INVITE_ROLES = ['editor', 'viewer'] as const;
export const COLOURING_EXPORT_STATUSES = ['queued', 'processing', 'ready', 'failed', 'cancelled'] as const;

export type ColouringBookStatus = (typeof COLOURING_BOOK_STATUSES)[number];
export type ColouringSourceStatus = (typeof COLOURING_SOURCE_STATUSES)[number];
export type ColouringPageStatus = (typeof COLOURING_PAGE_STATUSES)[number];
export type ColouringJobStatus = (typeof COLOURING_JOB_STATUSES)[number];
export type ColouringJobType = (typeof COLOURING_JOB_TYPES)[number];
export type ColouringMemberRole = (typeof COLOURING_MEMBER_ROLES)[number];
export type ColouringMemberStatus = (typeof COLOURING_MEMBER_STATUSES)[number];
export type ColouringInviteScope = (typeof COLOURING_INVITE_SCOPES)[number];
export type ColouringInviteRole = (typeof COLOURING_INVITE_ROLES)[number];
export type ColouringExportStatus = (typeof COLOURING_EXPORT_STATUSES)[number];

export interface ColouringBookRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: ColouringBookStatus;
  visibility: 'private' | 'family' | 'shared';
  paper_size: 'letter' | 'a4' | 'custom';
  orientation: 'portrait' | 'landscape';
  metadata: Record<string, unknown>;
  page_count: number;
  source_count: number;
  ready_page_count: number;
  last_job_id: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  archived_at: string | null;
}

export interface ColouringSourceRow {
  id: string;
  book_id: string;
  owner_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  perceptual_hash: string | null;
  duplicate_of_source_id: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  status: ColouringSourceStatus;
  committed_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

export interface ColouringPageRow {
  id: string;
  book_id: string;
  source_id: string;
  owner_id: string;
  page_number: number;
  status: ColouringPageStatus;
  svg_key: string | null;
  png_key: string | null;
  thumbnail_key: string | null;
  svg_width: number | null;
  svg_height: number | null;
  complexity_score: number | null;
  sharpness_score: number | null;
  perceptual_hash: string | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  error_message: string | null;
}

export interface ColouringJobRow {
  id: string;
  book_id: string;
  owner_id: string;
  job_type: ColouringJobType;
  status: ColouringJobStatus;
  stage: string;
  progress: number;
  message: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  claimed_by: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  run_after: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  updated_at: string;
}

export interface ColouringBookMemberRow {
  id: string;
  book_id: string;
  user_id: string;
  role: ColouringMemberRole;
  status: ColouringMemberStatus;
  added_by: string;
  invite_id: string | null;
  joined_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColouringInviteRow {
  id: string;
  book_id: string;
  created_by: string;
  scope: ColouringInviteScope;
  role: ColouringInviteRole;
  export_id: string | null;
  token_hash: string;
  token_prefix: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColouringExportRow {
  id: string;
  book_id: string;
  owner_id: string;
  job_id: string | null;
  scope: ColouringInviteScope | 'book';
  status: ColouringExportStatus;
  r2_key: string | null;
  mime_type: string;
  byte_size: number | null;
  page_count: number;
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  error_message: string | null;
}

export interface ColouringUsageRow {
  id: string;
  user_id: string;
  month: string;
  books_created: number;
  sources_uploaded: number;
  pages_processed: number;
  exports_created: number;
  created_at: string;
  updated_at: string;
}

export interface ColouringBookManifestPage {
  id: string;
  pageNumber: number;
  status: ColouringPageStatus;
  svgKey: string | null;
  pngKey: string | null;
  thumbnailKey: string | null;
  svgUrl: string | null;
  pngUrl: string | null;
  thumbnailUrl: string | null;
  complexityScore: number | null;
  sharpnessScore: number | null;
  perceptualHash: string | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  errorMessage: string | null;
}

export interface ColouringBookManifestSource {
  id: string;
  sortOrder: number;
  status: ColouringSourceStatus;
  originalFilename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  sha256: string | null;
  perceptualHash: string | null;
  duplicateOfSourceId: string | null;
  width: number | null;
  height: number | null;
  committedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}

export interface ColouringBookManifestExport {
  id: string;
  status: ColouringExportStatus;
  scope: 'book';
  r2Key: string | null;
  mimeType: string;
  byteSize: number | null;
  pageCount: number;
  downloadUrl: string | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  errorMessage: string | null;
  jobId: string | null;
}

export interface ColouringBookManifest {
  book: Pick<
    ColouringBookRow,
    | 'id'
    | 'owner_id'
    | 'title'
    | 'description'
    | 'status'
    | 'visibility'
    | 'paper_size'
    | 'orientation'
    | 'metadata'
    | 'page_count'
    | 'source_count'
    | 'ready_page_count'
    | 'last_job_id'
    | 'created_at'
    | 'updated_at'
    | 'processed_at'
    | 'archived_at'
  >;
  access: {
    userId: string | null;
    role: ColouringMemberRole | 'owner' | 'none';
    isOwner: boolean;
    isMember: boolean;
    canEdit: boolean;
  };
  sources: ColouringBookManifestSource[];
  pages: ColouringBookManifestPage[];
  exports: ColouringBookManifestExport[];
  members: Array<{
    id: string;
    userId: string;
    role: ColouringMemberRole;
    status: ColouringMemberStatus;
    joinedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  jobs: Array<{
    id: string;
    jobType: ColouringJobType;
    status: ColouringJobStatus;
    stage: string;
    progress: number;
    message: string;
    priority: number;
    attempts: number;
    maxAttempts: number;
    runAfter: string;
    claimedBy: string | null;
    claimedAt: string | null;
    heartbeatAt: string | null;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    updatedAt: string;
    error: string | null;
  }>;
  generatedAt: string;
}

export interface ColouringBookAccess {
  book: ColouringBookRow | null;
  membership: ColouringBookMemberRow | null;
  isOwner: boolean;
  isMember: boolean;
  canEdit: boolean;
}

export function getColouringEnv(key: string, fallback = ''): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

export function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const replaced = trimmed
    .replace(/[/\\?%*:|"<>]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '');

  return replaced.length > 0 ? replaced : 'upload';
}

export function getFileExtension(filename: string, fallback = 'bin'): string {
  const ext = filename.split('.').pop()?.trim().toLowerCase();
  if (!ext || ext === filename.toLowerCase()) {
    return fallback;
  }
  return ext.replace(/[^a-z0-9]+/g, '') || fallback;
}

export function inferContentType(filenameOrMime: string): string {
  const value = filenameOrMime.toLowerCase();
  if (value.includes('/')) {
    return value;
  }

  const ext = getFileExtension(value, '');
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export function createBookSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'colouring-book';
}

export function createSourceStoragePath(options: {
  userId: string;
  bookId: string;
  sourceId: string;
  filename: string;
}): string {
  const ext = getFileExtension(options.filename, 'jpg');
  const safeName = sanitizeFilename(options.filename).replace(/\.[^.]+$/, '');
  return [
    options.userId,
    options.bookId,
    options.sourceId,
    `${safeName}.${ext}`,
  ].join('/');
}

export function createDerivedR2Key(options: {
  userId: string;
  bookId: string;
  itemId: string;
  kind: 'pages' | 'previews' | 'thumbnails' | 'exports';
  extension: string;
}): string {
  const ext = options.extension.replace(/^\./, '').toLowerCase();
  return [
    'colouring-books',
    options.userId,
    options.bookId,
    options.kind,
    `${options.itemId}.${ext}`,
  ].join('/');
}

export function createInviteToken(prefix = 'cbk'): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenPrefix(token: string, length = 10): string {
  return token.slice(0, length);
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isAllowedImageContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().trim();
  return (
    normalized.startsWith('image/') &&
    !normalized.includes('svg') &&
    normalized !== 'image/gif'
  );
}

export function getPublicAppBaseUrl(): string {
  const explicit = getColouringEnv('PUBLIC_APP_URL') || getColouringEnv('NEXT_PUBLIC_SITE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelUrl = getColouringEnv('VERCEL_URL');
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, '')}`;
  }

  return 'http://localhost:3000';
}

export function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}
