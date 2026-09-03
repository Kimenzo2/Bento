// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { Metadata } from 'next';
import { Inter, DM_Sans, Instrument_Serif } from 'next/font/google';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ThemeInit from '../components/ThemeInit';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-instrument-serif',
});

const biscotti = localFont({
  src: '../public/fonts/biscotti.woff2',
  display: 'swap',
  variable: '--font-biscotti',
});

const baseUrl = 'https://iamazeyou.me';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default:
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 17 separate places?',
    template: '%s — Bento',
  },
  description:
    'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 17 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
  keywords: [
    'productivity app',
    'desktop app',
    'habit tracker',
    'focus timer',
    'mood tracker',
    'private productivity',
    'windows app',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title:
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 17 separate places?',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 17 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
    type: 'website',
    url: '/',
    siteName: 'Bento',
    locale: 'en_US',
    images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 17 separate places?',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 17 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
    images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630 }],
  },
  alternates: { canonical: '/' },
  other: {
    'apple-touch-icon': '/bento-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f7f7f7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/bento-icon.png" type="image/png" />
        <ThemeInit />
      </head>
      <body
        className={`${inter.variable} ${dmSans.variable} ${instrumentSerif.variable} ${biscotti.variable}`}
      >
        <a
          href="#main-content"
          className="skip-link"
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '16px',
            zIndex: 100,
            padding: '8px 16px',
            background: 'var(--color-ink)',
            color: 'var(--color-bg)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Skip to content
        </a>
        <style>{`.skip-link:focus-visible{left:16px !important;outline:2px solid var(--color-accent);outline-offset:2px}html{scroll-behavior:smooth}section[id],div[id]{scroll-margin-top:64px}@media (prefers-reduced-motion: reduce){.stagger-item,.hero-stagger{animation:none !important;transition:none !important}.hero-stagger{opacity:1 !important;transform:none !important}}`}</style>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
