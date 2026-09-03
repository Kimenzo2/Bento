// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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
    name: 'Lifetime',
    description: 'One payment, yours forever. Replaces $180+/mo in subscriptions.',
    summary: '17 apps in one — 2 years updates included',
    price: { monthly: '$29', yearly: '$270' },
    period: { monthly: '/mo', yearly: '/yr' },
    accent: 'var(--color-ink)',
    features: [
      'Replaces $180+/mo — 17 apps in one, pay once, keep forever',
      'All 17 apps + every future app free for 2 years',
      '2 years of updates included — yours to keep forever (no subscription)',
      'Notes — replaces Notion ($10/mo) / Evernote ($14.99/mo): 8 block types, tags, favorites, Markdown and JSON export, local-first',
      'Tasks — replaces Todoist Pro ($7/mo): natural language, recurring, My Day / Important / Planned, tags, history and search',
      'Journal — replaces Day One Gold ($74.99/yr): prompts, mood, photos, streaks, timeline, PDF / CSV / Markdown export',
      'Habits — replaces Streaks ($5.99) / Productive ($7/mo): unlimited habits, streaks, 90-day heatmap, weekly review',
      'Focus — replaces Forest: Pomodoro, custom intervals, ambient sounds, site blocking, sessions history and review',
      'Password vault — replaces 1Password ($3.99/mo): unlimited logins, passkeys, breach alerts, secure notes, travel mode, audit',
      'Health — vitals (BP/HR/weight/temp/SpO2), meds adherence, insights, AI recap, doctor reports and CSV',
      'Sleep — replaces Sleep Cycle: scores, smart alarm window, routine, stage balance, weekly trends, snore detection',
      'Nutrition — replaces MyFitnessPal ($19.99/mo): water + meals, macros, reminders, hydration stats, streaks and export',
      'Mood — replaces Daylio: one-tap logging, calendar, activity correlation, pattern detection, therapist prep notes',
      'Budget — replaces YNAB ($14.99/mo): manual transactions, category budgets, bills, forecast, AI cost tracking, CSV export',
      'Clipboard — replaces Paste ($29.99/yr, $89 lifetime): unlimited history, bookmarks, snippets, images, auto-expire secrets, search by app',
      'Voice memos — replaces Otter.ai ($17/mo): one-tap record, auto-transcription, speaker labels, searchable tags and export',
      'Countdown — events, birthdays, milestones, days-since tracker, shareable cards and widgets',
      'Goals and dashboard — long-term goals, milestones, accountability, quick actions and app health at a glance',
      'Local-first, offline and private — data never leaves your device (unlike Notion/Evernote cloud)',
      'Priority support, early access and commercial use — build your life OS without limits',
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
