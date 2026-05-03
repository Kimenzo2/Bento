# Copilot Instructions for Genesis

Read and obey all rules in `AGENTS.md` at the project root before making any changes.

## Critical: Payment System is LOCKED

The Dodo Payments integration is live in production processing real money. The following constraints are non-negotiable:

### Do NOT modify these files without explicit owner approval:

- `api/dodo.ts` — Dodo Payments server (checkout + webhook handler)
- `vercel.json` — Webhook routing and `trailingSlash: false` setting
- `supabase/migrations/007_add_dodo_payments.sql`
- `supabase/migrations/009_payment_history.sql`
- `supabase/migrations/011_dodo_subscription_management.sql`
- `supabase/migrations/012_dodo_profile_reconciliation.sql`
- `services/dodoService.ts`
- `components/PaymentCallback.tsx`
- `components/onboarding/ProRevealMoment.tsx`

### Rules that prevent production outages:

1. `vercel.json` > `trailingSlash` must be `false`. `true` causes 308 redirects that kill webhook POST bodies.
2. Never import `_middleware.ts` in API route files. It imports ESM-only `jose` and crashes the function.
3. Never add Paystack references. The sole payment provider is Dodo.
4. Never drop/rename columns in `profiles`, `payment_history`, or `processed_webhooks` referenced by `api/dodo.ts`.
5. RLS policies must use `(SELECT auth.uid())` not bare `auth.uid()`.
6. `api/dodo.ts` > `bodyParser` must be `false`. Webhook signature verification needs the raw body.

### Database columns used by live webhooks (do not rename/drop):

- profiles: `user_tier`, `subscription_status`, `subscription_plan_code`, `subscription_end_date`, `cancel_at_period_end`, `dodo_customer_id`, `dodo_subscription_id`, `payment_provider`
- payment_history: `user_id`, `provider`, `payment_id`, `subscription_id`, `amount`, `currency`, `plan`, `status`, `event_type`, `metadata`
- processed_webhooks: `webhook_id`, `event_type`, `processed_at`, `payload`

For full architecture and schema details, see `AGENTS.md`.
