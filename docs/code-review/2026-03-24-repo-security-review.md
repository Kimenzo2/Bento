# Code Review: Repository Security Baseline

**Ready for Production**: No
**Critical Issues**: 2

## Scope

- Web/API security (OWASP Top 10)
- Authentication and access control
- Payment and webhook boundaries
- Zero Trust controls (request identity, rate limit keying, CORS)

## Priority 1 (Must Fix) ⛔

- Wildcard CORS on payment checkout path allows cross-origin invocation surface.
  - Evidence: [api/dodo.ts](api/dodo.ts#L451) sets `Access-Control-Allow-Origin: *` for checkout.
  - Risk: Any origin can trigger authenticated browser requests against checkout endpoint, increasing abuse and CSRF-adjacent risk.
  - Fix: Restrict to explicit app origins (prod + dev allowlist) and require `Vary: Origin`.

- Global wildcard CORS default in core middleware.
  - Evidence: [api/_middleware.ts](api/_middleware.ts#L236) defaults `origin` to `*`.
  - Risk: Over-broad exposure for newly added endpoints when handlers forget to override CORS policy.
  - Fix: Default-deny (no CORS) and allow opt-in per route with explicit origin list.

## Priority 2 (High)

- Untrusted query parameter can influence non-auth route identity keying.
  - Evidence: [api/_middleware.ts](api/_middleware.ts#L186) returns `req.query.user_id` in `extractUserIdUnsafe`.
  - Risk: Rate-limit/accountability spoofing on unauthenticated routes, noisy audit attribution.
  - Fix: Remove `req.query.user_id` fallback; use verified token sub or IP/device fingerprint only.

- CSP allows inline script execution.
  - Evidence: [vercel.json](vercel.json#L54) contains `script-src 'unsafe-inline'`.
  - Risk: Lowered resistance to XSS payload execution.
  - Fix: Move to nonce/hash-based CSP, eliminate `unsafe-inline` for scripts.

## Priority 3 (Medium)

- In-memory rate limit key in service middleware is coarse and process-local.
  - Evidence: [services/api/middleware.ts](services/api/middleware.ts#L185) keys on `${table}:${operation}` only.
  - Risk: Cross-user throttling and bypass via horizontal scaling; inconsistent protection under load.
  - Fix: Use per-user/per-IP keys with shared backend (Redis/Upstash) for distributed enforcement.

- Some SQL migration policies use bare `auth.uid()` instead of optimizer-safe wrapper.
  - Evidence: [supabase/migrations/collaboration_platform.sql](supabase/migrations/collaboration_platform.sql#L74).
  - Risk: Policy eval overhead and inconsistency versus established repo standard.
  - Fix: Normalize to `(SELECT auth.uid())` pattern in active policy migrations.

## Strengths Observed

- Payment routing safeguards preserved: [vercel.json](vercel.json#L7), [vercel.json](vercel.json#L85), [vercel.json](vercel.json#L97).
- Checkout token verification path exists with JWT verification and fallback auth API checks: [api/dodo.ts](api/dodo.ts#L274).
- Auth-protected AI endpoints use authenticated wrapper: [api/ai-generate.ts](api/ai-generate.ts#L28), [api/ai-bytez.ts](api/ai-bytez.ts#L33).

## Enterprise Standard Verdict

- Current state aligns with a **mid-level startup security baseline**, not full enterprise standard.
- Blockers to enterprise readiness are mostly policy/config hardening, not architectural impossibilities.

## Recommended Next Actions (14 days)

1. Lock CORS to explicit origins in payment and middleware defaults.
2. Remove unsafe identity extraction from query params.
3. Replace in-memory rate limiting with distributed keys.
4. Harden CSP to nonce/hash script policy.
5. Normalize RLS policy style to `(SELECT auth.uid())` across active migrations.
