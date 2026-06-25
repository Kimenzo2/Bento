'use client';
/**
 * Nav — Bento Landing
 *
 * Minimal top bar. Transparent until scrolled, then warm cream.
 * Mobile: collapses to a clean drawer.
 */

import { useEffect, useState } from 'react';
import { tokens } from './tokens';

import Image from 'next/image';

const NAV_LINKS = [
  { label: 'Apps', href: '#apps' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Why Bento', href: '#why' },
  { label: 'Download', href: '#download' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (href: string) => {
    setOpen(false);
    if (!href.startsWith('#')) {
      window.location.href = href;
      return;
    }
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: scrolled ? '1px solid rgba(184,92,58,0.12)' : '1px solid transparent',
        background: scrolled ? tokens.surface : 'transparent',
        transition: 'background 0.25s, border-color 0.25s',
      }}
      aria-label="Primary navigation"
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 28px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Back to top"
        >
          <Image
            src="/bento-icon.png"
            alt="Bento"
            width={28}
            height={28}
            style={{ borderRadius: '6px' }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: '1.05rem',
              color: tokens.ink,
              letterSpacing: '-0.01em',
            }}
          >
            Bento
          </span>
        </button>

        {/* Desktop links */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          className="nav-desktop"
        >
          {NAV_LINKS.map((link) => (
            <button
              className="nav-link"
              key={link.href}
              type="button"
              onClick={() => handleAnchor(link.href)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 14px',
                fontSize: '0.9rem',
                color: tokens.inkMuted,
                borderRadius: '8px',
                fontWeight: 500,
              }}
            >
              {link.label}
            </button>
          ))}
          <a
            className="nav-cta"
            href="#download"
            style={{
              marginLeft: '8px',
              padding: '9px 20px',
              background: tokens.accent,
              color: '#fff',
              borderRadius: '100px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}
          >
            Download
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="nav-mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'none',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '22px',
              height: '2px',
              background: tokens.ink,
              marginBottom: '5px',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(45deg) translateY(7px)' : 'none',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '22px',
              height: '2px',
              background: tokens.ink,
              marginBottom: '5px',
              opacity: open ? 0 : 1,
              transition: 'opacity 0.2s',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '22px',
              height: '2px',
              background: tokens.ink,
              transform: open ? 'rotate(-45deg) translateY(-7px)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{
            background: tokens.surface,
            borderTop: '1px solid rgba(184,92,58,0.12)',
            padding: '16px 28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
          className="nav-drawer"
        >
          {NAV_LINKS.map((link) => (
            <button
              className="nav-link"
              key={link.href}
              type="button"
              onClick={() => handleAnchor(link.href)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '12px 4px',
                fontSize: '1rem',
                color: tokens.ink,
                fontWeight: 500,
              }}
            >
              {link.label}
            </button>
          ))}
          <a
            className="nav-cta"
            href="#download"
            style={{
              marginTop: '12px',
              display: 'block',
              textAlign: 'center',
              padding: '14px',
              background: tokens.accent,
              color: '#fff',
              borderRadius: '100px',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Download
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 700px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-toggle { display: flex !important; flex-direction: column; }
        }
        @media (min-width: 701px) {
          .nav-drawer { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
