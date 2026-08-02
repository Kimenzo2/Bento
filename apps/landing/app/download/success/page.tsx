// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

'use client';

import { useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Platform = 'windows' | 'macos' | 'linux';

const platformData: Record<
  Platform,
  {
    title: string;
    subtitle: string;
    steps: { label: string; detail?: string }[];
    tip?: string;
    advanced?: { label: string; code: string };
  }
> = {
  windows: {
    title: "You're all set.",
    subtitle: "Windows will show a warning — it's safe, just unsigned. Here's how to get past it.",
    steps: [
      { label: 'Click "More info" when SmartScreen appears' },
      { label: 'Click "Run anyway"' },
    ],
    tip: "That's it. Bento is yours.",
  },
  macos: {
    title: "You're all set.",
    subtitle: "macOS will block the first launch — it's normal. Here's how to open it.",
    steps: [
      { label: 'Find Bento.app in Finder' },
      { label: 'Right-click it, then click Open' },
      { label: 'Click Open again to confirm' },
    ],
    tip: "That's it. Bento is yours.",
    advanced: {
      label: 'Or use Terminal',
      code: 'xattr -d com.apple.quarantine /Applications/Bento.app',
    },
  },
  linux: {
    title: "You're all set.",
    subtitle: "One quick terminal step and you're in.",
    steps: [
      { label: 'Open Terminal in your Downloads folder' },
      { label: 'Run: chmod +x Bento.AppImage' },
      { label: 'Run: ./Bento.AppImage' },
    ],
    tip: "That's it. Bento is yours.",
  },
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const platform = (searchParams.get('platform') as Platform) || 'windows';
  const downloadUrl = searchParams.get('dl') || '';
  const info = platformData[platform] || platformData.windows;
  const [show, setShow] = useState(false);

  const triggerDownload = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl]);

  useEffect(() => {
    triggerDownload();
  }, [triggerDownload]);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 28px 60px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* Logo + checkmark */}
        <div
          style={{
            position: 'relative',
            width: '72px',
            height: '72px',
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
            transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1), transform 500ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          <Image
            src="/bento-icon.png"
            alt="Bento"
            width={72}
            height={72}
            style={{
              borderRadius: '18px',
              outline: '1px solid oklch(0 0 0 / 0.1)',
              outlineOffset: '-1px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 8l3 3 5-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div
          style={{
            textAlign: 'center',
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1) 80ms, transform 500ms cubic-bezier(0.23, 1, 0.32, 1) 80ms',
          }}
        >
          <h1
            style={{
              fontFamily: "'Inter Display', var(--font-inter), system-ui, sans-serif",
              fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              color: 'var(--color-ink)',
              margin: '0 0 12px',
              textWrap: 'balance',
            }}
          >
            {info.title}
          </h1>
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: 'var(--color-ink-muted)',
              maxWidth: '380px',
              margin: '0 auto',
            }}
          >
            {info.subtitle}
          </p>
        </div>

        {/* Steps card */}
        <div
          style={{
            width: '100%',
            background: 'var(--color-surface)',
            borderRadius: '1.25rem',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1) 160ms, transform 500ms cubic-bezier(0.23, 1, 0.32, 1) 160ms',
          }}
        >
          {info.steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  color: 'var(--color-bg)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {i + 1}
              </span>
              <div>
                <p
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-ink-muted)',
                      margin: '4px 0 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        {info.tip && (
          <p
            style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'var(--color-ink-faint)',
              textAlign: 'center',
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1) 280ms, transform 500ms cubic-bezier(0.23, 1, 0.32, 1) 280ms',
            }}
          >
            {info.tip}
          </p>
        )}

        {/* Advanced (macOS only) */}
        {info.advanced && (
          <details
            style={{
              width: '100%',
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1) 340ms, transform 500ms cubic-bezier(0.23, 1, 0.32, 1) 340ms',
            }}
          >
            <summary
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-ink-faint)',
                cursor: 'pointer',
                userSelect: 'none',
                listStyle: 'none',
              }}
            >
              {info.advanced.label}
            </summary>
            <code
              style={{
                display: 'block',
                marginTop: '10px',
                padding: '12px 16px',
                borderRadius: '0.75rem',
                background: 'var(--color-elevated)',
                fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
                fontSize: '0.8rem',
                color: 'var(--color-ink)',
                overflowX: 'auto',
                wordBreak: 'break-all',
              }}
            >
              {info.advanced.code}
            </code>
          </details>
        )}

        {/* Back link */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--color-ink-muted)',
            textDecoration: 'none',
            transition: 'color 160ms ease, transform 150ms ease',
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0) scale(1)' : 'translateY(8px) scale(1)',
            marginTop: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-ink)';
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-ink-muted)';
            e.currentTarget.style.textDecoration = 'none';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to home
        </Link>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
