const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
  CI: 'XOF',
  SN: 'XOF',
  BJ: 'XOF',
  TG: 'XOF',
  ML: 'XOF',
  BF: 'XOF',
  NE: 'XOF',
  US: 'USD',
};

const CURRENCY_UNIT_MULTIPLIERS: Record<string, number> = {
  NGN: 100,
  KES: 100,
  GHS: 100,
  ZAR: 100,
  USD: 100,
  XOF: 1,
};

export function getCurrencyForCountry(countryCode: string | null): string {
  if (!countryCode) return 'USD';
  const normalized = countryCode.trim().toUpperCase();
  return COUNTRY_CURRENCY_MAP[normalized] ?? 'USD';
}

export function getSmallestUnitMultiplier(currencyCode: string): number {
  const normalized = currencyCode.trim().toUpperCase();
  return CURRENCY_UNIT_MULTIPLIERS[normalized] ?? 100;
}

let cachedRates: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/USD';

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRates;
  }

  const response = await fetch(EXCHANGE_RATE_API, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Exchange rate API returned ${response.status}`);
  }

  const data = await response.json();
  if (!data?.rates) {
    throw new Error('Exchange rate API returned unexpected response');
  }

  cachedRates = data.rates as Record<string, number>;
  cacheTimestamp = now;
  return cachedRates;
}

export type CurrencyConversion = {
  currencyCode: string;
  smallestUnitAmount: number;
  exchangeRate: number;
};

export async function convertUsdToLocal(
  usdAmount: number,
  countryCode: string | null
): Promise<CurrencyConversion> {
  const currencyCode = getCurrencyForCountry(countryCode);
  const multiplier = getSmallestUnitMultiplier(currencyCode);

  if (currencyCode === 'USD') {
    return {
      currencyCode: 'USD',
      smallestUnitAmount: Math.round(usdAmount * 100),
      exchangeRate: 1,
    };
  }

  const rates = await fetchExchangeRates();
  const rate = rates[currencyCode];

  if (!rate || typeof rate !== 'number') {
    throw new Error(`No exchange rate available for ${currencyCode}`);
  }

  const smallestUnitAmount = Math.round(usdAmount * rate * multiplier);

  return {
    currencyCode,
    smallestUnitAmount,
    exchangeRate: rate,
  };
}

export function parseUsdPrice(priceString: string): number {
  const numeric = priceString.replace(/[^0-9.]/g, '');
  return parseFloat(numeric) || 0;
}
