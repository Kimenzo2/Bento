import type { VercelRequest } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { createAuthenticatedHandler, type ApiContext } from './_middleware';
import {
  createOriginalUploadUrl,
  getBookAccess,
  getBookManifestSnapshot,
  getColouringSupabaseAdmin,
  getExportById,
} from '../lib/colouring-books/supabase';
import { buildColouringBookManifest } from '../lib/colouring-books/manifest';
import {
  createBookSlug,
  createInviteToken,
  createSourceStoragePath,
  getPublicAppBaseUrl,
  hashToken,
  inferContentType,
  parsePositiveInteger,
  tokenPrefix,
  type ColouringBookRow,
  type ColouringExportRow,
  type ColouringJobRow,
  type ColouringMemberRole,
  type ColouringInviteScope,
} from '../lib/colouring-books/shared';
import { createSignedR2GetUrl } from '../lib/colouring-books/r2';

type JsonRecord = Record<string, unknown>;

const VALID_VISIBILITIES = new Set(['private', 'family', 'shared']);
const VALID_PAPER_SIZES = new Set(['letter', 'a4', 'custom']);
const VALID_ORIENTATIONS = new Set(['portrait', 'landscape']);
const VALID_INVITE_ROLES: ColouringMemberRole[] = ['editor', 'viewer'];

function getDb() {
  return getColouringSupabaseAdmin();
}

