# Security Best Practices Review

Date: March 9, 2026

## Executive Summary

This review found five material security issues in the current codebase:

1. A public job-control API allows unauthenticated job submission, status reads, streaming, cancellation, and queue-stat enumeration.
2. The email API acts as a generic authenticated mail relay, allowing any signed-in user to send arbitrary HTML emails to arbitrary recipients.
3. Shared client-side infrastructure bootstrap code imports configuration that includes server-only secrets and explicitly accepts `VITE_`-prefixed secret fallbacks, which is not secure by default.
4. The production CSP still permits `'unsafe-inline'`, which materially reduces the value of CSP as an XSS mitigation.
5. The app ships with a direct `jspdf@3.0.4` dependency that currently has critical/high advisories, and the vulnerable library is used in the PDF export path.

I also found lower-priority hardening gaps around storing profile data in Web Storage and around dependency scanning enforcement in CI.

## Critical

### F-001: Unauthenticated job API exposes queue control and job data

- Severity: Critical
- Rule IDs: EXPRESS-CSRF-001, EXPRESS-AUTH-001, EXPRESS-AUTHZ-001, EXPRESS-DOS-001
- Location:
  - `api/jobs.ts:91`
  - `api/jobs.ts:145`
  - `api/jobs.ts:180`
  - `api/jobs.ts:243`
  - `api/jobs.ts:278`
  - `api/jobs.ts:403`
- Evidence:
  - `handleSubmit()` accepts `POST /api/jobs/submit` without any authentication or ownership check.
  - `handleStatus()`, `handleStream()`, `handleCancel()`, and `handleStats()` are likewise public handlers.
  - The main handler sets CORS directly instead of using `createAuthenticatedHandler`, and falls back to `*` when `ALLOWED_ORIGIN` / `VERCEL_URL` are absent.
- Impact:
  - Any internet user can enqueue work, poll queue state, open long-lived SSE streams, cancel jobs, and scrape queue metrics.
  - This creates a direct abuse/DoS path and a data-exposure path for job results and progress messages.
- Fix:
  - Move `api/jobs.ts` behind `createAuthenticatedHandler(...)`.
  - Bind every job to `userId` and enforce ownership in status, stream, and cancel handlers.
  - Remove `*` fallback CORS and use an explicit origin allowlist.
  - Apply tighter rate limits to submit/stream endpoints than to status reads.
- Mitigation:
  - If public submission is intentional, issue signed one-time job tokens and restrict status/stream/cancel to the submitting principal.
  - Add server-side queue quotas per user/account and connection caps for SSE.
- False positive notes:
  - I found no compensating auth gateway in repository code. If this endpoint is protected outside the app, verify that protection at runtime and document it.

## High

### F-002: `/api/send-email` is a generic user-triggered email relay

- Severity: High
- Rule IDs: EXPRESS-AUTHZ-001, EXPRESS-INPUT-001
- Location:
  - `api/send-email.ts:23`
  - `api/send-email.ts:38`
  - `services/api/authenticatedFetch.ts:7`
  - `services/emailService.ts:21`
- Evidence:
  - Any authenticated browser session can call `/api/send-email`.
  - The handler forwards caller-controlled `to`, `subject`, `html`, `text`, `from`, and `replyTo` directly to Resend.
  - The frontend helper exposes a generic `sendEmail(options)` wrapper to the client.
- Impact:
  - A normal user account can use your mail infrastructure as a spam/phishing relay, damage sender reputation, and trigger provider suspension.
  - Because HTML is caller-controlled, the relay can send branded phishing content that appears to come from Genesis.
- Fix:
  - Replace the generic relay with narrowly scoped server-side templates only.
  - Enforce recipient policy per email type, for example `welcome` may only send to `session.user.email`.
  - Ignore client-supplied `from`/`replyTo` unless an admin/server workflow is calling the endpoint.
  - Validate and escape all user-controlled values that enter HTML email templates.
- Mitigation:
  - Add per-user and global abuse monitoring, plus allowlists for sender identities and domains.
  - Log template name and recipient count, not raw HTML payloads.
- False positive notes:
  - If this endpoint is intended for admin-only use, the current code does not enforce that distinction.

### F-003: Direct production dependency `jspdf@3.0.4` has current critical/high advisories

- Severity: High
- Rule IDs: REACT-SUPPLY-001
- Location:
  - `package.json:92`
  - `services/generator/pdfService.ts:1`
  - `services/generator/pdfService.ts:50`
- Evidence:
  - `package.json` pins `jspdf` to `^3.0.4`.
  - The PDF export path imports and uses that library to process user-controlled book text and image URLs.
  - `npm audit --omit=dev --json` run on March 9, 2026 reported a critical advisory and multiple high-severity advisories against installed `jspdf`.
- Impact:
  - The app’s export path depends on a library with unresolved path traversal, PDF injection, and DoS advisories.
  - Because the feature processes user-supplied titles, text, and image URLs, this is not dead code.
