-- ═══════════════════════════════════════════════════════════════════════
-- FIX: Profiles RLS infinite recursion (42P17) on UPDATE policy
-- ═══════════════════════════════════════════════════════════════════════
-- Root cause: The UPDATE policy's WITH CHECK clause queried
-- public.profiles directly, triggering RLS again → infinite recursion.
--
-- Fix: Use SECURITY DEFINER functions to read the current user_tier and
-- subscription_status without triggering RLS.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper: read user_tier bypassing RLS ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_profile_user_tier(target_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS 'SELECT user_tier FROM public.profiles WHERE id = target_id;';

-- ── Helper: read subscription_status bypassing RLS ────────────────────

CREATE OR REPLACE FUNCTION public.get_profile_subscription_status(target_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS 'SELECT subscription_status FROM public.profiles WHERE id = target_id;';

-- ── Fix the UPDATE policy ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    id = (SELECT auth.uid())
    AND (
      user_tier IS NOT DISTINCT FROM public.get_profile_user_tier((SELECT auth.uid()))
      AND subscription_status IS NOT DISTINCT FROM public.get_profile_subscription_status((SELECT auth.uid()))
    )
  );

-- ── Lock down helper functions ───────────────────────────────────────
-- Revoke from PUBLIC and anon (unauthenticated), but GRANT to authenticated
-- (the role that runs RLS policies, which call these functions).

REVOKE ALL ON FUNCTION public.get_profile_user_tier(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profile_subscription_status(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_profile_user_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_subscription_status(UUID) TO authenticated;
