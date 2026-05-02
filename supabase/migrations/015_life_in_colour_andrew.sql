-- ============================================================================
-- 015_life_in_colour_andrew.sql
-- Andrew-backed single-page Life in Colour generations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.life_in_colour_generations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  title                text NOT NULL,
  brief                text NOT NULL,
  outline_mode         text NOT NULL CHECK (outline_mode IN ('simple', 'detailed', 'mandala')),
  source_bucket        text NOT NULL DEFAULT 'life-in-colour-sources',
  source_path          text NOT NULL,
  source_mime_type     text,
  source_file_name     text,
  generated_bucket     text,
  generated_path       text,
  generated_public_url text,
  provider             text,
  model                text,
  normalized_prompt    text,
  critique_summary     jsonb,
  quality_flags        jsonb,
  fallback_eligible    boolean NOT NULL DEFAULT true,
  error_message        text,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_life_in_colour_generations_user_created
  ON public.life_in_colour_generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_life_in_colour_generations_status
  ON public.life_in_colour_generations (status, updated_at DESC);

ALTER TABLE public.life_in_colour_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "life_in_colour_generations_select_owner" ON public.life_in_colour_generations;
DROP POLICY IF EXISTS "life_in_colour_generations_insert_owner" ON public.life_in_colour_generations;
DROP POLICY IF EXISTS "life_in_colour_generations_update_owner" ON public.life_in_colour_generations;
DROP POLICY IF EXISTS "life_in_colour_generations_delete_owner" ON public.life_in_colour_generations;

CREATE POLICY "life_in_colour_generations_select_owner"
  ON public.life_in_colour_generations
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "life_in_colour_generations_insert_owner"
  ON public.life_in_colour_generations
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "life_in_colour_generations_update_owner"
  ON public.life_in_colour_generations
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "life_in_colour_generations_delete_owner"
  ON public.life_in_colour_generations
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('life-in-colour-sources', 'life-in-colour-sources', false),
  ('life-in-colour-pages', 'life-in-colour-pages', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Life in Colour source insert own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source select own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source update own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source delete own" ON storage.objects;

CREATE POLICY "Life in Colour source insert own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'life-in-colour-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source select own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'life-in-colour-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'life-in-colour-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'life-in-colour-sources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP TRIGGER IF EXISTS trg_life_in_colour_generations_updated_at ON public.life_in_colour_generations;
CREATE TRIGGER trg_life_in_colour_generations_updated_at
BEFORE UPDATE ON public.life_in_colour_generations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.life_in_colour_generations;
