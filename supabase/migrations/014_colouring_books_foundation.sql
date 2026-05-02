-- ============================================================================
-- 014_colouring_books_foundation.sql
-- Colouring Books backend foundation:
-- - private originals bucket
-- - durable job queue
-- - invite-based family sharing
-- - usage tracking
-- - deterministic processing RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Helper trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Core tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.colouring_books (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'uploading', 'queued', 'processing', 'ready', 'failed', 'archived')),
  visibility        text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'family', 'shared')),
  paper_size        text NOT NULL DEFAULT 'letter' CHECK (paper_size IN ('letter', 'a4', 'custom')),
  orientation       text NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_count        integer NOT NULL DEFAULT 0,
  source_count      integer NOT NULL DEFAULT 0,
  ready_page_count   integer NOT NULL DEFAULT 0,
  last_job_id       uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  archived_at       timestamptz
);

CREATE TABLE IF NOT EXISTS public.colouring_sources (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id                uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  owner_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket         text NOT NULL DEFAULT 'colouring-originals',
  storage_path           text NOT NULL,
  original_filename      text,
  mime_type              text,
  byte_size              bigint,
  sha256                 text,
  perceptual_hash        text,
  duplicate_of_source_id uuid REFERENCES public.colouring_sources(id) ON DELETE SET NULL,
  width                  integer,
  height                 integer,
  sort_order             integer NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'uploaded', 'committed', 'processing', 'ready', 'duplicate', 'rejected', 'failed')),
  committed_at           timestamptz,
  processed_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  error_message          text
);

CREATE TABLE IF NOT EXISTS public.colouring_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  source_id         uuid NOT NULL REFERENCES public.colouring_sources(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number       integer NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'skipped')),
  svg_key           text,
  png_key           text,
  thumbnail_key     text,
  svg_width         integer,
  svg_height        integer,
  complexity_score  numeric(6, 3),
  sharpness_score    numeric(6, 3),
  perceptual_hash   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  ready_at          timestamptz,
  error_message     text,
  CONSTRAINT colouring_pages_source_uq UNIQUE (source_id),
  CONSTRAINT colouring_pages_book_page_uq UNIQUE (book_id, page_number)
);

