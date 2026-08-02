// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';

const CN_CDN = 'https://cdn.crabnebula.app/download/bento-industries/bento/latest/platform';

const platforms = [
  { key: 'windows', label: 'Windows', arch: 'Windows 64-bit', href: CN_CDN + '/nsis-x86_64' },
  { key: 'macos', label: 'macOS', arch: 'macOS (Universal)', href: CN_CDN + '/dmg-universal' },
  {
    key: 'linux',
    label: 'Linux',
    arch: 'Linux (AppImage + deb)',
    href: CN_CDN + '/appimage-x86_64',
  },
];

export default function DownloadPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [deepLinkSent, setDeepLinkSent] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
      setAuthLoaded(true);
    });
  }, []);

  async function handleOpenInDesktop() {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const { access_token, refresh_token } = data.session;
    const deepLink = `bento://auth?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;
    window.location.href = deepLink;
    setDeepLinkSent(true);
  }

  return (
    <main className="download-page">
      <title>Download Bento</title>
      <meta
        name="description"
        content="Download Bento for Windows, macOS, or Linux. Your account works across all devices."
      />
      <meta property="og:title" content="Download Bento — Windows, macOS & Linux" />
      <meta
        property="og:description"
        content="Download Bento for Windows, macOS, or Linux. Your account works across all devices."
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://iamazeyou.me/download" />
      <div className="download-page__inner">
        <section className="download-page__hero">
          <Link href="/" className="download-page__logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="var(--color-accent, #5f61ed)" />
              <path d="M8 10h4v12H8V10zm6 4h4v8h-4v-8zm6-2h4v10h-4V12z" fill="#131211" />
            </svg>
          </Link>
          <h1 className="download-page__title">Download Bento</h1>
          <p className="download-page__desc">
            Choose your platform. Your account works across all devices — sign in once, pick up
            where you left off.
          </p>
        </section>

        <section className="download-page__platforms">
          {platforms.map((p) => (
            <a
              key={p.key}
              href={`/download/success?platform=${p.key}&dl=${encodeURIComponent(p.href)}`}
              className="download-page__card"
            >
              <div className="download-page__card-icon">
                {p.key === 'windows' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path d="M3 12h18M12 3v18" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
                {p.key === 'macos' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 7v6a3 3 0 003 3h2a3 3 0 003-3V7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 4v3M16 4v3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {p.key === 'linux' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2a3 3 0 00-3 3v1.5a3 3 0 003 3 3 3 0 003-3V5a3 3 0 00-3-3z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8.5 16.5L12 22l3.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 9.5v3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="download-page__card-title">{p.label}</h3>
                <p className="download-page__card-arch">{p.arch}</p>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="download-page__card-arrow"
              >
                <path
                  d="M10 4v12M10 16l-4-4M10 16l4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ))}
        </section>

        {authLoaded && user && (
          <section className="download-page__deep-link">
            <div className="download-page__deep-link-card">
              <h2 className="download-page__deep-link-title">Already have Bento installed?</h2>
              <p className="download-page__deep-link-desc">
                Click below to open the desktop app and sign in automatically with your web account.
              </p>
              <button
                className="download-page__deep-link-btn"
                onClick={handleOpenInDesktop}
                disabled={deepLinkSent}
              >
                {deepLinkSent ? 'Opening Bento…' : 'Open in Bento desktop'}
              </button>
              {deepLinkSent && (
                <p className="download-page__deep-link-hint">
                  If the app doesn&apos;t open, launch Bento manually and sign in with your email.
                </p>
              )}
            </div>
          </section>
        )}

        {!authLoaded || !user ? (
          <section className="download-page__cta">
            <p className="download-page__cta-text">
              <Link href="/auth/signup" className="download-page__cta-link">
                Create a free account
              </Link>{' '}
              to sync across devices.
            </p>
          </section>
        ) : null}

        <section className="download-page__note">
          <p className="download-page__note-text">
            Already subscribed?{' '}
            <Link href="/pricing" className="download-page__cta-link">
              Manage billing
            </Link>
          </p>
        </section>
      </div>
      <style>{downloadStyles}</style>
    </main>
  );
}

const downloadStyles = `
  .download-page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-ink);
  }
  .download-page__inner {
    max-width: 640px;
    margin: 0 auto;
    padding: 6rem 1.5rem 4rem;
    display: grid;
    gap: 2.5rem;
  }
  .download-page__logo {
    display: inline-flex;
    margin-bottom: 0.5rem;
  }
  .download-page__hero {
    text-align: center;
  }
  .download-page__title {
    margin: 0 0 0.75rem;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .download-page__desc {
    margin: 0;
    font-size: 1rem;
    color: #90959e;
    line-height: 1.6;
    max-width: 48ch;
    margin-inline: auto;
  }
  .download-page__platforms {
    display: grid;
    gap: 0.75rem;
  }
  .download-page__card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-radius: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    text-decoration: none;
    color: var(--color-ink);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .download-page__card:hover {
    border-color: var(--color-accent-line);
    background: var(--color-elevated);
  }
  .download-page__card-icon {
    width: 2.5rem;
    height: 2.5rem;
    display: grid;
    place-items: center;
    border-radius: 0.75rem;
    background: var(--color-highlight);
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .download-page__card-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
  }
  .download-page__card-arch {
    margin: 0.15rem 0 0;
    font-size: 0.82rem;
    color: var(--color-ink-muted);
  }
  .download-page__card-arrow {
    margin-left: auto;
    color: var(--color-ink-muted);
    flex-shrink: 0;
  }
  .download-page__deep-link-card {
    text-align: center;
    padding: 2rem;
    border-radius: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-accent-line);
    display: grid;
    gap: 0.75rem;
  }
  .download-page__deep-link-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }
  .download-page__deep-link-desc {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
  .download-page__deep-link-btn {
    justify-self: center;
    padding: 0.75rem 1.75rem;
    border-radius: 0.85rem;
    border: none;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .download-page__deep-link-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .download-page__deep-link-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .download-page__deep-link-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-ink-faint);
  }
  .download-page__cta {
    text-align: center;
  }
  .download-page__cta-text {
    margin: 0;
    font-size: 0.9rem;
    color: #90959e;
  }
  .download-page__cta-link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 600;
  }
  .download-page__cta-link:hover {
    text-decoration: underline;
  }
  .download-page__note {
    text-align: center;
  }
  .download-page__note-text {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-ink-faint);
  }
`;
