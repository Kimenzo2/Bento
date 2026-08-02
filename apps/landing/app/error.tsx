// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '420px', display: 'grid', gap: '1rem' }}>
        <p
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Error
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
          }}
        >
          Something went wrong
        </h1>
        <p
          className="text-body"
          style={{
            color: 'var(--color-ink-muted)',
            maxWidth: '36ch',
            marginInline: 'auto',
          }}
        >
          An unexpected error occurred. Try again or head back home.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={reset}
            data-slot="button"
            className="btn-accent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 18px',
              height: '36px',
              borderRadius: '0.75rem',
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              border: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            data-slot="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 18px',
              height: '36px',
              borderRadius: '0.75rem',
              background: 'var(--color-highlight)',
              color: 'var(--color-ink)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