CREATE TABLE IF NOT EXISTS public.colouring_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type        text NOT NULL CHECK (job_type IN ('build_book', 'retry_book', 'export_pdf')),
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'cancelled')),
  stage           text NOT NULL DEFAULT 'queued',
  progress        integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message         text NOT NULL DEFAULT '',
  priority        integer NOT NULL DEFAULT 0,
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  claimed_by      text,
  claimed_at      timestamptz,
  heartbeat_at    timestamptz,
  run_after       timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  result          jsonb,
  error           text,
  queued_at       timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  failed_at       timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.colouring_book_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  added_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id   uuid,
  joined_at   timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT colouring_book_members_book_user_uq UNIQUE (book_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.colouring_exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES public.colouring_jobs(id) ON DELETE SET NULL,
  scope         text NOT NULL DEFAULT 'book' CHECK (scope IN ('book', 'export')),
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'cancelled')),
  r2_key        text,
  mime_type     text NOT NULL DEFAULT 'application/pdf',
  byte_size     bigint,
  page_count    integer NOT NULL DEFAULT 0,
  options       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  ready_at      timestamptz,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.colouring_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       uuid NOT NULL REFERENCES public.colouring_books(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope         text NOT NULL DEFAULT 'book' CHECK (scope IN ('book', 'export')),
  role          text NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
  export_id     uuid REFERENCES public.colouring_exports(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  token_prefix  text NOT NULL,
  max_uses      integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count     integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  accepted_at   timestamptz,
  accepted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.colouring_book_members
  ADD CONSTRAINT colouring_book_members_invite_fk
  FOREIGN KEY (invite_id) REFERENCES public.colouring_invites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.colouring_usage_tracking (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month             text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  books_created     integer NOT NULL DEFAULT 0,
  sources_uploaded  integer NOT NULL DEFAULT 0,
  pages_processed   integer NOT NULL DEFAULT 0,
  exports_created   integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT colouring_usage_tracking_user_month_uq UNIQUE (user_id, month)
);

ALTER TABLE public.colouring_books
  ADD CONSTRAINT colouring_books_last_job_fk
  FOREIGN KEY (last_job_id) REFERENCES public.colouring_jobs(id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_colouring_books_owner_created
  ON public.colouring_books (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_colouring_books_status
  ON public.colouring_books (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_colouring_books_metadata_gin
  ON public.colouring_books USING GIN (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_colouring_sources_book_order
  ON public.colouring_sources (book_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_colouring_sources_book_status
  ON public.colouring_sources (book_id, status);

CREATE INDEX IF NOT EXISTS idx_colouring_sources_book_hash
  ON public.colouring_sources (book_id, sha256);

CREATE INDEX IF NOT EXISTS idx_colouring_sources_perceptual_hash
  ON public.colouring_sources (perceptual_hash);

CREATE INDEX IF NOT EXISTS idx_colouring_pages_book_page
  ON public.colouring_pages (book_id, page_number ASC);

CREATE INDEX IF NOT EXISTS idx_colouring_pages_source
  ON public.colouring_pages (source_id);

CREATE INDEX IF NOT EXISTS idx_colouring_pages_book_status
  ON public.colouring_pages (book_id, status);

CREATE INDEX IF NOT EXISTS idx_colouring_jobs_active
  ON public.colouring_jobs (status, run_after ASC, priority DESC, queued_at ASC);

CREATE INDEX IF NOT EXISTS idx_colouring_jobs_processing_heartbeat
  ON public.colouring_jobs (heartbeat_at ASC)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_colouring_jobs_book_type
  ON public.colouring_jobs (book_id, job_type, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_colouring_jobs_payload_gin
  ON public.colouring_jobs USING GIN (payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_colouring_members_book_user
  ON public.colouring_book_members (book_id, user_id);

CREATE INDEX IF NOT EXISTS idx_colouring_members_user_status
  ON public.colouring_book_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_colouring_exports_book_created
  ON public.colouring_exports (book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_colouring_exports_job
  ON public.colouring_exports (job_id);

CREATE INDEX IF NOT EXISTS idx_colouring_exports_book_status
  ON public.colouring_exports (book_id, status);

CREATE INDEX IF NOT EXISTS idx_colouring_exports_options_gin
  ON public.colouring_exports USING GIN (options jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_colouring_invites_book_created_by
  ON public.colouring_invites (book_id, created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_colouring_invites_expires
  ON public.colouring_invites (expires_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_colouring_invites_scope
  ON public.colouring_invites (scope, token_hash);

CREATE INDEX IF NOT EXISTS idx_colouring_usage_user_month
  ON public.colouring_usage_tracking (user_id, month);

-- Partial unique index prevents duplicate active jobs for the same book.
CREATE UNIQUE INDEX IF NOT EXISTS uq_colouring_jobs_active_book_type
  ON public.colouring_jobs (book_id)
  WHERE status IN ('queued', 'processing');

-- ============================================================================
-- Row-level security
-- ============================================================================

ALTER TABLE public.colouring_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_book_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colouring_usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colouring_books_select_access" ON public.colouring_books;
DROP POLICY IF EXISTS "colouring_books_insert_owner" ON public.colouring_books;
DROP POLICY IF EXISTS "colouring_books_update_owner_or_editor" ON public.colouring_books;
DROP POLICY IF EXISTS "colouring_books_delete_owner" ON public.colouring_books;

CREATE POLICY "colouring_books_select_access"
  ON public.colouring_books
  FOR SELECT
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.colouring_book_members m
      WHERE m.book_id = id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

CREATE POLICY "colouring_books_insert_owner"
  ON public.colouring_books
  FOR INSERT
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "colouring_books_update_owner_or_editor"
  ON public.colouring_books
  FOR UPDATE
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.colouring_book_members m
      WHERE m.book_id = id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role = 'editor'
    )
  );

CREATE POLICY "colouring_books_delete_owner"
  ON public.colouring_books
  FOR DELETE
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "colouring_sources_select_owner" ON public.colouring_sources;
DROP POLICY IF EXISTS "colouring_sources_insert_owner" ON public.colouring_sources;
DROP POLICY IF EXISTS "colouring_sources_update_owner" ON public.colouring_sources;
DROP POLICY IF EXISTS "colouring_sources_delete_owner" ON public.colouring_sources;

CREATE POLICY "colouring_sources_select_owner"
  ON public.colouring_sources
  FOR SELECT
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "colouring_sources_insert_owner"
  ON public.colouring_sources
  FOR INSERT
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "colouring_sources_update_owner"
  ON public.colouring_sources
  FOR UPDATE
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "colouring_sources_delete_owner"
  ON public.colouring_sources
  FOR DELETE
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "colouring_pages_select_access" ON public.colouring_pages;
CREATE POLICY "colouring_pages_select_access"
  ON public.colouring_pages
  FOR SELECT
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.colouring_book_members m
      WHERE m.book_id = book_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "colouring_jobs_select_owner" ON public.colouring_jobs;
CREATE POLICY "colouring_jobs_select_owner"
  ON public.colouring_jobs
  FOR SELECT
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "colouring_members_select_access" ON public.colouring_book_members;
CREATE POLICY "colouring_members_select_access"
  ON public.colouring_book_members
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.colouring_books b
      WHERE b.id = book_id
        AND b.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "colouring_exports_select_access" ON public.colouring_exports;
CREATE POLICY "colouring_exports_select_access"
  ON public.colouring_exports
  FOR SELECT
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.colouring_book_members m
      WHERE m.book_id = book_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "colouring_invites_select_owner" ON public.colouring_invites;
CREATE POLICY "colouring_invites_select_owner"
  ON public.colouring_invites
  FOR SELECT
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "colouring_usage_select_owner" ON public.colouring_usage_tracking;
CREATE POLICY "colouring_usage_select_owner"
  ON public.colouring_usage_tracking
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- Storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('colouring-originals', 'colouring-originals', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Colouring originals insert own" ON storage.objects;
DROP POLICY IF EXISTS "Colouring originals select own" ON storage.objects;
DROP POLICY IF EXISTS "Colouring originals update own" ON storage.objects;
DROP POLICY IF EXISTS "Colouring originals delete own" ON storage.objects;

CREATE POLICY "Colouring originals insert own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'colouring-originals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Colouring originals select own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'colouring-originals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Colouring originals update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'colouring-originals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Colouring originals delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'colouring-originals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- RPC functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_colouring_book(
  p_owner_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_paper_size text DEFAULT 'letter',
  p_orientation text DEFAULT 'portrait',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.colouring_books
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book public.colouring_books;
  v_paper_size text;
  v_orientation text;
BEGIN
  v_paper_size := CASE
    WHEN lower(coalesce(p_paper_size, 'letter')) IN ('letter', 'a4', 'custom') THEN lower(coalesce(p_paper_size, 'letter'))
    ELSE 'letter'
  END;

  v_orientation := CASE
    WHEN lower(coalesce(p_orientation, 'portrait')) IN ('portrait', 'landscape') THEN lower(coalesce(p_orientation, 'portrait'))
    ELSE 'portrait'
  END;

  INSERT INTO public.colouring_books (
    owner_id,
    title,
    description,
    status,
    visibility,
    paper_size,
    orientation,
    metadata,
    page_count,
    source_count,
    ready_page_count,
    created_at,
    updated_at
  )
  VALUES (
    p_owner_id,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Untitled Colouring Book'),
    NULLIF(trim(coalesce(p_description, '')), ''),
    'draft',
    'private',
    v_paper_size,
    v_orientation,
    coalesce(p_metadata, '{}'::jsonb),
    0,
    0,
    0,
    now(),
    now()
  )
  RETURNING * INTO v_book;

  INSERT INTO public.colouring_book_members (
    book_id,
    user_id,
    role,
    status,
    added_by,
    joined_at,
    created_at,
    updated_at
  )
  VALUES (
    v_book.id,
    p_owner_id,
    'owner',
    'active',
    p_owner_id,
    now(),
    now(),
    now()
  )
  ON CONFLICT (book_id, user_id) DO UPDATE
    SET role = 'owner',
        status = 'active',
        revoked_at = NULL,
        joined_at = COALESCE(public.colouring_book_members.joined_at, now()),
        updated_at = now();

  RETURN v_book;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_colouring_usage(
  p_user_id uuid,
  p_books integer DEFAULT 0,
  p_sources integer DEFAULT 0,
  p_pages integer DEFAULT 0,
  p_exports integer DEFAULT 0
)
RETURNS public.colouring_usage_tracking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
  v_row public.colouring_usage_tracking;
BEGIN
  INSERT INTO public.colouring_usage_tracking (
    user_id,
    month,
    books_created,
    sources_uploaded,
    pages_processed,
    exports_created,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_month,
    GREATEST(p_books, 0),
    GREATEST(p_sources, 0),
    GREATEST(p_pages, 0),
    GREATEST(p_exports, 0),
    now(),
    now()
  )
  ON CONFLICT (user_id, month) DO UPDATE
    SET books_created = public.colouring_usage_tracking.books_created + GREATEST(p_books, 0),
        sources_uploaded = public.colouring_usage_tracking.sources_uploaded + GREATEST(p_sources, 0),
        pages_processed = public.colouring_usage_tracking.pages_processed + GREATEST(p_pages, 0),
        exports_created = public.colouring_usage_tracking.exports_created + GREATEST(p_exports, 0),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_month_colouring_usage(p_user_id uuid)
RETURNS public.colouring_usage_tracking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.colouring_usage_tracking;
BEGIN
  SELECT *
  INTO v_row
  FROM public.colouring_usage_tracking
  WHERE user_id = p_user_id
    AND month = to_char(now(), 'YYYY-MM');

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_colouring_invite(
  p_token_hash text,
  p_user_id uuid
)
RETURNS public.colouring_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.colouring_invites;
BEGIN
  SELECT *
  INTO v_invite
  FROM public.colouring_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.scope <> 'book' THEN
    RAISE EXCEPTION 'Invite is not a book invite' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite revoked' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Invite exhausted' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.colouring_book_members (
    book_id,
    user_id,
    role,
    status,
    added_by,
    invite_id,
    joined_at,
    created_at,
    updated_at
  )
  VALUES (
    v_invite.book_id,
    p_user_id,
    v_invite.role,
    'active',
    v_invite.created_by,
    v_invite.id,
    now(),
    now(),
    now()
  )
  ON CONFLICT (book_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        added_by = EXCLUDED.added_by,
        invite_id = EXCLUDED.invite_id,
        revoked_at = NULL,
        joined_at = COALESCE(public.colouring_book_members.joined_at, now()),
        updated_at = now();

  UPDATE public.colouring_invites
  SET use_count = use_count + 1,
      accepted_at = COALESCE(accepted_at, now()),
      accepted_by = COALESCE(accepted_by, p_user_id),
      last_used_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  SELECT *
  INTO v_invite
  FROM public.colouring_invites
  WHERE id = v_invite.id;

  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_colouring_job(
  p_book_id uuid,
  p_owner_id uuid,
  p_job_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 0,
  p_run_after timestamptz DEFAULT now()
)
RETURNS public.colouring_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.colouring_jobs;
BEGIN
  SELECT *
  INTO v_job
  FROM public.colouring_jobs
  WHERE book_id = p_book_id
    AND status IN ('queued', 'processing')
  ORDER BY queued_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.colouring_books
    SET last_job_id = v_job.id,
        status = CASE
          WHEN p_job_type IN ('build_book', 'retry_book') THEN 'queued'
          ELSE status
        END,
        updated_at = now()
    WHERE id = p_book_id
      AND owner_id = p_owner_id;

    RETURN v_job;
  END IF;

  INSERT INTO public.colouring_jobs (
    book_id,
    owner_id,
    job_type,
    status,
    stage,
    progress,
    message,
    priority,
    attempts,
    max_attempts,
    claimed_by,
    claimed_at,
    run_after,
    payload,
    queued_at,
    started_at,
    completed_at,
    failed_at,
    updated_at
  )
  VALUES (
    p_book_id,
    p_owner_id,
    p_job_type,
    'queued',
    'queued',
    0,
    'Queued',
    p_priority,
    0,
    3,
    NULL,
    NULL,
    coalesce(p_run_after, now()),
    coalesce(p_payload, '{}'::jsonb),
    now(),
    NULL,
    NULL,
    NULL,
    NULL,
    now()
  )
  RETURNING * INTO v_job;

  UPDATE public.colouring_books
  SET last_job_id = v_job.id,
      status = CASE
        WHEN p_job_type IN ('build_book', 'retry_book') THEN 'queued'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_book_id
    AND owner_id = p_owner_id;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_colouring_job(p_worker_id text)
RETURNS SETOF public.colouring_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH next_job AS (
    SELECT id
    FROM public.colouring_jobs
    WHERE (
      status = 'queued'
      OR (
        status = 'processing'
        AND (heartbeat_at IS NULL OR heartbeat_at < now() - interval '30 minutes')
      )
    )
      AND run_after <= now()
    ORDER BY
      CASE WHEN status = 'queued' THEN 0 ELSE 1 END,
      priority DESC,
      run_after ASC,
      queued_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.colouring_jobs j
  SET status = 'processing',
      stage = 'processing',
      progress = GREATEST(progress, 1),
      message = 'Processing',
      claimed_by = p_worker_id,
      claimed_at = now(),
      heartbeat_at = now(),
      started_at = COALESCE(started_at, now()),
      attempts = attempts + 1,
      updated_at = now()
  FROM next_job
  WHERE j.id = next_job.id
  RETURNING j.*;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trg_colouring_books_updated_at ON public.colouring_books;
CREATE TRIGGER trg_colouring_books_updated_at
BEFORE UPDATE ON public.colouring_books
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_sources_updated_at ON public.colouring_sources;
CREATE TRIGGER trg_colouring_sources_updated_at
BEFORE UPDATE ON public.colouring_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_pages_updated_at ON public.colouring_pages;
CREATE TRIGGER trg_colouring_pages_updated_at
BEFORE UPDATE ON public.colouring_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_jobs_updated_at ON public.colouring_jobs;
CREATE TRIGGER trg_colouring_jobs_updated_at
BEFORE UPDATE ON public.colouring_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_members_updated_at ON public.colouring_book_members;
CREATE TRIGGER trg_colouring_members_updated_at
BEFORE UPDATE ON public.colouring_book_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_exports_updated_at ON public.colouring_exports;
CREATE TRIGGER trg_colouring_exports_updated_at
BEFORE UPDATE ON public.colouring_exports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_invites_updated_at ON public.colouring_invites;
CREATE TRIGGER trg_colouring_invites_updated_at
BEFORE UPDATE ON public.colouring_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_colouring_usage_updated_at ON public.colouring_usage_tracking;
CREATE TRIGGER trg_colouring_usage_updated_at
BEFORE UPDATE ON public.colouring_usage_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Realtime publication
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_book_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_exports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.colouring_invites;
