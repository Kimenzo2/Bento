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
    <section
      id="hero-section"
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: 'var(--color-bg)',
      }}
      aria-labelledby="hero-heading"
    >
      {/* ── Background image ── */}
      <Image
        src="/images/hero-bg.png"
        alt=""
        fill
        priority
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0,
        }}
      />

      {/* ── Text content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '720px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
          padding: '56px 28px',
        }}
      >
        <div
          className="hero-stagger"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
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
              color: '#1a1a1a',
            }}
          >
            Windows, macOS & Linux
          </p>
        </div>

        <h1
          id="hero-heading"
          className="hero-heading hero-stagger"
          style={{
            fontFamily: tokens.fontFamilyHero,
            fontSize: tokens.heroSize,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.05em',
            margin: 0,
            maxWidth: '720px',
            textAlign: 'center',
            textWrap: 'balance',
          }}
        >
          Take back{' '}
          <span
            className="hero-accent"
            style={{
              fontFamily: tokens.fontFamilyHeroAccent,
              fontStyle: 'italic',
              fontWeight: 400,
            }}
          >
            Control
          </span>{' '}
          of your Life
        </h1>

        <p
          className="hero-stagger"
          style={{
            fontFamily: tokens.fontFamilyDisplay,
            fontSize: tokens.subheadSize,
            lineHeight: 1.65,
            color: '#555555',
            maxWidth: '520px',
          }}
        >
          15 mini-apps &mdash; mood, focus, habits, sleep, budget, tasks, notes, and more &mdash; in
          one calm desktop app that stays out of your way.
        </p>

        <div
          className="hero-stagger"
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
                className="btn-accent hero-btn"
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
                  background: '#1a1a1a',
                  color: '#f7f7f7',
                  border: 'none',
                  cursor: detecting ? 'default' : 'pointer',
                  textDecoration: 'none',
                  opacity: detecting ? 0.6 : 1,
                  transition:
                    'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: detecting ? ('none' as const) : undefined,
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
                {detecting
                  ? 'Detecting\u2026'
                  : `Download for ${active ? active.label : platforms.windows.label}`}
              </a>
              <Link
                href="/pricing"
                data-slot="button"
                className="hero-btn"
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
                  background: 'rgba(0,0,0,0.06)',
                  color: '#1a1a1a',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition:
                    'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1)',
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
                className="btn-accent hero-btn"
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
                  background: '#1a1a1a',
                  color: '#f7f7f7',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition:
                    'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              >
                Get started
              </Link>
              <a
                data-slot="button"
                className="hero-btn"
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
                  background: 'rgba(0,0,0,0.06)',
                  color: '#1a1a1a',
                  border: 'none',
                  cursor: detecting ? 'default' : 'pointer',
                  textDecoration: 'none',
                  opacity: detecting ? 0.6 : 1,
                  transition:
                    'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease',
                  pointerEvents: detecting ? ('none' as const) : undefined,
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
                {detecting
                  ? 'Detecting\u2026'
                  : `Download for ${active ? active.label : platforms.windows.label}`}
              </a>
            </>
          )}
        </div>

        {/* Meta tags row */}
        <div
          className="hero-stagger"
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
              fontWeight: 500,
              height: '28px',
              borderRadius: '0.75rem',
              padding: '0 12px',
              color: '#8a8a8a',
              background: 'rgba(0,0,0,0.04)',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
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
              className={platform === key ? 'btn-accent hero-btn' : 'hero-btn'}
              style={{
                fontSize: '0.72rem',
                fontWeight: 500,
                height: '28px',
                borderRadius: '0.75rem',
                padding: '0 12px',
                background: platform === key ? '#1a1a1a' : 'rgba(0,0,0,0.04)',
                color: platform === key ? '#f7f7f7' : '#8a8a8a',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
                transition:
                  'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── App screenshot (peeks through hero bg into normal bg below) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '-360px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(80vw, 860px)',
          zIndex: 1,
        }}
      >
        <div
          style={{
            borderRadius: '12px',
            overflow: 'hidden',
            background: tokens.surface,
            outline: '1px solid rgba(0, 0, 0, 0.1)',
            outlineOffset: '-1px',
          }}
        >
          <Image
            src="/images/hero-app-screenshot.png"
            alt="Bento tasks view, showing a calendar with scheduled tasks for the month"
            width={1920}
            height={1132}
            priority
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
            }}
          />
        </div>
      </div>
    </section>
  );
}
