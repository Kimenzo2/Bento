-- 008_webhook_idempotency.sql
-- Description: Idempotency table for webhook processing.
-- Prevents duplicate tier grants when Dodo retries webhooks (up to 8 retries).

CREATE TABLE IF NOT EXISTS processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- Auto-cleanup index: use with a scheduled job or pg_cron to delete old rows
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_processed_at
  ON processed_webhooks(processed_at);

-- RLS: Only service role can access (webhooks are server-side only)
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON processed_webhooks
  FOR ALL
  USING (auth.role() = 'service_role');

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS processed_webhooks;
