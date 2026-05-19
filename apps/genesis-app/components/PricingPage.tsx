import { ArrowLeft, BrainCircuit, Check, MonitorSmartphone, ShieldCheck, Sparkles } from 'lucide-react';
import type React from 'react';
import { usePageSEO } from '../hooks/usePageSEO';
import { Button } from './ui/button';
import { useNavigate } from 'react-router';

type BillingPlan = {
  name: string;
  monthly: string;
  yearly: string;
  summary: string;
  features: string[];
  accent: string;
};

const PLANS: BillingPlan[] = [
  {
    name: 'Core',
    monthly: '$9/month',
    yearly: '$90/year',
    summary: 'Five anchor apps. Local only. No sync. No AI.',
    features: ['Tasks', 'Notes', 'Journal', 'Password Vault', 'Budget'],
    accent: 'from-cocoa-light/10 to-peach-soft/30',
  },
  {
    name: 'Pro',
    monthly: '$19/month',
    yearly: '$180/year',
    summary: 'All 21 apps. Sync across 3 devices. Basic AI features.',
    features: ['All 21 apps', 'Sync across 3 devices', 'Basic AI', 'Desktop + web access'],
    accent: 'from-coral-burst/10 to-gold-sunshine/25',
  },
  {
    name: 'Power',
    monthly: '$29/month',
    yearly: '$270/year',
    summary:
      'All 21 apps. Unlimited devices. Advanced AI intelligence layer. Priority support.',
    features: [
      'All 21 apps',
      'Unlimited devices',
      'Advanced AI recommendations',
      'Priority support',
      'Early access to new modules',
    ],
    accent: 'from-blue-500/10 to-purple-500/20',
  },
];

interface PricingPageProps {
  onUpgrade?: () => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onUpgrade }) => {
  void onUpgrade;
  const navigate = useNavigate();

  usePageSEO({
    title: 'Billing moved to desktop — Genesis',
    description:
      'Genesis billing and subscription changes are now managed in the desktop app. The web app only shows plan information.',
    canonical: '/pricing',
  });

  return (
    <section className="w-full min-h-screen bg-cream-base pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-peach-soft/60 bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cocoa-light">
              <Sparkles className="w-3.5 h-3.5 text-gold-sunshine" />
              Billing moved to desktop
            </div>
            <h1 className="mt-4 font-heading font-bold text-4xl md:text-5xl text-charcoal-soft">
              Pricing is now read only on the web
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-cocoa-light">
              Subscription changes and checkout now happen inside the Genesis desktop app. This
              web page stays open for reference only so there is no confusion about where billing
              lives.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="hidden md:inline-flex gap-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mb-8">
          <div className="rounded-3xl border-2 border-peach-soft/40 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-charcoal-soft flex items-center justify-center shrink-0">
                <MonitorSmartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-2xl text-charcoal-soft">
                  Desktop is the purchase surface
                </h2>
                <p className="mt-2 text-cocoa-light">
                  The web app will no longer route users into checkout, upgrade modals, or billing
                  flows. Desktop owns the purchase path and the same live Dodo infra remains in
                  place there.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                'No web checkout buttons',
                'No billing modal on the web',
                'Desktop uses the live Dodo backend',
                'Plan changes sync through Supabase',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-2xl border border-peach-soft/40 bg-cream-base/70 p-4"
                >
                  <Check className="mt-0.5 w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-charcoal-soft">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-peach-soft/40 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <BrainCircuit className="w-5 h-5 text-coral-burst" />
              <h2 className="font-heading font-bold text-xl text-charcoal-soft">Plan summary</h2>
            </div>
            <p className="text-sm text-cocoa-light">
              The tiers below are the current desktop billing model. The web app keeps them visible
              for clarity only.
            </p>

            <div className="mt-5 space-y-3">
              {PLANS.map((plan) => (
                <div key={plan.name} className="rounded-2xl border border-peach-soft/40 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading font-bold text-charcoal-soft">{plan.name}</h3>
                      <p className="text-xs uppercase tracking-[0.2em] text-cocoa-light">
                        {plan.monthly} / {plan.yearly}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl bg-linear-to-br ${plan.accent}`} />
                  </div>
                  <p className="mt-3 text-sm text-charcoal-soft/80">{plan.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full border border-peach-soft/50 bg-cream-base px-3 py-1 text-xs text-cocoa-light"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-peach-soft/40 bg-surface p-6 md:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 w-5 h-5 text-gold-sunshine shrink-0" />
            <div>
              <h2 className="font-heading font-bold text-xl text-charcoal-soft">
                Need to change your plan?
              </h2>
              <p className="mt-2 text-cocoa-light">
                Open the Genesis desktop app and use the billing page there. That is now the only
                place where plan changes, device limits, and AI tier changes are managed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingPage;
