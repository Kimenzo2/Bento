import type { Metadata } from 'next';
import { Inter, DM_Sans, Instrument_Serif } from 'next/font/google';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
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
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 15 separate places?',
    template: '%s — Bento',
  },
  description:
    'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 15 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
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
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 15 separate places?',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 15 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
    type: 'website',
    url: '/',
    siteName: 'Bento',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Your sleep, mood, and habits affect each other every day. So why are you tracking them in 15 separate places?',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 15 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
