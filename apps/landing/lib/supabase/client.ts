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

const FALLBACK_SUPABASE_URL = 'https://qjjocfnqwtccuxbnoult.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqam9jZm5xd3RjY3V4Ym5vdWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzY3MzUsImV4cCI6MjA3OTI1MjczNX0.oPqt-rffxO2gtX7xv4RisONqIdSSJ98hl7QNDjM_Y4c';

function resolveUrl(fallback: string): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  return /^https?:\/\//.test(raw) ? raw : fallback;
}

function resolveKey(fallback: string): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return raw.length > 10 ? raw : fallback;
}

export function createClient() {
  return createBrowserClient(
    resolveUrl(FALLBACK_SUPABASE_URL),
    resolveKey(FALLBACK_SUPABASE_ANON_KEY),
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
