'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { tokens } from './tokens';
import { useDownload } from './useDownload';
import type { Platform, PlatformInfo } from './useDownload';
import { createClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function Hero({
  version,
  platforms,
}: {
  version: string;
  platforms: Record<Platform, PlatformInfo>;
}) {
  const { platform, active, detecting } = useDownload(platforms);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
      setAuthLoaded(true);
    });
  }, []);

  return (
    <>
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--color-bg)',
          padding: '0 28px',
        }}
        aria-labelledby="hero-heading"
      >
        <div
          style={{
            maxWidth: '720px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center',
            padding: 'clamp(4rem, 10vh, 8rem) 0 clamp(3rem, 5vh, 4rem)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image
              src="/bento-icon.png"
              alt=""
              width={40}
              height={40}
              style={{ borderRadius: '10px', flexShrink: 0 }}
            />
            <p
              style={{
                fontSize: tokens.labelSize,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: tokens.accent,
              }}
            >
              Windows, macOS & Linux
            </p>
          </div>

          <h1
            id="hero-heading"
            style={{
              fontSize: tokens.heroSize,
              fontWeight: 650,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: tokens.ink,
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A quiet place for your whole day.
          </h1>

          <p
            style={{
              fontSize: tokens.subheadSize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              maxWidth: '520px',
            }}
          >
            Seventeen mini-apps &mdash; mood, focus, habits, sleep, budget, tasks, notes, and more &mdash;
            in one calm desktop app that stays out of your way.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            {authLoaded && user ? (
              <>
                <a
                  data-slot="button"
                  className="btn-accent"
                  href={active?.href ?? platforms.windows.href}
                  aria-disabled={detecting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    height: '36px',
                    borderRadius: '0.75rem',
                    padding: '0 18px',
                    background: tokens.accent,
                    color: tokens.bg,
                    border: 'none',
                    cursor: detecting ? 'default' : 'pointer',
                    textDecoration: 'none',
                    opacity: detecting ? 0.6 : 1,
                    transition: 'color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                    pointerEvents: detecting ? 'none' as const : undefined,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 1v9M8 10l-3-3M8 10l3-3M2 13h12"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {detecting ? 'Detecting…' : `Download for ${active ? active.label : platforms.windows.label}`}
                </a>
                <Link
                  href="/pricing"
                  data-slot="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    height: '36px',
                    borderRadius: '0.75rem',
                    padding: '0 18px',
                    background: 'var(--color-highlight)',
                    color: 'var(--color-ink)',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  Pricing & Plans
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  data-slot="button"
                  className="btn-accent"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    height: '36px',
                    borderRadius: '0.75rem',
                    padding: '0 18px',
                    background: tokens.accent,
                    color: tokens.bg,
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  Get started
                </Link>
                <a
                  data-slot="button"
                  href={active?.href ?? platforms.windows.href}
                  aria-disabled={detecting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    height: '36px',
                    borderRadius: '0.75rem',
                    padding: '0 18px',
                    background: 'var(--color-highlight)',
                    color: 'var(--color-ink)',
                    border: 'none',
                    cursor: detecting ? 'default' : 'pointer',
                    textDecoration: 'none',
                    opacity: detecting ? 0.6 : 1,
                    transition: 'color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                    pointerEvents: detecting ? 'none' as const : undefined,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 1v9M8 10l-3-3M8 10l3-3M2 13h12"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {detecting ? 'Detecting…' : `Download for ${active ? active.label : platforms.windows.label}`}
                </a>
              </>
            )}
          </div>

          {/* Meta tags row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: tokens.inkFaint,
                background: tokens.highlight,
                padding: '4px 12px',
                borderRadius: '999px',
                letterSpacing: '0.02em',
              }}
            >
              v{version}
            </span>
            {Object.entries(platforms).map(([key, p]) => (
              <a
                data-slot="button"
                key={key}
                href={p.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  height: '26px',
                  borderRadius: '999px',
                  padding: '0 10px',
                  background: platform === key ? tokens.accent : tokens.highlight,
                  color: platform === key ? tokens.bg : tokens.inkFaint,
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  transition: 'color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {p.label}
              </a>
            ))}
            <span
              style={{
                fontSize: '0.72rem',
                color: tokens.inkFaint,
                background: tokens.highlight,
                padding: '4px 12px',
                borderRadius: '999px',
                letterSpacing: '0.02em',
              }}
            >
              {authLoaded && user ? 'Already signed in' : 'Try it'}
            </span>
          </div>
        </div>
      </section>

      <div
        style={{
          background: 'var(--color-bg)',
          padding: '0 28px clamp(3rem, 5vw, 5rem)',
        }}
      >
        <div
          style={{
            borderRadius: '12px',
            overflow: 'hidden',
            background: tokens.surface,
            maxWidth: tokens.contentMax,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <Image
            src="/images/hero-app-screenshot.png"
            alt="Bento tasks view, showing a calendar with scheduled tasks for the month"
            width={1920}
            height={1132}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
            }}
          />
        </div>
      </div>
    </>
  );
}
