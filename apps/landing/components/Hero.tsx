'use client';

import Image from 'next/image';
import { useState } from 'react';
import { tokens } from './tokens';

type Platform = 'windows' | 'macos' | 'linux';
type PlatformInfo = { label: string; arch: string; href: string };

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return null;
}

export default function Hero({
  version,
  platforms,
}: {
  version: string;
  platforms: Record<Platform, PlatformInfo>;
}) {
  const [platform] = useState(detectPlatform);
  const active = platform ? platforms[platform] : null;

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: tokens.heroGradient,
        paddingTop: '60px',
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
        <p
          style={{
            fontSize: tokens.labelSize,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tokens.accent,
            marginBottom: '24px',
          }}
        >
          Available for Windows, macOS, and Linux
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '28px',
            flexWrap: 'wrap',
          }}
        >
          <Image
            src="/bento-icon.png"
            alt="Bento app icon"
            width={72}
            height={72}
            style={{
              borderRadius: '18px',
              flexShrink: 0,
              marginTop: '6px',
            }}
          />
          <div style={{ flex: 1, minWidth: '260px' }}>
            <h1
              id="hero-heading"
              style={{
                fontSize: tokens.heroSize,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-0.025em',
                color: tokens.ink,
                margin: 0,
                maxWidth: '780px',
              }}
            >
              One place for the habits, rhythms, and rituals that make your day feel like yours.
            </h1>
          </div>
        </div>

        <p
          style={{
            fontSize: '1.15rem',
            lineHeight: 1.65,
            color: tokens.inkMuted,
            maxWidth: tokens.textMax,
            marginTop: '32px',
            marginBottom: '40px',
          }}
        >
          Bento is a calm, private desktop app with twelve tools built in &mdash; mood, focus,
          habits, sleep, nutrition, budget, tasks, recipes, countdowns, passwords, notes, and a
          gentle AI chat. Everything you need to run your day, nothing you don&rsquo;t.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <a
            className="cta-primary"
            href={active ? active.href : platforms.windows.href}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              background: tokens.accent,
              color: tokens.bg,
              borderRadius: '100px',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
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
            Download for {active ? active.label : 'Windows'} &mdash; free
          </a>

          <span
            style={{
              fontSize: tokens.smallSize,
              color: tokens.inkFaint,
            }}
          >
            v{version} {active ? active.arch : 'Windows 64-bit'} &mdash; free installer
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '24px',
          }}
        >
          {Object.entries(platforms).map(([key, p]) => (
            <a
              className="cta-secondary"
              key={key}
              href={p.href}
              download
              style={{
                padding: '7px 16px',
                borderRadius: '100px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: platform === key ? tokens.accent : tokens.inkMuted,
                background: platform === key ? tokens.accentGlow : 'transparent',
                textDecoration: 'none',
                border: '1px solid ' + (platform === key ? tokens.accentLine : tokens.highlight),
              }}
            >
              {p.label} installer
            </a>
          ))}
        </div>

        <div
          style={{
            marginTop: 'clamp(3rem, 6vw, 5rem)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: tokens.surface,
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
