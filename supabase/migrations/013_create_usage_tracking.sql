-- ============================================================
-- 013_create_usage_tracking.sql
-- Monthly book creation usage tracking per user.
-- Source of truth for tier limit enforcement.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       text        NOT NULL,  -- Format: YYYY-MM
  books_created integer   NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usage_tracking_user_month_uq UNIQUE (user_id, month)
);

-- Index for fast lookups by user + month
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month
  ON public.usage_tracking (user_id, month);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read own usage"
  ON public.usage_tracking
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- No client INSERT/UPDATE/DELETE — only service role writes
-- (service_role bypasses RLS automatically)

-- ── Server-side increment function ───────────────────────────
-- Atomic upsert: inserts a new row or increments books_created.
-- Called from the Edge Function or webhook handler.

CREATE OR REPLACE FUNCTION public.increment_book_usage(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
  v_new_count integer;
BEGIN
  v_month := to_char(now(), 'YYYY-MM');

  INSERT INTO public.usage_tracking (user_id, month, books_created)
  VALUES (p_user_id, v_month, 1)
  ON CONFLICT (user_id, month) DO UPDATE
    SET books_created = usage_tracking.books_created + 1,
        updated_at = now()
  RETURNING books_created INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- ── Read current month usage function ────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_month_usage(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT books_created INTO v_count
  FROM public.usage_tracking
  WHERE user_id = p_user_id
    AND month = to_char(now(), 'YYYY-MM');

  RETURN COALESCE(v_count, 0);
END;
$$;
