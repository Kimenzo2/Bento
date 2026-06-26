'use client';

import { bentoApps, tokens } from './tokens';

const categories = [
  { label: 'How you feel', indices: [0, 1, 2] },
  { label: 'How you live', indices: [3, 4, 5, 6, 7] },
  { label: 'What you keep', indices: [8, 9, 10, 11] },
] as const;

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
        <header style={{ maxWidth: tokens.textMax, marginBottom: 'clamp(3rem, 5vw, 4.5rem)' }}>
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
        </header>

        {categories.map((cat) => (
          <div key={cat.label} style={{ marginBottom: '40px' }}>
            <p
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: tokens.inkFaint,
                marginBottom: '12px',
                paddingLeft: '2px',
              }}
            >
              {cat.label}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              {cat.indices.map((i) => {
                const app = bentoApps[i];
                return (
                  <div
                    key={app.name}
                    className="showcase-card"
                    style={{
                      flex: '1',
                      borderRadius: '1.5rem',
                      background: tokens.elevated,
                      padding: '12px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        fontSize: '1.1rem',
                        lineHeight: 1,
                      }}
                      aria-hidden="true"
                    >
                      {app.emoji}
                    </div>
                    <h3
                      style={{
                        marginTop: '5rem',
                        fontSize: '1.125rem',
                        fontWeight: 500,
                        color: tokens.ink,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {app.name}
                    </h3>
                    <p
                      style={{
                        maxWidth: '80%',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        color: tokens.inkMuted,
                        marginTop: '4px',
                      }}
                    >
                      {app.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
