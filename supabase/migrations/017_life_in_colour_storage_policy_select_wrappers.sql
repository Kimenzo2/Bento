-- ============================================================================
-- 017_life_in_colour_storage_policy_select_wrappers.sql
-- Normalize Life in Colour storage RLS predicates to use SELECT wrappers
-- ============================================================================

DROP POLICY IF EXISTS "Life in Colour source insert own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source select own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source update own" ON storage.objects;
DROP POLICY IF EXISTS "Life in Colour source delete own" ON storage.objects;

CREATE POLICY "Life in Colour source insert own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'life-in-colour-sources'
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source select own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'life-in-colour-sources'
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'life-in-colour-sources'
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Life in Colour source delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'life-in-colour-sources'
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);
