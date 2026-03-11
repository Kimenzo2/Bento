import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Font,
  Tailwind,
  pixelBasedPreset,
} from '@react-email/components';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Genesis Design DNA — Email Token System
// ---------------------------------------------------------------------------
// FONTS: Instrument Serif (headings) + Geist/Manrope (body)
//        — the editorial pairing from Genesis blog/landing page
// BUTTON: coral #FF9B71, white text, 13px medium, rounded-full, generous padding
// BACKGROUND: warm cream #FFF8E7
// CARD: white, 20px border-radius, subtle peach border
// DARK SECTION: #1A1412 (warm brown-black), #EAE0D5 text
// CORAL SECTION: #FF9B71 bg, white text
// DIVIDER: 1px solid #F0E6DC (softer than #FFE4CC for modern feel)
// ---------------------------------------------------------------------------

const GENESIS_TAILWIND_CONFIG = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        'g-coral': '#FF9B71',
        'g-gold': '#FFD93D',
        'g-cream': '#FFF8E7',
        'g-text': '#3D3D3D',
        'g-muted': '#8B7E74',
        'g-border': '#F0E6DC',
        'g-dark': '#1A1412',
      },
    },
  },
};

// In preview server, static files are served from /static/
// In production, from the CDN root
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://iamazeyou.me'
  : '';

const ICON_SRC = process.env.NODE_ENV === 'production'
  ? 'https://iamazeyou.me/genesis-icon-128.png'
  : '/static/genesis-icon.png';

// ── Shared inline style objects ──────────────────────────────────────────────

/** Instrument Serif heading — elegant serif, normal weight */
export const heading = (
  size: number,
  opts?: { color?: string; align?: string; margin?: string }
): React.CSSProperties => ({
  fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  fontSize: `${size}px`,
  fontWeight: 400,
  color: opts?.color || '#3D3D3D',
  textAlign: (opts?.align as React.CSSProperties['textAlign']) || 'left',
  margin: opts?.margin || '0 0 16px 0',
  lineHeight: '1.25',
});

/** Body text — clean sans-serif */
export const body = (
  opts?: { size?: number; color?: string; margin?: string; weight?: number; align?: string }
): React.CSSProperties => ({
  fontFamily: "'Geist', 'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif",
  fontSize: `${opts?.size || 15}px`,
  fontWeight: opts?.weight || 400,
  color: opts?.color || '#555555',
  lineHeight: '1.6',
  textAlign: (opts?.align as React.CSSProperties['textAlign']) || 'left',
  margin: opts?.margin || '12px 0',
});

/** Primary CTA button — coral, rounded-full, generous padding */
export const btnPrimary: React.CSSProperties = {
  fontFamily: "'Geist', 'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif",
  backgroundColor: '#FF9B71',
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 500,
  padding: '14px 32px',
  borderRadius: '9999px',
  textDecoration: 'none',
  boxSizing: 'border-box',
  display: 'inline-block',
  letterSpacing: '0.01em',
};

/** Secondary CTA button — outlined, white bg */
export const btnSecondary: React.CSSProperties = {
  fontFamily: "'Geist', 'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif",
  backgroundColor: '#FFFFFF',
  color: '#3D3D3D',
  fontSize: '14px',
  fontWeight: 500,
  padding: '14px 32px',
  borderRadius: '9999px',
  textDecoration: 'none',
  boxSizing: 'border-box',
  border: '1px solid #E8DED4',
  display: 'inline-block',
};

/** Genesis badge/pill — coral tinted, rounded-full */
export const badge: React.CSSProperties = {
  fontFamily: "'Geist', 'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif",
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#FF9B71',
  padding: '5px 14px',
  borderRadius: '9999px',
  border: '1px solid rgba(255, 155, 113, 0.25)',
  backgroundColor: 'rgba(255, 155, 113, 0.06)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
};

/** Divider — very subtle */
export const divider: React.CSSProperties = {
  borderStyle: 'solid',
  borderColor: '#F0E6DC',
  borderWidth: '1px 0 0 0',
  margin: '28px 0',
};

/** Callout box — cream bg, subtle border */
export const callout: React.CSSProperties = {
  padding: '20px 24px',
  borderRadius: '12px',
  border: '1px solid #F0E6DC',
  backgroundColor: '#FDFAF5',
  margin: '20px 0',
};

/** Dark section */
export const darkSection: React.CSSProperties = {
  backgroundColor: '#1A1412',
  borderRadius: '12px',
  padding: '24px',
  margin: '20px 0',
  textAlign: 'center',
};

/** Coral accent section */
export const coralSection: React.CSSProperties = {
  backgroundColor: '#FF9B71',
  borderRadius: '12px',
  padding: '24px',
  margin: '20px 0',
  textAlign: 'center',
};

// ── Layout Component ─────────────────────────────────────────────────────────

interface GenesisLayoutProps {
  preview: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
}

export default function GenesisLayout({
  preview,
  children,
  showUnsubscribe = false,
}: GenesisLayoutProps) {
  const year = new Date().getFullYear();

  return (
    <Html lang="en">
      <Tailwind config={GENESIS_TAILWIND_CONFIG}>
        <Head>
          <Font
            fontFamily="Instrument Serif"
            fallbackFontFamily={['Georgia', 'Times New Roman', 'serif']}
            webFont={{
              url: 'https://fonts.gstatic.com/s/instrumentserif/v4/jizBRFtNs2ka5fCjGQ3h0O2DSunwm_ec.woff2',
              format: 'woff2',
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Geist"
            fallbackFontFamily="Arial"
            webFont={{
              url: 'https://fonts.gstatic.com/s/geist/v1/gyBhhwUxId8mMGwzGFOt.woff2',
              format: 'woff2',
            }}
            fontWeight={400}
            fontStyle="normal"
          />
        </Head>
        <Preview>{preview}</Preview>
        <Body style={{
          backgroundColor: '#FFF8E7',
          fontFamily: "'Geist', 'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif",
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: 'antialiased',
        }}>
          <Container style={{ maxWidth: '520px', margin: '0 auto', padding: '48px 24px' }}>
            {/* ─── Header ─── */}
            <Section style={{ textAlign: 'center', paddingBottom: '40px' }}>
              <Img
                src={ICON_SRC}
                alt="Genesis"
                width="44"
                height="44"
                style={{ borderRadius: '12px', margin: '0 auto' }}
              />
            </Section>

            {/* ─── Content Card ─── */}
            <Section style={{
              backgroundColor: '#FFFFFF',
              padding: '40px 36px',
              borderRadius: '20px',
              border: '1px solid #F0E6DC',
            }}>
              {children}
            </Section>

            {/* ─── Footer ─── */}
            <Section style={{ paddingTop: '36px', textAlign: 'center' }}>
              <Text style={body({ size: 12, color: '#A9A09A', margin: '0', align: 'center' })}>
                &copy; {year} Genesis &middot;{' '}
                <Link href="https://iamazeyou.me" style={{ color: '#A9A09A', textDecoration: 'none' }}>
                  iamazeyou.me
                </Link>
              </Text>
              {showUnsubscribe && (
                <Text style={body({ size: 12, color: '#A9A09A', margin: '8px 0 0 0', align: 'center' })}>
                  <Link href="https://iamazeyou.me/settings" style={{ color: '#A9A09A', textDecoration: 'underline' }}>
                    Email preferences
                  </Link>
                </Text>
              )}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export { GENESIS_TAILWIND_CONFIG, BASE_URL, ICON_SRC };
