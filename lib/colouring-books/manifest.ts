import {
  type ColouringBookManifest,
  type ColouringBookManifestExport,
  type ColouringBookManifestPage,
  type ColouringBookManifestSource,
  type ColouringBookRow,
  type ColouringBookMemberRow,
  type ColouringExportRow,
  type ColouringJobRow,
  type ColouringPageRow,
  type ColouringSourceRow,
} from './shared';

export interface BuildManifestOptions {
  book: ColouringBookRow;
  sources: ColouringSourceRow[];
  pages: ColouringPageRow[];
  exports: ColouringExportRow[];
  members: ColouringBookMemberRow[];
  jobs: ColouringJobRow[];
  userId: string | null;
  includeSources?: boolean;
  signUrl: (key: string) => Promise<string | null>;
}

function mapPage(page: ColouringPageRow, signUrl: (key: string) => Promise<string | null>): Promise<ColouringBookManifestPage> {
  return Promise.all([
    page.svg_key ? signUrl(page.svg_key) : Promise.resolve(null),
    page.png_key ? signUrl(page.png_key) : Promise.resolve(null),
    page.thumbnail_key ? signUrl(page.thumbnail_key) : Promise.resolve(null),
  ]).then(([svgUrl, pngUrl, thumbnailUrl]) => ({
    id: page.id,
    pageNumber: page.page_number,
    status: page.status,
    svgKey: page.svg_key,
    pngKey: page.png_key,
    thumbnailKey: page.thumbnail_key,
    svgUrl,
    pngUrl,
    thumbnailUrl,
    complexityScore: page.complexity_score,
    sharpnessScore: page.sharpness_score,
    perceptualHash: page.perceptual_hash,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    readyAt: page.ready_at,
    errorMessage: page.error_message,
  }));
}

function mapSource(source: ColouringSourceRow): ColouringBookManifestSource {
  return {
    id: source.id,
    sortOrder: source.sort_order,
    status: source.status,
    originalFilename: source.original_filename,
    mimeType: source.mime_type,
    byteSize: source.byte_size,
    sha256: source.sha256,
    perceptualHash: source.perceptual_hash,
    duplicateOfSourceId: source.duplicate_of_source_id,
    width: source.width,
    height: source.height,
    committedAt: source.committed_at,
    processedAt: source.processed_at,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
    errorMessage: source.error_message,
  };
}

async function mapExport(
  exportRow: ColouringExportRow,
  signUrl: (key: string) => Promise<string | null>
): Promise<ColouringBookManifestExport> {
  return {
    id: exportRow.id,
    status: exportRow.status,
    scope: 'book',
    r2Key: exportRow.r2_key,
    mimeType: exportRow.mime_type,
    byteSize: exportRow.byte_size,
    pageCount: exportRow.page_count,
    downloadUrl: exportRow.r2_key ? await signUrl(exportRow.r2_key) : null,
    createdAt: exportRow.created_at,
    updatedAt: exportRow.updated_at,
    readyAt: exportRow.ready_at,
    errorMessage: exportRow.error_message,
    jobId: exportRow.job_id,
  };
}

export async function buildColouringBookManifest(
  options: BuildManifestOptions
): Promise<ColouringBookManifest> {
  const accessRole = options.userId
    ? options.book.owner_id === options.userId
      ? 'owner'
      : options.members.find((member) => member.user_id === options.userId && member.status === 'active')?.role || 'none'
    : 'none';
  const isOwner = options.userId === options.book.owner_id;
  const isMember = isOwner || accessRole !== 'none';
  const canEdit = isOwner || accessRole === 'editor';

  const [pageEntries, exportEntries] = await Promise.all([
    Promise.all(options.pages.map((page) => mapPage(page, options.signUrl))),
    Promise.all(options.exports.map((exportRow) => mapExport(exportRow, options.signUrl))),
  ]);

  return {
    book: {
      id: options.book.id,
      owner_id: options.book.owner_id,
      title: options.book.title,
      description: options.book.description,
      status: options.book.status,
      visibility: options.book.visibility,
      paper_size: options.book.paper_size,
      orientation: options.book.orientation,
      metadata: options.book.metadata,
      page_count: options.book.page_count,
      source_count: options.book.source_count,
      ready_page_count: options.book.ready_page_count,
      last_job_id: options.book.last_job_id,
      created_at: options.book.created_at,
      updated_at: options.book.updated_at,
      processed_at: options.book.processed_at,
      archived_at: options.book.archived_at,
    },
    access: {
      userId: options.userId,
      role: accessRole,
      isOwner,
      isMember,
      canEdit,
    },
    sources: options.includeSources ? options.sources.map(mapSource) : [],
    pages: pageEntries,
    exports: exportEntries,
    members: options.members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      role: member.role,
      status: member.status,
      joinedAt: member.joined_at,
      revokedAt: member.revoked_at,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
    })),
    jobs: options.jobs.map((job) => ({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      runAfter: job.run_after,
      claimedBy: job.claimed_by,
      claimedAt: job.claimed_at,
      heartbeatAt: job.heartbeat_at,
      queuedAt: job.queued_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      failedAt: job.failed_at,
      updatedAt: job.updated_at,
      error: job.error,
    })),
    generatedAt: new Date().toISOString(),
  };
}
