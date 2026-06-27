import { tokens } from './tokens';

const stats = [
  { value: '12', label: 'Apps included' },
  { value: '100%', label: 'Offline capable' },
  { value: '0', label: 'Data sent to servers' },
  { value: '3 platforms', label: 'Windows, macOS & Linux' },
] as const;

export default function SocialProof() {
  return (
    <section
      style={{
        background: tokens.bg,
        padding: '32px 28px',
      }}
      aria-label="Key numbers"
    >
      <div style={{ maxWidth: tokens.contentMax, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
          className="social-proof-strip"
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: tokens.ink,
                    letterSpacing: '-0.03em',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    fontSize: tokens.labelSize,
                    color: tokens.inkFaint,
                    fontWeight: 500,
                    margin: '4px 0 0',
                  }}
                >
                  {stat.label}
                </p>
              </div>
              {i < stats.length - 1 && (
                <div
                  className="social-proof-divider"
                  style={{
                    width: '1px',
                    height: '32px',
                    background: tokens.highlight,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: tokens.labelSize,
            color: tokens.inkFaint,
            textAlign: 'center',
            marginTop: '24px',
            marginBottom: 0,
            fontStyle: 'italic',
          }}
        >
          Built by an independent developer. No investors. No tracking. No catch.
        </p>
      </div>

      <style>{`
        .social-proof-strip {
          gap: 24px;
        }
        @media (max-width: 600px) {
          .social-proof-strip {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 28px 16px;
          }
          .social-proof-divider {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
