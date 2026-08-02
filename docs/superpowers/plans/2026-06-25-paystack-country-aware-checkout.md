**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Paystack Country-Aware Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a country-aware Paystack checkout on the Next.js pricing page that filters methods by country, persists checkout intent/state in Supabase, and keeps webhook-driven billing updates idempotent.

**Architecture:** Keep payment method rules in Supabase so supported methods can change without redeploys. Detect customer country server-side from profile, checkout form, request headers, or manual selection, then feed that country into a payment-method router that returns only supported Paystack channels. Reuse the existing `/api/paystack/webhook` route for payment-state updates and keep pricing-page UI thin.

**Tech Stack:** Next.js route handlers and server components, Supabase Postgres, Supabase SSR/admin client, Paystack hosted checkout, node:test/Bun tests.

---

### Task 1: Add Supabase-backed payment method rules

**Files:**

- Create: `apps/genesis-desktop/supabase/migrations/0006_paystack_payment_method_rules.sql`
- Modify: `apps/landing/lib/supabase/server.ts` if a new helper needs admin access

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.paystack_payment_method_rules (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  country_code text not null,
  enabled boolean not null default true,
  fallback_to_card boolean not null default false,
  sort_order integer not null default 0,
  notes text null,
  updated_at timestamptz not null default now(),
  unique (method_key, country_code)
);

alter table public.paystack_payment_method_rules enable row level security;
```

- [ ] **Step 2: Add a lightweight seed strategy**

Insert rows for:
`card`, `bank`, `bank_transfer`, `ussd`, `mobile_money`, `qr`, `apple_pay`, `dedicated_bank_account`, `direct_debit`, `paypal`, `preauth`, `capitec_pay`, `pos`, `eft`, `payattitude`

- [ ] **Step 3: Verify schema shape**

Run Supabase table listing and confirm the table exists with RLS enabled.

---

### Task 2: Add country detection and payment method routing helpers

**Files:**

- Create: `apps/landing/lib/paystack/country.ts`
- Create: `apps/landing/lib/paystack/payment-methods.ts`
- Create: `apps/landing/lib/paystack/checkout-intents.ts`

- [ ] **Step 1: Write the failing tests**

Cover:

- profile country wins over IP
- manual country wins over profile
- fallback to IP header works
- unsupported methods are filtered out
- cards are always present as fallback

- [ ] **Step 2: Implement country detection**

```ts
export function detectCountry(input: {
  manualCountry?: string | null;
  profileCountry?: string | null;
  billingCountry?: string | null;
  shippingCountry?: string | null;
  headerCountry?: string | null;
}): string | null;
```

- [ ] **Step 3: Implement payment routing**

```ts
export function getSupportedPaystackMethods(countryCode: string | null): string[];
```

Use Supabase-backed rules first, default to card-only if no other method exists.

- [ ] **Step 4: Implement checkout intent persistence**

Store:

- detected country
- selected method
- plan code
- billing period
- profile id
- email
- source (`web`, `desktop`, `manual`)

---

### Task 3: Wire the pricing page to the router

**Files:**

- Modify: `apps/landing/app/pricing/page.tsx`
- Modify: `apps/landing/app/api/paystack/initialize/route.ts`
- Create: `apps/landing/app/api/paystack/payment-methods/route.ts`

- [ ] **Step 1: Write tests for the route helper**

Ensure the API returns only methods allowed for the detected country.

- [ ] **Step 2: Add country detection to the page**

Use profile country first, then manual selection, then IP-country headers.

- [ ] **Step 3: Render only available methods**

Hide unavailable methods completely; show card if nothing else is available.

- [ ] **Step 4: Pass method selection into checkout init**

Persist the checkout intent before redirecting to Paystack.

---

### Task 4: Keep webhook-driven billing sync idempotent

**Files:**

- Modify: `apps/landing/app/api/paystack/webhook/route.ts`
- Modify: `apps/landing/lib/paystack-webhook.ts`
- Modify: `apps/landing/lib/paystack-webhook.test.ts`

- [ ] **Step 1: Add tests for supported/unsupported events**

Unsupported events must be ignored safely; supported events must remain idempotent.

- [ ] **Step 2: Keep the event-hash dedupe**

Use the event hash and `payments`/`paystack_webhook_events` rows to prevent duplicate processing.

- [ ] **Step 3: Update billing state on relevant events**

Continue to update `profiles` and `payments` only for billing events.

---

### Task 5: Verify and document

**Files:**

- Modify: `apps/landing/.env.example`
- Modify: `apps/genesis-desktop/.env.example`

- [ ] **Step 1: Add country-related env notes**

Document optional IP geolocation headers and Supabase config.

- [ ] **Step 2: Run tests**

Run the focused webhook and payment-method tests plus landing type-check.

- [ ] **Step 3: Commit**

Commit the migration, helper, route, and tests together.
