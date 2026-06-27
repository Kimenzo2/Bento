'use client';

import { useEffect, useState } from 'react';
import { tokens } from './tokens';
import Image from 'next/image';
import { useDownload } from './useDownload';
import type { Platform, PlatformInfo } from './useDownload';

const NAV_LINKS = [
  { label: 'Apps', href: '#apps' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Why Bento', href: '#why' },
];

const btn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
  fontSize: '0.875rem',
  fontWeight: 500,
  height: '28px',
  borderRadius: '0.75rem',
  padding: '0 12px',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(220,224,230,0.8)',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'color 0.15s ease, box-shadow 0.15s ease',
} as const;

export default function Nav({
  platforms,
}: {
  platforms: Record<Platform, PlatformInfo>;
}) {
  const { detecting, downloadHref, scrollToDownload } = useDownload(platforms);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
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
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
        background: scrolled ? 'rgba(12, 11, 10, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
      }}
      aria-label="Primary navigation"
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
          padding: '0 28px 0 8px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
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
              fontSize: '1rem',
              color: tokens.ink,
              letterSpacing: '-0.01em',
            }}
          >
            Bento
          </span>
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
          className="nav-desktop"
        >
          {NAV_LINKS.map((link) => (
            <button
              data-slot="button"
              key={link.href}
              type="button"
              onClick={() => handleAnchor(link.href)}
              style={btn}
              className="nav-btn"
            >
              {link.label}
            </button>
          ))}
          <button
            data-slot="button"
            className="btn-accent"
            type="button"
            disabled={detecting}
            onClick={() => {
              if (downloadHref) window.location.href = downloadHref;
              else scrollToDownload();
            }}
            style={{
              ...btn,
              marginLeft: '12px',
              background: tokens.accent,
              color: tokens.bg,
              opacity: detecting ? 0.6 : 1,
              cursor: detecting ? 'default' : 'pointer',
            }}
          >
            {detecting ? 'Checking…' : 'Download'}
          </button>
        </div>

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
              width: '20px',
              height: '1.5px',
              background: tokens.ink,
              marginBottom: '5px',
              transition: 'transform 0.2s, opacity 0.2s',
              transform: open ? 'rotate(45deg) translateY(6.5px)' : 'none',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '20px',
              height: '1.5px',
              background: tokens.ink,
              marginBottom: '5px',
              opacity: open ? 0 : 1,
              transition: 'opacity 0.2s',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '20px',
              height: '1.5px',
              background: tokens.ink,
              transition: 'transform 0.2s, opacity 0.2s',
              transform: open ? 'rotate(-45deg) translateY(-6.5px)' : 'none',
            }}
          />
        </button>
      </div>

      {open && (
        <div
          style={{
            background: tokens.surface,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            padding: '12px 28px 20px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
          className="nav-drawer"
        >
          {NAV_LINKS.map((link) => (
            <button
              data-slot="button"
              key={link.href}
              type="button"
              onClick={() => handleAnchor(link.href)}
              style={{ ...btn, width: '100%', justifyContent: 'flex-start' }}
            >
              {link.label}
            </button>
          ))}
          <button
            data-slot="button"
            className="btn-accent"
            type="button"
            disabled={detecting}
            onClick={() => {
              if (downloadHref) window.location.href = downloadHref;
              else scrollToDownload();
            }}
            style={{
              ...btn,
              width: '100%',
              justifyContent: 'center',
              marginTop: '8px',
              background: tokens.accent,
              color: tokens.bg,
              height: detecting ? '36px' : '36px',
              opacity: detecting ? 0.6 : 1,
              cursor: detecting ? 'default' : 'pointer',
            }}
          >
            {detecting ? 'Checking…' : 'Download'}
          </button>
        </div>
      )}

      <style>{`
        .nav-btn:hover { background: rgba(255,255,255,0.1) !important; }
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
