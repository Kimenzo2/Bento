'use client';

import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';

type Platform = 'windows' | 'macos' | 'linux';

const instructions: Record<Platform, { title: string; subtitle: string; steps: string[]; note?: string; advanced?: { label: string; code: string } }> = {
  windows: {
    title: 'Windows SmartScreen Warning',
    subtitle: 'Get past SmartScreen in two clicks.',
    steps: [
      'When the SmartScreen dialog appears, click "More info".',
      'Click "Run anyway".',
    ],
    note: "It's safe — just unsigned.",
  },
  macos: {
    title: 'macOS Security Notice',
    subtitle: 'First launch? macOS will block it. Here\u2019s how to open it.',
    steps: [
      'Locate Bento.app in Finder.',
      'Right-click the app and click Open.',
      'Confirm by clicking Open again.',
    ],
    note: 'Alternatively, go to System Settings > Privacy & Security and click Open Anyway next to the Bento entry.',
    advanced: {
      label: 'Advanced — remove quarantine via terminal',
      code: 'xattr -d com.apple.quarantine /Applications/Bento.app',
    },
  },
  linux: {
    title: 'Linux Setup',
    subtitle: 'Make the AppImage executable and run it.',
    steps: [
      'Open a terminal in your Downloads folder.',
      'Run: chmod +x Bento.AppImage',
      'Run: ./Bento.AppImage',
    ],
    note: 'For .deb packages, run: sudo dpkg -i bento.deb',
  },
};

const platformIcons: Record<Platform, React.JSX.Element> = {
  windows: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18M12 3v18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  macos: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
      <path d="M8 4v3M16 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  linux: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
      <path d="M12 9.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const platform = (searchParams.get('platform') as Platform) || 'windows';
  const downloadUrl = searchParams.get('dl') || '';
  const info = instructions[platform] || instructions.windows;
  const icon = platformIcons[platform] || platformIcons.windows;

  useEffect(() => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl]);

  return (
    <main className="success-page">
      <div className="success-page__inner">
        <Link href="/download" className="success-page__back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to downloads
        </Link>

        <div className="success-page__card">
          <div className="success-page__icon">{icon}</div>
          <h1 className="success-page__title">{info.title}</h1>
          <p className="success-page__subtitle">{info.subtitle}</p>

          <ol className="success-page__steps">
            {info.steps.map((step, i) => (
              <li key={i} className="success-page__step">
                <span className="success-page__step-num">{i + 1}</span>
                <span className="success-page__step-text">{step}</span>
              </li>
            ))}
          </ol>

          {info.note && <p className="success-page__note">{info.note}</p>}

          {info.advanced && (
            <details className="success-page__advanced">
              <summary>{info.advanced.label}</summary>
              <code className="success-page__code">{info.advanced.code}</code>
            </details>
          )}
        </div>
      </div>
      <style>{successStyles}</style>
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

const successStyles = `
  .success-page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-ink);
  }
  .success-page__inner {
    max-width: 520px;
    margin: 0 auto;
    padding: 4rem 1.5rem 4rem;
    display: grid;
    gap: 1.5rem;
  }
  .success-page__back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--color-ink-muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .success-page__back:hover {
    color: var(--color-ink);
  }
  .success-page__card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 1.25rem;
    padding: 2.5rem 2rem;
    display: grid;
    gap: 0.5rem;
  }
  .success-page__icon {
    width: 3rem;
    height: 3rem;
    display: grid;
    place-items: center;
    border-radius: 0.75rem;
    background: var(--color-highlight);
    color: var(--color-accent);
    margin-bottom: 0.5rem;
  }
  .success-page__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .success-page__subtitle {
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
  .success-page__steps {
    margin: 1.5rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1rem;
  }
  .success-page__step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .success-page__step-num {
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .success-page__step-text {
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--color-ink);
  }
  .success-page__note {
    margin: 1.5rem 0 0;
    font-size: 0.85rem;
    color: var(--color-ink-muted);
    line-height: 1.6;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }
  .success-page__advanced {
    margin-top: 1rem;
  }
  .success-page__advanced summary {
    font-size: 0.8rem;
    color: var(--color-ink-muted);
    cursor: pointer;
    user-select: none;
  }
  .success-page__advanced summary:hover {
    color: var(--color-ink);
  }
  .success-page__code {
    display: block;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: var(--color-elevated);
    font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
    font-size: 0.8rem;
    color: var(--color-ink);
    overflow-x: auto;
    word-break: break-all;
  }
`;
