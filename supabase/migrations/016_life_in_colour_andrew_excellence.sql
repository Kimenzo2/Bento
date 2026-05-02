-- ============================================================================
-- 016_life_in_colour_andrew_excellence.sql
-- Expanded Andrew metadata for source analysis, prompt versioning, and retries
-- ============================================================================

ALTER TABLE public.life_in_colour_generations
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT 'andrew-v2',
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_model text,
  ADD COLUMN IF NOT EXISTS render_model text,
  ADD COLUMN IF NOT EXISTS source_analysis_summary jsonb;

UPDATE public.life_in_colour_generations
SET
  prompt_version = COALESCE(prompt_version, 'andrew-v2'),
  retry_count = COALESCE(retry_count, 0)
WHERE prompt_version IS NULL OR retry_count IS NULL;

