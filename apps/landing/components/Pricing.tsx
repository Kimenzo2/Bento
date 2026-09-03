// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Link from 'next/link';
import { tokens } from './tokens';
import { PRICING_PLANS } from '../lib/billing';

const plans = PRICING_PLANS.filter((plan) => plan.key === 'power').map((plan) => ({
  key: plan.key,
  name: 'Lifetime',
  description: plan.description,
  price: plan.price.monthly,
  accent: plan.accent,
  features: plan.features,
  cta: { label: 'Subscribe', href: '/pricing', ghost: true },
}));

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ marginTop: '3px', flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.25" />
      <path
        d="M5 8l2.25 2.25L11 6"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Pricing() {
  return (
    <>
      <section
        style={{
          background: tokens.bg,
          padding: `${tokens.sectionPad} 28px`,
          paddingInline: '28px',
        }}
        aria-labelledby="pricing-heading"
      >
        <div style={{ maxWidth: tokens.contentMax, margin: '0 auto' }}>
          <header
            style={{
              maxWidth: tokens.textMax,
              margin: '0 auto clamp(3rem, 5vw, 4.5rem)',
              textAlign: 'center',
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
              Pricing
            </p>
            <h2
              id="pricing-heading"
              style={{
                fontSize: tokens.headingSize,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: tokens.ink,
                margin: 0,
                textWrap: 'balance',
              }}
            >
              Pick the plan that fits you.
            </h2>
            <p
              className="text-body"
              style={{
                marginTop: '16px',
                marginInline: 'auto',
                maxWidth: '52ch',
                textWrap: 'pretty',
                overflowWrap: 'break-word',
              }}
            >
              Works on Windows, macOS, and Linux. One payment — 2 years of updates, yours forever.
            </p>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 560px)',
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            {plans.map((plan, i) => (
              <div
                key={plan.key}
                className="stagger-item"
                style={{
                  flex: '1',
                  borderRadius: '1.5rem',
                  background: tokens.surface,
                  paddingBlock: '12px',
                  paddingInline: '16px',
                  borderTop: '2px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <p
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: tokens.ink,
                    margin: 0,
                  }}
                >
                  {plan.name}
                </p>

                <p
                  style={{
                    fontSize: tokens.smallSize,
                    color: tokens.inkMuted,
                    margin: '4px 0 0',
                    lineHeight: 1.5,
                    textWrap: 'pretty',
                    overflowWrap: 'break-word',
                  }}
                >
                  {plan.description}
                </p>

                <div
                  style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '12px' }}
                >
                  <span
                    style={{
                      fontSize: '2.5rem',
                      fontWeight: 700,
                      color: tokens.ink,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {plan.price}
                  </span>
                  <span
                    style={{
                      fontSize: tokens.smallSize,
                      fontWeight: 600,
                      color: tokens.accent,
                      background: tokens.highlight,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      marginInlineStart: '8px',
                    }}
                  >
                    one-time
                  </span>
                </div>

                <div
                  style={{
                    background: tokens.highlight,
                    borderRadius: '0.75rem',
                    padding: '10px 12px',
                    marginTop: '14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: tokens.ink,
                    textAlign: 'center',
                  }}
                >
                  💎 Replaces $180+/mo in separate apps — pay once, keep forever
                </div>

                <div
                  style={{
                    height: '1px',
                    background: tokens.highlight,
                    margin: '16px 0',
                  }}
                />

                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    flex: 1,
                  }}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: tokens.smallSize,
                        color: tokens.inkMuted,
                        lineHeight: 1.5,
                        overflowWrap: 'break-word',
                        maxWidth: '65ch',
                      }}
                    >
                      <CheckIcon color={plan.accent} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: '20px' }}>
                  <Link
                    data-slot="button"
                    className="btn-accent"
                    href={plan.cta.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      height: '36px',
                      borderRadius: '0.75rem',
                      padding: '0 18px',
                      background: 'var(--color-accent)',
                      color: 'var(--color-accent-text)',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition:
                        'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms cubic-bezier(0.23, 1, 0.32, 1)',
                      width: '100%',
                    }}
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: tokens.labelSize,
              color: tokens.inkFaint,
              textAlign: 'center',
              marginTop: '28px',
              marginBottom: 0,
            }}
          >
            Need the full feature breakdown?{' '}
            <Link
              href="/pricing"
              style={{ color: tokens.accent, textDecoration: 'none', fontWeight: 600 }}
            >
              See everything included &rarr;
            </Link>
          </p>
        </div>
      </section>
      <style>{`.btn-accent:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}.btn-accent:active:not(:disabled){transform:scale(0.96)}.pricing-card:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}`}</style>
    </>
  );
}
