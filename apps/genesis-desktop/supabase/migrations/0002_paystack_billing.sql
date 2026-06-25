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

