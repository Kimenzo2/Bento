/**
 * Supabase Browser Client for Next.js Landing App
 *
 * Use this client in Client Components (files with "use client" directive).
 * This client stores auth tokens in cookies that are shared with the Vite app.
 *
 * IMPORTANT: This function creates a new client instance each time.
 * In client components, call it once in a useEffect or useMemo, not on every render.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use PKCE flow for server-side rendering compatibility
        flowType: 'pkce',
        // Automatically refresh tokens before they expire
        autoRefreshToken: true,
        // Persist session in cookies (shared with Vite app)
        persistSession: true,
        // Detect auth tokens in URL (OAuth callback handling)
        detectSessionInUrl: true,
      },
    }
  );
}
