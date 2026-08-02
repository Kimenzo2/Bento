-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

-- Paystack billing support
-- Adds the subscription fields used by the desktop app and the Paystack webhook.

alter table if exists public.profiles
  add column if not exists paystack_customer_id text,
  add column if not exists paystack_subscription_id text,
  add column if not exists paystack_authorization_code text,
  add column if not exists paystack_email_token text,
  add column if not exists paystack_plan_code text,
  add column if not exists paystack_last4 text,
  add column if not exists paystack_card_type text,
  add column if not exists paystack_card_expiry text,
  add column if not exists paystack_next_payment_at timestamptz,
  add column if not exists paystack_last_event_at timestamptz;

create table if not exists public.paystack_webhook_events (
  event_hash text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table if exists public.paystack_webhook_events enable row level security;

