-- Currency-aware Paystack checkout support.
-- Adds expected currency and amount columns to the checkout intents table
-- so the webhook can verify payments match the intended local-currency amount.

alter table if exists public.paystack_checkout_intents
  add column if not exists expected_currency text not null default 'USD',
  add column if not exists expected_amount_smallest_unit bigint not null default 0;
