'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import Link from 'next/link';

export default function DesktopSuccessPage() {
  const [session, setSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError('No active session found. Please try signing in again.');
        return;
      }

      const { access_token, refresh_token } = data.session;
      // Create a deep link URL for the desktop app
      const deepLink = `bento://auth?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;
      setSession(deepLink);

      // Auto-trigger deep link with a slight delay
      setTimeout(() => {
        window.location.href = deepLink;
      }, 1500);
    });
  }, []);

  function handleCopyLink() {
    if (session) {
      navigator.clipboard.writeText(session);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <div className="auth-card__icon">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="#ef4444" strokeWidth="2.5" />
                <path
                  d="M20 20l24 24M44 20l-24 24"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="auth-card__title">Authentication error</h1>
            <p className="auth-card__desc">{error}</p>
            <Link href="/auth/login" className="auth-card__btn">
              Sign in again
            </Link>
          </>
        ) : session ? (
          <>
            <div className="auth-card__icon">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="#22c55e" strokeWidth="2.5" />
                <path
                  d="M20 33l8 8 16-16"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="auth-card__title">
              Opening{' '}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: '1.8rem',
                  fontFamily: 'var(--font-biscotti), var(--font-inter), system-ui, sans-serif',
                  color: 'var(--color-ink)',
                }}
              >
                Bento
              </span>
              …
            </h1>
            <p className="auth-card__desc">
              Your authentication is complete. Bento desktop app should open automatically in a
              moment.
            </p>
            <p className="auth-card__hint">
              If the app doesn&apos;t open,{' '}
              <button className="auth-card__link-btn" onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'copy this link'}
              </button>{' '}
              and paste it in your browser while Bento is running.
            </p>
            <Link href="/download" className="auth-card__btn">
              Go to downloads
            </Link>
          </>
        ) : (
          <>
            <div className="auth-card__spinner" />
            <h1 className="auth-card__title">Completing sign-in…</h1>
            <p className="auth-card__desc">Please wait while we verify your session.</p>
          </>
        )}
      </div>
      <style>{authStyles}</style>
    </main>
  );
}

const authStyles = `
  .auth-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: var(--color-bg);
    color: var(--color-ink);
    padding: 2rem 1.5rem;
  }
  .auth-card {
    width: 100%;
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 2rem;
    padding: 2.5rem 2rem;
    display: grid;
    gap: 1.2rem;
    text-align: center;
  }
  .auth-card__icon {
    display: flex;
    justify-content: center;
  }
  .auth-card__spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 2.5px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: auth-spin 0.7s linear infinite;
    margin: 0 auto;
  }
  @keyframes auth-spin {
    to { transform: rotate(360deg); }
  }
  .auth-card__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-ink);
  }
  .auth-card__desc {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
  .auth-card__hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-ink-faint);
    line-height: 1.5;
  }
  .auth-card__link-btn {
    background: none;
    border: none;
    color: var(--color-accent);
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
  }
  .auth-card__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: 0.85rem;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    padding: 0 1.5rem;
  }
`;
