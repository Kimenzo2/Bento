# Genesis Environment Variables Reference

This document lists all environment variables used across the Genesis monorepo.

## Quick Reference Table

| Variable | App | Public | Description |
|----------|-----|--------|-------------|
| `VITE_SUPABASE_URL` | Vite | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vite | ✅ | Supabase anonymous/public key |
| `NEXT_PUBLIC_SUPABASE_URL` | Landing | ✅ | Same value as VITE_SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Landing | ✅ | Same value as VITE_SUPABASE_ANON_KEY |
| `SUPABASE_URL` | Both | ❌ | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Both | ❌ | Service role key (server only) |

---

## Port Assignments (Local Development)

| Port | Service | Description |
|------|---------|-------------|
| **4000** | Dev Proxy | Unified access URL - use this in browser |
| 3000 | Vite App | Genesis main app (authenticated routes) |
| 3001 | Landing App | Next.js landing (public routes) |
| 3002 | API Server | Vite's API proxy target |
| 4111 | Mastra Server | AI workflow backend |

**Developer URL:** `http://localhost:4000`

---

## Supabase Configuration

### Client-Side (Public)

Both apps need access to Supabase for authentication. They use different
prefixes but MUST have the same values:

```bash
# Vite App (apps/genesis-app/.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Landing App (apps/landing/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Server-Side (Secret)

Used by Mastra backend and Next.js server components for admin operations:

```bash
# Both apps can use these (no prefix = server-only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Note:** Never expose the service role key to the browser. It bypasses
Row Level Security.

---

## Auth Cookie Configuration

For auth to work across both apps, they share cookies via the dev proxy:

- **Cookie Name:** `sb-<project-ref>-auth-token` (Supabase default)
- **Domain:** `localhost` (shared in development)
- **Path:** `/` (accessible to all routes)

Both apps use the same Supabase project, so cookies set by one app are
automatically readable by the other when accessed through the proxy.

---

## AI Service Keys

### Gemini (Text Generation)

```bash
# Server-side (Mastra - preferred)
GEMINI_API_KEY_1=your_key
GEMINI_API_KEY_2=your_key
# ... up to GEMINI_API_KEY_5

# Client-side (legacy fallback - deprecating)
VITE_GEMINI_API_KEY_1=your_key
# ... up to VITE_GEMINI_API_KEY_11
```

### Grok (Unified Text + Image)

```bash
# Server-side only
GROK_API_KEY=your_key
GROK_TEXT_MODEL=grok-4.1
GROK_IMAGE_MODEL=grok-image-1.5
```

### Bytez (Character Conversations)

```bash
# Server-side (Mastra)
BYTEZ_API_KEY=your_key

# Client-side (legacy)
VITE_BYTEZ_API_KEY_1=your_key
# ... up to VITE_BYTEZ_API_KEY_11
```

---

## Payment Configuration (Dodo)

```bash
# Server-side only - NEVER expose to browser
DODO_PAYMENTS_API_KEY=your_key
DODO_PAYMENTS_WEBHOOK_SECRET=your_secret
DODO_PAYMENTS_ENV=live_mode  # or test_mode

# Product IDs
DODO_PRODUCT_ID_CREATOR_MONTHLY=prod_xxx
DODO_PRODUCT_ID_STUDIO_MONTHLY=prod_xxx
DODO_PRODUCT_ID_EMPIRE_MONTHLY=prod_xxx
```

---

## Email Configuration (Resend)

```bash
# Server-side only
RESEND_API_KEY=re_xxx
```

---

## Observability

```bash
# Braintrust (LLM monitoring)
BRAINTRUST_API_KEY=bt-xxx
BRAINTRUST_PROJECT_ID=xxx

# Rollbar (error tracking - client-side)
VITE_ROLLBAR_ACCESS_TOKEN=xxx
```

---

## Local Development Setup

1. Copy example files:
   ```bash
   cp apps/genesis-app/.env.example apps/genesis-app/.env
   cp apps/landing/.env.example apps/landing/.env.local
   ```

2. Fill in Supabase values (same values in both files)

3. Start the dev server:
   ```bash
   bun run dev
   ```

4. Access at: `http://localhost:4000`

---

## Vercel Deployment

Both apps are deployed as separate Vercel projects. Environment variables
must be set in each project's Vercel dashboard:

- **Landing App:** Only needs `NEXT_PUBLIC_SUPABASE_*` variables
- **Vite App:** Needs all `VITE_*` and server-side variables

The Supabase URL and anon key values must match between both deployments.
