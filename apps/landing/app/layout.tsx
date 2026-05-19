import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bento Desktop',
  description: 'Marketing front-door for Bento Desktop',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
