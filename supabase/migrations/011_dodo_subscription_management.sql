-- 011_dodo_subscription_management.sql
-- Description: Ensure subscription management columns exist on profiles and create
--              the downgrade_to_spark RPC function used by the Dodo webhook handler.
--
-- NOTE: The profiles table already has these columns from the legacy schema:
--   subscription_status, subscription_plan_code, subscription_end_date, cancel_at_period_end
-- This migration is safe to re-run (IF NOT EXISTS / OR REPLACE).

-- ─── Ensure subscription tracking columns exist ───────────────────────────────
-- These columns already exist in the live DB; ADD COLUMN IF NOT EXISTS is a no-op.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Index for finding users with expiring subscriptions (cron job / scheduled task)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_end_date
  ON profiles(subscription_end_date)
  WHERE subscription_end_date IS NOT NULL
    AND subscription_status = 'cancelled'
    AND cancel_at_period_end = TRUE;

-- ─── downgrade_to_spark RPC ─────────────────────────────────────────────────────
-- Called by the Dodo webhook handler on immediate cancellation or refund.
-- Resets the user back to SPARK tier and clears subscription fields.

CREATE OR REPLACE FUNCTION downgrade_to_spark(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET
    user_tier              = 'SPARK',
    subscription_status    = 'inactive',
    subscription_plan_code = NULL,
    subscription_end_date  = NULL,
    cancel_at_period_end   = FALSE,
    dodo_subscription_id   = NULL,
    payment_provider       = 'none',
    updated_at             = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ─── get_today_upgrade_count RPC ────────────────────────────────────────────────
-- Used by ProRevealMoment.tsx LiveUpgradeCounter for social proof.
-- Counts successful payments logged today.

CREATE OR REPLACE FUNCTION get_today_upgrade_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM payment_history
  WHERE status = 'succeeded'
    AND created_at >= CURRENT_DATE;
$$;

-- ─── ROLLBACK (run manually if reverting) ────────────────────────────────────────
-- DROP FUNCTION IF EXISTS downgrade_to_spark(UUID);
-- DROP FUNCTION IF EXISTS get_today_upgrade_count();
-- DROP INDEX IF EXISTS idx_profiles_subscription_end_date;
