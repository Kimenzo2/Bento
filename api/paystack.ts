/**
 * Unified Paystack API Handler
 *
 * Routes by ?action= query param:
 *   POST ?action=charge   → initiate mobile-money / bank-transfer charge
 *   GET  ?action=verify   → verify a transaction by reference
 *   POST ?action=webhook  → Paystack webhook (HMAC-verified, raw body)
 *
 * Vercel rewrites map legacy URLs to this handler:
 *   /api/paystack-charge  → /api/paystack?action=charge
 *   /api/paystack-verify  → /api/paystack?action=verify
 *   /api/paystack-webhook → /api/paystack?action=webhook
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, createPublicHandler, type ApiContext } from './_middleware';

// ---------------------------------------------------------------------------
// Disable Vercel body-parsing globally — we read rawBody ourselves.
// This is REQUIRED for accurate HMAC verification on webhook events.
// ---------------------------------------------------------------------------
export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------------------------------------------------------------------------
// Supabase (service role — webhook handler needs admin access)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  if (action === 'webhook') {
    return handleWebhook(req, res);
  }

  if (action === 'charge') {
    return createAuthenticatedHandler(handleCharge, { protection: 'api', cors: true })(req, res);
  }

  if (action === 'verify') {
    return createPublicHandler(handleVerify, { cors: true })(req, res);
  }

  return res.status(400).json({ status: false, message: 'Unknown action' });
}

// ---------------------------------------------------------------------------
// CHARGE  (POST /api/paystack?action=charge)
// ---------------------------------------------------------------------------
async function handleCharge(ctx: ApiContext) {
  const { req, res, log } = ctx;

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  if (!PAYSTACK_SECRET_KEY) {
    log.error('PAYSTACK_SECRET_KEY not configured');
    return res.status(500).json({ status: false, message: 'Payment service not configured' });
  }

  const rawBody = await getRawBody(req);
  let chargeData: any;
  try {
    chargeData = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ status: false, message: 'Invalid JSON body' });
  }

  if (!chargeData.email || !chargeData.amount) {
    return res.status(400).json({ status: false, message: 'Email and amount are required' });
  }

  const hasPaymentMethod =
    chargeData.mobile_money ||
    chargeData.bank_transfer ||
    chargeData.ussd ||
    chargeData.qr ||
    chargeData.eft;

  if (!hasPaymentMethod) {
    return res.status(400).json({ status: false, message: 'A payment method must be specified' });
  }

  try {
    const response = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargeData),
    });

    const data = await response.json();

    if (process.env.NODE_ENV !== 'production') {
      log.info('Paystack Charge Response', {
        status: data.status,
        message: data.message,
        dataStatus: data.data?.status,
        reference: data.data?.reference,
      });
    }

    return res.status(response.ok ? 200 : 400).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    log.error('Paystack Charge API Error', error instanceof Error ? error : undefined);
    return res.status(500).json({ status: false, message });
  }
}

// ---------------------------------------------------------------------------
// VERIFY  (GET /api/paystack?action=verify&reference=xxx)
// ---------------------------------------------------------------------------
async function handleVerify(ctx: ApiContext) {
  const { req, res, log } = ctx;

  if (req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  if (!PAYSTACK_SECRET_KEY) {
    log.error('PAYSTACK_SECRET_KEY not configured');
    return res.status(500).json({ status: false, message: 'Payment service not configured' });
  }

  const { reference } = req.query;
  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ status: false, message: 'Transaction reference is required' });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (process.env.NODE_ENV !== 'production') {
      log.info('Paystack Verify Response', {
        status: data.status,
        dataStatus: data.data?.status,
        reference: data.data?.reference,
        amount: data.data?.amount,
        channel: data.data?.channel,
      });
    }

    return res.status(response.ok ? 200 : 400).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    log.error('Paystack Verify API Error', error instanceof Error ? error : undefined);
    return res.status(500).json({ status: false, message });
  }
}

// ---------------------------------------------------------------------------
// WEBHOOK  (POST /api/paystack?action=webhook)
// ---------------------------------------------------------------------------
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] PAYSTACK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let rawBody: string;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[webhook] Failed to read request body:', err);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!rawBody) {
    return res.status(400).json({ error: 'Empty body' });
  }

  const hash = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
  const signature = req.headers['x-paystack-signature'];

  if (hash !== signature) {
    console.warn('[webhook] Invalid HMAC signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventId = event.data?.id || 'unknown';
  console.log(`[webhook] ✅ Verified event: ${event.event} (id: ${eventId})`);

  try {
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;
      case 'subscription.create':
        await handleSubscriptionCreate(event.data);
        break;
      case 'subscription.disable':
      case 'subscription.not_renew':
        await handleSubscriptionDisable(event.data);
        break;
      case 'subscription.enable':
        await handleSubscriptionEnable(event.data);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data);
        break;
      case 'refund.processed':
        await handleRefundProcessed(event.data);
        break;
      default:
        console.log(`[webhook] Unhandled event type: ${event.event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(
      `[webhook] Processing error for ${event.event}:`,
      error instanceof Error ? error.message : error
    );
    // Return 200 to acknowledge receipt — prevents Paystack from retrying duplicates
    return res.status(200).json({ received: true, processing_error: true });
  }
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------
async function isDuplicate(reference: string | undefined, eventType: string): Promise<boolean> {
  if (!reference) return false;
  const { data } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('paystack_reference', reference)
    .eq('event_type', eventType)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// Event handlers (unchanged logic from paystack-webhook.ts)
// ---------------------------------------------------------------------------
async function handleChargeSuccess(data: any) {
  let userId: string | undefined = data.metadata?.user_id;
  let planCode: string | undefined = data.metadata?.plan_code;
  const reference = data.reference;
  const customerCode = data.customer?.customer_code;

  if (!userId || !planCode) {
    if (customerCode) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, subscription_plan_code')
        .eq('paystack_customer_code', customerCode)
        .single();
      if (!error && profile) {
        userId = profile.id;
        planCode = planCode || profile.subscription_plan_code || data.plan?.plan_code;
      }
    }
    if (!userId && data.customer?.email) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, subscription_plan_code')
        .eq('email', data.customer.email)
        .single();
      if (!error && profile) {
        userId = profile.id;
        planCode = planCode || profile.subscription_plan_code || data.plan?.plan_code;
      }
    }
    if (!userId) {
      console.warn('[webhook:charge.success] Cannot resolve user');
      return;
    }
    planCode = planCode || data.plan?.plan_code;
    if (!planCode) {
      console.warn(`[webhook:charge.success] No plan_code for user ${userId}`);
      return;
    }
  }

  if (await isDuplicate(reference, 'charge_success')) return;

  const { error: rpcError } = await supabase.rpc('update_user_tier_from_plan', {
    p_user_id: userId,
    p_plan_code: planCode,
  });
  if (rpcError) throw rpcError;

  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_plan_code: planCode,
      paystack_customer_code: data.customer?.customer_code,
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: nextBillingDate.toISOString(),
      cancel_at_period_end: false,
    })
    .eq('id', userId);
  if (updateError) throw updateError;

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'charge_success',
    paystack_reference: reference,
    plan_code: planCode,
    amount: data.amount,
    status: 'success',
    metadata: {
      channel: data.channel,
      currency: data.currency,
      ip_address: data.ip_address,
      customer_code: data.customer?.customer_code,
      paid_at: data.paid_at,
    },
  });
  console.log(`[webhook:charge.success] User ${userId} upgraded to plan ${planCode}`);
}

async function handleSubscriptionCreate(data: any) {
  const customerCode = data.customer?.customer_code;
  const subscriptionCode = data.subscription_code;
  if (!customerCode) return;
  if (await isDuplicate(subscriptionCode, 'subscription_create')) return;

  let profile: any = null;
  if (customerCode) {
    const { data: found } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_customer_code', customerCode)
      .single();
    profile = found;
  }
  if (!profile && data.customer?.email) {
    const { data: found } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', data.customer.email)
      .single();
    profile = found;
  }
  if (!profile) return;

  const planCode = data.plan?.plan_code;
  if (planCode) {
    const { error } = await supabase.rpc('update_user_tier_from_plan', {
      p_user_id: profile.id,
      p_plan_code: planCode,
    });
    if (error) throw error;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      paystack_subscription_code: subscriptionCode,
      paystack_customer_code: customerCode,
      subscription_plan_code: planCode || null,
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: data.next_payment_date,
      subscription_status: 'active',
      cancel_at_period_end: false,
    })
    .eq('id', profile.id);
  if (updateError) throw updateError;

  await supabase.from('subscription_events').insert({
    user_id: profile.id,
    event_type: 'subscription_create',
    paystack_reference: subscriptionCode,
    plan_code: planCode,
    status: 'success',
    metadata: {
      plan_name: data.plan?.name,
      plan_interval: data.plan?.interval,
      next_payment_date: data.next_payment_date,
      customer_code: customerCode,
    },
  });
}

async function handleSubscriptionDisable(data: any) {
  const subscriptionCode = data.subscription_code;
  if (!subscriptionCode) return;
  if (await isDuplicate(subscriptionCode, 'subscription_disable')) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('paystack_subscription_code', subscriptionCode)
    .single();
  if (error || !profile) return;

  const { error: rpcError } = await supabase.rpc('downgrade_to_spark', { p_user_id: profile.id });
  if (rpcError) throw rpcError;

  await supabase.from('subscription_events').insert({
    user_id: profile.id,
    event_type: 'subscription_disable',
    paystack_reference: subscriptionCode,
    status: 'success',
    metadata: { reason: data.status, disabled_at: new Date().toISOString() },
  });
}

async function handleSubscriptionEnable(data: any) {
  const subscriptionCode = data.subscription_code;
  const customerCode = data.customer?.customer_code;
  if (!subscriptionCode || !customerCode) return;
  if (await isDuplicate(subscriptionCode, 'subscription_enable')) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('paystack_customer_code', customerCode)
    .single();
  if (error || !profile) return;

  const planCode = data.plan?.plan_code;
  if (planCode) {
    await supabase.rpc('update_user_tier_from_plan', { p_user_id: profile.id, p_plan_code: planCode });
  }

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      paystack_subscription_code: subscriptionCode,
      subscription_end_date: data.next_payment_date,
      cancel_at_period_end: false,
    })
    .eq('id', profile.id);

  await supabase.from('subscription_events').insert({
    user_id: profile.id,
    event_type: 'subscription_enable',
    paystack_reference: subscriptionCode,
    plan_code: planCode,
    status: 'success',
    metadata: {
      plan_name: data.plan?.name,
      next_payment_date: data.next_payment_date,
      reactivated_at: new Date().toISOString(),
    },
  });
}

async function handlePaymentFailed(data: any) {
  const customerCode = data.customer?.customer_code;
  if (!customerCode) return;
  const reference = data.reference || `pf_${customerCode}_${Date.now()}`;
  if (data.reference && (await isDuplicate(data.reference, 'payment_failed'))) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('paystack_customer_code', customerCode)
    .single();
  if (error || !profile) return;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ subscription_status: 'payment_failed' })
    .eq('id', profile.id);
  if (updateError) throw updateError;

  await supabase.from('subscription_events').insert({
    user_id: profile.id,
    event_type: 'payment_failed',
    paystack_reference: reference,
    status: 'failed',
    metadata: {
      amount: data.amount,
      currency: data.currency,
      failure_reason: data.gateway_response || 'Unknown',
      failed_at: new Date().toISOString(),
    },
  });
}

async function handleRefundProcessed(data: any) {
  const reference = data.transaction?.reference;
  const customerCode = data.customer?.customer_code;
  if (!reference || !customerCode) return;
  if (await isDuplicate(`refund_${reference}`, 'refund_processed')) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('paystack_customer_code', customerCode)
    .single();
  if (!profile) return;

  await supabase.rpc('downgrade_to_spark', { p_user_id: profile.id });

  await supabase.from('subscription_events').insert({
    user_id: profile.id,
    event_type: 'refund_processed',
    paystack_reference: `refund_${reference}`,
    amount: data.amount ? -data.amount : null,
    status: 'success',
    metadata: {
      original_reference: reference,
      refund_amount: data.amount,
      currency: data.currency,
      refunded_at: new Date().toISOString(),
    },
  });
}
