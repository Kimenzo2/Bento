import { tokens } from './tokens';

const CDN = 'https://cdn.crabnebula.app/download/bento-industries/bento/latest/platform';

export default function DownloadSection({ version }: { version: string }) {
  return (
    <section
      id="download"
      style={{
        background: 'var(--color-bg)',
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="download-heading"
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'center',
        }}
      >
        <div>
          <p
            style={{
              fontSize: tokens.labelSize,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: tokens.accent,
              marginBottom: '16px',
            }}
          >
            Ready when you are
          </p>
          <h2
            id="download-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: '0 0 18px',
              maxWidth: '480px',
            }}
          >
            Private. Local-first. Offline-ready.
          </h2>
          <p
            className="text-body"
            style={{
              marginBottom: '32px',
              maxWidth: '420px',
            }}
          >
            Sign in with Google and you&rsquo;re in &mdash; no onboarding tour, no setup wizard. All
            your data lives on your machine and works fully offline. Upgrade only when you want
            more.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { label: 'Windows', href: CDN + '/nsis-x86_64' },
              { label: 'macOS', href: CDN + '/dmg-universal' },
              { label: 'Linux', href: CDN + '/appimage-x86_64' },
            ].map((p) => (
              <a
                key={p.label}
                data-slot="button"
                className="btn-accent"
                href={p.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  height: '36px',
                  borderRadius: '0.75rem',
                  padding: '0 18px',
                  background: tokens.accent,
                  color: tokens.bg,
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 1v9M8 10l-3-3M8 10l3-3M2 13h12"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {p.label}
              </a>
            ))}
          </div>

          <p
            style={{
              fontSize: tokens.labelSize,
              color: tokens.inkFaint,
              marginTop: '14px',
            }}
          >
            v{version}
          </p>
        </div>

        <div
          style={{
            flex: '1',
            borderRadius: '1.5rem',
            background: tokens.elevated,
            padding: '12px 16px',
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: tokens.ink,
              letterSpacing: '-0.01em',
            }}
          >
            Includes v{version}
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: '16px 0 0',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {[
              'Seventeen mini-apps in one desktop app',
              'Works fully offline — no internet required',
              'Light and dark themes, everywhere',
              'Available on Windows, macOS, and Linux',
            ].map((note) => (
              <li
                key={note}
                className="text-body"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  style={{ marginTop: '3px', flexShrink: 0 }}
                >
                  <circle cx="8" cy="8" r="7" stroke={tokens.accent} strokeWidth="1.25" />
                  <path
                    d="M5 8l2.25 2.25L11 6"
                    stroke={tokens.accent}
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {note}
              </li>
            ))}
          </ul>

          <div
            className="text-body"
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid ' + tokens.highlight,
              fontSize: '0.75rem',
            }}
          >
            Also on macOS and Linux. Questions?{' '}
            <a
              href="mailto:support@iamazeyou.me"
              style={{ color: tokens.accent, textDecoration: 'none' }}
            >
              Say hello.
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