function resolveColouringAction(req: VercelRequest): string {
  if (typeof req.query.action === 'string' && req.query.action.trim()) {
    return req.query.action.trim();
  }

  const bodyAction = req.body && typeof req.body === 'object' && typeof (req.body as JsonRecord).action === 'string'
    ? String((req.body as JsonRecord).action).trim()
    : '';
  if (bodyAction) {
    return bodyAction;
  }

  const path = req.url?.split('?')[0] || '';
  const suffix = path.replace('/api/colouring-books', '').replace(/^\/+/, '');
  return suffix;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asJsonObject(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function resolveBookId(req: VercelRequest, body: JsonRecord): string | undefined {
  return asString(body.bookId) || asString(req.query.bookId);
}

function resolveSourceId(req: VercelRequest, body: JsonRecord): string | undefined {
  return asString(body.sourceId) || asString(req.query.sourceId);
}

function resolveJobId(req: VercelRequest, body: JsonRecord): string | undefined {
  return asString(body.jobId) || asString(req.query.jobId);
}

function resolveExportId(req: VercelRequest, body: JsonRecord): string | undefined {
  return asString(body.exportId) || asString(req.query.exportId);
}

function resolveInviteToken(req: VercelRequest, body: JsonRecord): string | undefined {
  return asString(body.token) || asString(req.query.token);
}

function nowIso(): string {
  return new Date().toISOString();
}

function validateVisibility(value: unknown): ColouringBookRow['visibility'] | undefined {
  const normalized = asString(value);
  if (!normalized) return undefined;
  return VALID_VISIBILITIES.has(normalized) ? (normalized as ColouringBookRow['visibility']) : undefined;
}

function validatePaperSize(value: unknown): ColouringBookRow['paper_size'] | undefined {
  const normalized = asString(value);
  if (!normalized) return undefined;
  return VALID_PAPER_SIZES.has(normalized) ? (normalized as ColouringBookRow['paper_size']) : undefined;
}

function validateOrientation(value: unknown): ColouringBookRow['orientation'] | undefined {
  const normalized = asString(value);
  if (!normalized) return undefined;
  return VALID_ORIENTATIONS.has(normalized) ? (normalized as ColouringBookRow['orientation']) : undefined;
}

function validateInviteRole(value: unknown): ColouringMemberRole | undefined {
  const normalized = asString(value);
  if (!normalized) return undefined;
  return VALID_INVITE_ROLES.includes(normalized as ColouringMemberRole)
    ? (normalized as ColouringMemberRole)
    : undefined;
}

function resolveInviteScope(value: unknown): ColouringInviteScope | undefined {
  const normalized = asString(value);
  if (normalized === 'book' || normalized === 'export') {
    return normalized;
  }
  return undefined;
}

async function getActiveJob(db: ReturnType<typeof getDb>, bookId: string): Promise<ColouringJobRow | null> {
  const { data, error } = await db
    .from('colouring_jobs')
    .select('*')
    .eq('book_id', bookId)
    .in('status', ['queued', 'processing'])
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle<ColouringJobRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function refreshSourceCount(db: ReturnType<typeof getDb>, bookId: string): Promise<number> {
  const { count, error } = await db
    .from('colouring_sources')
    .select('id', { head: true, count: 'exact' })
    .eq('book_id', bookId);

  if (error) {
    throw new Error(error.message);
  }

  const sourceCount = count ?? 0;
  const { error: updateError } = await db
    .from('colouring_books')
    .update({ source_count: sourceCount })
    .eq('id', bookId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return sourceCount;
}

async function ensureReadableBook(
  db: ReturnType<typeof getDb>,
  bookId: string,
  userId: string
) {
  const access = await getBookAccess(db, bookId, userId);
  if (!access.book) {
    return { access, forbidden: false, notFound: true };
  }
  const hasAccess = access.isOwner || access.membership?.status === 'active';
  return { access, forbidden: !hasAccess, notFound: false };
}

async function ensureEditableBook(
  db: ReturnType<typeof getDb>,
  bookId: string,
  userId: string
) {
  const access = await getBookAccess(db, bookId, userId);
  if (!access.book) {
    return { access, forbidden: false, notFound: true };
  }
  const hasAccess = access.isOwner || (access.membership?.status === 'active' && access.canEdit);
  return { access, forbidden: !hasAccess, notFound: false };
}

async function buildManifestForBook(
  db: ReturnType<typeof getDb>,
  bookId: string,
  userId: string,
  includeSourcesOverride?: boolean
) {
  const accessResult = await ensureReadableBook(db, bookId, userId);
  if (accessResult.notFound) {
    return { error: 'Book not found', status: 404 as const };
  }
  if (accessResult.forbidden) {
    return { error: 'Forbidden', status: 403 as const };
  }

  const allowedToSeeSources = Boolean(accessResult.access.isOwner || accessResult.access.canEdit);
  const includeSources = typeof includeSourcesOverride === 'boolean'
    ? includeSourcesOverride && allowedToSeeSources
    : allowedToSeeSources;
  const snapshot = await getBookManifestSnapshot(db, bookId);
  const book = snapshot.book;
  if (!book) {
    return { error: 'Book not found', status: 404 as const };
  }

  const manifest = await buildColouringBookManifest({
    ...snapshot,
    book,
    userId,
    includeSources,
    signUrl: async (key: string) => {
      try {
        return createSignedR2GetUrl(key, 900);
      } catch {
        return null;
      }
    },
  });

  return { manifest, access: accessResult.access };
}

async function queueBookJob(options: {
  db: ReturnType<typeof getDb>;
  bookId: string;
  userId: string;
  jobType: 'build_book' | 'retry_book' | 'export_pdf';
  payload?: JsonRecord;
  priority?: number;
}) {
  const { db, bookId, userId, jobType, payload, priority } = options;
  const activeJob = await getActiveJob(db, bookId);
  if (activeJob && activeJob.job_type !== 'build_book' && activeJob.job_type !== 'retry_book') {
    return { error: 'An export is already in progress', status: 409 as const };
  }
  if (activeJob) {
    return { job: activeJob, status: 200 as const };
  }

  const { data, error } = await db.rpc('enqueue_colouring_job', {
    p_book_id: bookId,
    p_owner_id: userId,
    p_job_type: jobType,
    p_payload: payload ?? {},
    p_priority: priority ?? 0,
    p_run_after: nowIso(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return { job: data as ColouringJobRow, status: 201 as const };
}

async function handleCreateBook(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();

  const title = asNullableString(body.title) || 'Untitled Colouring Book';
  const description = asNullableString(body.description);
  const paperSize = validatePaperSize(body.paperSize) || validatePaperSize(body.paper_size) || 'letter';
  const orientation = validateOrientation(body.orientation) || 'portrait';
  const metadata = asJsonObject(body.metadata) || {};
  const visibility = validateVisibility(body.visibility);
  const slug = asString(metadata.slug) || createBookSlug(title);
  metadata.slug = slug;

  const { data, error } = await db.rpc('create_colouring_book', {
    p_owner_id: userId,
    p_title: title,
    p_description: description,
    p_paper_size: paperSize,
    p_orientation: orientation,
    p_metadata: metadata,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(500).json({ error: 'Failed to create colouring book' });
  }

  const book = data as ColouringBookRow;

  if (visibility) {
    const { error: visibilityError } = await db
      .from('colouring_books')
      .update({ visibility })
      .eq('id', book.id);

    if (visibilityError) {
      return res.status(500).json({ error: visibilityError.message });
    }
  }

  await db.rpc('increment_colouring_usage', {
    p_user_id: userId,
    p_books: 1,
  });

  const manifestResult = await buildManifestForBook(db, book.id, userId);
  if ('error' in manifestResult) {
    return res.status(manifestResult.status).json({ error: manifestResult.error });
  }

  return res.status(201).json({
    book,
    manifest: manifestResult.manifest,
  });
}

async function handlePresignSourceUpload(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);
  const filename = asString(body.filename);
  const contentType = asString(body.contentType) || asString(body.content_type) || undefined;
  const sortOrderInput = body.sortOrder ?? body.sort_order;

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }

  const accessResult = await ensureEditableBook(db, bookId, userId);
  if (accessResult.notFound) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (accessResult.forbidden) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (accessResult.access.book?.status === 'archived') {
    return res.status(409).json({ error: 'Archived books cannot receive uploads' });
  }

  const sourceId = randomUUID();
  const { count } = await db
    .from('colouring_sources')
    .select('id', { head: true, count: 'exact' })
    .eq('book_id', bookId);

  const sortOrder = parsePositiveInteger(sortOrderInput, count ?? 0);
  const storagePath = createSourceStoragePath({
    userId,
    bookId,
    sourceId,
    filename,
  });

  const { error: insertError } = await db.from('colouring_sources').insert({
    id: sourceId,
    book_id: bookId,
    owner_id: userId,
    storage_bucket: 'colouring-originals',
    storage_path: storagePath,
    original_filename: filename,
    mime_type: contentType || inferContentType(filename),
    sort_order: sortOrder,
    status: 'uploading',
  });

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  let uploadUrl;
  try {
    uploadUrl = await createOriginalUploadUrl(db, storagePath);
  } catch (error) {
    await db.from('colouring_sources').delete().eq('id', sourceId);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate signed upload URL',
    });
  }

  try {
    await refreshSourceCount(db, bookId);
  } catch (error) {
    console.warn('[colouring-books] source count refresh failed after presign:', error);
  }

  if (accessResult.access.book?.status === 'draft') {
    await db
      .from('colouring_books')
      .update({ status: 'uploading' })
      .eq('id', bookId);
  }

  return res.status(201).json({
    sourceId,
    bookId,
    storageBucket: 'colouring-originals',
    storagePath,
    contentType: contentType || inferContentType(filename),
    sortOrder,
    uploadUrl: uploadUrl.signedUrl,
    uploadToken: uploadUrl.token,
    uploadPath: uploadUrl.path,
  });
}

async function handleCommitSource(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);
  const sourceId = resolveSourceId(ctx.req, body);

  if (!bookId || !sourceId) {
    return res.status(400).json({ error: 'bookId and sourceId are required' });
  }

  const accessResult = await ensureEditableBook(db, bookId, userId);
  if (accessResult.notFound) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (accessResult.forbidden) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data: source, error: sourceError } = await db
    .from('colouring_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (sourceError) {
    return res.status(500).json({ error: sourceError.message });
  }
  if (!source) {
    return res.status(404).json({ error: 'Source not found' });
  }
  if (source.status === 'duplicate' || source.status === 'rejected') {
    return res.status(409).json({ error: `Source is ${source.status}` });
  }

  const nextMimeType = asString(body.mimeType) || asString(body.mime_type) || source.mime_type || inferContentType(source.original_filename || source.storage_path);
  const byteSize = typeof body.byteSize === 'number'
    ? body.byteSize
    : typeof body.byte_size === 'number'
      ? body.byte_size
      : source.byte_size;
  const sha256 = asString(body.sha256) || source.sha256;
  const perceptualHash = asString(body.perceptualHash) || asString(body.perceptual_hash) || source.perceptual_hash;
  const width = typeof body.width === 'number' ? Math.floor(body.width) : source.width;
  const height = typeof body.height === 'number' ? Math.floor(body.height) : source.height;
  const firstCommit = !source.committed_at;

  const { data: updated, error: updateError } = await db
    .from('colouring_sources')
    .update({
      status: 'committed',
      mime_type: nextMimeType,
      byte_size: byteSize ?? null,
      sha256: sha256 ?? null,
      perceptual_hash: perceptualHash ?? null,
      width: width ?? null,
      height: height ?? null,
      committed_at: source.committed_at || nowIso(),
      processed_at: source.processed_at,
    })
    .eq('id', sourceId)
    .select('*')
    .maybeSingle();

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }
  if (!updated) {
    return res.status(500).json({ error: 'Failed to update source' });
  }

  try {
    await refreshSourceCount(db, bookId);
  } catch (error) {
    console.warn('[colouring-books] source count refresh failed after commit:', error);
  }
  if (accessResult.access.book?.status === 'draft') {
    await db
      .from('colouring_books')
      .update({ status: 'uploading' })
      .eq('id', bookId);
  }

  if (firstCommit) {
    await db.rpc('increment_colouring_usage', {
      p_user_id: userId,
      p_sources: 1,
    });
  }

  return res.status(200).json({ source: updated });
}

async function handleQueueProcessing(ctx: ApiContext, body: JsonRecord, jobType: 'build_book' | 'retry_book'): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);
  const priority = parsePositiveInteger(body.priority, 0);

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const accessResult = await ensureEditableBook(db, bookId, userId);
  if (accessResult.notFound) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (accessResult.forbidden) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (accessResult.access.book?.status === 'archived') {
    return res.status(409).json({ error: 'Archived books cannot be processed' });
  }

  const activeJob = await getActiveJob(db, bookId);
  if (activeJob && activeJob.job_type === 'export_pdf') {
    return res.status(409).json({ error: 'An export is already in progress' });
  }
  if (activeJob) {
    return res.status(200).json({ job: activeJob });
  }

  const { data: sources, error: sourceError } = await db
    .from('colouring_sources')
    .select('id')
    .eq('book_id', bookId)
    .in('status', ['uploaded', 'committed', 'processing', 'ready', 'duplicate'])
    .limit(1);

  if (sourceError) {
    return res.status(500).json({ error: sourceError.message });
  }
  if (!sources || sources.length === 0) {
    return res.status(409).json({ error: 'Upload at least one source before processing' });
  }

  const queueResult = await queueBookJob({
    db,
    bookId,
    userId,
    jobType,
    priority,
    payload: asJsonObject(body.payload) || {
      reason: jobType,
      requestedBy: userId,
    },
  });

  if ('error' in queueResult) {
    return res.status(queueResult.status).json({ error: queueResult.error });
  }
  if (!queueResult.job || queueResult.job.job_type !== jobType) {
    return res.status(409).json({ error: 'A different colouring job is already in progress' });
  }

  return res.status(queueResult.status).json({ job: queueResult.job });
}

