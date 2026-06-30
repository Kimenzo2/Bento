import { tokens } from './tokens';

const testimonials = [
  {
    quote:
      'I\u2019ve tried every productivity app there is. Bento is the first one I\u2019ve kept open after the first week.',
    initials: 'A.M.',
    name: 'A.M.',
    context: 'Lagos, Nigeria',
  },
  {
    quote:
      'The fact that nothing leaves my computer isn\u2019t a feature anymore. It\u2019s a requirement. Bento is the only one that takes it seriously.',
    initials: 'J.T.',
    name: 'J.T.',
    context: 'Edinburgh, Scotland',
  },
  {
    quote:
      'I started using the mood and focus apps together by accident. Now I can actually see what kind of day I\u2019m having before I\u2019ve decided it\u2019s going badly.',
    initials: 'S.O.',
    name: 'S.O.',
    context: 'Nairobi, Kenya',
  },
] as const;

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: tokens.highlight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        color: tokens.inkFaint,
        fontWeight: 600,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section
      style={{
        background: tokens.surface,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="testimonials-heading"
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
            From people using it
          </p>
          <h2
            id="testimonials-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Quiet mini-apps. Real difference.
          </h2>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                flex: '1',
                borderRadius: '1.5rem',
                background: tokens.elevated,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  fontSize: '2rem',
                  lineHeight: 1,
                  color: tokens.highlight,
                  display: 'block',
                  marginBottom: '8px',
                }}
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: tokens.inkMuted,
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                  margin: 0,
                  flex: 1,
                }}
              >
                {t.quote}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '16px',
                }}
              >
                <Avatar initials={t.initials} />
                <div>
                  <p
                    style={{
                      fontSize: tokens.smallSize,
                      fontWeight: 600,
                      color: tokens.ink,
                      margin: 0,
                    }}
                  >
                    {t.name}
                  </p>
                  <p
                    style={{
                      fontSize: tokens.labelSize,
                      color: tokens.inkFaint,
                      margin: 0,
                    }}
                  >
                    {t.context}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
