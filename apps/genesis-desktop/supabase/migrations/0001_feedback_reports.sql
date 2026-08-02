-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

-- ═══════════════════════════════════════════════════════════════════════
-- BUG & FEATURE REQUEST INFRASTRUCTURE — feedback_reports
-- ═══════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor.
-- Creates the table, enables RLS, and adds real-time replication.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type              TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    severity          TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    category          TEXT CHECK (category IN ('ui', 'performance', 'new_feature', 'integration', 'other')),
    active_module     TEXT,
    app_version       TEXT NOT NULL,
    os_name           TEXT NOT NULL,
    os_version        TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'reviewing', 'in_progress',
                                            'fixed', 'planned', 'rejected', 'wont_fix')),
    developer_note    TEXT,
    github_issue_url  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_feedback_reports_user_id
    ON feedback_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_status
    ON feedback_reports(status);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at
    ON feedback_reports(created_at DESC);

-- ── Updated-at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_feedback_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trg_feedback_reports_updated_at
    ON public.feedback_reports;
CREATE TRIGGER trg_feedback_reports_updated_at
    BEFORE UPDATE ON public.feedback_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feedback_reports_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports REPLICA IDENTITY FULL;

-- Policy 1 — SELECT: users can only read their own rows
DROP POLICY IF EXISTS "Users can read own feedback" ON public.feedback_reports;
CREATE POLICY "Users can read own feedback"
    ON public.feedback_reports
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

-- Policy 2 — INSERT: authenticated users can insert with their own user_id
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback_reports;
CREATE POLICY "Users can insert own feedback"
    ON public.feedback_reports
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy 3 — UPDATE: only service_role can update (developer uses dashboard)
-- No user-facing update policy — users never edit submitted reports.

GRANT SELECT, INSERT ON public.feedback_reports TO authenticated;

REVOKE ALL ON FUNCTION public.update_feedback_reports_updated_at() FROM PUBLIC, anon, authenticated;

-- ── Realtime (for live status updates) ────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'feedback_reports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_reports;
    END IF;
END;
$$;

-- ── Database Webhook (for Edge Function trigger) ─────────────────────
-- Set app.feedback_function_jwt to your Supabase anon/publishable JWT before
-- applying this migration in a fresh environment:
--   ALTER DATABASE postgres SET app.feedback_function_jwt = '<anon-or-publishable-jwt>';

CREATE OR REPLACE FUNCTION public.invoke_create_github_issue_for_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
    function_jwt text := current_setting('app.feedback_function_jwt', true);
BEGIN
    IF function_jwt IS NULL OR length(function_jwt) = 0 THEN
        RAISE WARNING 'feedback GitHub issue trigger skipped: app.feedback_function_jwt is not configured';
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url := 'https://qjjocfnqwtccuxbnoult.supabase.co/functions/v1/create-github-issue',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || function_jwt
        ),
        body := jsonb_build_object(
            'type', 'INSERT',
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', to_jsonb(NEW)
        ),
        timeout_milliseconds := 5000
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_reports_create_github_issue
    ON public.feedback_reports;
CREATE TRIGGER trg_feedback_reports_create_github_issue
    AFTER INSERT ON public.feedback_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.invoke_create_github_issue_for_feedback();

REVOKE ALL ON FUNCTION public.invoke_create_github_issue_for_feedback() FROM PUBLIC, anon, authenticated;
