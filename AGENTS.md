# Genesis Codebase: AI Agent Rules

**This file is mandatory reading for every AI coding agent operating on this codebase.**
**Violation of these rules will break production payments for real users.**

---

## CRITICAL: Payment System is LOCKED

The Dodo Payments integration is **live in production** processing real money.
The following files and configurations are **FROZEN** unless the project owner
explicitly requests a change and confirms they understand the payment impact.

### Frozen Files (DO NOT MODIFY)

| File | Why it is frozen |
|---|---|
| `api/dodo.ts` | The entire Dodo Payments server — checkout, webhook handler, profile sync |
| `vercel.json` | Contains webhook/checkout rewrites and `trailingSlash: false` — changing this breaks webhooks |
| `supabase/migrations/007_add_dodo_payments.sql` | Live DB schema for payment_provider column |
| `supabase/migrations/009_payment_history.sql` | Live DB schema for payment_history table |
| `supabase/migrations/011_dodo_subscription_management.sql` | Live DB schema for subscription columns |
| `supabase/migrations/012_dodo_profile_reconciliation.sql` | Webhook trigger that syncs profiles on payment events |
| `services/dodoService.ts` | Frontend service that calls checkout endpoint |
| `components/onboarding/ProRevealMoment.tsx` | Listens to payment_history realtime for upgrade animation |
| `components/PaymentCallback.tsx` | Post-checkout redirect handler |

### Frozen Configuration Values

These values are set correctly. Changing them breaks payments:

- **`vercel.json` > `trailingSlash`** must remain `false`. Setting it to `true` causes 308 redirects that silently kill webhook POST requests from Dodo.
- **`vercel.json` > `rewrites`** for `/api/dodo-checkout` and `/api/dodo-webhook` must route to `/api/dodo?action=checkout` and `/api/dodo?action=webhook` respectively. Both with-slash and without-slash variants must exist.
- **`api/dodo.ts` > `bodyParser: false`** must remain `false`. Webhook signature verification requires the raw request body.
- **`api/dodo.ts` > `handleWebhook`** must NOT be wrapped in middleware or imported through intermediate modules that use ESM-only packages.

### Frozen Database Schema

These columns and tables are written to by the live webhook handler. Do not rename, drop, or change their types:

**`profiles` table:**
- `user_tier` (text) — CHECK: `'SPARK', 'CREATOR', 'STUDIO', 'EMPIRE'`
- `subscription_status` (text) — CHECK: `'none', 'inactive', 'active', 'cancelled', 'on_hold', 'past_due', 'payment_failed'`
- `subscription_plan_code` (text)
- `subscription_end_date` (timestamptz)
- `cancel_at_period_end` (boolean)
- `dodo_customer_id` (text)
- `dodo_subscription_id` (text)
- `payment_provider` (text) — CHECK: `'none', 'dodo'`

**`payment_history` table:**
- `user_id`, `provider`, `payment_id`, `subscription_id`, `amount`, `currency`, `plan`, `status`, `event_type`, `metadata`, `created_at`
- `provider` CHECK: `'dodo'`
- `plan` CHECK: `'spark', 'creator', 'studio', 'empire', NULL`

**`processed_webhooks` table:**
- `webhook_id`, `event_type`, `processed_at`, `payload`
- Has an AFTER INSERT trigger (`trg_processed_webhooks_dodo_profile_sync`) that calls `apply_dodo_webhook_profile_sync()` — do not drop this trigger

**RPC functions (do not drop or rename):**
- `downgrade_to_spark(p_user_id UUID)`
- `get_today_upgrade_count(p_user_id UUID)`
- `apply_dodo_webhook_profile_sync(p_event_type TEXT, p_payload JSONB)`

### Frozen Environment Variables

These Vercel env vars are configured for live Dodo payments. Do not change the variable names or their mapping:

- `DODO_PAYMENTS_API_KEY` — live mode API key
- `DODO_PAYMENTS_ENV` — must be `live_mode`
- `DODO_PAYMENTS_WEBHOOK_SECRET` — webhook signature verification
- `DODO_PRODUCT_ID_CREATOR_MONTHLY`, `DODO_PRODUCT_ID_STUDIO_MONTHLY`, `DODO_PRODUCT_ID_EMPIRE_MONTHLY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`

