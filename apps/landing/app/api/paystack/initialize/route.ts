import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '../../../../lib/supabase/server';
import { findPlanByCode, getBillingPeriod, planCodeFor } from '../../../../lib/billing';
import { detectCheckoutCountry } from '../../../../lib/paystack/country';
import {
  buildCheckoutIntentRecord,
  persistCheckoutIntent,
} from '../../../../lib/paystack/checkout-intents';
import {
  getPaystackChannelsForCountry,
  loadPaystackMethodRules,
  selectPreferredPaystackMethod,
} from '../../../../lib/paystack/payment-methods';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }
  return key;
}

function getAppOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

async function readPlanRequest(request: Request) {
  const formData = await request.formData();
  const planCode = String(formData.get('planCode') ?? '')
    .trim()
    .toLowerCase();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const period = getBillingPeriod(
    String(formData.get('billingPeriod') ?? '')
      .trim()
      .toLowerCase()
  );
  const country = String(formData.get('country') ?? '').trim().toUpperCase();
  const method = String(formData.get('method') ?? '').trim().toLowerCase();
  const billingCountry = String(formData.get('billingCountry') ?? '').trim().toUpperCase();
  const shippingCountry = String(formData.get('shippingCountry') ?? '').trim().toUpperCase();
  const source = String(formData.get('source') ?? 'web').trim().toLowerCase();
  return { planCode, period, email, country, method, billingCountry, shippingCountry, source };
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    const {
      planCode,
      period,
      email: formEmail,
      country: manualCountry,
      method: preferredMethod,
      billingCountry,
      shippingCountry,
      source,
    } = await readPlanRequest(request);
    const plan = findPlanByCode(planCode);

    if (!plan) {
      return NextResponse.redirect(
        new URL('/pricing?error=unknown_plan', getAppOrigin(request)),
        303
      );
    }

    const selectedPlanCode =
      planCode === plan.planCodes.yearly || planCode === plan.planCodes.monthly
        ? planCodeFor(plan.key, period)
        : plan.planCodes[period];

    const supabase = createAdminClient();
    let profileQuery = supabase
      .from('profiles')
      .select(
        'id, email, user_tier, payment_provider, subscription_status, subscription_plan_code, billing_country, shipping_country, last_checkout_country, last_checkout_method'
      );

    if (user?.email) {
      profileQuery = profileQuery.eq('id', user.id);
    } else if (formEmail) {
      profileQuery = profileQuery.eq('email', formEmail);
    } else {
      return NextResponse.redirect(new URL('/pricing?signin=required', getAppOrigin(request)), 303);
    }

    const {
      data: profile,
      error: profileError,
    } = await profileQuery.maybeSingle<{
      id: string;
      email: string | null;
      user_tier: string | null;
      payment_provider: string | null;
      subscription_status: string | null;
      subscription_plan_code: string | null;
      billing_country: string | null;
      shipping_country: string | null;
      last_checkout_country: string | null;
      last_checkout_method: string | null;
    }>();

    if (profileError) {
      console.error('[paystack:init] profile lookup failed', profileError);
    }

    if (!profile) {
      return NextResponse.redirect(
        new URL('/pricing?error=profile_missing', getAppOrigin(request)),
        303
      );
    }

    const email = user?.email ?? profile.email ?? formEmail;
    if (!email) {
      return NextResponse.redirect(new URL('/pricing?signin=required', getAppOrigin(request)), 303);
    }

    const rules = await loadPaystackMethodRules(supabase);
    const detectedCountry = detectCheckoutCountry({
      manualCountry,
      profileCountry: profile.last_checkout_country ?? null,
      billingCountry: billingCountry || profile.billing_country || null,
      shippingCountry: shippingCountry || profile.shipping_country || null,
    });
    const selection = selectPreferredPaystackMethod(detectedCountry, rules, preferredMethod);
    const channels = getPaystackChannelsForCountry(detectedCountry, rules);
    const reference = `bento_${plan.key}_${period}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const checkoutIntent = buildCheckoutIntentRecord({
      reference,
      profileId: profile.id,
      email,
      countryCode: detectedCountry ?? 'GLOBAL',
      billingCountry: billingCountry || profile.billing_country || null,
      shippingCountry: shippingCountry || profile.shipping_country || null,
      selectedMethodKey: selection.selectedMethodKey,
      selectedChannels: channels,
      planCode: selectedPlanCode,
      billingPeriod: period,
      source: source === 'desktop' || source === 'manual' ? source : 'web',
      payload: {
        plan_key: plan.key,
        billing_period: period,
        subscription_plan_code: selectedPlanCode,
        country: detectedCountry,
        selected_method: selection.selectedMethodKey,
        selected_channels: channels,
        checkout_intent_at: new Date().toISOString(),
      },
    });

    await persistCheckoutIntent(supabase, checkoutIntent);
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: profile.id,
          billing_country: billingCountry || profile.billing_country || detectedCountry,
          shipping_country: shippingCountry || profile.shipping_country || null,
          last_checkout_country: detectedCountry,
          last_checkout_method: selection.selectedMethodKey,
          last_checkout_intent_at: new Date().toISOString(),
          last_checkout_reference: reference,
        },
        { onConflict: 'id' }
      );
    if (profileUpdateError) {
      console.warn('[paystack:init] failed to persist checkout profile fields', profileUpdateError);
    }

    const body = {
      email,
      reference,
      channels,
      plan:
        process.env[`PAYSTACK_PLAN_${plan.key.toUpperCase()}_${period.toUpperCase()}`] ?? undefined,
      callback_url: new URL('/pricing/success', getAppOrigin(request)).toString(),
      metadata: {
        checkout_source: 'bento-pricing-page',
        checkout_reference: reference,
        user_id: user?.id ?? profile.id,
        profile_id: profile.id,
        customer_email: email,
        plan_key: plan.key,
        billing_period: period,
        subscription_plan_code: selectedPlanCode,
        billing_country: billingCountry || profile.billing_country || null,
        shipping_country: shippingCountry || profile.shipping_country || null,
        country: detectedCountry,
        selected_method: selection.selectedMethodKey,
        selected_channels: channels,
        checkout_intent_at: checkoutIntent.payload.checkout_intent_at,
        checkout_origin: source,
        app: 'Bento',
      },
    };

    const planCodeFromEnv = body.plan;
    if (!planCodeFromEnv) {
      return NextResponse.redirect(
        new URL('/pricing?error=missing_paystack_plan', getAppOrigin(request)),
        303
      );
    }

    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        plan: planCodeFromEnv,
        reference: body.reference,
        channels: body.channels,
        callback_url: body.callback_url,
        metadata: body.metadata,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string };
    } | null;

    if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
      console.error('[paystack:init] initialize failed', response.status, payload);
      return NextResponse.redirect(
        new URL('/pricing?error=checkout_failed', getAppOrigin(request)),
        303
      );
    }

    await persistCheckoutIntent(supabase, {
      ...checkoutIntent,
      paystackAuthorizationUrl: payload.data.authorization_url,
      payload: {
        ...checkoutIntent.payload,
        paystack_response: payload,
      },
    });

    return NextResponse.redirect(payload.data.authorization_url, 303);
  } catch (error) {
    console.error('[paystack:init] unexpected error', error);
    return NextResponse.redirect(
      new URL('/pricing?error=checkout_failed', getAppOrigin(request)),
      303
    );
  }
}
