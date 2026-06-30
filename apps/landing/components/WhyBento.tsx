import { tokens } from './tokens';

export default function WhyBento() {
  return (
    <section
      id="why"
      style={{
        background: 'var(--color-bg)',
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="why-heading"
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(3rem, 6vw, 6rem)',
        }}
      >
        {/* ── Header ── */}
        <header style={{ maxWidth: '680px' }}>
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
            The cost of more
          </p>
          <h2
            id="why-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: '0 0 20px',
            }}
          >
            Your attention is not the problem.
            <br />
            Your tool stack is.
          </h2>
          <p
            className="text-body"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            Over the past two decades the average human attention span on a screen has fallen from
            two and a half minutes to forty seven seconds. That is not a failure of willpower. It is
            the direct consequence of an environment designed to fracture focus at every turn.
          </p>
        </header>

        {/* ── Section: The toggle tax ── */}
        <div>
          <h3
            style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: tokens.ink,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            The toggle tax
          </h3>
          <div
            className="text-body"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <p style={{ margin: 0 }}>
              The average knowledge worker now toggles between applications nearly twelve hundred
              times per day. That is one switch every four minutes, every hour, every day. Each
              switch carries a cost not just the second it takes to click a different window, but
              the cognitive load of reorienting. Where was I? What was I doing? What was I searching
              for? Researchers call this the toggle tax and it consumes roughly four hours per week,
              or nine percent of working time, per person. Across a year that adds up to five
              working weeks erased entirely by the act of navigating between tools.
            </p>
            <p style={{ margin: 0 }}>
              The average organisation now runs over a hundred applications. The average employee
              interacts with forty distinct tools to do their job. Yet despite this proliferation,
              productivity per knowledge worker has stagnated or declined. The correlation is not
              accidental. Each new tool adds capability in theory, but in practice it adds another
              context to manage, another notification stream to ignore, another login to remember,
              another place where a thought can land and never be seen again.
            </p>
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <a
              href="#how"
              className="why-cta"
              style={{
                fontSize: '0.85rem',
                color: tokens.accent,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              See all 17 mini-apps &rarr;
            </a>
          </p>
        </div>

        {/* ── Section: The illusion of integration ── */}
        <div>
          <h3
            style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: tokens.ink,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            The illusion of integration
          </h3>
          <div
            className="text-body"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <p style={{ margin: 0 }}>
              The software industry has responded with integrations. Connect your calendar to your
              task manager, your task manager to your notes app, your notes app to your habit
              tracker. But integration is not unity. It is a patchwork of API calls that break when
              a service updates its pricing, a startup shuts down, or a privacy policy changes. The
              underlying fragmentation remains. You are still managing multiple surfaces. Your mood
              data lives in one place, your sleep data in another, your tasks in a third, and never
              the three shall meet unless you build the bridge yourself.
            </p>
            <p style={{ margin: 0 }}>
              This fragmentation carries a hidden cost beyond the toggle tax. It prevents the kind
              of cross-context awareness that makes a tool feel intelligent. A sleep tracker that
              cannot talk to your mood log is not a sleep tracker that understands you. A habit
              streak that ignores your focus sessions is a number, not insight. The promise of
              connected productivity has been deferred to the user in the form of configuration
              work. The user must become the integrator.
            </p>
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <a
              href="#apps"
              className="why-cta"
              style={{
                fontSize: '0.85rem',
                color: tokens.accent,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              See how your data connects &rarr;
            </a>
          </p>
        </div>

        {/* ── Section: The local alternative ── */}
        <div>
          <h3
            style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: tokens.ink,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            A different architecture
          </h3>
          <div
            className="text-body"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <p style={{ margin: 0 }}>
              Bento starts from a different premise. Instead of adding another tool to your
              collection, it replaces the collection with a single local environment where every
              mini-app shares the same data layer, the same storage, the same context. Your sleep
              logs sit next to your mood checkins. Your focus timer writes into the same timeline
              your habit tracker reads from. Your tasks, notes, journal, and voice memos all share a
              unified search that does not require an internet connection to return results.
            </p>
            <p style={{ margin: 0 }}>
              Because everything runs on your machine there is no sync delay, no offline mode that
              means limited mode, no subscription tier that gates access to your own data. The apps
              talk to each other not because a cloud service brokers the conversation, but because
              they were never separate to begin with. The integration is architectural, not
              contractual.
            </p>
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <a
              href="#download"
              className="why-cta"
              style={{
                fontSize: '0.85rem',
                color: tokens.accent,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Experience local-first &rarr;
            </a>
          </p>
        </div>

        {/* ── Section: The feeling ── */}
        <div>
          <h3
            style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: tokens.ink,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            What it feels like
          </h3>
          <div
            className="text-body"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <p style={{ margin: 0 }}>
              The measure of a good tool is not how many features it contains, but how quickly it
              gets out of your way. Bento opens instantly. It does not ping you. It does not badge
              unread counts in the hope of pulling you back. It does not make you feel guilty for
              skipping a day. It holds your data, connects your contexts, and waits.
            </p>
            <p style={{ margin: 0 }}>
              When you log a rough nights sleep, the app does not ask you to reenter that context
              when you open your mood checkin in the morning. When you finish a focus session, your
              habit streak knows. When you need to find something, there is one search bar, not a
              hunt across a dozen silos. The feeling is not that the software is smart. It is that
              the software is present. It remembers what you have told it because it never had to
              look away.
            </p>
            <p style={{ margin: 0 }}>
              This is what local-first, unified productivity actually feels like. Not a dashboard
              that aggregates data from ten different APIs. Not a calendar that only syncs when you
              are online. Not a notes app that cannot see your tasks. Just one environment where
              everything belongs together because it was built that way from the ground up.
            </p>
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <a
              href="#download"
              className="why-cta"
              style={{
                fontSize: '0.85rem',
                color: tokens.accent,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Try Bento &rarr;
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
