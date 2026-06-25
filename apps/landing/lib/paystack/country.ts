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
  return normalizeCountryCode(
    headers.get('x-vercel-ip-country') ??
      headers.get('cf-ipcountry') ??
      headers.get('x-country-code') ??
      headers.get('x-country')
  );
}
