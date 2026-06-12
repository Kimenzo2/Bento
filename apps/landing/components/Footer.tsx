/**
 * Footer — Bento Landing
 *
 * Warm dark footer. Brand mark, tagline, a couple of links.
 * Uses warm dark brown (#2c2418) instead of cold near-black.
 */

import Image from 'next/image';
import { tokens } from './tokens';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: tokens.ink,
        padding: 'clamp(3rem, 6vw, 5rem) 28px',
        color: '#fff',
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
          gap: '40px',
        }}
      >
        {/* Brand */}
        <div style={{ maxWidth: '280px' }}>
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
              width={26}
              height={26}
              style={{ borderRadius: '6px' }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              Bento
            </span>
          </div>
          <p
            style={{
              fontSize: tokens.smallSize,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.5)',
              margin: 0,
            }}
          >
            A calm desktop app for people who want to take their day back.
          </p>
        </div>

        {/* Links */}
        <nav aria-label="Footer navigation">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(32px, 5vw, 80px)',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: tokens.labelSize,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '14px',
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
                        fontSize: tokens.smallSize,
                        color: 'rgba(255,255,255,0.6)',
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
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '14px',
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
                  { label: 'Email support', href: 'mailto:support@bentoproductivity.app' },
                  { label: 'Privacy Policy', href: '/legal/privacy' },
                  { label: 'Terms of Service', href: '/legal/terms' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      className="footer-link"
                      href={l.href}
                      style={{
                        fontSize: tokens.smallSize,
                        color: 'rgba(255,255,255,0.6)',
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

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          paddingTop: '40px',
          marginTop: '40px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
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
            color: 'rgba(255,255,255,0.3)',
            margin: 0,
          }}
        >
          © {year} Bento. All rights reserved.
        </p>
        <p
          style={{
            fontSize: tokens.labelSize,
            color: 'rgba(255,255,255,0.3)',
            margin: 0,
          }}
        >
          Made with care. Runs on your machine.
        </p>
      </div>
    </footer>
  );
}
