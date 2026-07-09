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
    'Bento is a calm, private desktop app with seventeen built-in mini-apps for the rhythms that make your day feel like yours: mood, focus, habits, sleep, nutrition, budget, tasks, countdowns, passwords, notes, journal, voice memos, clipboard, goals, health, and settings.',
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
      'Seventeen thoughtful mini-apps in one private desktop app. No subscriptions per feature. No hype. Just the stuff that helps your day feel more like yours.',
    type: 'website',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=(dark|light)(?:;|$)/);if(m){document.documentElement.setAttribute("data-theme",m[1])}else if(window.matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} ${biscotti.variable}`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
