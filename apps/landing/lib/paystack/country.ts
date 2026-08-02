// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/i;

function normalizeLikeCountryCode(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'global') return null;
  if (!COUNTRY_CODE_PATTERN.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function normalizeCountryCode(value?: string | null) {
  return normalizeLikeCountryCode(value);
}

export function getCountryDisplayName(countryCode?: string | null) {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) return null;

  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

export function detectCheckoutCountry(input: {
  manualCountry?: string | null;
  profileCountry?: string | null;
  billingCountry?: string | null;
  shippingCountry?: string | null;
  headerCountry?: string | null;
}) {
  return (
    normalizeCountryCode(input.manualCountry) ??
    normalizeCountryCode(input.profileCountry) ??
    normalizeCountryCode(input.billingCountry) ??
    normalizeCountryCode(input.shippingCountry) ??
    normalizeCountryCode(input.headerCountry)
  );
}

export function getCountryFromHeaders(headers: Pick<Headers, 'get'>) {
  const fromIp = normalizeCountryCode(
    headers.get('x-vercel-ip-country') ??
      headers.get('cf-ipcountry') ??
      headers.get('x-country-code') ??
      headers.get('x-country')
  );
  if (fromIp) return fromIp;

  const acceptLanguage = headers.get('accept-language') ?? '';
  const match = acceptLanguage.match(/[_-]([A-Z]{2})(?:;|,|$)/i);
  if (match) {
    const fromLang = normalizeCountryCode(match[1]);
    if (fromLang) return fromLang;
  }

  return null;
}
