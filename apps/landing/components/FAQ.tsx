'use client';

import { useState } from 'react';
import { faqsLeft, faqsRight } from '../lib/faq-data';
import { tokens } from './tokens';

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
        transition: 'transform 300ms cubic-bezier(0.23, 1, 0.32, 1)',
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
          transition:
            'max-height 350ms cubic-bezier(0.23, 1, 0.32, 1), opacity 250ms cubic-bezier(0.23, 1, 0.32, 1)',
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

        <div className="faq-grid">
          <FAQColumn items={faqsLeft} startIndex={0} />
          <FAQColumn items={faqsRight} startIndex={faqsLeft.length} />
        </div>
      </div>
    </section>
  );
}
