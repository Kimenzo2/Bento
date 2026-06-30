import type { Metadata } from 'next';
import { Inter, DM_Sans } from 'next/font/google';
import localFont from 'next/font/local';
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

const biscotti = localFont({
  src: '../public/fonts/biscotti.woff2',
  display: 'swap',
  variable: '--font-biscotti',
});

export const metadata: Metadata = {
  title: 'Bento — Your whole day, one warm desktop app',
  description:
    'Bento is a calm, private desktop app with twelve built-in tools for the rhythms that make your day feel like yours: mood, focus, habits, sleep, nutrition, budget, tasks, recipes, countdowns, passwords, notes, and a gentle AI chat.',
  keywords: [
    'productivity app',
    'desktop app',
    'habit tracker',
    'focus timer',
    'mood tracker',
    'private productivity',
    'windows app',
  ],
  openGraph: {
    title: 'Bento — A calm desktop app for real days',
    description:
      'Twelve thoughtful tools in one private desktop app. No subscriptions per feature. No hype. Just the stuff that helps your day feel more like yours.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/bento-icon.png" type="image/png" />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} ${biscotti.variable}`}>{children}</body>
    </html>
  );
}
