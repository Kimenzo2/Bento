import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for admin access
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Paystack webhook source IPs (whitelist)
// See: https://paystack.com/docs/payments/webhooks/#ip-whitelisting
const PAYSTACK_WEBHOOK_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220',
];

/**
 * Enterprise-grade Paystack Webhook Handler
 *
 * Security measures:
 * 1. HMAC SHA-512 signature verification
 * 2. IP allowlist for known Paystack IPs
 * 3. Idempotency via unique paystack_reference in subscription_events
 * 4. Structured error logging
 * 5. Graceful error handling per event type
 */
export default async function handler(req: any, res: any) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // === IP Allowlist Check ===
  const forwarded = req.headers['x-forwarded-for'];
  const sourceIp = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim()
    : req.socket?.remoteAddress || req.connection?.remoteAddress;

  // Only enforce IP check in production (Vercel sets NODE_ENV)
  if (process.env.NODE_ENV === 'production' && sourceIp && !PAYSTACK_WEBHOOK_IPS.includes(sourceIp)) {
    console.warn(`[webhook] Rejected request from untrusted IP: ${sourceIp}`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // === HMAC Signature Verification ===
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] PAYSTACK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const hash = crypto
    .createHmac('sha512', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.warn('[webhook] Invalid HMAC signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventId = event.data?.id || 'unknown';

  console.log(`[webhook] Received event: ${event.event} (id: ${eventId})`);

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
    console.error(`[webhook] Processing error for ${event.event}:`, error instanceof Error ? error.message : error);
    // Return 200 to acknowledge receipt even on processing errors
    // Prevents Paystack from retrying and creating duplicate processing
    return res.status(200).json({ received: true, processing_error: true });
  }
}

/**
 * Idempotency guard: checks if a webhook event with the given reference
 * has already been processed. Uses the unique index on paystack_reference.
 *
 * Returns true if event was already processed (duplicate).
 */
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

async function handleChargeSuccess(data: any) {
  const userId = data.metadata?.user_id;
  const planCode = data.metadata?.plan_code;
  const reference = data.reference;

  if (!userId || !planCode) {
    console.warn('[webhook:charge.success] Missing user_id or plan_code in metadata');
    return;
  }

  // Idempotency check
  if (await isDuplicate(reference, 'charge_success')) {
    console.log(`[webhook:charge.success] Duplicate ignored: ${reference}`);
    return;
  }

  try {
    // Update user tier based on plan
    const { error: rpcError } = await supabase.rpc('update_user_tier_from_plan', {
      p_user_id: userId,
      p_plan_code: planCode,
    });

    if (rpcError) {
      console.error('[webhook:charge.success] RPC error:', rpcError.message);
      throw rpcError;
    }

    // Update subscription info
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_plan_code: planCode,
        paystack_customer_code: data.customer?.customer_code,
        subscription_start_date: new Date().toISOString(),
        cancel_at_period_end: false,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[webhook:charge.success] Profile update error:', updateError.message);
      throw updateError;
    }

    // Log event (idempotent via unique index on paystack_reference)
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

    console.log(`[webhook:charge.success] User ${userId} upgraded to plan ${planCode} (ref: ${reference})`);
  } catch (error) {
    console.error('[webhook:charge.success] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function handleSubscriptionCreate(data: any) {
  const customerCode = data.customer?.customer_code;
  const subscriptionCode = data.subscription_code;

  if (!customerCode) {
    console.warn('[webhook:subscription.create] Missing customer_code');
    return;
  }

  // Idempotency check using subscription_code as reference
  if (await isDuplicate(subscriptionCode, 'subscription_create')) {
    console.log(`[webhook:subscription.create] Duplicate ignored: ${subscriptionCode}`);
    return;
  }

  try {
    // Find user by customer code
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_customer_code', customerCode)
      .single();

    if (findError || !profile) {
      console.warn(`[webhook:subscription.create] User not found for customer: ${customerCode}`);
      return;
    }

    // Update subscription details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        paystack_subscription_code: subscriptionCode,
        subscription_end_date: data.next_payment_date,
        subscription_status: 'active',
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[webhook:subscription.create] Update error:', updateError.message);
      throw updateError;
    }

    // Log event
    await supabase.from('subscription_events').insert({
      user_id: profile.id,
      event_type: 'subscription_create',
      paystack_reference: subscriptionCode,
      plan_code: data.plan?.plan_code,
      status: 'success',
      metadata: {
        plan_name: data.plan?.name,
        plan_interval: data.plan?.interval,
        next_payment_date: data.next_payment_date,
      },
    });

    console.log(`[webhook:subscription.create] Subscription ${subscriptionCode} linked to user ${profile.id}`);
  } catch (error) {
    console.error('[webhook:subscription.create] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function handleSubscriptionDisable(data: any) {
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
    console.warn('[webhook:subscription.disable] Missing subscription_code');
    return;
  }

  // Idempotency check
  if (await isDuplicate(subscriptionCode, 'subscription_disable')) {
    console.log(`[webhook:subscription.disable] Duplicate ignored: ${subscriptionCode}`);
    return;
  }

  try {
    // Find user by subscription code
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_subscription_code', subscriptionCode)
      .single();

    if (findError || !profile) {
      console.warn(`[webhook:subscription.disable] User not found for subscription: ${subscriptionCode}`);
      return;
    }

    // Downgrade user to Spark tier
    const { error: rpcError } = await supabase.rpc('downgrade_to_spark', {
      p_user_id: profile.id,
    });

    if (rpcError) {
      console.error('[webhook:subscription.disable] RPC error:', rpcError.message);
      throw rpcError;
    }

    // Log event
    await supabase.from('subscription_events').insert({
      user_id: profile.id,
      event_type: 'subscription_disable',
      paystack_reference: subscriptionCode,
      status: 'success',
      metadata: {
        reason: data.status,
        disabled_at: new Date().toISOString(),
      },
    });

    console.log(`[webhook:subscription.disable] User ${profile.id} downgraded to Spark`);
  } catch (error) {
    console.error('[webhook:subscription.disable] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function handleSubscriptionEnable(data: any) {
  const subscriptionCode = data.subscription_code;
  const customerCode = data.customer?.customer_code;

  if (!subscriptionCode || !customerCode) {
    console.warn('[webhook:subscription.enable] Missing subscription_code or customer_code');
    return;
  }

  // Idempotency check
  if (await isDuplicate(subscriptionCode, 'subscription_enable')) {
    console.log(`[webhook:subscription.enable] Duplicate ignored: ${subscriptionCode}`);
    return;
  }

  try {
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_customer_code', customerCode)
      .single();

    if (findError || !profile) {
      console.warn(`[webhook:subscription.enable] User not found for customer: ${customerCode}`);
      return;
    }

    // Re-activate subscription and update tier from plan
    const planCode = data.plan?.plan_code;
    if (planCode) {
      await supabase.rpc('update_user_tier_from_plan', {
        p_user_id: profile.id,
        p_plan_code: planCode,
      });
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

    console.log(`[webhook:subscription.enable] Subscription reactivated for user ${profile.id}`);
  } catch (error) {
    console.error('[webhook:subscription.enable] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function handlePaymentFailed(data: any) {
  const customerCode = data.customer?.customer_code;

  if (!customerCode) {
    console.warn('[webhook:invoice.payment_failed] Missing customer_code');
    return;
  }

  const reference = data.reference || `pf_${customerCode}_${Date.now()}`;

  // Idempotency check
  if (data.reference && await isDuplicate(data.reference, 'payment_failed')) {
    console.log(`[webhook:invoice.payment_failed] Duplicate ignored: ${data.reference}`);
    return;
  }

  try {
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_customer_code', customerCode)
      .single();

    if (findError || !profile) {
      console.warn(`[webhook:invoice.payment_failed] User not found for customer: ${customerCode}`);
      return;
    }

    // Update subscription status to payment_failed
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'payment_failed',
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[webhook:invoice.payment_failed] Update error:', updateError.message);
      throw updateError;
    }

    // Log event
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

    console.log(`[webhook:invoice.payment_failed] Payment failure recorded for user ${profile.id}`);
  } catch (error) {
    console.error('[webhook:invoice.payment_failed] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function handleRefundProcessed(data: any) {
  const reference = data.transaction?.reference;
  const customerCode = data.customer?.customer_code;

  if (!reference || !customerCode) {
    console.warn('[webhook:refund.processed] Missing reference or customer_code');
    return;
  }

  // Idempotency check
  if (await isDuplicate(`refund_${reference}`, 'refund_processed')) {
    console.log(`[webhook:refund.processed] Duplicate ignored: ${reference}`);
    return;
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('paystack_customer_code', customerCode)
      .single();

    if (!profile) {
      console.warn(`[webhook:refund.processed] User not found for customer: ${customerCode}`);
      return;
    }

    // Downgrade to Spark on full refund
    await supabase.rpc('downgrade_to_spark', {
      p_user_id: profile.id,
    });

    await supabase.from('subscription_events').insert({
      user_id: profile.id,
      event_type: 'refund_processed',
      paystack_reference: `refund_${reference}`,
      amount: data.amount ? -(data.amount) : null,
      status: 'success',
      metadata: {
        original_reference: reference,
        refund_amount: data.amount,
        currency: data.currency,
        refunded_at: new Date().toISOString(),
      },
    });

    console.log(`[webhook:refund.processed] Refund processed, user ${profile.id} downgraded`);
  } catch (error) {
    console.error('[webhook:refund.processed] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}
