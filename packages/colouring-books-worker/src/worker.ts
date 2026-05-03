import { randomUUID } from 'node:crypto';
import {
  analyzeBitmap,
  buildPdfBuffer,
  buildTracedPageArtifact,
  hammingDistance,
} from '../../../lib/colouring-books/processing';
import {
  createDerivedR2Key,
  type ColouringBookRow,
  type ColouringJobRow,
  type ColouringPageRow,
  type ColouringSourceRow,
} from '../../../lib/colouring-books/shared';
import { downloadBufferFromR2, uploadBufferToR2 } from '../../../lib/colouring-books/r2';
import {
  downloadStorageObjectAsBuffer,
  getBookManifestSnapshot,
  getColouringSupabaseAdmin,
} from '../../../lib/colouring-books/supabase';

const db = getColouringSupabaseAdmin();
const WORKER_ID =
  process.env.COLOURING_BOOKS_WORKER_ID ||
  `colouring-books-${process.pid}-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.COLOURING_BOOKS_POLL_INTERVAL_MS || 2000);
const SOURCE_DUPLICATE_DISTANCE = Number(process.env.COLOURING_BOOKS_DUPLICATE_DISTANCE || 6);
const BASE_RETRY_DELAY_MS = Number(process.env.COLOURING_BOOKS_RETRY_DELAY_MS || 30_000);

interface JobPayload extends Record<string, unknown> {
  exportId?: string;
  pageNumbers?: number[];
  requestedBy?: string;
  reason?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asJobPayload(value: unknown): JobPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JobPayload;
}

function asPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function resolveCustomPageSize(book: ColouringBookRow): { width: number; height: number } {
  const metadata =
    book.metadata && typeof book.metadata === 'object' && !Array.isArray(book.metadata)
      ? (book.metadata as Record<string, unknown>)
      : {};

  const width = asPositiveNumber(metadata.pageWidth ?? metadata.width, 612);
  const height = asPositiveNumber(metadata.pageHeight ?? metadata.height, 792);
  return { width, height };
}

async function claimNextJob(): Promise<ColouringJobRow | null> {
  const { data, error } = await db.rpc('claim_next_colouring_job', {
    p_worker_id: WORKER_ID,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const rows = Array.isArray(data) ? data : [data];
  return (rows[0] as ColouringJobRow | undefined) ?? null;
}

async function updateJob(
  jobId: string,
  patch: Partial<ColouringJobRow> & Record<string, unknown>
): Promise<void> {
  const { error } = await db
    .from('colouring_jobs')
    .update({
      ...patch,
      updated_at: nowIso(),
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

async function markJobRetry(job: ColouringJobRow, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const canRetry = job.attempts < job.max_attempts;

  if (canRetry) {
    const backoffMs = Math.min(BASE_RETRY_DELAY_MS * Math.max(1, job.attempts), 15 * 60_000);
    await updateJob(job.id, {
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: `Retrying after error: ${message}`,
      error: message,
      claimed_by: null,
      claimed_at: null,
      heartbeat_at: null,
      run_after: new Date(Date.now() + backoffMs).toISOString(),
    } as Partial<ColouringJobRow>);

    if (job.job_type !== 'export_pdf') {
      await db
        .from('colouring_books')
        .update({
          status: 'queued',
        })
        .eq('id', job.book_id);
    }
    return;
  }

  await updateJob(job.id, {
    status: 'failed',
    stage: 'failed',
    progress: 0,
    message,
    error: message,
    failed_at: nowIso(),
    completed_at: nowIso(),
    claimed_by: null,
    heartbeat_at: null,
  } as Partial<ColouringJobRow>);

  if (job.job_type !== 'export_pdf') {
    await db
      .from('colouring_books')
      .update({
        status: 'failed',
        processed_at: nowIso(),
      })
      .eq('id', job.book_id);
  }
}

async function markJobComplete(
  job: ColouringJobRow,
  result: Record<string, unknown>
): Promise<void> {
  await updateJob(job.id, {
    status: 'ready',
    stage: 'ready',
    progress: 100,
    message: 'Ready',
    result,
    completed_at: nowIso(),
    heartbeat_at: null,
  } as Partial<ColouringJobRow>);
}

async function touchJob(
  jobId: string,
  stage: string,
  progress: number,
  message: string
): Promise<void> {
  await updateJob(jobId, {
    stage,
    progress: Math.max(0, Math.min(100, Math.floor(progress))),
    message,
    heartbeat_at: nowIso(),
  } as Partial<ColouringJobRow>);
}

async function processBuildJob(job: ColouringJobRow): Promise<void> {
  const snapshot = await getBookManifestSnapshot(db, job.book_id);
  if (!snapshot.book) {
    throw new Error('Book not found');
  }

  const book = snapshot.book;
  const sources = snapshot.sources
    .filter((source) => ['uploaded', 'committed', 'processing', 'ready'].includes(source.status))
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }
      return left.created_at.localeCompare(right.created_at);
    });

  if (sources.length === 0) {
    throw new Error('No committed sources available');
  }

  await updateJob(job.id, {
    stage: 'preparing',
    progress: 1,
    message: 'Preparing colouring pages',
    heartbeat_at: nowIso(),
  } as Partial<ColouringJobRow>);

  const { error: deletePagesError } = await db
    .from('colouring_pages')
    .delete()
    .eq('book_id', book.id);
  if (deletePagesError) {
    throw new Error(deletePagesError.message);
  }

  const { error: processingBookError } = await db
    .from('colouring_books')
    .update({
      status: 'processing',
      last_job_id: job.id,
    })
    .eq('id', book.id);
  if (processingBookError) {
    throw new Error(processingBookError.message);
  }

  const seenSha256 = new Map<string, string>();
  const seenHashes = new Map<string, string>();
  const acceptedPages: ColouringPageRow[] = [];
  const failedSources: Array<{ sourceId: string; error: string }> = [];
  const duplicateSources: Array<{ sourceId: string; duplicateOfSourceId: string }> = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index] as ColouringSourceRow;
    const progressBase = (index / Math.max(1, sources.length)) * 90 + 5;
    await touchJob(
      job.id,
      'processing',
      progressBase,
      `Processing source ${index + 1} of ${sources.length}`
    );

    let buffer: Buffer;
    try {
      buffer = await downloadStorageObjectAsBuffer(db, source.storage_bucket, source.storage_path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedSources.push({ sourceId: source.id, error: message });
      await db
        .from('colouring_sources')
        .update({
          status: 'failed',
          error_message: message,
          processed_at: nowIso(),
        })
        .eq('id', source.id);
      continue;
    }

    let analysis: Awaited<ReturnType<typeof analyzeBitmap>>;
    try {
      analysis = await analyzeBitmap(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedSources.push({ sourceId: source.id, error: message });
      await db
        .from('colouring_sources')
        .update({
          status: 'failed',
          error_message: message,
          processed_at: nowIso(),
        })
        .eq('id', source.id);
      continue;
    }

    const duplicateBySha = source.sha256 ? seenSha256.get(source.sha256) : undefined;
    let duplicateOfSourceId = duplicateBySha;

    if (!duplicateOfSourceId) {
      for (const [seenHash, seenSourceId] of seenHashes.entries()) {
        if (hammingDistance(seenHash, analysis.perceptualHash) <= SOURCE_DUPLICATE_DISTANCE) {
          duplicateOfSourceId = seenSourceId;
          break;
        }
      }
    }

    if (duplicateOfSourceId) {
      duplicateSources.push({ sourceId: source.id, duplicateOfSourceId });
      await db
        .from('colouring_sources')
        .update({
          status: 'duplicate',
          duplicate_of_source_id: duplicateOfSourceId,
          processed_at: nowIso(),
          error_message: 'Duplicate or near-duplicate source',
        })
        .eq('id', source.id);
      continue;
    }

    const artifact = await buildTracedPageArtifact(buffer);
    const pageNumber = acceptedPages.length + 1;
    const svgKey = createDerivedR2Key({
      userId: book.owner_id,
      bookId: book.id,
      itemId: source.id,
      kind: 'pages',
      extension: 'svg',
    });
    const previewKey = createDerivedR2Key({
      userId: book.owner_id,
      bookId: book.id,
      itemId: source.id,
      kind: 'previews',
      extension: 'png',
    });
    const thumbnailKey = createDerivedR2Key({
      userId: book.owner_id,
      bookId: book.id,
      itemId: source.id,
      kind: 'thumbnails',
      extension: 'png',
    });

    const svgUpload = await uploadBufferToR2({
      key: svgKey,
      body: Buffer.from(artifact.svg, 'utf8'),
      contentType: 'image/svg+xml',
    });
    const previewUpload = await uploadBufferToR2({
      key: previewKey,
      body: artifact.previewPng,
      contentType: 'image/png',
    });
    const thumbnailUpload = await uploadBufferToR2({
      key: thumbnailKey,
      body: artifact.thumbnailPng,
      contentType: 'image/png',
    });

    const { data: pageRow, error: pageError } = await db
      .from('colouring_pages')
      .insert({
        book_id: book.id,
        source_id: source.id,
        owner_id: book.owner_id,
        page_number: pageNumber,
        status: 'ready',
        svg_key: svgUpload.key,
        png_key: previewUpload.key,
        thumbnail_key: thumbnailUpload.key,
        svg_width: artifact.width,
        svg_height: artifact.height,
        complexity_score: artifact.analysis.entropy,
        sharpness_score: analysis.edgeDensity,
        perceptual_hash: artifact.analysis.perceptualHash,
        ready_at: nowIso(),
      })
      .select('*')
      .maybeSingle<ColouringPageRow>();

    if (pageError) {
      throw new Error(pageError.message);
    }
    if (!pageRow) {
      throw new Error('Failed to create colouring page row');
    }

    acceptedPages.push(pageRow as ColouringPageRow);
    seenHashes.set(artifact.analysis.perceptualHash, source.id);
    if (source.sha256) {
      seenSha256.set(source.sha256, source.id);
    }

    await db
      .from('colouring_sources')
      .update({
        status: 'ready',
        duplicate_of_source_id: null,
        processed_at: nowIso(),
        error_message: null,
        perceptual_hash: artifact.analysis.perceptualHash,
        width: artifact.width,
        height: artifact.height,
      })
      .eq('id', source.id);

    await touchJob(
      job.id,
      'processing',
      5 + (acceptedPages.length / sources.length) * 90,
      `Generated ${acceptedPages.length} page(s)`
    );
  }

  const pageCount = acceptedPages.length;
  const sourceCount = sources.length;

  const { error: finalBookUpdateError } = await db
    .from('colouring_books')
    .update({
      status: pageCount > 0 ? 'ready' : 'failed',
      page_count: pageCount,
      source_count: sourceCount,
      ready_page_count: pageCount,
      processed_at: nowIso(),
      last_job_id: job.id,
    })
    .eq('id', book.id);
  if (finalBookUpdateError) {
    throw new Error(finalBookUpdateError.message);
  }

  const { error: usageError } = await db.rpc('increment_colouring_usage', {
    p_user_id: book.owner_id,
    p_pages: pageCount,
  });
  if (usageError) {
    throw new Error(usageError.message);
  }

  if (pageCount === 0) {
    throw new Error('No pages could be generated from the submitted sources');
  }

  await markJobComplete(job, {
    bookId: book.id,
    pageCount,
    sourceCount,
    acceptedSourceIds: acceptedPages.map((page) => page.source_id),
    duplicateSources,
    failedSources,
  });
}

async function processExportJob(job: ColouringJobRow): Promise<void> {
  const snapshot = await getBookManifestSnapshot(db, job.book_id);
  if (!snapshot.book) {
    throw new Error('Book not found');
  }

  const book = snapshot.book;
  const payload = asJobPayload(job.payload);
  const selectedPageNumbers = Array.isArray(payload.pageNumbers)
    ? payload.pageNumbers.map((value) => asPositiveNumber(value, 0)).filter((value) => value > 0)
    : [];

  const pages = snapshot.pages
    .filter((page) => page.status === 'ready')
    .filter(
      (page) => selectedPageNumbers.length === 0 || selectedPageNumbers.includes(page.page_number)
    )
    .sort((left, right) => left.page_number - right.page_number);

  if (pages.length === 0) {
    throw new Error('No ready pages are available for export');
  }

  await updateJob(job.id, {
    stage: 'exporting',
    progress: 5,
    message: `Assembling PDF from ${pages.length} page(s)`,
    heartbeat_at: nowIso(),
  } as Partial<ColouringJobRow>);

  const customPageSize = resolveCustomPageSize(book);
  const pageInputs = await Promise.all(
    pages.map(async (page, index) => {
      if (!page.svg_key) {
        throw new Error(`Page ${page.page_number} is missing an SVG asset`);
      }

      const svgBuffer = await downloadBufferFromR2(page.svg_key);
      const svg = svgBuffer.toString('utf8');
      await touchJob(
        job.id,
        'exporting',
        10 + (index / Math.max(1, pages.length)) * 80,
        `Exporting page ${index + 1} of ${pages.length}`
      );

      return {
        svg,
        title: book.title,
        pageWidth: customPageSize.width,
        pageHeight: customPageSize.height,
        landscape: book.orientation === 'landscape',
      };
    })
  );

  const pdfBuffer = await buildPdfBuffer(pageInputs, {
    pageSize: book.paper_size,
    orientation: book.orientation,
    title: book.title,
  });

  const exportId = payload.exportId || randomUUID();
  const exportKey = createDerivedR2Key({
    userId: book.owner_id,
    bookId: book.id,
    itemId: exportId,
    kind: 'exports',
    extension: 'pdf',
  });

  const exportUpload = await uploadBufferToR2({
    key: exportKey,
    body: pdfBuffer,
    contentType: 'application/pdf',
  });

  const { error: exportUpdateError } = await db
    .from('colouring_exports')
    .update({
      job_id: job.id,
      status: 'ready',
      r2_key: exportUpload.key,
      byte_size: pdfBuffer.byteLength,
      page_count: pages.length,
      ready_at: nowIso(),
      error_message: null,
    })
    .eq('id', exportId);

  if (exportUpdateError) {
    throw new Error(exportUpdateError.message);
  }

  await markJobComplete(job, {
    bookId: book.id,
    exportId,
    pageCount: pages.length,
    r2Key: exportUpload.key,
  });
}

async function processJob(job: ColouringJobRow): Promise<void> {
  try {
    if (job.job_type === 'build_book' || job.job_type === 'retry_book') {
      await processBuildJob(job);
      return;
    }

    if (job.job_type === 'export_pdf') {
      await processExportJob(job);
      return;
    }

    throw new Error(`Unknown job type: ${job.job_type}`);
  } catch (error) {
    await markJobRetry(job, error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log(`[colouring-books-worker] starting as ${WORKER_ID}`);

  while (true) {
    try {
      const job = await claimNextJob();
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      await processJob(job);
    } catch (error) {
      console.error('[colouring-books-worker] worker loop error:', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

process.on('SIGINT', () => {
  console.log('[colouring-books-worker] received SIGINT, exiting');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[colouring-books-worker] received SIGTERM, exiting');
  process.exit(0);
});

main().catch((error) => {
  console.error('[colouring-books-worker] fatal error:', error);
  process.exit(1);
});
