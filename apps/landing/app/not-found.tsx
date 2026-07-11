import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '420px', display: 'grid', gap: '1rem' }}>
        <p
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
          }}
        >
          Page not found
        </h1>
        <p
          className="text-body"
          style={{
            color: 'var(--color-ink-muted)',
            maxWidth: '36ch',
            marginInline: 'auto',
          }}
        >
          This page doesn&apos;t exist or has been moved. Head back home to find what you need.
        </p>
        <div style={{ marginTop: '0.5rem' }}>
          <Link
            href="/"
            data-slot="button"
            className="btn-accent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 18px',
              height: '36px',
              borderRadius: '0.75rem',
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
