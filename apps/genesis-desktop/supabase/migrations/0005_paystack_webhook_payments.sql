-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

-- Paystack webhook storage and recurring access state.
-- Keeps the existing profile-driven billing model, but adds a durable
-- webhook processing table for idempotency and audit/history.

alter table if exists public.profiles
  add column if not exists billing_status text not null default 'free',
  add column if not exists billing_period text,
  add column if not exists access_expires_at timestamptz,
  add column if not exists billing_updated_at timestamptz,
  add column if not exists paystack_last_event_id text,
  add column if not exists paystack_last_payment_reference text;

create table if not exists public.payments (
  id text primary key,
  event_hash text not null unique,
  event_type text not null,
  processing_status text not null default 'processing',
  payment_status text not null,
  billing_status text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  billing_period text,
  plan_code text,
  amount_kobo bigint,
  currency text,
  paystack_event_id text unique,
  paystack_reference text,
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_invoice_code text,
  access_starts_at timestamptz,
  access_expires_at timestamptz,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table if exists public.payments enable row level security;

create index if not exists payments_profile_id_idx on public.payments (profile_id);
create index if not exists payments_event_type_idx on public.payments (event_type);
create index if not exists payments_access_expires_at_idx on public.payments (access_expires_at);
