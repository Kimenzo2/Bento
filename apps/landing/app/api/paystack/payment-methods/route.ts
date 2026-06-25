import { NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '../../../../lib/supabase/server';
import {
  detectCheckoutCountry,
  getCountryFromHeaders,
  normalizeCountryCode,
} from '../../../../lib/paystack/country';
import {
  getPaystackChannelsForCountry,
  getPaystackMethodsForCountry,
  loadPaystackMethodRules,
  selectPreferredPaystackMethod,
} from '../../../../lib/paystack/payment-methods';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminSupabase = createAdminClient();
  const user = await getAuthenticatedUser();
  const requestHeaders = new Headers(request.headers);
  const headerCountry = getCountryFromHeaders(requestHeaders);
  const manualCountry = normalizeCountryCode(url.searchParams.get('country'));
  const preferredMethod = url.searchParams.get('method');
  const email = url.searchParams.get('email')?.trim().toLowerCase() ?? null;

  let profileCountry: string | null = null;
  let billingCountry: string | null = null;
  let shippingCountry: string | null = null;

  if (user?.id) {
    const { data } = await adminSupabase
      .from('profiles')
      .select('billing_country, shipping_country, last_checkout_country')
      .eq('id', user.id)
      .maybeSingle();
    profileCountry = data?.last_checkout_country ?? null;
    billingCountry = data?.billing_country ?? null;
    shippingCountry = data?.shipping_country ?? null;
  } else if (email) {
    const { data } = await adminSupabase
      .from('profiles')
      .select('billing_country, shipping_country, last_checkout_country')
      .eq('email', email)
      .maybeSingle();
    profileCountry = data?.last_checkout_country ?? null;
    billingCountry = data?.billing_country ?? null;
    shippingCountry = data?.shipping_country ?? null;
  }

  const countryCode = detectCheckoutCountry({
    manualCountry,
    profileCountry,
    billingCountry,
    shippingCountry,
    headerCountry,
  });

  const rules = await loadPaystackMethodRules(adminSupabase);
  const availableMethods = getPaystackMethodsForCountry(countryCode, rules);
  const selection = selectPreferredPaystackMethod(countryCode, rules, preferredMethod);

  return NextResponse.json({
    countryCode,
    channels: getPaystackChannelsForCountry(countryCode, rules),
    methods: availableMethods,
    selectedMethodKey: selection.selectedMethodKey,
    selectedChannel: selection.selectedChannel,
    fallbackToCard: availableMethods.some((method) => method.methodKey === 'card'),
  });
}
