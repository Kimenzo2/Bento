import { bentoApps, tokens } from './tokens';

const categories = [
  { label: 'Start your day', indices: [0, 1, 2, 3, 4] },
  { label: 'Stay in rhythm', indices: [5, 6, 7, 8, 9] },
  { label: 'Know your body', indices: [10, 11, 12] },
  { label: 'Secure your life', indices: [13, 14, 15, 16] },
] as const;

export default function AppShowcase() {
  return (
    <section
      id="apps"
      style={{
        background: tokens.bg,
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
            Seventeen mini-apps. One desktop. No subscriptions.
          </h2>
          <p
            className="text-body"
            style={{
              marginTop: '16px',
            }}
          >
            Log a rough night of sleep and your morning mood check-in will already know. Your focus
            sessions stack against your habit streaks. Each mini-app talks to the others &mdash; but
            only on your machine.
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
              className="showcase-grid"
              role="region"
              aria-label={`${cat.label} mini-apps`}
              tabIndex={0}
            >
              {cat.indices.map((i) => {
                const app = bentoApps[i];
                return (
                  <div
                    key={app.name}
                    className="showcase-card"
                    style={{
                      borderRadius: '1.5rem',
                      background: tokens.elevated,
                      padding: '12px 16px',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        color: 'var(--color-ink-muted)',
                        width: '28px',
                        height: '28px',
                      }}
                      dangerouslySetInnerHTML={{ __html: app.icon }}
                    />
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
                      className="text-body"
                      style={{
                        maxWidth: '80%',
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
