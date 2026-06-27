import Link from 'next/link';
import { tokens } from './tokens';
import { PRICING_PLANS } from '../lib/billing';

const plans = PRICING_PLANS.map((plan) => ({
  key: plan.key,
  name: plan.name,
  description: plan.description,
  price: plan.price.monthly,
  sub: '/mo',
  accent: plan.accent,
  features: plan.features,
  badge: plan.badge,
  cta: { label: 'Subscribe', href: '/pricing', ghost: true },
}));

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ marginTop: '3px', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.25" />
      <path d="M5 8l2.25 2.25L11 6" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section
      style={{
        background: tokens.bg,
        padding: tokens.sectionPad + ' 28px',
      }}
      aria-labelledby="pricing-heading"
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
            }}
          >
            Pick the plan that fits you.
          </h2>
          <p
            className="text-body"
            style={{
              marginTop: '16px',
            }}
          >
            Every plan works on Windows, macOS, and Linux. Upgrade or downgrade at any time.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {plans.map((plan) => (
            <div
              key={plan.key}
              style={{
                flex: '1',
                borderRadius: '1.5rem',
                background: plan.badge ? tokens.elevated : tokens.surface,
                padding: '12px 16px',
                borderTop: plan.badge ? '2px solid ' + plan.accent : '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {plan.badge && (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: plan.accent,
                    background: `color-mix(in srgb, ${plan.accent} 15%, transparent)`,
                    padding: '2px 10px',
                    borderRadius: '999px',
                    alignSelf: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  {plan.badge}
                </span>
              )}

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
                }}
              >
                {plan.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '12px' }}>
                <span
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: tokens.ink,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                  }}
                >
                  {plan.price}
                </span>
                <span
                  style={{
                    fontSize: tokens.smallSize,
                    color: tokens.inkFaint,
                  }}
                >
                  {plan.sub}
                </span>
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
                    background: plan.badge ? tokens.accent : 'rgba(255,255,255,0.06)',
                    color: plan.badge ? tokens.bg : 'rgba(220,224,230,0.8)',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease, box-shadow 0.15s ease',
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
  );
}
