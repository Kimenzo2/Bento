import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/pricing';
  const desktop = requestUrl.searchParams.get('desktop') === 'true';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && desktop) {
      // User came from desktop OAuth flow — redirect to the post-auth page
      // which will deep-link back to the desktop app
      const origin = requestUrl.origin;
      return NextResponse.redirect(`${origin}/auth/desktop-success`);
    }
  }

  // Standard web flow: redirect to pricing or next destination
  const origin = requestUrl.origin;
  return NextResponse.redirect(`${origin}${next}`);
}
