-- 009_payment_history.sql
-- Description: Audit trail for all payment events across providers.
-- Stores both Paystack and Dodo events for complete history.

CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'dodo'
    CHECK (provider IN ('paystack', 'dodo')),
  payment_id TEXT,
  subscription_id TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'USD',
  plan TEXT
    CHECK (plan IN ('spark', 'creator', 'studio', 'empire', NULL)),
  status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user_id
  ON payment_history(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_payment_id
  ON payment_history(payment_id)
  WHERE payment_id IS NOT NULL;

-- RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own payment history
CREATE POLICY "Users can view own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (webhooks insert records)
CREATE POLICY "Service role full access"
  ON payment_history FOR ALL
  USING (auth.role() = 'service_role');

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS payment_history;
