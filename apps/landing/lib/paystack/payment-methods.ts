import { normalizeCountryCode } from './country';

export const PAYSTACK_METHOD_KEYS = [
  'card',
  'bank',
  'bank_transfer',
  'ussd',
  'mobile_money',
  'qr',
  'apple_pay',
  'dedicated_bank_account',
  'direct_debit',
  'paypal',
  'preauth',
  'capitec_pay',
  'pos',
  'eft',
  'payattitude',
] as const;

export type PaystackMethodKey = (typeof PAYSTACK_METHOD_KEYS)[number];

export type PaystackMethodRule = {
  methodKey: PaystackMethodKey;
  countryCode: string;
  channel: string;
  enabled: boolean;
  checkoutVisible: boolean;
  fallbackToCard: boolean;
  sortOrder: number;
  notes: string | null;
};

export type PaystackMethodView = PaystackMethodRule & {
  label: string;
};

const DEFAULT_METHOD_RULES: PaystackMethodRule[] = [
  {
    methodKey: 'card',
    countryCode: '*',
    channel: 'card',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: true,
    sortOrder: 0,
    notes: 'Cards are globally available and act as the fallback method.',
  },
  {
    methodKey: 'apple_pay',
    countryCode: '*',
    channel: 'apple_pay',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: true,
    sortOrder: 5,
    notes: 'Apple Pay is available globally on supported Apple devices via Paystack hosted checkout.',
  },
  {
    methodKey: 'bank',
    countryCode: 'NG',
    channel: 'bank',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 10,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'bank_transfer',
    countryCode: 'NG',
    channel: 'bank_transfer',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 20,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'ussd',
    countryCode: 'NG',
    channel: 'ussd',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 30,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'dedicated_bank_account',
    countryCode: 'NG',
    channel: 'dedicated_bank_account',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 40,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'preauth',
    countryCode: 'NG',
    channel: 'preauth',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 50,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'payattitude',
    countryCode: 'NG',
    channel: 'payattitude',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 60,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'pos',
    countryCode: 'NG',
    channel: 'pos',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 70,
    notes: 'Nigeria only.',
  },
  {
    methodKey: 'mobile_money',
    countryCode: 'GH',
    channel: 'mobile_money',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 80,
    notes: 'Conservative default for supported mobile money markets.',
  },
  {
    methodKey: 'mobile_money',
    countryCode: 'CI',
    channel: 'mobile_money',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 90,
    notes: 'Conservative default for supported mobile money markets.',
  },
  {
    methodKey: 'mobile_money',
    countryCode: 'KE',
    channel: 'mobile_money',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 100,
    notes: 'Kenya mobile money (M-Pesa, Airtel Money) via Paystack hosted checkout.',
  },
  {
    methodKey: 'qr',
    countryCode: 'ZA',
    channel: 'qr',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 110,
    notes: 'South Africa only.',
  },
  {
    methodKey: 'capitec_pay',
    countryCode: 'ZA',
    channel: 'capitec_pay',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 120,
    notes: 'South Africa only.',
  },
  {
    methodKey: 'eft',
    countryCode: 'ZA',
    channel: 'eft',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 130,
    notes: 'South Africa only.',
  },
  {
    methodKey: 'direct_debit',
    countryCode: 'ZA',
    channel: 'direct_debit',
    enabled: true,
    checkoutVisible: true,
    fallbackToCard: false,
    sortOrder: 140,
    notes: 'South Africa only.',
  },
];

const METHOD_LABELS: Record<PaystackMethodKey, string> = {
  card: 'Card',
  bank: 'Bank account',
  bank_transfer: 'Bank transfer',
  ussd: 'USSD',
  mobile_money: 'Mobile money',
  qr: 'QR',
  apple_pay: 'Apple Pay',
  dedicated_bank_account: 'Dedicated bank account',
  direct_debit: 'Direct debit',
  paypal: 'PayPal',
  preauth: 'Preauth',
  capitec_pay: 'Capitec Pay',
  pos: 'POS',
  eft: 'EFT',
  payattitude: 'Payattitude',
};

