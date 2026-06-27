import { tokens } from './tokens';

const reasons = [
  {
    icon: '🔒',
    title: 'Completely private',
    body: 'Your data stays on your computer. No telemetry, no tracking, no internet required after install.',
  },
  {
    icon: '📦',
    title: 'Twelve apps, one install',
    body: 'Stop juggling separate tools for habits, focus, sleep, budget, and mood. Bento brings them together so they can actually talk to each other.',
  },
  {
    icon: '🌿',
    title: 'Calm by design',
    body: "No gamification dark patterns. No streaks that guilt you. No notifications that interrupt. Bento is there when you want it, quiet when you don't.",
  },
  {
    icon: '⚡',
    title: 'Fast and native',
    body: 'Built with Tauri, Bento is a real desktop app. It opens instantly, uses very little memory, and works offline — always.',
  },
] as const;

export default function WhyBento() {
  const mid = Math.ceil(reasons.length / 2);

  return (
    <section
      id="why"
      style={{
        background: `radial-gradient(ellipse 70% 50% at 30% 40%, rgba(122, 155, 181, 0.04) 0%, transparent 70%), ${tokens.bg}`,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="why-heading"
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
            Built for real days.
          </h2>
          <p
            className="text-body"
            style={{
              marginTop: '16px',
            }}
          >
            Most productivity apps assume an ideal schedule and unlimited willpower. Bento
            doesn&rsquo;t. It&rsquo;s designed for messy, real, human days.
          </p>
        </header>

        <div className="why-grid">
          <div className="why-col">
            {reasons.slice(0, mid).map((r) => (
              <WhyItem key={r.title} icon={r.icon} title={r.title} body={r.body} />
            ))}
          </div>
          <div className="why-col">
            {reasons.slice(mid).map((r) => (
              <WhyItem key={r.title} icon={r.icon} title={r.title} body={r.body} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .why-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 48px; }
        .why-col { display: flex; flex-direction: column; gap: 4px; }
        .why-item {
          padding: 24px 0 24px 20px;
          border-left: 1px solid ${tokens.highlight};
          transition: border-color 0.2s ease, background 0.2s ease;
          border-radius: 0 8px 8px 0;
        }
        .why-item:hover {
          border-left-color: ${tokens.accent};
          background: rgba(255,255,255,0.015);
        }
        @media (max-width: 700px) {
          .why-grid { grid-template-columns: 1fr; gap: 0; }
        }
      `}</style>
    </section>
  );
}

function WhyItem({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="why-item">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: tokens.ink,
              margin: '0 0 6px',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          <p
            className="text-body"
            style={{
              margin: 0,
            }}
          >
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
