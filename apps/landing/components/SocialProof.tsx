// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { tokens } from './tokens';

const stats = [
  { value: '15', label: 'Apps included' },
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
      aria-labelledby="social-proof-heading"
    >
      <h2
        id="social-proof-heading"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Key numbers
      </h2>
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
              className="stagger-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                animationDelay: `${i * 80}ms`,
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
                    fontVariantNumeric: 'tabular-nums',
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
    </section>
  );
}
