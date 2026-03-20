# Claude Code Instructions for Genesis

Read and obey all rules in `AGENTS.md` at the project root before making any changes.

## Critical Reminders

- **`api/dodo.ts`** is FROZEN. Do not modify unless the owner explicitly requests it and confirms payment impact.
- **`vercel.json`** must keep `trailingSlash: false`. Setting it to `true` kills webhook delivery.
- **Do not import `_middleware.ts`** in any API route. It pulls in ESM-only `jose` and crashes the serverless function.
- **Do not add Paystack** references back. The sole payment provider is Dodo.
- **Do not drop or rename** any column in `profiles`, `payment_history`, or `processed_webhooks` that is referenced by `api/dodo.ts` or the `apply_dodo_webhook_profile_sync` trigger.
- **RLS policies** must use `(SELECT auth.uid())` not bare `auth.uid()`.
- When adding Vercel env vars, use `printf 'value' | npx vercel env add` (never `echo`) to avoid trailing newline corruption.
- The Dodo webhook URL is `https://iamazeyou.me/api/dodo-webhook` (no trailing slash). Both slash and no-slash rewrite variants must exist in `vercel.json`.

For the full frozen file list, schema details, and architecture diagram, see `AGENTS.md`.

## Claude-Specific Architecture Context

- Always treat `AGENTS.md` as the source of truth for payment safety and architecture rules.
- Do not suggest migrating the Vite application to Next.js.
- The Vite application may be moved into a monorepo folder, but must remain Vite-based.
- `gen-engine` packages are published under the `@lorenzootieno/*` npm scope.
- Performance is the primary decision filter for architecture and implementation choices.
