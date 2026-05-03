import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  COLOURING_ORIGINALS_BUCKET,
  getColouringEnv,
  type ColouringBookAccess,
  type ColouringBookRow,
  type ColouringBookMemberRow,
  type ColouringExportRow,
  type ColouringInviteRow,
  type ColouringJobRow,
  type ColouringPageRow,
  type ColouringSourceRow,
} from './shared';

let adminClient: SupabaseClient | null | undefined;

function buildAdminClient(): SupabaseClient {
  const supabaseUrl = getColouringEnv('SUPABASE_URL') || getColouringEnv('VITE_SUPABASE_URL');
  const supabaseServiceKey =
    getColouringEnv('SUPABASE_SERVICE_ROLE_KEY') || getColouringEnv('SUPABASE_SECRET_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getColouringSupabaseAdmin(): SupabaseClient {
  if (adminClient !== undefined) {
    return adminClient as SupabaseClient;
  }

  try {
    adminClient = buildAdminClient();
    return adminClient;
  } catch (error) {
    adminClient = null;
    throw error;
  }
}

export async function getBookAccess(
  db: SupabaseClient,
  bookId: string,
  userId: string
): Promise<ColouringBookAccess> {
  const [bookResult, memberResult] = await Promise.all([
    db.from('colouring_books').select('*').eq('id', bookId).maybeSingle<ColouringBookRow>(),
    db
      .from('colouring_book_members')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .maybeSingle<ColouringBookMemberRow>(),
  ]);

  if (bookResult.error) {
    throw new Error(bookResult.error.message);
  }

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  const book = bookResult.data ?? null;
  const membership = memberResult.data ?? null;
  const isOwner = book?.owner_id === userId;
  const isMember = Boolean(
    membership?.status === 'active' || membership?.status === 'pending' || isOwner
  );
  const canEdit = Boolean(isOwner || membership?.role === 'editor');

  return { book, membership, isOwner, isMember, canEdit };
}

export async function getBookManifestSnapshot(
  db: SupabaseClient,
  bookId: string
): Promise<{
  book: ColouringBookRow | null;
  sources: ColouringSourceRow[];
  pages: ColouringPageRow[];
  exports: ColouringExportRow[];
  members: ColouringBookMemberRow[];
  jobs: ColouringJobRow[];
}> {
  const [book, sources, pages, exportsData, members, jobs] = await Promise.all([
    db.from('colouring_books').select('*').eq('id', bookId).maybeSingle<ColouringBookRow>(),
    db
      .from('colouring_sources')
      .select('*')
      .eq('book_id', bookId)
      .order('sort_order', { ascending: true })
      .returns<ColouringSourceRow[]>(),
    db
      .from('colouring_pages')
      .select('*')
      .eq('book_id', bookId)
      .order('page_number', { ascending: true })
      .returns<ColouringPageRow[]>(),
    db
      .from('colouring_exports')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
      .returns<ColouringExportRow[]>(),
    db
      .from('colouring_book_members')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true })
      .returns<ColouringBookMemberRow[]>(),
    db
      .from('colouring_jobs')
      .select('*')
      .eq('book_id', bookId)
      .order('queued_at', { ascending: false })
      .limit(12)
      .returns<ColouringJobRow[]>(),
  ]);

  if (book.error) throw new Error(book.error.message);
  if (sources.error) throw new Error(sources.error.message);
  if (pages.error) throw new Error(pages.error.message);
  if (exportsData.error) throw new Error(exportsData.error.message);
  if (members.error) throw new Error(members.error.message);
  if (jobs.error) throw new Error(jobs.error.message);

  return {
    book: book.data ?? null,
    sources: sources.data ?? [],
    pages: pages.data ?? [],
    exports: exportsData.data ?? [],
    members: members.data ?? [],
    jobs: jobs.data ?? [],
  };
}

export async function getInviteByTokenHash(
  db: SupabaseClient,
  tokenHash: string
): Promise<ColouringInviteRow | null> {
  const { data, error } = await db
    .from('colouring_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle<ColouringInviteRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getExportById(
  db: SupabaseClient,
  exportId: string
): Promise<ColouringExportRow | null> {
  const { data, error } = await db
    .from('colouring_exports')
    .select('*')
    .eq('id', exportId)
    .maybeSingle<ColouringExportRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getBookById(
  db: SupabaseClient,
  bookId: string
): Promise<ColouringBookRow | null> {
  const { data, error } = await db
    .from('colouring_books')
    .select('*')
    .eq('id', bookId)
    .maybeSingle<ColouringBookRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function downloadStorageObjectAsBuffer(
  db: SupabaseClient,
  bucket: string,
  path: string
): Promise<Buffer> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || `Failed to download ${bucket}/${path}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createOriginalUploadUrl(
  db: SupabaseClient,
  path: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await db.storage
    .from(COLOURING_ORIGINALS_BUCKET)
    .createSignedUploadUrl(path, {
      upsert: false,
    });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create signed upload URL');
  }

  return data;
}
