// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

function validateRedirectPath(path: string): string {
  const sanitized = path.split('?')[0].split('#')[0];
  if (
    sanitized.startsWith('/') &&
    !sanitized.includes('@') &&
    !sanitized.includes('//') &&
    !sanitized.includes('\\')
  ) {
    return sanitized;
  }
  return '/pricing';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/pricing';
  const desktop = requestUrl.searchParams.get('desktop') === 'true';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && desktop) {
      const origin = requestUrl.origin;
      return NextResponse.redirect(`${origin}/auth/desktop-success`);
    }
  }

  const origin = requestUrl.origin;
  const safePath = validateRedirectPath(next);
  return NextResponse.redirect(`${origin}${safePath}`);
}
