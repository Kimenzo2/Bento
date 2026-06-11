/**
 * WhyBento — Bento Landing
 *
 * Four honest reasons to use Bento.
 * Warm sand background, alternating card tones.
 * Plain language. No buzzwords. No fake claims.
 */

import { tokens } from './tokens';

const reasons = [
  {
    icon: '🔒',
    title: 'Completely private',
    body:
      'Your data stays on your computer. No telemetry, no tracking, no internet required after install.',
    bg: tokens.surface,
    iconBg: tokens.accentLight,
  },
  {
    icon: '📦',
    title: 'Twelve apps, one install',
    body:
      'Stop juggling separate tools for habits, focus, sleep, budget, and mood. Bento brings them together so they can actually talk to each other.',
    bg: tokens.surfaceAlt,
    iconBg: tokens.accentSecondaryLight,
  },
  {
    icon: '🌿',
    title: 'Calm by design',
    body:
      'No gamification dark patterns. No streaks that guilt you. No notifications that interrupt. Bento is there when you want it, quiet when you don\'t.',
    bg: tokens.surface,
    iconBg: tokens.surfaceWarm,
  },
  {
    icon: '⚡',
    title: 'Fast and native',
    body:
      'Built with Tauri, Bento is a real desktop app. It opens instantly, uses very little memory, and works offline — always.',
    bg: tokens.surfaceAlt,
    iconBg: tokens.accentLight,
  },
] as const;

export default function WhyBento() {
  return (
    <section
      id="why"
      style={{
        background: tokens.surfaceWarm,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="why-heading"
    >
      <div style={{ maxWidth: tokens.contentMax, margin: '0 auto' }}>
        <div style={{ maxWidth: tokens.textMax, marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <p
            style={{
              fontSize: tokens.labelSize,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: tokens.accentSecondary,
              marginBottom: '16px',
            }}
          >
            Why Bento
          </p>
          <h2
            id="why-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Built for the way real days actually go.
          </h2>
          <p
            style={{
              fontSize: tokens.bodySize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              marginTop: '16px',
            }}
          >
            Most productivity apps assume you have an ideal schedule and unlimited willpower.
            Bento doesn&rsquo;t. It&rsquo;s designed for messy, real, human days.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '24px',
          }}
        >
          {reasons.map((r) => (
            <div
              key={r.title}
              style={{
                padding: '32px 28px',
                borderRadius: '16px',
                background: r.bg,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: r.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  marginBottom: '18px',
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                {r.icon}
              </div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 650,
                  color: tokens.ink,
                  margin: '0 0 10px',
                  letterSpacing: '-0.01em',
                }}
              >
                {r.title}
              </h3>
              <p
                style={{
                  fontSize: tokens.smallSize,
                  lineHeight: 1.65,
                  color: tokens.inkMuted,
                  margin: 0,
                }}
              >
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
