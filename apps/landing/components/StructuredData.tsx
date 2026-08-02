// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Script from 'next/script';
import { PRICING_PLANS } from '../lib/billing';

function buildOffers() {
  return PRICING_PLANS.flatMap((plan) => [
    {
      '@type': 'Offer',
      name: `${plan.name} Monthly`,
      price: plan.price.monthly.replace('$', ''),
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        billingDuration: 'P1M',
        price: plan.price.monthly.replace('$', ''),
        priceCurrency: 'USD',
      },
      url: `https://iamazeyou.me/pricing?plan=${plan.planCodes.monthly}`,
    },
    {
      '@type': 'Offer',
      name: `${plan.name} Yearly`,
      price: plan.price.yearly.replace('$', ''),
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        billingDuration: 'P1Y',
        price: plan.price.yearly.replace('$', ''),
        priceCurrency: 'USD',
      },
      url: `https://iamazeyou.me/pricing?plan=${plan.planCodes.yearly}`,
    },
  ]);
}

export function SoftwareAppSchema({ version }: { version?: string }) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Bento',
    applicationCategory: 'DesktopApplication',
    operatingSystem: 'Windows, macOS, Linux',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 15 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
    url: 'https://iamazeyou.me',
    downloadUrl: 'https://iamazeyou.me/download',
    screenshot: 'https://iamazeyou.me/images/hero-app-screenshot.png',
    offers: buildOffers(),
    featureList:
      '15 mini-apps, Works fully offline, Private — no data sent to servers, Light and dark themes, Available on Windows, macOS and Linux',
    author: { '@type': 'Organization', name: 'Bento Industries' },
  };

  if (version) {
    schema.softwareVersion = version;
  }

  return (
    <Script
      id="schema-software-app"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bento Industries',
    url: 'https://iamazeyou.me',
    logo: 'https://iamazeyou.me/bento-icon.png',
    foundingDate: '2025',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@iamazeyou.me',
      contactType: 'support',
    },
  };

  return (
    <Script
      id="schema-organization"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bento',
    url: 'https://iamazeyou.me',
    description:
      'Bento brings mood, tasks, habits, sleep, budget, notes, journal, passwords — 15 mini-apps — into one private desktop app. Fully offline. Your data stays on your machine.',
  };

  return (
    <Script
      id="schema-website"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
