'use client';

import Image from 'next/image';
import { tokens } from './tokens';
import { useDownload } from './useDownload';
import type { Platform, PlatformInfo } from './useDownload';

export default function Hero({
  version,
  platforms,
}: {
  version: string;
  platforms: Record<Platform, PlatformInfo>;
}) {
  const { platform, active, detecting } = useDownload(platforms);

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: `radial-gradient(ellipse 80% 60% at 50% -20%, rgba(122, 155, 181, 0.08) 0%, transparent 60%), linear-gradient(180deg, #0c0b0a 0%, #141315 50%, #0c0b0a 100%)`,
        paddingTop: '64px',
      }}
      aria-labelledby="hero-heading"
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          padding: tokens.sectionPad + ' 28px',
          width: '100%',
        }}
      >
        <div style={{ maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
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
            }}
          >
            A quiet place for your whole day.
          </h1>

          <p
            style={{
              fontSize: tokens.subheadSize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              maxWidth: tokens.textMax,
              marginTop: '24px',
              marginBottom: '40px',
            }}
          >
            Twelve tools &mdash; mood, focus, habits, sleep, budget, tasks, notes, and more &mdash;
            in one calm desktop app that stays out of your way.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
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
                transition: 'color 0.15s ease, box-shadow 0.15s ease',
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

            <span
              style={{
                fontSize: tokens.smallSize,
                color: tokens.inkFaint,
              }}
            >
              v{version} &mdash; sign in with Google to start
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '20px',
            }}
          >
            {Object.entries(platforms).map(([key, p]) => (
              <a
                data-slot="button"
                key={key}
                href={p.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  height: '28px',
                  borderRadius: '0.75rem',
                  padding: '0 10px',
                  background: platform === key ? 'rgba(122, 155, 181, 0.15)' : 'rgba(255,255,255,0.06)',
                  color: platform === key ? '#7a9bb5' : 'rgba(220,224,230,0.8)',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 'clamp(4rem, 8vw, 6rem)',
            borderRadius: '12px',
            overflow: 'hidden',
            background: tokens.surface,
            border: '1px solid rgba(255,255,255,0.04)',
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
    </section>
  );
}
