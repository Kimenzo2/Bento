'use client';

import { useEffect, useState } from 'react';

function readThemeCookie(): 'light' | 'dark' | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)theme=(dark|light)(?:;|$)/);
    return m ? (m[1] as 'light' | 'dark') : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const cookie = readThemeCookie();
    const initial = cookie ?? getSystemTheme();
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!readThemeCookie()) {
        const next = e.matches ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    } catch {}
  }

  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '0.75rem',
        background: 'var(--color-highlight)',
        color: 'var(--color-ink)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
        transition:
          'background 200ms cubic-bezier(0.23, 1, 0.32, 1), color 200ms cubic-bezier(0.23, 1, 0.32, 1)',
        fontSize: '1rem',
        lineHeight: 1,
      }}
    >
      {dark ? (
        /* Sun icon — switch to light */
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 1v2M9 15v2M1 9h2M15 9h2M3.05 3.05l1.41 1.41M13.54 13.54l1.41 1.41M3.05 14.95l1.41-1.41M13.54 4.46l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        /* Moon icon — switch to dark */
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M15 10.5a7 7 0 01-7.5-7.5A7 7 0 1015 10.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
