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

    const email = user?.email ?? formEmail;
    if (!email) {
      return NextResponse.redirect(new URL('/pricing?signin=required', getAppOrigin(request)), 303);
    }

    let resolvedProfile = profile;

    if (!resolvedProfile && user) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, email: user.email, user_tier: 'free' },
          { onConflict: 'id' }
        )
        .select('id, email, user_tier, payment_provider, subscription_status, subscription_plan_code, billing_country, shipping_country, last_checkout_country, last_checkout_method')
        .maybeSingle();

      if (createError || !newProfile) {
        const reason = createError?.message || 'profile creation returned no row';
        console.error('[paystack:init] failed to create profile', createError);
        return NextResponse.redirect(
          new URL(`/pricing?error=profile_creation&details=${encodeURIComponent(reason)}`, getAppOrigin(request)),
          303
        );
      }

      resolvedProfile = newProfile;
    }

    if (!resolvedProfile) {
      if (formEmail) {
        const adminSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjjocfnqwtccuxbnoult.supabase.co';
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const authHeader = { Authorization: `Bearer ${serviceRole}`, 'apikey': serviceRole, 'Content-Type': 'application/json' };

        let authUserId: string | null = null;

        const existingResp = await fetch(`${adminSupabaseUrl}/auth/v1/admin/users?filter=email:eq:${encodeURIComponent(formEmail)}`, { headers: authHeader });
        const existingBody = await existingResp.json().catch(() => null);
        const existingUser = existingBody?.users?.[0] ?? null;
        if (existingUser?.id) {
          authUserId = existingUser.id;
        } else {
          const createResp = await fetch(`${adminSupabaseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ email: formEmail, email_confirm: true, user_metadata: { source: 'desktop_app' } }),
          });
          const createBody = await createResp.json().catch(() => null);
          if (createResp.ok && createBody?.id) {
            authUserId = createBody.id;
          } else {
            const msg = createBody?.msg || `HTTP ${createResp.status}`;
            console.error('[paystack:init] failed to create auth user', createResp.status, createBody);
            return NextResponse.redirect(new URL(`/pricing?error=auth_user&details=${encodeURIComponent(msg)}`, getAppOrigin(request)), 303);
          }
        }

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .upsert({ id: authUserId, email: formEmail, user_tier: 'free' }, { onConflict: 'id' })
          .select('id, email, user_tier, payment_provider, subscription_status, subscription_plan_code, billing_country, shipping_country, last_checkout_country, last_checkout_method')
          .maybeSingle();

        if (createError || !newProfile) {
          const reason = createError?.message || 'profile creation returned no row';
          console.error('[paystack:init] failed to create desktop profile', createError);
          return NextResponse.redirect(new URL(`/pricing?error=profile_creation&details=${encodeURIComponent(reason)}`, getAppOrigin(request)), 303);
        }

        resolvedProfile = newProfile;
      } else {
        return NextResponse.redirect(new URL('/pricing?signin=required', getAppOrigin(request)), 303);
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
    const channels = getPaystackChannelsForCountry(detectedCountry, rules);
    const reference = `bento_${plan.key}_${period}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
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
          id: resolvedProfile.id,
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
      },
    };

    const planCodeFromEnv = body.plan;
    if (!planCodeFromEnv) {
      return NextResponse.redirect(
        new URL('/pricing?error=missing_paystack_plan', getAppOrigin(request)),
        303
      );
    }

    const priceString = plan.price[period].replace(/[^0-9]/g, '');
    const amountInCents = plan.key === 'pro' ? 1 : parseInt(priceString, 10) * 100;

    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        amount: String(amountInCents),
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
      const reason = payload?.message || `HTTP ${response.status}`;
      console.error('[paystack:init] initialize failed', response.status, payload);
      return NextResponse.redirect(
        new URL(`/pricing?error=paystack&details=${encodeURIComponent(reason)}`, getAppOrigin(request)),
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
    const message = error instanceof Error ? error.message : String(error);
    console.error('[paystack:init] unexpected error', error);
    return NextResponse.redirect(
      new URL(`/pricing?error=server&details=${encodeURIComponent(message)}`, getAppOrigin(request)),
      303
    );
  }
}