- Fix:
  - Upgrade `jspdf` to a non-vulnerable release and retest PDF generation/export.
  - Add coverage for malicious titles, long strings, malformed image sources, and adversarial PDF metadata/input.
- Mitigation:
  - If an immediate upgrade is risky, gate PDF export behind a feature flag until the dependency is remediated.
- False positive notes:
  - Exact exploitability depends on the advisory specifics and execution path, but the dependency exposure is current and direct.

## Medium

### F-004: Client bootstrap path is not secret-safe by default

- Severity: Medium
- Rule IDs: REACT-CONFIG-001
- Location:
  - `contexts/InfrastructureContext.tsx:45`
  - `services/infrastructure/bootstrap.ts:19`
  - `config/infrastructure.ts:166`
  - `config/infrastructure.ts:219`
- Evidence:
  - A React context imports `bootstrapInfrastructure()` on the client.
  - `bootstrapInfrastructure()` imports shared `config` from `config/infrastructure.ts`.
  - `getEnv()` explicitly reads both raw names and `VITE_`-prefixed fallbacks.
  - The shared config object includes server-only fields such as `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.
- Impact:
  - This design makes it easy to leak server-only credentials into the client bundle if someone ever sets a `VITE_`-prefixed secret.
  - Even when not leaked today, the current structure is a dangerous footgun and violates secure-by-default separation of client/server config.
- Fix:
  - Split config into `clientConfig` and `serverConfig`.
  - Remove all secret fields from any module imported by browser code.
  - Make secret reads server-only and reject `VITE_` fallbacks for server credentials.
- Mitigation:
  - Add a CI check that fails builds when banned env names appear with `VITE_` prefixes.
- False positive notes:
  - I did not find a committed secret leak in tracked files; this is a design flaw that increases the chance of one.

### F-005: CSP still allows inline script/style execution

- Severity: Medium
- Rule IDs: JS-CSP-001, JS-CSP-002, REACT-CSP-001
- Location:
  - `vercel.json:38`
  - `vercel.json:39`
- Evidence:
  - The production policy includes `script-src 'self' 'unsafe-inline' ...` and `style-src 'self' 'unsafe-inline' ...`.
- Impact:
  - CSP is present, but allowing inline execution materially weakens its value against XSS and DOM injection bugs.
  - This is especially relevant in a browser app that stores user/profile state in Web Storage and renders a large amount of dynamic content.
- Fix:
  - Remove `'unsafe-inline'` from `script-src`.
  - Move inline scripts/styles into bundled assets or adopt nonces/hashes where unavoidable.
  - Consider Trusted Types report-only mode after eliminating remaining DOM injection sinks.
- Mitigation:
  - Start with report-only CSP changes in preview deployments to avoid regressions.
- False positive notes:
  - If a third-party integration currently requires inline execution, document that dependency explicitly and scope it as tightly as possible.

## Lower-Priority Hardening Opportunities

### H-001: Profile and onboarding data is stored in Web Storage

- Location:
  - `components/SettingsPanel.tsx:98`
  - `components/SettingsPanel.tsx:219`
  - `contexts/AuthContext.tsx:32`
  - `components/EmailAuthModal.tsx:45`
- Risk:
  - The app stores user email, display name, bio, avatar data, onboarding flags, and pending welcome-email metadata in `localStorage`/`sessionStorage`.
  - This is not appropriate for anything you would not want exposed during an XSS incident.
- Secure-by-default improvement:
  - Keep only non-sensitive presentation toggles in Web Storage.
  - Move identity/profile fields to server-backed storage and derive them from the authenticated session.

### H-002: CI does not enforce dependency scanning

- Location:
  - `.github/workflows/ci.yml:13`
- Risk:
  - CI runs lint, tests, and build, but no dependency audit/SCA step.
- Secure-by-default improvement:
  - Add a dependency scan job that at minimum fails on critical production vulnerabilities after triage.
  - Pair it with a scheduled workflow and Dependabot/GitHub advisory triage.

## Recommended Remediation Order

1. Lock down `api/jobs.ts` with authentication, ownership checks, and strict CORS.
2. Replace `/api/send-email` with template-specific server endpoints and remove caller-controlled sender/HTML fields.
3. Upgrade `jspdf` and re-run export tests.
4. Split shared config into browser-safe and server-only modules.
5. Tighten CSP to remove inline execution allowances.

## Notes

- I checked tracked files with `git ls-files` and did not find committed `.env` / `.env.local` files in Git.
- `npm audit --omit=dev --json` on March 9, 2026 reported `1 critical`, `14 high`, and `12 moderate` production vulnerabilities in the installed tree. The most actionable direct-package issues from that run were `jspdf`, `react-router-dom` / `react-router`, `@mastra/deployer`, and `checkly`.
