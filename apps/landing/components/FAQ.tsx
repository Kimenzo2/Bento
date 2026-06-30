'use client';

import { useState } from 'react';
import { tokens } from './tokens';

const faqsLeft = [
  {
    q: 'Is there a free version?',
    a: 'Bento is a paid app. The Core plan starts at $9/month and includes Tasks, Notes, Journal, Password Vault, and Budget. There is no free tier and no free trial. Every plan works offline and respects your privacy.',
  },
  {
    q: 'Do I need an account to use it?',
    a: 'Yes. You sign in with Google the first time you open the app. After that your data stays on your device.',
  },
  {
    q: 'What platforms does it run on?',
    a: 'Windows, macOS, and Linux. We build for all three with every release.',
  },
  {
    q: 'How does it work offline?',
    a: 'Everything Bento does \u2014 saving notes, tracking habits, logging sleep \u2014 happens directly on your computer. There\u2019s no server involved. Open it on a plane. It works exactly the same.',
  },
] as const;

const faqsRight = [
  {
    q: 'What data does Bento collect?',
    a: 'None. Your data stays on your device. Bento has no telemetry, no tracking, and no access to your files.',
  },
  {
    q: 'What is the AI feature?',
    a: 'Bento has an optional AI companion. You connect it using your own account with an AI provider. Your data goes to the provider you choose, not to us.',
  },
  {
    q: 'Can I move my data if I stop using Bento?',
    a: 'Yes. Bento stores your data in open formats and provides a full export at any time. You are never locked in.',
  },
  {
    q: 'Who builds Bento?',
    a: 'Bento is built by an independent developer. No venture capital. No growth team. No dark patterns. Updates happen because the builder uses the app every day.',
  },
] as const;

function PlusIcon({ open }: { open: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '20px',
        height: '20px',
        position: 'relative',
        flexShrink: 0,
        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '14px',
          height: '2px',
          background: 'var(--color-ink)',
          borderRadius: '2px',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '2px',
          height: '14px',
          background: 'var(--color-ink)',
          borderRadius: '2px',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}

function AccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: '20px',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '18px 20px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: tokens.fontFamily,
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: 1.6,
          color: 'var(--color-ink)',
          letterSpacing: '-0.01em',
        }}
      >
        <PlusIcon open={open} />
        <span>{question}</span>
      </button>

      <div
        style={{
          maxHeight: open ? '500px' : '0px',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          style={{
            padding: '0 20px 20px 52px',
            fontSize: '14px',
            lineHeight: 1.7,
            color: 'var(--color-ink-muted)',
            letterSpacing: '-0.01em',
          }}
        >
          {answer}
        </div>
      </div>
    </div>
  );
}

function FAQColumn({
  items,
  startIndex,
}: {
  items: ReadonlyArray<{ q: string; a: string }>;
  startIndex: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {items.map((faq, i) => {
        const idx = startIndex + i;
        return (
          <AccordionItem
            key={faq.q}
            question={faq.q}
            answer={faq.a}
            open={openIndex === idx}
            onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
          />
        );
      })}
    </div>
  );
}

export default function FAQ() {
  return (
    <section
      style={{
        background: tokens.bg,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="faq-heading"
    >
      <div
        style={{
          maxWidth: '1040px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <header
          style={{
            textAlign: 'center',
            marginBottom: 'clamp(2rem, 4vw, 3rem)',
          }}
        >
          <h2
            id="faq-heading"
            style={{
              fontSize: tokens.headingSize,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: tokens.ink,
              margin: '0 0 12px',
            }}
          >
            Frequently Asked Questions
          </h2>
          <p
            style={{
              fontSize: tokens.subheadSize,
              lineHeight: 1.7,
              color: tokens.inkMuted,
              maxWidth: '540px',
              margin: '0 auto',
            }}
          >
            Everything you need to know about Bento.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            width: '100%',
          }}
          className="faq-grid"
        >
          <FAQColumn items={faqsLeft} startIndex={0} />
          <FAQColumn items={faqsRight} startIndex={faqsLeft.length} />
        </div>

        <style>{`
          @media (max-width: 700px) {
            .faq-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
