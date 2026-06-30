import Link from 'next/link';
import Script from 'next/script';
import { headers } from 'next/headers';
import type { CSSProperties } from 'react';
import { tokens } from '../../components/tokens';
import { createAdminClient, createClient, getAuthenticatedUser } from '../../lib/supabase/server';
import { PRICING_PLANS, findPlanByCode, getBillingPeriod, tierRank } from '../../lib/billing';
import {
  detectCheckoutCountry,
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

function manageLabel(currentTierRank: number, planRank: number) {
  if (planRank === currentTierRank) return 'Current plan';
  if (planRank < currentTierRank) return 'Downgrade';
  return 'Upgrade';
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
  const issueDetails = firstString(params.details) ?? null;
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

  return (
    <main className="pricing-page">
      <section className="pricing-page__hero">
        <div className="pricing-page__inner">
          {issue ? (
            <div className="pricing-page__alert text-body" role="status" aria-live="polite">
              {issue === 'signin_required'
                ? 'Please sign in to continue.'
                : issue === 'profile_missing'
                  ? 'No account found for that email. Please sign in first.'
                  : issue === 'unknown_plan'
                    ? 'Plan not found. Please select another plan.'
                    : issue === 'missing_paystack_plan'
                      ? 'This plan is temporarily unavailable.'
                      : issue === 'paystack' || issue === 'server' || issue === 'profile_creation' || issue === 'auth_user'
                        ? `Error: ${issueDetails || 'Something went wrong'}`
                        : `Something went wrong.${issueDetails ? ` (${issueDetails})` : ''}`}
            </div>
          ) : null}

          <div className="pricing-page__hero-copy">
            <p className="pricing-page__eyebrow">Pricing</p>
            <h1 className="pricing-page__title">Simple, transparent pricing.</h1>
            <p className="pricing-page__subtitle">
              Pick the tier that fits you best. Upgrade or downgrade at any time.
            </p>
          </div>

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

          <div className="pricing-page__method-strip" aria-label="Accepted payment methods">
            {paymentMethodViews.map((method) => (
              <span key={`${method.countryCode}:${method.methodKey}`} className="pricing-page__method-pill">
                {method.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-page__plans" aria-labelledby="pricing-plans-heading">
        <div className="pricing-page__inner">
          <div className="pricing-page__plans-header">
            <h2 id="pricing-plans-heading">Plans</h2>
            <p className="text-body">
              {activePlan
                ? `Your current plan is ${activePlan.name}.`
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
                      <p className="text-body">{plan.description}</p>
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
                      <li key={feature} className="text-body">{feature}</li>
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
                      data-slot="button"
                      type="submit"
                      className="pricing-page__cta btn-accent"
                      disabled={isCurrent || !canCheckout}
                    >
                      {!canCheckout
                        ? 'Sign in to subscribe'
                        : user
                          ? manageLabel(currentTierRank, rank)
                          : 'Subscribe'}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pricing-page__note">
        <div className="pricing-page__inner">
          <div className="pricing-page__note-card">
            <h2>Your privacy comes first.</h2>
            <p className="text-body">
              Payment details stay in your browser. Your data stays on your device.
            </p>
            <Link href="/" data-slot="button" className="pricing-page__note-link btn-accent">
              Back to home
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .pricing-page {
          background: var(--color-bg);
          color: var(--color-ink);
          min-height: 100vh;
          line-height: 1.5;
          letter-spacing: -0.1px;
        }

        .pricing-page__inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 28px;
        }

        .pricing-page__hero {
          padding: 7.5rem 0 4rem;
          text-align: center;
        }

        .pricing-page__alert {
          margin-bottom: 1.25rem;
          border-radius: 0.75rem;
          background: var(--color-accent-bg);
          color: var(--color-accent);
          padding: 0.95rem 1rem;
          max-width: 760px;
          margin-inline: auto;
        }

        .pricing-page__hero-copy {
          max-width: 640px;
          margin-inline: auto;
        }

        .pricing-page__eyebrow {
          display: inline-block;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-accent);
          margin-bottom: 1rem;
        }

        .pricing-page__title {
          font-size: clamp(2.6rem, 5vw, 4.4rem);
          line-height: 1.05;
          letter-spacing: -0.04em;
          margin: 0;
          color: var(--color-ink);
        }

        .pricing-page__subtitle {
          font-size: 1.12rem;
          line-height: 1.7;
          color: var(--color-ink-muted);
          max-width: 52ch;
          margin: 1.25rem auto 0;
        }

        .pricing-page__billing-switch {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          margin-top: 2rem;
        }

        .pricing-page__billing-switch a {
          text-decoration: none;
          color: var(--color-ink-muted);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .pricing-page__billing-switch a.is-active {
          color: var(--color-ink);
          background: var(--color-highlight);
        }

        .pricing-page__plans,
        .pricing-page__note {
          padding: 0 0 4rem;
        }

        .pricing-page__plans-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: end;
          margin-bottom: 1.5rem;
        }

        .pricing-page__plans-header h2,
        .pricing-page__note-card h2 {
          margin: 0;
          font-size: clamp(1.6rem, 3vw, 2.2rem);
          letter-spacing: -0.03em;
          color: var(--color-ink);
        }

        .pricing-page__plans-header p {
          margin: 0;
          max-width: 44ch;
        }

        .pricing-page__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .pricing-page__card {
          border-radius: 1.5rem;
          padding: 12px 16px;
          background: var(--color-elevated);
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }

        .pricing-page__card.is-selected {
          background: var(--color-highlight);
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
          max-width: 28ch;
        }

        .pricing-page__badge {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--plan-accent);
          background: var(--color-highlight);
          padding: 0.45rem 0.7rem;
          border-radius: 0.75rem;
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
          color: var(--color-ink);
        }

        .pricing-page__period {
          color: var(--color-ink-muted);
          font-weight: 700;
        }

        .pricing-page__summary {
          color: var(--color-ink-muted);
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
          border-radius: 0.75rem;
          padding: 0 18px;
          background: var(--color-accent);
          color: var(--color-bg);
          font-weight: 500;
          font-size: 0.875rem;
          height: 36px;
          cursor: pointer;
          transition: background 0.2s ease, box-shadow 0.15s ease;
        }

        .pricing-page__cta:hover:not(:disabled) {
          background: var(--color-accent-hover);
        }

        .pricing-page__cta:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--color-accent);
          color: var(--color-bg);
        }

        .pricing-page__card.is-current .pricing-page__cta {
          background: var(--color-highlight);
          color: var(--color-ink-muted);
          cursor: default;
        }

        .pricing-page__card.is-current .pricing-page__cta:hover {
          background: var(--color-highlight) !important;
          color: var(--color-ink-muted);
        }

        .pricing-page__method-strip {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .pricing-page__method-pill {
          background: var(--color-highlight);
          border-radius: 0.75rem;
          padding: 0.4rem 0.75rem;
          font-size: 0.8rem;
          color: var(--color-ink-muted);
        }

        .pricing-page__note-card {
          border-radius: 1.5rem;
          background: var(--color-elevated);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .pricing-page__note-card p {
          max-width: 62ch;
          margin-top: 0.5rem;
        }

        .pricing-page__note-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 18px;
          border-radius: 0.75rem;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          height: 36px;
          color: var(--color-bg);
          background: var(--color-accent);
          white-space: nowrap;
          transition: background 0.2s ease, box-shadow 0.15s ease;
        }

        @media (max-width: 900px) {
          .pricing-page__grid {
            grid-template-columns: 1fr;
          }

          .pricing-page__plans-header,
          .pricing-page__note-card {
            flex-direction: column;
            align-items: start;
          }
        }
      `}</style>
      <Script id="pricing-country-detect" strategy="afterInteractive">{`
        (function(){
          var c = null, tz;
          try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){}
          if (tz && tz.indexOf('/') > 0) {
            var city = tz.split('/')[1];
            var africa = {Nairobi:'KE',Lagos:'NG',Accra:'GH',Abidjan:'CI',Johannesburg:'ZA',Cairo:'EG',Casablanca:'MA',Tunis:'TN',Algiers:'DZ',Khartoum:'SD',Addis_Ababa:'ET',Dar_es_Salaam:'TZ',Kampala:'UG',Kigali:'RW',Maputo:'MZ',Luanda:'AO',Douala:'CM',Dakar:'SN',Harare:'ZW'};
            c = africa[city] || (city.length===2 ? city.toUpperCase() : null);
          }
          document.querySelectorAll('input[name="country"]').forEach(function(el){
            if (c && (el.value==='GLOBAL'||!el.value)) el.value = c;
          });
          document.querySelectorAll('form.pricing-page__form').forEach(function(f){
            f.addEventListener('submit',function(){
              var inp = this.querySelector('input[name="country"]');
              if (inp && c && (inp.value==='GLOBAL'||!inp.value)) inp.value = c;
            });
          });
        })();
      `}</Script>
    </main>
  );
}
