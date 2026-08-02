// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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
import { convertUsdToLocal, parseUsdPrice } from '../../../../lib/paystack/currency';
import { INTENT_TTL_MS } from '../../../../lib/paystack/checkout-intents';

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
  const country = String(formData.get('country') ?? '')
    .trim()
    .toUpperCase();
  const method = String(formData.get('method') ?? '')
    .trim()
    .toLowerCase();
  const billingCountry = String(formData.get('billingCountry') ?? '')
    .trim()
    .toUpperCase();
  const shippingCountry = String(formData.get('shippingCountry') ?? '')
    .trim()
    .toUpperCase();
  const source = String(formData.get('source') ?? 'web')
    .trim()
    .toLowerCase();
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

    const { data: profile, error: profileError } = await profileQuery.maybeSingle<{
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

    const email = user?.email ?? formEmail;
    if (!email) {
      return NextResponse.redirect(new URL('/pricing?signin=required', getAppOrigin(request)), 303);
    }

    let resolvedProfile = profile;

    if (!resolvedProfile && user) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email, user_tier: 'free' }, { onConflict: 'id' })
        .select(
          'id, email, user_tier, payment_provider, subscription_status, subscription_plan_code, billing_country, shipping_country, last_checkout_country, last_checkout_method'
        )
        .maybeSingle();

      if (createError || !newProfile) {
        console.error('[paystack:init] failed to create profile', createError);
        return NextResponse.redirect(
          new URL('/pricing?error=profile_creation', getAppOrigin(request)),
          303
        );
      }

      resolvedProfile = newProfile;
    }

    if (!resolvedProfile) {
      if (formEmail) {
        const adminSupabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjjocfnqwtccuxbnoult.supabase.co';
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const authHeader = {
          Authorization: `Bearer ${serviceRole}`,
          apikey: serviceRole,
          'Content-Type': 'application/json',
        };

        let authUserId: string | null = null;

        const existingResp = await fetch(
          `${adminSupabaseUrl}/auth/v1/admin/users?filter=email:eq:${encodeURIComponent(formEmail)}`,
          { headers: authHeader }
        );
        const existingBody = await existingResp.json().catch(() => null);
        const existingUser = existingBody?.users?.[0] ?? null;
        if (existingUser?.id) {
          authUserId = existingUser.id;
        } else {
          const createResp = await fetch(`${adminSupabaseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              email: formEmail,
              email_confirm: true,
              user_metadata: { source: 'desktop_app' },
            }),
          });
          const createBody = await createResp.json().catch(() => null);
          if (createResp.ok && createBody?.id) {
            authUserId = createBody.id;
          } else {
            console.error(
              '[paystack:init] failed to create auth user',
              createResp.status,
              createBody
            );
            return NextResponse.redirect(
              new URL('/pricing?error=auth_user', getAppOrigin(request)),
              303
            );
          }
        }

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .upsert({ id: authUserId, email: formEmail, user_tier: 'free' }, { onConflict: 'id' })
          .select(
            'id, email, user_tier, payment_provider, subscription_status, subscription_plan_code, billing_country, shipping_country, last_checkout_country, last_checkout_method'
          )
          .maybeSingle();

        if (createError || !newProfile) {
          console.error('[paystack:init] failed to create desktop profile', createError);
          return NextResponse.redirect(
            new URL('/pricing?error=profile_creation', getAppOrigin(request)),
            303
          );
        }

        resolvedProfile = newProfile;
      } else {
        return NextResponse.redirect(
          new URL('/pricing?signin=required', getAppOrigin(request)),
          303
        );
      }
    }

    const rules = await loadPaystackMethodRules(supabase);
    const detectedCountry = detectCheckoutCountry({
      manualCountry,
      profileCountry: resolvedProfile.last_checkout_country ?? null,
      billingCountry: billingCountry || resolvedProfile.billing_country || null,
      shippingCountry: shippingCountry || resolvedProfile.shipping_country || null,
    });
    const selection = selectPreferredPaystackMethod(detectedCountry, rules, preferredMethod);
    const channels = getPaystackChannelsForCountry(detectedCountry, rules).filter(
      (ch) => ch !== 'apple_pay'
    );
    const reference = `bento_${plan.key}_${period}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const usdPriceString = plan.price[period];
    const usdPriceFloat = parseUsdPrice(usdPriceString);

    let conversion;
    try {
      conversion = await convertUsdToLocal(usdPriceFloat, detectedCountry);
    } catch (convError) {
      const message = convError instanceof Error ? convError.message : 'Unknown conversion error';
      console.error('[paystack:init] currency conversion failed', message, convError);
      return NextResponse.redirect(
        new URL(
          `/pricing?error=server&details=${encodeURIComponent(message)}`,
          getAppOrigin(request)
        ),
        303
      );
    }

    const checkoutIntent = buildCheckoutIntentRecord({
      reference,
      profileId: resolvedProfile.id,
      email,
      countryCode: detectedCountry ?? 'GLOBAL',
      billingCountry: billingCountry || resolvedProfile.billing_country || null,
      shippingCountry: shippingCountry || resolvedProfile.shipping_country || null,
      selectedMethodKey: selection.selectedMethodKey,
      selectedChannels: channels,
      planCode: selectedPlanCode,
      billingPeriod: period,
      source: source === 'desktop' || source === 'manual' ? source : 'web',
      expectedCurrency: conversion.currencyCode,
      expectedAmountSmallestUnit: conversion.smallestUnitAmount,
      payload: {
        plan_key: plan.key,
        billing_period: period,
        subscription_plan_code: selectedPlanCode,
        country: detectedCountry,
        selected_method: selection.selectedMethodKey,
        selected_channels: channels,
        checkout_intent_at: new Date().toISOString(),
        expected_currency: conversion.currencyCode,
        expected_amount_smallest_unit: conversion.smallestUnitAmount,
        usd_price_float: usdPriceFloat,
      },
    });

    await persistCheckoutIntent(supabase, checkoutIntent);

    const now = new Date();
    const ttlCutoff = new Date(now.getTime() - INTENT_TTL_MS);

    await supabase
      .from('paystack_checkout_intents')
      .update({ payment_status: 'failed' })
      .eq('profile_id', resolvedProfile.id)
      .eq('payment_status', 'pending')
      .lt('created_at', ttlCutoff.toISOString());

    const { data: existingIntent } = await supabase
      .from('paystack_checkout_intents')
      .select('paystack_authorization_url')
      .eq('profile_id', resolvedProfile.id)
      .eq('plan_code', selectedPlanCode)
      .eq('billing_period', period)
      .eq('payment_status', 'pending')
      .neq('reference', reference)
      .not('paystack_authorization_url', 'is', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle();

    if (existingIntent?.paystack_authorization_url) {
      return NextResponse.redirect(existingIntent.paystack_authorization_url, 303);
    }

    const { error: profileUpdateError } = await supabase.from('profiles').upsert(
      {
        id: resolvedProfile.id,
        email,
        billing_country: billingCountry || resolvedProfile.billing_country || detectedCountry,
        shipping_country: shippingCountry || resolvedProfile.shipping_country || null,
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
        user_id: user?.id ?? resolvedProfile.id,
        profile_id: resolvedProfile.id,
        customer_email: email,
        plan_key: plan.key,
        billing_period: period,
        subscription_plan_code: selectedPlanCode,
        billing_country: billingCountry || resolvedProfile.billing_country || null,
        shipping_country: shippingCountry || resolvedProfile.shipping_country || null,
        country: detectedCountry,
        selected_method: selection.selectedMethodKey,
        selected_channels: channels,
        checkout_intent_at: checkoutIntent.payload.checkout_intent_at,
        checkout_origin: source,
        app: 'Bento',
        expected_currency: conversion.currencyCode,
        expected_amount_smallest_unit: conversion.smallestUnitAmount,
      },
    };

    const planCodeFromEnv = body.plan;

    const paystackPayload: Record<string, unknown> = {
      email: body.email,
      amount: String(conversion.smallestUnitAmount),
      currency: conversion.currencyCode,
      reference: body.reference,
      channels: body.channels,
      callback_url: body.callback_url,
      metadata: body.metadata,
    };

    const isTestKey = getPaystackSecretKey().startsWith('sk_test_');
    if (planCodeFromEnv && !isTestKey) {
      paystackPayload.plan = planCodeFromEnv;
    }

    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const payload = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string };
    } | null;

    if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
      console.error('[paystack:init] initialize failed', response.status, payload);
      return NextResponse.redirect(new URL(`/pricing?error=paystack`, getAppOrigin(request)), 303);
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
    const message = error instanceof Error ? error.message : String(error);
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(error);
    console.error('[paystack:init] unexpected error', {
      message,
      type: typeof error,
      isError: error instanceof Error,
      error,
    });
    return NextResponse.redirect(
      new URL(`/pricing?error=server&details=${encodeURIComponent(detail)}`, getAppOrigin(request)),
      303
    );
  }
}