When adding env vars via `vercel env add`, pipe the value through `printf` (not `echo`) to avoid trailing newline corruption:
```bash
printf 'the_value' | npx vercel env add VAR_NAME production --yes
```

---

## Rules for ALL Code Changes

### 1. Never change the Dodo API method

The checkout uses `checkoutSessions.create()` (see `api/dodo.ts`). Do not change it to `subscriptions.create()` or any other method. The current method is tested and working in production.

### 2. Never add `trailingSlash: true` to vercel.json

This causes Vercel to issue 308 redirects on webhook URLs, which silently drops the POST body. Dodo's webhook client does not follow redirects. This was the root cause of a production outage.

### 3. Never import _middleware.ts in api/dodo.ts

The `_middleware.ts` file imports `jose` which is ESM-only. A static import at module level crashes the entire serverless function before any handler code runs, causing `FUNCTION_INVOCATION_FAILED` on every request.

### 4. Never add Paystack references back

Paystack has been fully removed. The payment provider is Dodo. Do not:
- Add `paystack` to any CHECK constraint
- Create columns with `paystack_` prefix
- Import Paystack SDKs
- Add `VITE_PAYSTACK_PUBLIC_KEY` back to env vars

### 5. Preserve RLS policy performance patterns

All RLS policies use `(SELECT auth.uid())` and `(SELECT auth.role())` with the `SELECT` wrapper for performance. Do not rewrite these as bare `auth.uid()` or `auth.role()` calls — that evaluates per-row instead of once per query.

### 6. Database changes require verification

Before modifying any migration file or running SQL against production:
- Verify the column/table is not referenced in `api/dodo.ts`
- Verify it is not referenced in `supabase/migrations/012_dodo_profile_reconciliation.sql`
- Verify the CHECK constraints allow all values the webhook handler writes
- Never run `DROP TABLE`, `DROP COLUMN`, or `ALTER TYPE` on payment-related tables without explicit owner approval

### 7. Autovacuum settings are tuned

`profiles` and `user_gamification` have custom autovacuum thresholds. Do not reset table storage parameters on these tables.

---

## Architecture Quick Reference

```
Frontend (React SPA)
  |
  |-- POST /api/dodo-checkout  -->  vercel.json rewrite  -->  api/dodo.ts?action=checkout
  |                                                            |
  |                                                            |- verifies JWT (jose or Supabase Auth API)
  |                                                            |- calls Dodo checkoutSessions.create()
  |                                                            |- returns checkout_url to frontend
  |
  |-- (user pays on Dodo hosted page)
  |
  |-- Dodo sends POST /api/dodo-webhook  -->  vercel.json rewrite  -->  api/dodo.ts?action=webhook
                                                                         |
                                                                         |- verifies signature (webhooks.unwrap)
                                                                         |- deduplicates via processed_webhooks
                                                                         |- updates profiles table
                                                                         |- inserts into payment_history
                                                                         |- inserts into processed_webhooks
                                                                         |- trigger fires apply_dodo_webhook_profile_sync()
```

**Dodo webhook URL configured in Dodo dashboard:** `https://iamazeyou.me/api/dodo-webhook`

---

## When in Doubt

If you are unsure whether a change affects payments:
1. **ASK the project owner** before proceeding
2. Search `api/dodo.ts` for any column or table name you plan to change
3. Search `supabase/migrations/012_dodo_profile_reconciliation.sql` for the same
4. Test webhook delivery: `POST https://iamazeyou.me/api/dodo-webhook` should return 400 "Missing webhook headers" (not 308, not 404, not 500)

---

## Genesis Architecture Context (Appended)

The Genesis system is evolving to a monorepo architecture with two apps and shared packages:

- `apps/landing`: Next.js marketing/front-door application
- `apps/genesis-app`: existing Vite 8 application (moved as-is)
- `packages/ui`: shared presentational UI primitives/components
- `packages/types`: shared public TypeScript types

### Deployment model

- Public domain: `https://iamazeyou.me`
- Landing app handles public marketing pages.
- Vite app handles authenticated/product experience.
- Vercel path-based routing and rewrites proxy app routes transparently.

### Performance mission

Performance is the primary architecture filter. For landing and app surfaces, choose the fastest safe option first, then optimize for maintainability.

### Hard rule: Vite app migration

The Vite application must not be migrated to Next.js. It may be relocated inside a monorepo, but the runtime framework and behavior of the app must remain Vite-based unless the owner explicitly directs otherwise.

