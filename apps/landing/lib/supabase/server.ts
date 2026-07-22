/**
 * Supabase Server Client for Next.js Landing App
 *
 * Use this client in Server Components, Server Actions, and Route Handlers.
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER initialize this client at module level - always inside request handlers
 * 2. ALWAYS use getUser() to verify identity, NEVER just getSession()
 * 3. Mark all routes using this client as `export const dynamic = 'force-dynamic'`
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const FALLBACK_SUPABASE_URL = 'https://qjjocfnqwtccuxbnoult.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqam9jZm5xd3RjY3V4Ym5vdWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzY3MzUsImV4cCI6MjA3OTI1MjczNX0.oPqt-rffxO2gtX7xv4RisONqIdSSJ98hl7QNDjM_Y4c';

function isValidHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

function resolveSupabaseEnv(...values: Array<string | undefined>): string {
  const resolved = values.find((value): value is string =>
    Boolean(value && value.trim().length > 0 && isValidHttpUrl(value.trim()))
  );

  if (!resolved) {
    throw new Error(
      'Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY or the legacy GENESIS_PUBLIC_* values.'
    );
  }

  return resolved.trim();
}

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = resolveSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    FALLBACK_SUPABASE_URL
  );
  const supabaseAnonKey = resolveSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    FALLBACK_SUPABASE_ANON_KEY
  );

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method is called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

export function createAdminClient() {
  const supabaseUrl = resolveSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    FALLBACK_SUPABASE_URL
  );
  const supabaseServiceRole = resolveSupabaseEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createSupabaseAdminClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get the authenticated user with JWT verification.
 *
 * This validates the JWT against Supabase's public keys, unlike getSession()
 * which only reads cookies without verification.
 *
 * ALWAYS use this instead of getSession() in server-side code.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();

  // getUser() validates the JWT with Supabase servers
  // This is the ONLY secure way to verify identity server-side
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
