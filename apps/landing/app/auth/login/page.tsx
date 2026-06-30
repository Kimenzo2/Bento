'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import Link from 'next/link';

const accent = 'var(--color-accent)';
const bg = 'var(--color-bg)';
const surface = 'var(--color-surface)';
const ink = 'var(--color-ink)';
const inkMuted = 'var(--color-ink-muted)';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/pricing';
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '400px',
        background: surface,
        borderRadius: '1.5rem',
        padding: '2.5rem 2rem',
        display: 'grid',
        gap: '1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            textDecoration: 'none',
            margin: '0 auto',
          }}
          aria-label="Back to homepage"
        >
          <Image
            src="/bento-icon.png"
            alt="Bento"
            width={36}
            height={36}
            style={{ borderRadius: '8px' }}
          />
          <span
            style={{
              fontWeight: 400,
              fontSize: '1.5rem',
              fontFamily: 'var(--font-biscotti), var(--font-inter), system-ui, sans-serif',
              color: ink,
              letterSpacing: '-0.02em',
            }}
          >
            Bento
          </span>
        </Link>
        <h1
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 650,
            letterSpacing: '-0.03em',
            color: ink,
          }}
        >
          Welcome back
        </h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: inkMuted, lineHeight: 1.5 }}>
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}
          >
            Sign up
          </Link>
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.7rem 0.9rem',
            borderRadius: '0.85rem',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 500,
            textAlign: 'left',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="8" cy="8" r="6.5" stroke="#ef4444" strokeWidth="1.3" />
            <path d="M8 5v3.5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="10.5" r="0.65" fill="#ef4444" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        data-slot="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          whiteSpace: 'nowrap',
          fontSize: '0.9rem',
          fontWeight: 500,
          height: '36px',
          borderRadius: '0.75rem',
          padding: '0 18px',
          background: accent,
          color: bg,
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
          textDecoration: 'none',
          opacity: loading ? 0.6 : 1,
          transition: 'color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M19.6 10.2c0-.7-.06-1.36-.18-2H10v3.78h5.38a4.53 4.53 0 0 1-1.96 2.98v2.48h3.18c1.86-1.72 2.94-4.24 2.94-7.24z"
            fill="#4285F4"
          />
          <path
            d="M10 20c2.66 0 4.88-.88 6.52-2.38l-3.18-2.48c-.88.6-2 1-3.34 1-2.56 0-4.74-1.72-5.52-4.02H1.14v2.56C2.76 17.78 6.1 20 10 20z"
            fill="#34A853"
          />
          <path
            d="M4.48 12.12A5.96 5.96 0 0 1 4.1 10c0-.74.14-1.46.38-2.12V5.32H1.14A9.99 9.99 0 0 0 0 10c0 1.64.4 3.18 1.14 4.56l3.34-2.44z"
            fill="#FBBC05"
          />
          <path
            d="M10 4.02c1.44 0 2.74.5 3.76 1.46l2.82-2.82C14.86.98 12.66 0 10 0 6.1 0 2.76 2.22 1.14 5.32l3.34 2.56C5.26 5.74 7.44 4.02 10 4.02z"
            fill="#EA4335"
          />
        </svg>
        {loading ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>

      <div style={{ marginTop: '0.25rem' }}>
        <Link
          href="/auth/signup"
          style={{
            color: accent,
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          Don&apos;t have an account? Sign up
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: bg,
        color: ink,
        padding: '2rem 1.5rem',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              background: surface,
              borderRadius: '1.5rem',
              padding: '2.5rem 2rem',
              display: 'grid',
              gap: '1.5rem',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  margin: '0 auto',
                }}
              >
                <Image
                  src="/bento-icon.png"
                  alt="Bento"
                  width={36}
                  height={36}
                  style={{ borderRadius: '8px' }}
                />
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: '1.5rem',
                    fontFamily: 'var(--font-biscotti), var(--font-inter), system-ui, sans-serif',
                    color: ink,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Bento
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 650,
                  letterSpacing: '-0.03em',
                  color: ink,
                }}
              >
                Welcome back
              </h1>
              <p style={{ margin: 0, fontSize: '0.9rem', color: inkMuted, lineHeight: 1.5 }}>
                Loading…
              </p>
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
