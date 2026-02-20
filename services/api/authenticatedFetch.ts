/**
 * Authenticated fetch utility — attaches the current Supabase JWT
 * to every API request so server-side middleware can verify identity.
 */
import { supabase } from '../supabaseClient';

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Auto-set JSON content type for requests with a body
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
