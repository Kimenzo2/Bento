import { createPublicHandler, type ApiContext } from './_middleware';
import {
  getBookById,
  getColouringSupabaseAdmin,
  getExportById,
  getInviteByTokenHash,
} from '../lib/colouring-books/supabase';
import { createSignedR2GetUrl } from '../lib/colouring-books/r2';
import { hashToken, type ColouringInviteRow } from '../lib/colouring-books/shared';

type JsonRecord = Record<string, unknown>;

function getDb() {
  return getColouringSupabaseAdmin();
}

function resolveAction(ctx: ApiContext, body: JsonRecord): string {
  if (typeof ctx.req.query.action === 'string' && ctx.req.query.action.trim()) {
    return ctx.req.query.action.trim();
  }

  if (typeof body.action === 'string' && body.action.trim()) {
    return body.action.trim();
  }

  return 'resolve';
}

function resolveToken(ctx: ApiContext, body: JsonRecord): string | undefined {
  if (typeof ctx.req.query.token === 'string' && ctx.req.query.token.trim()) {
    return ctx.req.query.token.trim();
  }
  if (typeof body.token === 'string' && body.token.trim()) {
    return body.token.trim();
  }
  return undefined;
}

function inviteIsExpired(invite: ColouringInviteRow): boolean {
  return invite.revoked_at !== null || new Date(invite.expires_at).getTime() <= Date.now() || invite.use_count >= invite.max_uses;
}

async function handleResolve(ctx: ApiContext, body: JsonRecord): Promise<unknown> {
  const { res } = ctx;
  const db = getDb();
  const token = resolveToken(ctx, body);

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const invite = await getInviteByTokenHash(db, hashToken(token));
  if (!invite) {
    return res.status(404).json({ error: 'Share link not found' });
  }

  if (invite.scope !== 'export') {
    return res.status(400).json({ error: 'This share link is not an export link' });
  }

  if (inviteIsExpired(invite)) {
    return res.status(410).json({ error: 'Share link expired or revoked' });
  }

  const exportRow = invite.export_id ? await getExportById(db, invite.export_id) : null;
  if (!exportRow || exportRow.status !== 'ready' || !exportRow.r2_key) {
    return res.status(409).json({ error: 'Export is not ready yet' });
  }

  const book = await getBookById(db, invite.book_id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const { data: consumedInvite, error: consumeError } = await db
    .from('colouring_invites')
    .update({
      use_count: invite.use_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .lt('use_count', invite.max_uses)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();

  if (consumeError) {
    return res.status(500).json({ error: consumeError.message });
  }
  if (!consumedInvite) {
    return res.status(410).json({ error: 'Share link expired or revoked' });
  }

  let downloadUrl: string | null = null;
  try {
    downloadUrl = createSignedR2GetUrl(exportRow.r2_key, 900);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to sign export download URL',
    });
  }

  return res.status(200).json({
    invite: {
      id: invite.id,
      bookId: invite.book_id,
      scope: invite.scope,
      role: invite.role,
      tokenPrefix: invite.token_prefix,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      useCount: invite.use_count + 1,
    },
    book: {
      id: book.id,
      title: book.title,
      description: book.description,
      status: book.status,
      visibility: book.visibility,
      pageCount: book.page_count,
      readyPageCount: book.ready_page_count,
      createdAt: book.created_at,
      updatedAt: book.updated_at,
    },
    export: {
      id: exportRow.id,
      status: exportRow.status,
      mimeType: exportRow.mime_type,
      byteSize: exportRow.byte_size,
      pageCount: exportRow.page_count,
      downloadUrl,
      createdAt: exportRow.created_at,
      updatedAt: exportRow.updated_at,
      readyAt: exportRow.ready_at,
    },
  });
}

export default createPublicHandler(async (ctx: ApiContext) => {
  const body = (ctx.req.body && typeof ctx.req.body === 'object' ? ctx.req.body : {}) as JsonRecord;
  const action = resolveAction(ctx, body);

  switch (action) {
    case 'resolve':
    case 'download':
      return handleResolve(ctx, body);
    default:
      return ctx.res.status(400).json({
        error: 'Unknown colouring-books share action',
        action,
      });
  }
});
