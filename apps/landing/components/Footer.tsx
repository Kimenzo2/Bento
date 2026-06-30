import Image from 'next/image';
import { tokens } from './tokens';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: tokens.bg,
        padding: 'clamp(3rem, 6vw, 5rem) 28px',
        borderTop: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '48px',
        }}
      >
        <div style={{ maxWidth: '260px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <Image
              src="/bento-icon.png"
              alt="Bento"
              width={24}
              height={24}
              style={{ borderRadius: '6px' }}
            />
            <span
              style={{
                fontWeight: 400,
                fontSize: '1.15rem',
                color: tokens.ink,
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-biscotti), var(--font-inter), system-ui, sans-serif',
              }}
            >
              Bento
            </span>
          </div>
          <p
            className="text-body"
            style={{
              margin: 0,
            }}
          >
            A calm desktop app for people who want to take their day back.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(40px, 6vw, 80px)',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: tokens.labelSize,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: tokens.inkFaint,
                  marginBottom: '16px',
                }}
              >
                Product
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                  {[
                    { label: 'Apps', href: '#apps' },
                    { label: 'Why Bento', href: '#why' },
                    { label: 'Download', href: '#download' },
                  ].map((l) => (
                    <li key={l.href}>
                      <a
                        className="footer-link"
                        href={l.href}
                        style={{
                          textDecoration: 'none',
                        }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>

            <div>
              <p
                style={{
                  fontSize: tokens.labelSize,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: tokens.inkFaint,
                  marginBottom: '16px',
                }}
              >
                Support
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                  {[
                    { label: 'Email support', href: 'mailto:support@iamazeyou.me' },
                    { label: 'Privacy Policy', href: '/legal/privacy' },
                    { label: 'Terms of Service', href: '/legal/terms' },
                  ].map((l) => (
                    <li key={l.label}>
                      <a
                        className="footer-link"
                        href={l.href}
                        style={{
                          textDecoration: 'none',
                        }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>

      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          paddingTop: '36px',
          marginTop: '36px',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <p
          style={{
            fontSize: tokens.labelSize,
            color: tokens.inkFaint,
            margin: 0,
          }}
        >
          &copy; {year} Bento. All rights reserved.
        </p>
        <p
          style={{
            fontSize: '0.65rem',
            color: tokens.inkFaint,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Made with care, not noise.
        </p>
      </div>
    </footer>
  );
}
