import type React from 'react';
import { Link, useLocation } from 'react-router';

// ---------------------------------------------------------------------------
// Design tokens — matching BlogPost.tsx pattern
// ---------------------------------------------------------------------------
const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LegalSection {
  id: string;
  number: number;
  title: string;
  content: React.ReactNode;
}

interface LegalLayoutProps {
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
}

// ---------------------------------------------------------------------------
// Sticky Navigation
// ---------------------------------------------------------------------------
const LegalNav: React.FC = () => (
  <nav
    className="sticky top-0 z-40 border-b border-peach-soft bg-cream-base"
    style={{ height: 56 }}
  >
    <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-5 sm:px-10 lg:px-0">
      <Link
        to="/welcome"
        className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded-lg"
      >
        <img
          src="/genesis-icon.jpg"
          alt="Genesis"
          width={28}
          height={28}
          className="rounded-md"
        />
        <span
          className="text-charcoal-soft"
          style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 500 }}
        >
          Genesis
        </span>
      </Link>
      <span
        className="text-cocoa-light"
        style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 500 }}
      >
        Legal
      </span>
    </div>
  </nav>
);

// ---------------------------------------------------------------------------
// Page Header
// ---------------------------------------------------------------------------
const LegalHeader: React.FC<{
  title: string;
  description: string;
  effectiveDate: string;
}> = ({ title, description, effectiveDate }) => (
  <header className="mb-14">
    <p
      className="text-cocoa-light mb-3"
      style={{
        fontFamily: F.sans,
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
      }}
    >
      Last updated {effectiveDate}
    </p>
    <h1
      className="text-charcoal-soft"
      style={{
        fontFamily: F.serif,
        fontSize: 40,
        fontWeight: 400,
        lineHeight: 1.2,
      }}
    >
      {title}
    </h1>
    <p
      className="text-cocoa-light mt-3"
      style={{
        fontFamily: F.sans,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.6,
        maxWidth: 560,
      }}
    >
      {description}
    </p>
  </header>
);

// ---------------------------------------------------------------------------
// Table of Contents
// ---------------------------------------------------------------------------
const LegalTOC: React.FC<{ sections: LegalSection[] }> = ({ sections }) => (
  <nav className="mb-10" aria-label="Table of contents">
    <ol className="list-none p-0 m-0">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="text-coral-burst hover:underline transition-colors"
            style={{
              fontFamily: F.sans,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.8,
              display: 'block',
            }}
          >
            {s.number}. {s.title}
          </a>
        </li>
      ))}
    </ol>
  </nav>
);

// ---------------------------------------------------------------------------
// Section Renderer
// ---------------------------------------------------------------------------
const LegalSectionBlock: React.FC<{ section: LegalSection }> = ({ section }) => (
  <section
    id={section.id}
    className="legal-section"
    style={{ scrollMarginTop: 72 }}
  >
    <h2
      className="text-charcoal-soft"
      style={{
        fontFamily: F.serif,
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.3,
        marginTop: 48,
        marginBottom: 16,
      }}
    >
      {section.number}. {section.title}
    </h2>
    {section.content}
  </section>
);

// ---------------------------------------------------------------------------
// Contact Block
// ---------------------------------------------------------------------------
const LegalContactBlock: React.FC = () => (
  <div
    className="bg-surface border border-peach-soft rounded-lg mt-16"
    style={{ padding: 32 }}
  >
    <h3
      className="text-charcoal-soft mb-2"
      style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 400, lineHeight: 1.3 }}
    >
      Questions?
    </h3>
    <p
      className="text-cocoa-light"
      style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 400, lineHeight: 1.75 }}
    >
      If you have questions about this document or your data, reach out to us at{' '}
      <a
        href="mailto:legal@iamazeyou.me"
        className="text-coral-burst hover:underline"
        style={{ fontWeight: 500 }}
      >
        legal@iamazeyou.me
      </a>
      . We aim to respond within 5 business days.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
const LegalFooter: React.FC = () => {
  const location = useLocation();
  const isPrivacy = location.pathname.includes('privacy');
  const isTerms = location.pathname.includes('terms');
  const isCookies = location.pathname.includes('cookies');

  return (
    <footer
      className="border-t border-peach-soft mt-10 pt-10"
      style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 1.5 }}
    >
      <p className="text-cocoa-light">
        &copy; 2026 Genesis &mdash; All rights reserved.
      </p>
      <p className="text-cocoa-light mt-1 flex flex-wrap gap-1">
        {isPrivacy ? (
          <span className="text-charcoal-soft font-medium">Privacy Policy</span>
        ) : (
          <Link to="/legal/privacy" className="text-coral-burst hover:underline">Privacy Policy</Link>
        )}
        <span className="text-cocoa-light">&middot;</span>
        {isTerms ? (
          <span className="text-charcoal-soft font-medium">Terms of Use</span>
        ) : (
          <Link to="/legal/terms" className="text-coral-burst hover:underline">Terms of Use</Link>
        )}
        <span className="text-cocoa-light">&middot;</span>
        {isCookies ? (
          <span className="text-charcoal-soft font-medium">Cookie Policy</span>
        ) : (
          <Link to="/legal/cookies" className="text-coral-burst hover:underline">Cookie Policy</Link>
        )}
        <span className="text-cocoa-light">&middot;</span>
        <a href="mailto:legal@iamazeyou.me" className="text-coral-burst hover:underline">Contact</a>
      </p>
    </footer>
  );
};

// ---------------------------------------------------------------------------
// Exported helpers for page content
// ---------------------------------------------------------------------------

/** Body paragraph */
export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    className="text-cocoa-light"
    style={{
      fontFamily: F.sans,
      fontSize: 15,
      fontWeight: 400,
      lineHeight: 1.75,
      marginBottom: 16,
    }}
  >
    {children}
  </p>
);

/** Subsection heading */
export const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    className="text-charcoal-soft"
    style={{
      fontFamily: F.sans,
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
      marginTop: 28,
      marginBottom: 8,
    }}
  >
    {children}
  </h3>
);

/** List with em-dash items */
export const DashList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-none p-0 m-0 mb-4" style={{ paddingLeft: 16 }}>
    {items.map((item, i) => (
      <li
        key={i}
        className="text-cocoa-light"
        style={{
          fontFamily: F.sans,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.75,
          marginBottom: 8,
        }}
      >
        <span className="text-coral-burst mr-2">&mdash;</span>
        {item}
      </li>
    ))}
  </ul>
);

/** Bold key term */
export const B: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className="text-charcoal-soft" style={{ fontWeight: 600 }}>
    {children}
  </strong>
);

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------
const LegalLayout: React.FC<LegalLayoutProps> = ({
  title,
  description,
  effectiveDate,
  sections,
}) => (
  <div className="min-h-screen bg-cream-base" style={{ fontFamily: F.sans }}>
    <LegalNav />
    <div
      className="mx-auto w-full"
      style={{
        maxWidth: 680,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 80,
        paddingBottom: 120,
      }}
    >
      <LegalHeader title={title} description={description} effectiveDate={effectiveDate} />
      <hr className="border-peach-soft mb-10" />
      <LegalTOC sections={sections} />
      <hr className="border-peach-soft mb-0" />
      {sections.map((s) => (
        <LegalSectionBlock key={s.id} section={s} />
      ))}
      <LegalContactBlock />
      <LegalFooter />
    </div>
  </div>
);

export default LegalLayout;