async function handleManifest(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);
  const rawIncludeSources = body.includeSources ?? body.include_sources ?? ctx.req.query.includeSources;
  const includeSourcesOverride = typeof rawIncludeSources === 'undefined' ? undefined : asBoolean(rawIncludeSources);

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const result = await buildManifestForBook(db, bookId, userId, includeSourcesOverride);
  if ('error' in result) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(200).json(result.manifest);
}

async function handleJobStatus(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const jobId = resolveJobId(ctx.req, body);

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const { data: job, error } = await db
    .from('colouring_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle<ColouringJobRow>();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const accessResult = await ensureReadableBook(db, job.book_id, userId);
  if (accessResult.notFound) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (accessResult.forbidden) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(200).json({ job });
}

async function handleCreateInvite(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const access = await getBookAccess(db, bookId, userId);
  if (!access.book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (!access.isOwner) {
    return res.status(403).json({ error: 'Only the owner can create invites' });
  }
  if (access.book.status === 'archived') {
    return res.status(409).json({ error: 'Archived books cannot create invites' });
  }

  const scope = resolveInviteScope(body.scope) || 'book';
  const role = validateInviteRole(body.role) || 'viewer';
  const exportId = scope === 'export' ? resolveExportId(ctx.req, body) : null;
  const maxUses = parsePositiveInteger(body.maxUses ?? body.max_uses, scope === 'export' ? 20 : 5);
  const expiresInHours = parsePositiveInteger(body.expiresInHours ?? body.expires_in_hours, scope === 'export' ? 24 : 168);
  const expiresAt = asString(body.expiresAt) || asString(body.expires_at);

  let resolvedExportId: string | null = null;
  if (scope === 'export') {
    if (!exportId) {
      return res.status(400).json({ error: 'exportId is required for export invites' });
    }

    const exportRow = await getExportById(db, exportId);
    if (!exportRow || exportRow.book_id !== bookId) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (exportRow.status !== 'ready' || !exportRow.r2_key) {
      return res.status(409).json({ error: 'Export must be ready before creating a share link' });
    }

    resolvedExportId = exportId;
  } else if (role === 'owner') {
    return res.status(400).json({ error: 'Owner is not a valid invite role' });
  }

  const token = createInviteToken(scope === 'export' ? 'exp' : 'cbk');
  const tokenHash = hashToken(token);
  const tokenPrefixValue = tokenPrefix(token);
  const expiryIso = expiresAt || new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await db
    .from('colouring_invites')
    .insert({
      book_id: bookId,
      created_by: userId,
      scope,
      role: scope === 'export' ? 'viewer' : role,
      export_id: resolvedExportId,
      token_hash: tokenHash,
      token_prefix: tokenPrefixValue,
      max_uses: maxUses,
      use_count: 0,
      expires_at: expiryIso,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (scope === 'book') {
    await db
      .from('colouring_books')
      .update({
        visibility: access.book.visibility === 'shared' ? 'shared' : 'family',
      })
      .eq('id', bookId);
  }

  return res.status(201).json({
    invite,
    token,
    tokenPrefix: tokenPrefixValue,
    shareUrl:
      scope === 'export'
        ? `${getPublicAppBaseUrl()}/api/colouring-books-share?token=${encodeURIComponent(token)}`
        : null,
  });
}

async function handleAcceptInvite(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const token = resolveInviteToken(ctx.req, body);

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const { data: invite, error } = await db.rpc('accept_colouring_invite', {
    p_token_hash: hashToken(token),
    p_user_id: userId,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!invite) {
    return res.status(500).json({ error: 'Failed to accept invite' });
  }

  const manifestResult = await buildManifestForBook(db, invite.book_id, userId);
  if ('error' in manifestResult) {
    return res.status(manifestResult.status).json({ error: manifestResult.error });
  }

  return res.status(200).json({
    invite,
    manifest: manifestResult.manifest,
  });
}

async function handleRequestExport(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res, userId } = ctx;
  const db = getDb();
  const bookId = resolveBookId(ctx.req, body);

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const access = await getBookAccess(db, bookId, userId);
  if (!access.book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  if (!(access.isOwner || (access.membership?.status === 'active' && access.canEdit))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (access.book.status === 'archived') {
    return res.status(409).json({ error: 'Archived books cannot be exported' });
  }

  const activeJob = await getActiveJob(db, bookId);
  if (activeJob && activeJob.job_type !== 'export_pdf') {
    return res.status(409).json({ error: 'Book processing is in progress' });
  }
  if (activeJob && activeJob.job_type === 'export_pdf') {
    const existingExportId = asString((activeJob.payload as JsonRecord).exportId);
    if (existingExportId) {
      const existingExport = await getExportById(db, existingExportId);
      if (existingExport) {
        return res.status(200).json({
          export: existingExport,
          job: activeJob,
        });
      }
    }
    return res.status(409).json({ error: 'An export is already in progress' });
  }

  if ((access.book.ready_page_count ?? 0) <= 0) {
    return res.status(409).json({ error: 'Generate pages before exporting' });
  }

  const selectedPageNumbers = Array.isArray(body.pageNumbers)
    ? body.pageNumbers
        .map((value) => parsePositiveInteger(value, 0))
        .filter((value) => value > 0)
    : [];
  const exportOptions: JsonRecord = {
    requestedBy: userId,
    ...(selectedPageNumbers.length > 0 ? { pageNumbers: selectedPageNumbers } : {}),
  };

  const { data: exportRow, error: exportError } = await db
    .from('colouring_exports')
    .insert({
      book_id: bookId,
      owner_id: userId,
      scope: 'book',
      status: 'queued',
      options: exportOptions,
    })
    .select('*')
    .maybeSingle<ColouringExportRow>();

  if (exportError) {
    return res.status(500).json({ error: exportError.message });
  }
  if (!exportRow) {
    return res.status(500).json({ error: 'Failed to create export row' });
  }

  const queueResult = await queueBookJob({
    db,
    bookId,
    userId,
    jobType: 'export_pdf',
    payload: {
      exportId: exportRow.id,
      ...(selectedPageNumbers.length > 0 ? { pageNumbers: selectedPageNumbers } : {}),
      requestedBy: userId,
    },
    priority: 1,
  });

  if ('error' in queueResult) {
    await db.from('colouring_exports').delete().eq('id', exportRow.id);
    return res.status(queueResult.status).json({ error: queueResult.error });
  }
  if (!queueResult.job || queueResult.job.job_type !== 'export_pdf') {
    await db.from('colouring_exports').delete().eq('id', exportRow.id);
    return res.status(409).json({ error: 'A different colouring job is already in progress' });
  }

  const exportId = exportRow.id;
  if (exportId && queueResult.job) {
    await db
      .from('colouring_exports')
      .update({ job_id: queueResult.job.id })
      .eq('id', exportId);
  }

  await db.rpc('increment_colouring_usage', {
    p_user_id: userId,
    p_exports: 1,
  });

  return res.status(queueResult.status).json({
    export: exportRow,
    job: queueResult.job,
  });
}

export default createAuthenticatedHandler(async (ctx: ApiContext) => {
  const body = (ctx.req.body && typeof ctx.req.body === 'object' ? ctx.req.body : {}) as JsonRecord;
  const action = resolveColouringAction(ctx.req);

  if (ctx.req.method === 'GET' && !action && asString(ctx.req.query.bookId)) {
    return handleManifest(ctx, body);
  }

  switch (action) {
    case 'create':
    case 'create-book':
      return handleCreateBook(ctx, body);
    case 'presign-source-upload':
    case 'presign-upload':
      return handlePresignSourceUpload(ctx, body);
    case 'commit-source':
      return handleCommitSource(ctx, body);
    case 'start-processing':
    case 'start':
    case 'build':
      return handleQueueProcessing(ctx, body, 'build_book');
    case 'retry-processing':
    case 'retry':
      return handleQueueProcessing(ctx, body, 'retry_book');
    case 'manifest':
    case 'get-manifest':
      return handleManifest(ctx, body);
    case 'job-status':
    case 'status':
      return handleJobStatus(ctx, body);
    case 'create-invite':
    case 'invite':
      return handleCreateInvite(ctx, body);
    case 'accept-invite':
    case 'accept':
      return handleAcceptInvite(ctx, body);
    case 'request-export':
    case 'export':
      return handleRequestExport(ctx, body);
    default:
      if (ctx.req.method === 'GET' && asString(ctx.req.query.bookId)) {
        return handleManifest(ctx, body);
      }

      return ctx.res.status(400).json({
        error: 'Unknown colouring-books action',
        action: action || null,
      });
  }
});
