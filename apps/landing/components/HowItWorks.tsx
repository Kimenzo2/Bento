import { tokens } from './tokens';

const categories = [
  {
    title: 'Capture & Organize',
    description:
      'Write rich notes, manage tasks with natural language, keep a private journal, record searchable voice memos, and never lose a copied link again. Everything stays on your machine — instantly searchable, seamlessly connected.',
    includes: 'Notes, Tasks, Journal, Voice Memos, Clipboard Manager',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          d="M4 4h14v14H4V4z"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 7h8M7 11h8M7 15h5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Focus & Growth',
    description:
      'Run Pomodoro sessions, build habit streaks, log one-tap mood check-ins, and set long-term goals with milestones. Each session feeds into the next — your focus history stacks against your habit streaks, silently, locally.',
    includes: 'Focus Timer, Habits, Mood Tracker, Goals',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7.5" stroke="var(--color-ink)" strokeWidth="1.5" />
        <path
          d="M11 7v4l2.5 2.5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17.5 4.5L20 7"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Health & Sleep',
    description:
      'Track sleep quality with scores and trends, log workouts and body metrics, and stay hydrated with intelligent reminders. Your sleep score already knows how your morning will feel — no re-entering, no syncing.',
    includes: 'Sleep Tracker, Health Tracker, Water & Nutrition',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          d="M18 12.5A7.5 7.5 0 019.5 4 7.5 7.5 0 1018 12.5z"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Finance & Security',
    description:
      'Manage budgets with manual transactions and category forecasts, store passwords and passkeys in a local-first vault with breach alerts, and mark the life events that matter with countdowns and milestones.',
    includes: 'Budget Tracker, Password Vault, Countdown / Life Events',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="8"
          width="16"
          height="10"
          rx="2"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <path
          d="M7 8V6a4 4 0 018 0v2"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="11" cy="13" r="1.5" fill="var(--color-ink)" />
      </svg>
    ),
  },
  {
    title: 'Dashboard & System',
    description:
      'The Dashboard gives you a pulse on everything — recent mini-apps, quick actions, and local system health. Settings tie it all together with theme control, platform preferences, and shell-wide configuration.',
    includes: 'Dashboard, Settings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1.5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <rect
          x="12"
          y="3"
          width="7"
          height="4"
          rx="1.5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="12"
          width="7"
          height="7"
          rx="1.5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <rect
          x="12"
          y="9"
          width="7"
          height="10"
          rx="1.5"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      style={{
        background: tokens.bg,
        padding: '0 28px ' + tokens.sectionPad,
        paddingTop: 'calc(360px + clamp(5rem, 10vw, 8rem))',
      }}
      aria-labelledby="how-heading"
    >
      <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
        <header
          style={{
            maxWidth: '640px',
            marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
          }}
        >
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
            Mini-apps
          </p>
          <h2
            id="how-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: '0 0 12px',
            }}
          >
            15 mini-apps that work as one.
          </h2>
          <p
            className="text-body"
            style={{
              margin: 0,
            }}
          >
            From tasks and notes to mood, sleep, budgets, passwords, and voice memos &mdash; every
            module shares context locally, so nothing falls through the cracks.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {categories.map((cat, i) => (
            <div
              key={cat.title}
              className="stagger-item"
              style={{
                background: 'var(--color-surface)',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--color-highlight)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {cat.icon}
              </div>

              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {cat.title}
              </h3>

              <p
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.7,
                  color: 'var(--color-ink-muted)',
                  margin: 0,
                }}
              >
                {cat.description}
              </p>

              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: '0.78rem',
                  color: 'var(--color-ink-faint)',
                  lineHeight: 1.5,
                  letterSpacing: '0.01em',
                }}
              >
                Includes: {cat.includes}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
