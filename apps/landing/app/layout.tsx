import type { Metadata } from 'next';
import './globals.css';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
