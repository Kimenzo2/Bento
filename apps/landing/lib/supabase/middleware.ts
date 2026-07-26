/**
 * Supabase Middleware Client for Next.js Landing App
 *
 * This client is used exclusively in Next.js middleware to refresh
 * auth tokens before they expire.
 *
 * The middleware runs on every request and ensures:
 * 1. Expired tokens are refreshed automatically
 * 2. Fresh tokens are written to both request and response
 * 3. Server components always see up-to-date auth state
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const FALLBACK_SUPABASE_URL = 'https://qjjocfnqwtccuxbnoult.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqam9jZm5xd3RjY3V4Ym5vdWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzY3MzUsImV4cCI6MjA3OTI1MjczNX0.oPqt-rffxO2gtX7xv4RisONqIdSSJ98hl7QNDjM_Y4c';

function resolveUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  return /^https?:\/\//.test(raw) ? raw : FALLBACK_SUPABASE_URL;
}

function resolveKey(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return raw.length > 10 ? raw : FALLBACK_SUPABASE_ANON_KEY;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(resolveUrl(), resolveKey(), {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do NOT use getSession() here.
  // getUser() validates the JWT and triggers token refresh if needed.
  // A middleware that only calls getSession() would not refresh expired tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
