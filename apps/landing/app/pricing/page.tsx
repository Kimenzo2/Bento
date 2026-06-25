import Link from 'next/link';
import { headers } from 'next/headers';
import type { CSSProperties } from 'react';
import { createAdminClient, createClient, getAuthenticatedUser } from '../../lib/supabase/server';
import { PRICING_PLANS, findPlanByCode, getBillingPeriod, tierRank } from '../../lib/billing';
import {
  detectCheckoutCountry,
  getCountryDisplayName,
  getCountryFromHeaders,
  normalizeCountryCode,
} from '../../lib/paystack/country';
import {
  getPaystackMethodsForCountry,
  loadPaystackMethodRules,
  selectPreferredPaystackMethod,
  toPaystackMethodViews,
} from '../../lib/paystack/payment-methods';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatStatus(subscriptionStatus?: string | null) {
  const value = (subscriptionStatus ?? 'free').trim().toLowerCase();
  if (value === 'active') return 'Active';
  if (value === 'attention') return 'Needs attention';
  if (value === 'non-renewing') return 'Cancels at period end';
  if (value === 'cancelled') return 'Cancelled';
  if (value === 'finalization_required') return 'Pending activation';
  return 'Free';
}

function manageLabel(currentTierRank: number, planRank: number) {
  if (planRank === currentTierRank) return 'Current plan';
  if (planRank < currentTierRank) return 'Switch to this plan';
  return 'Continue to Paystack';
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const period = getBillingPeriod(firstString(params.billing));
  const selectedPlanCode = firstString(params.plan);
  const desktopEmail = firstString(params.email)?.trim() ?? '';
  const manualCountry = normalizeCountryCode(firstString(params.country));
  const issue =
    firstString(params.error) ??
    (firstString(params.signin) === 'required' ? 'signin_required' : null);
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const requestHeaders = await headers();
  const headerCountry = getCountryFromHeaders(requestHeaders);

  let profile: {
    user_tier: string | null;
    payment_provider: string | null;
    subscription_status: string | null;
    subscription_plan_code: string | null;
    subscription_end_date: string | null;
    cancel_at_period_end: boolean | null;
    billing_country: string | null;
    shipping_country: string | null;
    last_checkout_country: string | null;
    last_checkout_method: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select(
        'user_tier, payment_provider, subscription_status, subscription_plan_code, subscription_end_date, cancel_at_period_end, billing_country, shipping_country, last_checkout_country, last_checkout_method'
      )
      .eq('id', user.id)
      .maybeSingle();
    profile = data ?? null;
  } else if (desktopEmail) {
    const { data } = await adminSupabase
      .from('profiles')
      .select(
        'user_tier, payment_provider, subscription_status, subscription_plan_code, subscription_end_date, cancel_at_period_end, billing_country, shipping_country, last_checkout_country, last_checkout_method'
      )
      .eq('email', desktopEmail)
      .maybeSingle();
    profile = data ?? null;
  }

  const profilePlan = findPlanByCode(profile?.subscription_plan_code);
  const selectedPlan = findPlanByCode(selectedPlanCode) ?? profilePlan ?? PRICING_PLANS[1];
  const currentTierRank = tierRank(profile?.user_tier);
  const activePlan = profilePlan;
  const detectedCountry = detectCheckoutCountry({
    manualCountry,
    profileCountry: profile?.last_checkout_country,
    billingCountry: profile?.billing_country,
    shippingCountry: profile?.shipping_country,
    headerCountry,
  });
  const methodRules = await loadPaystackMethodRules(adminSupabase);
  const availableMethods = getPaystackMethodsForCountry(detectedCountry, methodRules);
  const selectedMethodKey =
    selectPreferredPaystackMethod(detectedCountry, methodRules, profile?.last_checkout_method).selectedMethodKey;
  const paymentMethodViews = toPaystackMethodViews(availableMethods);
  const canCheckout = Boolean(user || desktopEmail);
  const billingNote = user
    ? profile
      ? `${user.email} · ${formatStatus(profile.subscription_status)}`
      : `${user.email} · no subscription record yet`
    : desktopEmail
      ? `Continuing as ${desktopEmail}`
    : 'Sign in in the browser before starting checkout.';
  const countryLabel = getCountryDisplayName(detectedCountry);

  return (
    <main className="pricing-page">
      <section className="pricing-page__hero">
        <div className="pricing-page__inner">
          {issue ? (
            <div className="pricing-page__alert" role="status" aria-live="polite">
              {issue === 'signin_required'
                ? 'Sign in first or continue from the desktop app email. Bento needs a profile match to attach the payment to the right account.'
                : issue === 'unknown_plan'
                  ? 'That plan was not recognized. Pick a plan below.'
                  : issue === 'missing_paystack_plan'
                    ? 'The Paystack plan code for this tier is missing in environment configuration.'
                    : 'Checkout could not start. Please try again.'}
            </div>
          ) : null}

          <div className="pricing-page__hero-copy">
            <p className="pricing-page__eyebrow">Bento pricing</p>
            <h1 className="pricing-page__title">Pick a plan, pay on the web, unlock in desktop.</h1>
            <p className="pricing-page__subtitle">
              Upgrade opens a secure hosted checkout on Paystack. Bento never stores your payment
              secret, and the desktop app only reacts to Supabase subscription updates.
            </p>

            <div className="pricing-page__hero-meta">
              <span className="pricing-page__meta-pill">{billingNote}</span>
              <span className="pricing-page__meta-pill">
                Desktop syncs automatically after the Paystack webhook updates Supabase.
              </span>
              <span className="pricing-page__meta-pill">
                {countryLabel
                  ? `Detected country: ${countryLabel}`
                  : 'Detected country: defaulting to card-only checkout.'}
              </span>
            </div>
          </div>

          <div className="pricing-page__hero-panel">
            <div className="pricing-page__billing-switch" aria-label="Billing period">
              <Link
                className={period === 'monthly' ? 'is-active' : ''}
                href={`/pricing?billing=monthly${selectedPlanCode ? `&plan=${selectedPlanCode}` : ''}${desktopEmail ? `&email=${encodeURIComponent(desktopEmail)}` : ''}`}
              >
                Monthly
              </Link>
              <Link
                className={period === 'yearly' ? 'is-active' : ''}
                href={`/pricing?billing=yearly${selectedPlanCode ? `&plan=${selectedPlanCode}` : ''}${desktopEmail ? `&email=${encodeURIComponent(desktopEmail)}` : ''}`}
              >
                Yearly
              </Link>
            </div>
            <p className="pricing-page__panel-copy">
              Choose a plan below. The card you click posts directly to the server route that
              initializes Paystack using Bento&apos;s secret key on the web side only.
            </p>
            <div className="pricing-page__method-strip" aria-label="Available payment methods">
              {paymentMethodViews.map((method) => (
                <span key={`${method.countryCode}:${method.methodKey}`} className="pricing-page__method-pill">
                  {method.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-page__plans" aria-labelledby="pricing-plans-heading">
        <div className="pricing-page__inner">
          <div className="pricing-page__plans-header">
            <h2 id="pricing-plans-heading">Plans</h2>
            <p>
              {activePlan
                ? `Your current plan is ${activePlan.name}. Select another plan to upgrade or renew.`
                : 'Select the plan that fits how you use Bento.'}
            </p>
          </div>

          <div className="pricing-page__grid">
            {PRICING_PLANS.map((plan) => {
              const rank = tierRank(plan.key);
              const isCurrent = rank === currentTierRank;
              const planCode = plan.planCodes[period];
              const isSelected =
                selectedPlan.key === plan.key ||
                selectedPlan.planCodes.monthly === planCode ||
                selectedPlan.planCodes.yearly === planCode;

              return (
                <article
                  key={plan.key}
                  className={`pricing-page__card${isSelected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}`}
                  style={{ '--plan-accent': plan.accent } as CSSProperties}
                >
                  <div className="pricing-page__card-top">
                    <div>
                      <h3>{plan.name}</h3>
                      <p>{plan.description}</p>
                    </div>
                    {plan.badge ? <span className="pricing-page__badge">{plan.badge}</span> : null}
                  </div>

                  <div className="pricing-page__price-row">
                    <div className="pricing-page__price">
                      <span className="pricing-page__currency">{plan.price[period]}</span>
                      <span className="pricing-page__period">{plan.period[period]}</span>
                    </div>
                    <span className="pricing-page__summary">{plan.summary}</span>
                  </div>

                  <ul className="pricing-page__features">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>

                  <form
                    action="/api/paystack/initialize"
                    method="post"
                    className="pricing-page__form"
                  >
                    <input type="hidden" name="planCode" value={planCode} />
                    <input type="hidden" name="billingPeriod" value={period} />
                    <input
                      type="hidden"
                      name="country"
                      value={detectedCountry ?? 'GLOBAL'}
                    />
                    <input type="hidden" name="method" value={selectedMethodKey} />
                    <input
                      type="hidden"
                      name="billingCountry"
                      value={profile?.billing_country ?? detectedCountry ?? ''}
                    />
                    <input
                      type="hidden"
                      name="shippingCountry"
                      value={profile?.shipping_country ?? ''}
                    />
                    <input type="hidden" name="source" value={user ? 'web' : 'desktop'} />
                    {desktopEmail ? <input type="hidden" name="email" value={desktopEmail} /> : null}
                    <button
                      type="submit"
                      className="pricing-page__cta"
                      disabled={isCurrent || !canCheckout}
                    >
                      {!canCheckout
                        ? 'Sign in to continue'
                        : user
                          ? manageLabel(currentTierRank, rank)
                          : 'Continue to Paystack'}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pricing-page__flow" aria-labelledby="pricing-flow-heading">
        <div className="pricing-page__inner">
          <div className="pricing-page__flow-header">
            <h2 id="pricing-flow-heading">How the upgrade flow works</h2>
            <p>Desktop stays local-first. Web handles payment. Supabase moves the plan state.</p>
          </div>

          <div className="pricing-page__steps">
            <div className="pricing-page__step">
              <span>1</span>
              <h3>Choose a plan</h3>
              <p>
                Pick monthly or yearly, then submit the card that matches your target tier and
                country.
              </p>
            </div>
            <div className="pricing-page__step">
              <span>2</span>
              <h3>Pay on Paystack</h3>
              <p>
                Checkout opens on Paystack&apos;s hosted surface. The web app keeps the secret key.
              </p>
            </div>
            <div className="pricing-page__step">
              <span>3</span>
              <h3>Webhook updates Supabase</h3>
              <p>A Paystack webhook updates the `profiles` row with the new subscription state.</p>
            </div>
            <div className="pricing-page__step">
              <span>4</span>
              <h3>Desktop unlocks automatically</h3>
              <p>
                Bento listens to Supabase realtime, refreshes billing, and unlocks the new tier.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-page__note">
        <div className="pricing-page__inner">
          <div className="pricing-page__note-card">
            <h2>Security-first by design</h2>
            <p>
              No Paystack secret key lives in the Tauri app. Desktop only opens this page, and all
              subscription changes land back in the app through Supabase.
            </p>
            <Link href="/" className="pricing-page__note-link">
              Back to the home page
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .pricing-page {
          background:
            radial-gradient(circle at top left, rgba(184,92,58,0.09), transparent 32%),
            radial-gradient(circle at top right, rgba(140,124,199,0.08), transparent 28%),
            linear-gradient(180deg, #fefcf8 0%, #fcf7f0 55%, #fefcf8 100%);
          color: #2c2418;
          min-height: 100vh;
        }

        .pricing-page__inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 28px;
        }

        .pricing-page__hero {
          padding: 7.5rem 0 4rem;
        }

        .pricing-page__alert {
          margin-bottom: 1.25rem;
          border-radius: 20px;
          border: 1px solid rgba(184,92,58,0.18);
          background: rgba(239, 224, 212, 0.66);
          color: #6b3a25;
          padding: 0.95rem 1rem;
          box-shadow: 0 14px 28px rgba(44,36,24,0.05);
          max-width: 760px;
        }

        .pricing-page__hero-copy {
          max-width: 680px;
        }

        .pricing-page__eyebrow {
          display: inline-block;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #b85c3a;
          margin-bottom: 1rem;
        }

        .pricing-page__title {
          font-size: clamp(2.6rem, 5vw, 4.4rem);
          line-height: 1.05;
          letter-spacing: -0.04em;
          margin: 0;
          max-width: 10.5ch;
        }

        .pricing-page__subtitle {
          font-size: 1.12rem;
          line-height: 1.7;
          color: #6b5e53;
          max-width: 62ch;
          margin-top: 1.25rem;
        }

        .pricing-page__hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .pricing-page__meta-pill {
          border: 1px solid rgba(44,36,24,0.09);
          background: rgba(254, 252, 248, 0.78);
          border-radius: 999px;
          padding: 0.72rem 1rem;
          font-size: 0.9rem;
          color: #6b5e53;
          box-shadow: 0 12px 24px rgba(44,36,24,0.04);
        }

        .pricing-page__hero-panel {
          margin-top: 2rem;
          border: 1px solid rgba(44,36,24,0.08);
          background: rgba(254,252,248,0.82);
          border-radius: 28px;
          padding: 1.25rem;
          box-shadow: 0 24px 60px rgba(44,36,24,0.06);
          max-width: 520px;
        }

        .pricing-page__billing-switch {
          display: inline-flex;
          background: #f7efe4;
          padding: 0.3rem;
          border-radius: 999px;
          gap: 0.2rem;
        }

        .pricing-page__billing-switch a {
          text-decoration: none;
          color: #6b5e53;
          padding: 0.7rem 1rem;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 700;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .pricing-page__billing-switch a.is-active {
          background: #2c2418;
          color: #fff;
        }

        .pricing-page__panel-copy {
          margin-top: 1rem;
          color: #6b5e53;
          line-height: 1.65;
        }

        .pricing-page__plans,
        .pricing-page__flow,
        .pricing-page__note {
          padding: 0 0 4rem;
        }

        .pricing-page__plans-header,
        .pricing-page__flow-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: end;
          margin-bottom: 1.5rem;
        }

        .pricing-page__plans-header h2,
        .pricing-page__flow-header h2,
        .pricing-page__note-card h2 {
          margin: 0;
          font-size: clamp(1.6rem, 3vw, 2.2rem);
          letter-spacing: -0.03em;
        }

        .pricing-page__plans-header p,
        .pricing-page__flow-header p {
          margin: 0;
          max-width: 44ch;
          color: #6b5e53;
        }

        .pricing-page__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .pricing-page__card {
          border-radius: 28px;
          padding: 1.4rem;
          border: 1px solid rgba(44,36,24,0.08);
          background: rgba(254,252,248,0.9);
          box-shadow: 0 18px 40px rgba(44,36,24,0.05);
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }

        .pricing-page__card.is-selected {
          border-color: color-mix(in srgb, var(--plan-accent) 38%, rgba(44,36,24,0.08));
          box-shadow: 0 22px 48px rgba(44,36,24,0.08);
        }

        .pricing-page__card.is-current .pricing-page__cta {
          background: #efe0d4;
          color: #6b5e53;
          cursor: default;
        }

        .pricing-page__card-top {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: start;
        }

        .pricing-page__card-top h3 {
          margin: 0;
          font-size: 1.4rem;
          letter-spacing: -0.03em;
        }

        .pricing-page__card-top p {
          margin-top: 0.35rem;
          color: #6b5e53;
          line-height: 1.55;
          max-width: 28ch;
        }

        .pricing-page__badge {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--plan-accent);
          background: color-mix(in srgb, var(--plan-accent) 12%, #fff);
          border: 1px solid color-mix(in srgb, var(--plan-accent) 22%, transparent);
          padding: 0.45rem 0.7rem;
          border-radius: 999px;
          white-space: nowrap;
        }

        .pricing-page__price-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: baseline;
          margin-top: 1.4rem;
        }

        .pricing-page__price {
          display: flex;
          align-items: end;
          gap: 0.35rem;
        }

        .pricing-page__currency {
          font-size: 2.4rem;
          font-weight: 700;
          letter-spacing: -0.05em;
        }

        .pricing-page__period {
          color: #6b5e53;
          font-weight: 700;
        }

        .pricing-page__summary {
          color: #6b5e53;
          font-size: 0.95rem;
        }

        .pricing-page__features {
          list-style: none;
          display: grid;
          gap: 0.75rem;
          margin-top: 1.4rem;
          flex: 1;
        }

        .pricing-page__features li {
          position: relative;
          padding-left: 1.2rem;
          color: #46382b;
          line-height: 1.55;
        }

        .pricing-page__features li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.55rem;
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 999px;
          background: var(--plan-accent);
        }

        .pricing-page__form {
          margin-top: 1.4rem;
        }

        .pricing-page__cta {
          width: 100%;
          border: none;
          border-radius: 999px;
          padding: 0.95rem 1.15rem;
          background: #2c2418;
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: transform 0.16s ease, background 0.16s ease, opacity 0.16s ease;
        }

        .pricing-page__cta:hover:not(:disabled) {
          transform: translateY(-1px);
          background: color-mix(in srgb, var(--plan-accent) 84%, #2c2418);
        }

        .pricing-page__cta:disabled {
          opacity: 0.85;
          cursor: not-allowed;
        }

        .pricing-page__step {
          border-radius: 24px;
          border: 1px solid rgba(44,36,24,0.08);
          background: rgba(254,252,248,0.9);
          padding: 1.25rem;
          box-shadow: 0 12px 30px rgba(44,36,24,0.04);
        }

        .pricing-page__steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .pricing-page__step span {
          display: inline-grid;
          place-items: center;
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          background: #f7efe4;
          color: #b85c3a;
          font-weight: 800;
          margin-bottom: 0.9rem;
        }

        .pricing-page__step h3 {
          margin: 0;
          font-size: 1.05rem;
          letter-spacing: -0.02em;
        }

        .pricing-page__step p {
          margin-top: 0.45rem;
          color: #6b5e53;
          line-height: 1.55;
        }

        .pricing-page__note-card {
          border-radius: 28px;
          border: 1px solid rgba(44,36,24,0.08);
          background: linear-gradient(180deg, rgba(247,239,228,0.72), rgba(254,252,248,0.92));
          padding: 1.5rem;
          box-shadow: 0 18px 40px rgba(44,36,24,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .pricing-page__note-card p {
          max-width: 62ch;
          color: #6b5e53;
          line-height: 1.65;
          margin-top: 0.5rem;
        }

        .pricing-page__note-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.9rem 1.2rem;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 700;
          color: #fff;
          background: #b85c3a;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .pricing-page__grid,
          .pricing-page__steps {
            grid-template-columns: 1fr;
          }

          .pricing-page__plans-header,
          .pricing-page__flow-header,
          .pricing-page__note-card {
            flex-direction: column;
            align-items: start;
          }

          .pricing-page__title {
            max-width: none;
          }
        }
      `}</style>
    </main>
  );
}
