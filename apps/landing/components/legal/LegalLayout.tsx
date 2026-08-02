// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type React from 'react';
import Link from 'next/link';

const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
} as const;

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
  currentPage: 'privacy' | 'terms' | 'cookies';
}

const LegalNav: React.FC = () => (
  <nav
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      height: 56,
      borderBottom: '1px solid rgba(44,36,24,0.1)',
      background: '#fefcf8',
    }}
  >
    <div
      style={{
        margin: '0 auto',
        height: '100%',
        maxWidth: 680,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}
      >
        <img src="/bento-icon.png" alt="Bento" width={28} height={28} style={{ borderRadius: 6 }} />
        <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: '#3c2e22' }}>
          Bento
        </span>
      </Link>
      <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: '#8c7a6a' }}>
        Legal
      </span>
    </div>
  </nav>
);

const LegalHeader: React.FC<{
  title: string;
  description: string;
  effectiveDate: string;
}> = ({ title, description, effectiveDate }) => (
  <header style={{ marginBottom: 56 }}>
    <p
      style={{
        fontFamily: F.sans,
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8c7a6a',
        marginBottom: 12,
      }}
    >
      Last updated {effectiveDate}
    </p>
    <h1
      style={{
        fontFamily: F.serif,
        fontSize: 40,
        fontWeight: 400,
        lineHeight: 1.2,
        color: '#3c2e22',
        margin: 0,
      }}
    >
      {title}
    </h1>
    <p
      style={{
        fontFamily: F.sans,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.6,
        color: '#8c7a6a',
        maxWidth: 560,
        marginTop: 12,
        marginBottom: 0,
      }}
    >
      {description}
    </p>
  </header>
);

const LegalTOC: React.FC<{ sections: LegalSection[] }> = ({ sections }) => (
  <nav aria-label="Table of contents" style={{ marginBottom: 40 }}>
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="legal-link-toc"
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

const LegalSectionBlock: React.FC<{ section: LegalSection }> = ({ section }) => (
  <section id={section.id} style={{ scrollMarginTop: 72 }}>
    <h2
      style={{
        fontFamily: F.serif,
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.3,
        marginTop: 48,
        marginBottom: 16,
        color: '#3c2e22',
      }}
    >
      {section.number}. {section.title}
    </h2>
    {section.content}
  </section>
);

const LegalContactBlock: React.FC = () => (
  <div
    style={{
      marginTop: 64,
      padding: 32,
      borderRadius: 8,
      border: '1px solid rgba(44,36,24,0.1)',
      background: '#fcf7f0',
    }}
  >
    <h3
      style={{
        fontFamily: F.serif,
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1.3,
        color: '#3c2e22',
        margin: '0 0 8px',
      }}
    >
      Questions?
    </h3>
    <p
      style={{
        fontFamily: F.sans,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.75,
        color: '#8c7a6a',
        margin: 0,
      }}
    >
      If you have questions about this document or your data, reach out to us at{' '}
      <a href="mailto:legal@iamazeyou.me" className="legal-link">
        legal@iamazeyou.me
      </a>
      . We aim to respond within 5 business days.
    </p>
  </div>
);

const LegalFooter: React.FC<{ currentPage: 'privacy' | 'terms' | 'cookies' }> = ({
  currentPage,
}) => (
  <footer
    style={{
      borderTop: '1px solid rgba(44,36,24,0.1)',
      marginTop: 40,
      paddingTop: 40,
      fontFamily: F.sans,
      fontSize: 13,
      lineHeight: 1.5,
    }}
  >
    <p style={{ color: '#8c7a6a', margin: 0 }}>&copy; 2026 Bento &mdash; All rights reserved.</p>
    <p
      style={{
        color: '#8c7a6a',
        margin: '4px 0 0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
      }}
    >
      {currentPage === 'privacy' ? (
        <span style={{ color: '#3c2e22', fontWeight: 500 }}>Privacy Policy</span>
      ) : (
        <Link href="/legal/privacy" className="legal-link">
          Privacy Policy
        </Link>
      )}
      <span style={{ color: '#8c7a6a' }}>&middot;</span>
      {currentPage === 'terms' ? (
        <span style={{ color: '#3c2e22', fontWeight: 500 }}>Terms of Use</span>
      ) : (
        <Link href="/legal/terms" className="legal-link">
          Terms of Use
        </Link>
      )}
      <span style={{ color: '#8c7a6a' }}>&middot;</span>
      {currentPage === 'cookies' ? (
        <span style={{ color: '#3c2e22', fontWeight: 500 }}>Cookie Policy</span>
      ) : (
        <Link href="/legal/cookies" className="legal-link">
          Cookie Policy
        </Link>
      )}
      <span style={{ color: '#8c7a6a' }}>&middot;</span>
      <a href="mailto:legal@iamazeyou.me" className="legal-link">
        Contact
      </a>
    </p>
  </footer>
);

export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontFamily: F.sans,
      fontSize: 15,
      fontWeight: 400,
      lineHeight: 1.75,
      color: '#8c7a6a',
      marginBottom: 16,
      marginTop: 0,
    }}
  >
    {children}
  </p>
);

export const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    style={{
      fontFamily: F.sans,
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: '#3c2e22',
      marginTop: 28,
      marginBottom: 8,
    }}
  >
    {children}
  </h3>
);

export const DashList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul style={{ listStyle: 'none', paddingLeft: 16, margin: '0 0 16px' }}>
    {items.map((item, i) => (
      <li
        key={i}
        style={{
          fontFamily: F.sans,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.75,
          color: '#8c7a6a',
          marginBottom: 8,
        }}
      >
        <span style={{ color: '#b85c3a', marginRight: 8 }}>&mdash;</span>
        {item}
      </li>
    ))}
  </ul>
);

export const B: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong style={{ color: '#3c2e22', fontWeight: 600 }}>{children}</strong>
);

const LegalLayout: React.FC<LegalLayoutProps> = ({
  title,
  description,
  effectiveDate,
  sections,
  currentPage,
}) => (
  <div style={{ minHeight: '100vh', background: '#fefcf8', fontFamily: F.sans }}>
    <style>{`.legal-link{color:#b85c3a;font-weight:500;text-decoration:none}.legal-link:hover{text-decoration:underline}.legal-link-toc{color:#b85c3a;text-decoration:none}.legal-link-toc:hover{text-decoration:underline}`}</style>
    <LegalNav />
    <div
      style={{
        margin: '0 auto',
        maxWidth: 680,
        padding: '80px 20px 120px',
      }}
    >
      <LegalHeader title={title} description={description} effectiveDate={effectiveDate} />
      <hr style={{ border: 'none', borderTop: '1px solid rgba(44,36,24,0.1)', marginBottom: 40 }} />
      <LegalTOC sections={sections} />
      <hr style={{ border: 'none', borderTop: '1px solid rgba(44,36,24,0.1)', marginBottom: 0 }} />
      {sections.map((s) => (
        <LegalSectionBlock key={s.id} section={s} />
      ))}
      <LegalContactBlock />
      <LegalFooter currentPage={currentPage} />
    </div>
  </div>
);

export default LegalLayout;
