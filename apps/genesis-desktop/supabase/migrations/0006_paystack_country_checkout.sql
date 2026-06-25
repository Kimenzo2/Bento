-- Country-aware Paystack checkout support.
-- Adds a rules table for supported checkout channels and an intent table
-- so the web pricing page can stay deterministic and idempotent.

alter table if exists public.profiles
  add column if not exists billing_country text,
  add column if not exists shipping_country text,
  add column if not exists last_checkout_country text,
  add column if not exists last_checkout_method text,
  add column if not exists last_checkout_intent_at timestamptz,
  add column if not exists last_checkout_reference text;

create table if not exists public.paystack_payment_method_rules (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  country_code text not null,
  channel text not null default '',
  enabled boolean not null default true,
  checkout_visible boolean not null default true,
  fallback_to_card boolean not null default false,
  sort_order integer not null default 0,
  notes text null,
  updated_at timestamptz not null default now(),
  unique (method_key, country_code)
);

create index if not exists paystack_payment_method_rules_country_code_idx
  on public.paystack_payment_method_rules (country_code);

alter table if exists public.paystack_payment_method_rules enable row level security;

create table if not exists public.paystack_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null,
  country_code text not null,
  billing_country text null,
  shipping_country text null,
  selected_method_key text not null,
  selected_channels jsonb not null default '[]'::jsonb,
  plan_code text not null,
  billing_period text not null,
  source text not null default 'web',
  payment_status text not null default 'pending',
  billing_status text not null default 'pending',
  paystack_access_code text null,
  paystack_authorization_url text null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists paystack_checkout_intents_profile_id_idx
  on public.paystack_checkout_intents (profile_id);

create index if not exists paystack_checkout_intents_country_code_idx
  on public.paystack_checkout_intents (country_code);

create index if not exists paystack_checkout_intents_payment_status_idx
  on public.paystack_checkout_intents (payment_status);

create index if not exists paystack_checkout_intents_billing_status_idx
  on public.paystack_checkout_intents (billing_status);

alter table if exists public.paystack_checkout_intents enable row level security;

insert into public.paystack_payment_method_rules (
  method_key,
  country_code,
  channel,
  enabled,
  checkout_visible,
  fallback_to_card,
  sort_order,
  notes
)
values
  ('card', '*', 'card', true, true, true, 0, 'Global card fallback'),
  ('bank', 'NG', 'bank', true, true, false, 10, 'Nigeria only'),
  ('bank_transfer', 'NG', 'bank_transfer', true, true, false, 20, 'Nigeria only'),
  ('ussd', 'NG', 'ussd', true, true, false, 30, 'Nigeria only'),
  ('dedicated_bank_account', 'NG', 'dedicated_bank_account', true, true, false, 40, 'Nigeria only'),
  ('preauth', 'NG', 'preauth', true, true, false, 50, 'Nigeria only'),
  ('payattitude', 'NG', 'payattitude', true, true, false, 60, 'Nigeria only'),
  ('pos', 'NG', 'pos', true, true, false, 70, 'Nigeria only'),
  ('mobile_money', 'GH', 'mobile_money', true, true, false, 80, 'Ghana mobile money'),
  ('mobile_money', 'CI', 'mobile_money', true, true, false, 90, 'Cote dIvoire mobile money'),
  ('mobile_money', 'KE', 'mobile_money', true, true, false, 100, 'Kenya mobile money'),
  ('qr', 'ZA', 'qr', true, true, false, 110, 'South Africa QR'),
  ('capitec_pay', 'ZA', 'capitec_pay', true, true, false, 120, 'South Africa only'),
  ('eft', 'ZA', 'eft', true, true, false, 130, 'South Africa only'),
  ('direct_debit', 'ZA', 'direct_debit', true, true, false, 140, 'South Africa only')
on conflict (method_key, country_code)
do update set
  channel = excluded.channel,
  enabled = excluded.enabled,
  checkout_visible = excluded.checkout_visible,
  fallback_to_card = excluded.fallback_to_card,
  sort_order = excluded.sort_order,
  notes = excluded.notes,
  updated_at = now();
