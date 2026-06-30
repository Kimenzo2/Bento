'use client';

import { useEffect, useState } from 'react';
import { tokens } from './tokens';
import Image from 'next/image';
import Link from 'next/link';
import { useDownload } from './useDownload';
import type { Platform, PlatformInfo } from './useDownload';
import { createClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

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
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Load auth state
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
      setAuthLoaded(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoaded(true);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      subscription.unsubscribe();
    };
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: scrolled ? '8px 16px' : '16px 16px 0',
        transition: 'padding 300ms ease',
      }}
      aria-label="Primary navigation"
    >
      <div
        style={{
          maxWidth: tokens.contentMax,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '46px',
            padding: scrolled ? '0 8px' : '0 10px',
            background: scrolled
              ? 'linear-gradient(180deg, rgba(18,17,16,0.78) 0%, rgba(12,11,10,0.82) 100%)'
              : 'transparent',
            backdropFilter: scrolled ? 'blur(24px)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
            borderRadius: '16px',
            border: scrolled ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            boxShadow: scrolled ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
            transition: 'background 300ms ease, backdrop-filter 300ms ease, border 300ms ease, box-shadow 300ms ease, padding 300ms ease',
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
                fontWeight: 400,
                fontSize: '1.3rem',
                color: tokens.ink,
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-biscotti), var(--font-inter), system-ui, sans-serif',
              }}
            >
              Bento
            </span>
          </button>

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

            {/* Auth buttons */}
            {authLoaded && user ? (
              <>
                <Link
                  href="/pricing"
                  data-slot="button"
                  style={{ ...btn, textDecoration: 'none' }}
                  className="nav-btn"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{ ...btn, fontSize: '0.78rem', opacity: 0.6 }}
                  className="nav-btn"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  data-slot="button"
                  className="btn-accent nav-btn-accent"
                  type="button"
                  style={{
                    ...btn,
                    marginLeft: '8px',
                    background: tokens.accent,
                    color: tokens.bg,
                  }}
                >
                  Get started
                </Link>
              </>
            )}

            {/* Download button */}
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
                marginLeft: '16px',
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
              marginTop: '8px',
              borderRadius: '16px',
              background: 'linear-gradient(180deg, rgba(18,17,16,0.92) 0%, rgba(12,11,10,0.95) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
              padding: '12px 12px 20px',
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
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
            {authLoaded && user ? (
              <>
                <Link
                  href="/pricing"
                  data-slot="button"
                  style={{ ...btn, width: '100%', justifyContent: 'flex-start', textDecoration: 'none' }}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{ ...btn, width: '100%', justifyContent: 'flex-start', fontSize: '0.78rem', opacity: 0.6 }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  data-slot="button"
                  className="btn-accent"
                  style={{
                    ...btn,
                    width: '100%',
                    justifyContent: 'center',
                    background: tokens.accent,
                    color: tokens.bg,
                    textDecoration: 'none',
                  }}
                >
                  Get started
                </Link>
              </>
            )}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
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
                height: '36px',
                opacity: detecting ? 0.6 : 1,
                cursor: detecting ? 'default' : 'pointer',
              }}
            >
              {detecting ? 'Checking…' : 'Download'}
            </button>
          </div>
        )}

        <style>{`
          .nav-btn:hover { background: rgba(255,255,255,0.12) !important; }
          .nav-btn-accent:hover { opacity: 0.9 !important; }
          @media (max-width: 700px) {
            .nav-desktop { display: none !important; }
            .nav-mobile-toggle { display: flex !important; flex-direction: column; }
          }
          @media (min-width: 701px) {
            .nav-drawer { display: none !important; }
          }
        `}</style>
      </div>
    </nav>
  );
}
