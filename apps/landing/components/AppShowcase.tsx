'use client';
/**
 * AppShowcase — Bento Landing
 *
 * Displays the 12 apps inside Bento in a clean grid.
 * Emoji cards with subtle tinted backgrounds. Alternating tones for rhythm.
 * No borders, no shadows.
 */

import { bentoApps, tokens } from './tokens';

const EMOJI_BGS = [tokens.accentLight, tokens.accentSecondaryLight, tokens.surfaceWarm];

export default function AppShowcase() {
  return (
    <section
      id="apps"
      style={{
        background: tokens.surface,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="apps-heading"
    >
      <div style={{ maxWidth: tokens.contentMax, margin: '0 auto' }}>
        <div style={{ maxWidth: tokens.textMax, marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
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
            What&rsquo;s inside
          </p>
          <h2
            id="apps-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Twelve tools. One desktop. No subscriptions.
          </h2>
          <p
            style={{
              fontSize: tokens.bodySize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              marginTop: '16px',
            }}
          >
            Each app is fully self-contained. They share your data with each other where it helps
            &mdash; your sleep data might inform your mood patterns &mdash; but nothing ever leaves
            your machine.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {bentoApps.map((app, i) => (
            <div
              key={app.name}
              style={{
                background: i % 2 === 0 ? tokens.surfaceAlt : tokens.surface,
                borderRadius: '16px',
                padding: '24px 22px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: EMOJI_BGS[i % EMOJI_BGS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  marginBottom: '14px',
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                {app.emoji}
              </div>
              <h3
                style={{
                  fontSize: '0.975rem',
                  fontWeight: 600,
                  color: tokens.ink,
                  margin: '0 0 6px',
                  letterSpacing: '-0.01em',
                }}
              >
                {app.name}
              </h3>
              <p
                style={{
                  fontSize: tokens.smallSize,
                  lineHeight: 1.55,
                  color: tokens.inkMuted,
                  margin: 0,
                }}
              >
                {app.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
