import { tokens } from './tokens';

const steps = [
  {
    num: '01',
    title: 'Sleep shapes your morning',
    body: 'Log when you went to bed and how rested you feel. The next time you open Mood, that context is already there. No re-entering. No syncing.',
  },
  {
    num: '02',
    title: 'Focus compounds your habits',
    body: 'Every Pomodoro session adds to your streak. Your habit tracker sees the work you\u2019re doing, not just the box you ticked.',
  },
  {
    num: '03',
    title: 'Everything stays on your machine',
    body: 'Nothing is sent to a server. Nothing is stored in the cloud. Every connection between your tools happens locally, invisibly, instantly.',
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      style={{
        background: tokens.bg,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="how-heading"
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
            How it works
          </p>
          <h2
            id="how-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Your apps talk to each other.
          </h2>
          <p
            className="text-body"
            style={{
              marginTop: '16px',
            }}
          >
            Log a rough night\u2019s sleep. Your mood check-in already knows. Your focus session
            history stacks against your habit streaks. Each tool adds context to the others
            &mdash; without sending anything anywhere.
          </p>
        </header>

        <div style={{ maxWidth: '640px' }}>
          {steps.map((step, i) => (
            <div key={step.num}>
              {i > 0 && (
                <div
                  style={{
                    height: '1px',
                    background: tokens.highlight,
                    margin: '32px 0',
                  }}
                />
              )}
              <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '80px',
                    flexShrink: 0,
                    fontSize: '3.5rem',
                    fontWeight: 700,
                    letterSpacing: '-0.04em',
                    color: tokens.highlight,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  {step.num}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: tokens.ink,
                      margin: '0 0 6px',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontSize: tokens.smallSize,
                      color: tokens.inkMuted,
                      lineHeight: 1.7,
                      maxWidth: '480px',
                      margin: 0,
                    }}
                  >
                    {step.body}
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
