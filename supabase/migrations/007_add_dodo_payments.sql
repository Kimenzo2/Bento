-- 007_add_dodo_payments.sql
-- Description: Add Dodo Payments columns to profiles table.
-- Safe: All new columns are nullable with defaults — no data loss risk.

-- ─── Dodo customer tracking ────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'none'
    CHECK (payment_provider IN ('none', 'dodo'));

-- Index for Dodo customer lookups (webhook handler needs to find users by Dodo ID)
CREATE INDEX IF NOT EXISTS idx_profiles_dodo_customer_id
  ON profiles(dodo_customer_id)
  WHERE dodo_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_dodo_subscription_id
  ON profiles(dodo_subscription_id)
  WHERE dodo_subscription_id IS NOT NULL;

-- ─── ROLLBACK (run manually if reverting) ──────────────────────────────────────
-- ALTER TABLE profiles
--   DROP COLUMN IF EXISTS dodo_customer_id,
--   DROP COLUMN IF EXISTS dodo_subscription_id,
--   DROP COLUMN IF EXISTS payment_provider;
-- DROP INDEX IF EXISTS idx_profiles_dodo_customer_id;
-- DROP INDEX IF EXISTS idx_profiles_dodo_subscription_id;
