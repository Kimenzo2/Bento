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
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
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
