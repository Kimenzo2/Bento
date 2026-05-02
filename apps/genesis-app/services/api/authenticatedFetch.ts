/**
 * Authenticated fetch utility — attaches the current Supabase JWT
 * to every API request so server-side middleware can verify identity.
 */
import { supabase } from '../supabaseClient';

const MASTRA_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTRA_URL) ||
  'http://localhost:4111';

function shouldRouteToMastra(url: string): boolean {
  return (
    url === '/api/ai-generate' ||
    url === '/api/ai-bytez' ||
    url === '/api/life-in-colour/generate' ||
    url.startsWith('/api/life-in-colour/generations/')
  );
}

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

  const resolvedUrl = shouldRouteToMastra(url) ? `${MASTRA_BASE_URL}${url}` : url;
  return fetch(resolvedUrl, { ...options, headers });
}
