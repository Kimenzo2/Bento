export type BillingPeriod = 'monthly' | 'yearly';
export type BillingTier = 'core' | 'pro' | 'power';
export type PricingPlanCode =
  | 'core_monthly'
  | 'core_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'power_monthly'
  | 'power_yearly';

export type PricingPlan = {
  key: BillingTier;
  name: string;
  description: string;
  summary: string;
  price: Record<BillingPeriod, string>;
  period: Record<BillingPeriod, string>;
  accent: string;
  features: string[];
  planCodes: Record<BillingPeriod, PricingPlanCode>;
  badge?: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: 'core',
    name: 'Core',
    description: 'The essentials for a calm, focused workflow.',
    summary: 'Five anchor apps',
    price: { monthly: '$9', yearly: '$90' },
    period: { monthly: '/mo', yearly: '/yr' },
    accent: 'var(--color-ink)',
    features: [
      'Tasks, Notes, Journal, Password Vault, Budget',
      'Local-first desktop experience',
      'No AI features',
      'Best for focused personal use',
    ],
    planCodes: { monthly: 'core_monthly', yearly: 'core_yearly' },
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'For people using Bento across work, study, and daily routines.',
    summary: 'All 15 apps',
    price: { monthly: '$19', yearly: '$180' },
    period: { monthly: '/mo', yearly: '/yr' },
    accent: 'var(--color-ink)',
    features: [
      'All 15 apps',
      'Sync across devices (Coming soon)',
      'Basic AI features',
      'Desktop-first continuity',
    ],
    planCodes: { monthly: 'pro_monthly', yearly: 'pro_yearly' },
    badge: 'Most popular',
  },
  {
    key: 'power',
    name: 'Power',
    description: 'For heavy users who want the full Bento experience.',
    summary: 'Everything unlocked',
    price: { monthly: '$29', yearly: '$270' },
    period: { monthly: '/mo', yearly: '/yr' },
    accent: 'var(--color-ink)',
    features: [
      'All 15 apps',
      'Unlimited devices',
      'Advanced AI intelligence layer',
      'Priority support and early access',
    ],
    planCodes: { monthly: 'power_monthly', yearly: 'power_yearly' },
  },
];

export function isBillingPeriod(value: string | undefined): value is BillingPeriod {
  return value === 'monthly' || value === 'yearly';
}

export function getBillingPeriod(value: string | undefined): BillingPeriod {
  return isBillingPeriod(value) ? value : 'monthly';
}

export function findPlanByCode(code: string | null | undefined) {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  return (
    PRICING_PLANS.find(
      (plan) => plan.planCodes.monthly === normalized || plan.planCodes.yearly === normalized
    ) ?? null
  );
}

export function planCodeFor(planKey: BillingTier, period: BillingPeriod): PricingPlanCode {
  const plan = PRICING_PLANS.find((item) => item.key === planKey);
  if (!plan) {
    throw new Error(`Unknown pricing plan: ${planKey}`);
  }

  return plan.planCodes[period];
}

export function tierRank(tier: string | null | undefined): number {
  const normalized = (tier ?? 'free').trim().toLowerCase();
  if (normalized === 'core') return 1;
  if (normalized === 'pro') return 2;
  if (normalized === 'power') return 3;
  return 0;
}
