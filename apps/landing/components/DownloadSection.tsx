/**
 * DownloadSection - Bento Landing
 *
 * Warm final CTA. Restates the value. Big download button.
 * Version comes from the server (page.tsx).
 * Installers served from /downloads/ directory.
 */

import { tokens } from './tokens';

export default function DownloadSection({ version }: { version: string }) {
  const winHref = '/downloads/Bento_' + version + '_x64-setup.exe';

  return (
    <section
      id="download"
      style={{
        background: tokens.heroGradient,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="download-heading"
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
              margin: '0 0 20px',
              maxWidth: '500px',
            }}
          >
            Download Bento and settle in.
          </h2>
          <p
            style={{
              fontSize: tokens.bodySize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              marginBottom: '32px',
              maxWidth: '440px',
            }}
          >
            No account. No credit card. No onboarding flow that takes twenty minutes. Install it,
            open it, and start the day.
          </p>

          <a
            className="cta-primary"
            href={winHref}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '15px 30px',
              background: tokens.accent,
              color: '#fff',
              borderRadius: '100px',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
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
            Download for free
          </a>

          <p
            style={{
              fontSize: tokens.labelSize,
              color: tokens.inkFaint,
              marginTop: '14px',
            }}
          >
            v{version} &mdash; Available for Windows, macOS, and Linux
          </p>
        </div>

        <div
          style={{
            background: tokens.surfaceAlt,
            borderRadius: '20px',
            padding: '32px 28px',
          }}
        >
          <p
            style={{
              fontSize: tokens.smallSize,
              fontWeight: 600,
              color: tokens.ink,
              marginBottom: '18px',
              letterSpacing: '-0.01em',
            }}
          >
            What&rsquo;s in v{version}
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {[
              'All twelve apps included at launch',
              'Fully offline \u2014 no internet required after install',
              'Light and dark theme across every app',
              'Native installers for Windows, macOS, and Linux',
            ].map((note) => (
              <li
                key={note}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: tokens.smallSize,
                  color: tokens.inkMuted,
                  lineHeight: 1.5,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  aria-hidden="true"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                >
                  <circle
                    cx="7.5"
                    cy="7.5"
                    r="7"
                    stroke={tokens.accentSecondary}
                    strokeWidth="1.25"
                  />
                  <path
                    d="M4.5 7.5l2.25 2.25L10.5 5.5"
                    stroke={tokens.accentSecondary}
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
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid ' + tokens.surfaceWarm,
              fontSize: tokens.labelSize,
              color: tokens.inkFaint,
            }}
          >
            Also available for macOS and Linux. <br />
            Questions?{' '}
            <a
              href="mailto:support@bentoproductivity.app"
              style={{ color: tokens.accent, textDecoration: 'none' }}
            >
              Get in touch.
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