function normalizeRule(rule: Partial<PaystackMethodRule> & { methodKey: string; countryCode: string }): PaystackMethodRule | null {
  const normalizedMethod = rule.methodKey.trim().toLowerCase();
  if (!PAYSTACK_METHOD_KEYS.includes(normalizedMethod as PaystackMethodKey)) return null;

  return {
    methodKey: normalizedMethod as PaystackMethodKey,
    countryCode: normalizeCountryCode(rule.countryCode) ?? '*',
    channel: (rule.channel ?? normalizedMethod).trim().toLowerCase(),
    enabled: rule.enabled ?? true,
    checkoutVisible: rule.checkoutVisible ?? true,
    fallbackToCard: rule.fallbackToCard ?? false,
    sortOrder: Number.isFinite(rule.sortOrder ?? Number.NaN) ? Number(rule.sortOrder) : 0,
    notes: rule.notes ?? null,
  };
}

export function getDefaultPaystackMethodRules() {
  return DEFAULT_METHOD_RULES.slice();
}

export function getPaystackMethodLabel(methodKey: PaystackMethodKey) {
  return METHOD_LABELS[methodKey];
}

export function toPaystackMethodViews(rules: PaystackMethodRule[]) {
  return rules.map((rule) => ({ ...rule, label: getPaystackMethodLabel(rule.methodKey) }));
}

export async function loadPaystackMethodRules(supabase: any): Promise<PaystackMethodRule[]> {
  const { data, error } = await supabase
    .from('paystack_payment_method_rules')
    .select('method_key, country_code, channel, enabled, checkout_visible, fallback_to_card, sort_order, notes')
    .order('sort_order', { ascending: true })
    .order('country_code', { ascending: true });

  if (error) {
    console.warn('[paystack:methods] falling back to in-code defaults', error.message);
    return getDefaultPaystackMethodRules();
  }

  const normalized = (data ?? [])
    .map((row: any): PaystackMethodRule | null =>
      normalizeRule({
        methodKey: row.method_key,
        countryCode: row.country_code,
        channel: row.channel,
        enabled: row.enabled,
        checkoutVisible: row.checkout_visible,
        fallbackToCard: row.fallback_to_card,
        sortOrder: row.sort_order,
        notes: row.notes,
      })
    )
    .filter((row: PaystackMethodRule | null): row is PaystackMethodRule => Boolean(row));

  return normalized.length > 0 ? normalized : getDefaultPaystackMethodRules();
}

export function getPaystackMethodsForCountry(
  countryCode: string | null,
  rules: PaystackMethodRule[]
): PaystackMethodRule[] {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const globalRules = rules.filter((rule) => rule.countryCode === '*');
  const scopedRules = normalizedCountry
    ? rules.filter((rule) => rule.countryCode === normalizedCountry)
    : [];

  const merged = new Map<PaystackMethodKey, PaystackMethodRule>();
  for (const rule of [...scopedRules, ...globalRules]) {
    if (!rule.enabled || !rule.checkoutVisible) continue;
    if (!merged.has(rule.methodKey)) merged.set(rule.methodKey, rule);
  }

  if (!merged.has('card')) {
    merged.set('card', DEFAULT_METHOD_RULES[0]);
  }

  return [...merged.values()].sort((left, right) => {
    if (left.sortOrder === right.sortOrder) return left.methodKey.localeCompare(right.methodKey);
    return left.sortOrder - right.sortOrder;
  });
}

export function getPaystackChannelsForCountry(countryCode: string | null, rules: PaystackMethodRule[]): string[] {
  return getPaystackMethodsForCountry(countryCode, rules).map((rule) => rule.channel);
}

export function selectPreferredPaystackMethod(
  countryCode: string | null,
  rules: PaystackMethodRule[],
  preferredMethodKey?: string | null
): {
  selectedMethodKey: PaystackMethodKey;
  selectedChannel: string;
  methods: PaystackMethodRule[];
  channels: string[];
} {
  const available = getPaystackMethodsForCountry(countryCode, rules);
  const preferred = preferredMethodKey?.trim().toLowerCase();
  const selected =
    available.find((rule) => rule.methodKey === preferred) ??
    available.find((rule) => rule.methodKey === 'card') ??
    available[0] ??
    DEFAULT_METHOD_RULES[0];

  return {
    selectedMethodKey: selected.methodKey,
    selectedChannel: selected.channel,
    methods: available,
    channels: available.map((rule) => rule.channel),
  };
}
