'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#f7f7f7',
            color: '#1a1a1a',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ maxWidth: '420px', display: 'grid', gap: '1rem' }}>
            <p
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#1a1a1a',
              }}
            >
              Error
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.04em',
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: '#555', maxWidth: '36ch', marginInline: 'auto', lineHeight: 1.5 }}>
              A critical error occurred. Please try refreshing.
            </p>
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 18px',
                  height: '36px',
                  borderRadius: '0.75rem',
                  background: '#1a1a1a',
                  color: '#f7f7f7',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
