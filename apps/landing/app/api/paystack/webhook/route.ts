import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/server';
import { syncCheckoutIntentFromWebhook } from '../../../../lib/paystack/checkout-intents';
import {
  buildBillingUpdate,
  deriveProfilePatch,
  fingerprintPayload,
  isSupportedPaystackEvent,
  normalizeEventName,
  verifyPaystackSignature,
  type PaystackPayload,
} from '../../../../lib/paystack-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }
  return key;
}

async function readPayload(request: Request) {
  const rawBody = await request.text();
  let payload: PaystackPayload;

  try {
    payload = JSON.parse(rawBody) as PaystackPayload;
  } catch {
    throw new Error('Invalid JSON payload.');
  }

  return { rawBody, payload };
}

function duplicateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|unique constraint|already exists/i.test(message);
}

function toIntentPaymentStatus(
  status: 'processing' | 'pending' | 'succeeded' | 'failed' | 'ignored'
): 'pending' | 'succeeded' | 'failed' | 'ignored' {
  return status === 'processing' ? 'pending' : status;
}

async function upsertPaymentsRecord(
  supabase: ReturnType<typeof createAdminClient>,
  eventHash: string,
  update: ReturnType<typeof buildBillingUpdate>,
  payload: PaystackPayload,
  processingStatus: 'processing' | 'completed' | 'ignored' | 'failed'
) {
  const fallback = {
    profileId: null,
    paymentStatus: 'ignored' as const,
    billingStatus: 'free' as const,
    billingPeriod: null,
    planCode: null,
    tier: null,
    accessStartsAt: null,
    accessExpiresAt: null,
    paystackEventId: eventHash,
    paystackReference: null,
    paystackCustomerCode: null,
    paystackSubscriptionCode: null,
    paystackInvoiceCode: null,
    amountKobo: null,
    currency: null,
    paymentProvider: 'paystack' as const,
  };
  const normalized = update ?? fallback;

  const { error } = await supabase.from('payments').upsert(
    {
      id: eventHash,
      event_hash: eventHash,
      event_type: normalizeEventName(payload.event),
      processing_status: processingStatus,
      payment_status: normalized.paymentStatus,
      billing_status: normalized.billingStatus,
      billing_period: normalized.billingPeriod,
      plan_code: normalized.planCode,
      profile_id: normalized.profileId,
      amount_kobo: normalized.amountKobo,
      currency: normalized.currency,
      paystack_event_id: normalized.paystackEventId,
      paystack_reference: normalized.paystackReference,
      paystack_customer_code: normalized.paystackCustomerCode,
      paystack_subscription_code: normalized.paystackSubscriptionCode,
      paystack_invoice_code: normalized.paystackInvoiceCode,
      access_starts_at: normalized.accessStartsAt,
      access_expires_at: normalized.accessExpiresAt,
      payload,
      processed_at: processingStatus === 'completed' ? new Date().toISOString() : null,
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
  console.info('[paystack:webhook] payments row persisted', eventHash, processingStatus);
}

async function storeAuditEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventHash: string,
  payload: PaystackPayload
) {
  const eventName = normalizeEventName(payload.event);
  const { error } = await supabase.from('paystack_webhook_events').upsert(
    {
      event_hash: eventHash,
      event_type: eventName,
      payload,
    },
    { onConflict: 'event_hash' }
  );

  if (error) throw error;
  console.info('[paystack:webhook] audit event persisted', eventHash, eventName);
}

async function resolveProfileId(
  supabase: ReturnType<typeof createAdminClient>,
  payload: PaystackPayload,
  update: ReturnType<typeof buildBillingUpdate>
) {
  if (update?.profileId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', update.profileId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const data = payload.data ?? {};
  const metadata =
    (data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {}) ?? {};
  const customer =
    (data.customer && typeof data.customer === 'object'
      ? (data.customer as Record<string, unknown>)
      : {}) ?? {};
  const email =
    (typeof metadata.customer_email === 'string' && metadata.customer_email) ||
    (typeof metadata.email === 'string' && metadata.email) ||
    (typeof customer.email === 'string' && customer.email) ||
    (typeof data.email === 'string' && data.email) ||
    null;

  if (!email) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  return profile?.id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-paystack-signature');
  if (!signature) {
    console.warn('[paystack:webhook] missing signature header');
    return new NextResponse('Missing signature', { status: 401 });
  }

  const secret = getPaystackSecretKey();
  const { rawBody, payload } = await readPayload(request);

  if (!verifyPaystackSignature(rawBody, signature, secret)) {
    console.warn('[paystack:webhook] signature verification failed');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  console.info('[paystack:webhook] signature verified');

  const eventName = normalizeEventName(payload.event);
  const eventHash = fingerprintPayload(rawBody);
  const supabase = createAdminClient();
  const update = buildBillingUpdate(payload);

  console.info('[paystack:webhook] event received', eventName, { eventHash });

  if (!isSupportedPaystackEvent(eventName)) {
    console.info('[paystack:webhook] unsupported event ignored', eventName, eventHash);
    return NextResponse.json({
      received: true,
      ignored: true,
      unsupported: true,
      event: eventName,
    });
  }

  if (!update) {
    console.warn(
      '[paystack:webhook] supported event had no billable payload',
      eventName,
      eventHash
    );
    return NextResponse.json({ received: true, ignored: true, malformed: true, event: eventName });
  }

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from('payments')
    .select('id, processing_status')
    .eq('id', eventHash)
    .maybeSingle();

  if (existingPaymentError) {
    console.error('[paystack:webhook] failed to check existing payment row', existingPaymentError);
    return new NextResponse('Database error', { status: 500 });
  }

  if (existingPayment?.processing_status === 'completed') {
    console.info('[paystack:webhook] duplicate event skipped', eventName, eventHash);
    return NextResponse.json({ received: true, duplicate: true, event: eventName });
  }

  const profileId = await resolveProfileId(supabase, payload, update);

  if (!update.affectsBilling) {
    try {
      await upsertPaymentsRecord(
        supabase,
        eventHash,
        { ...update, profileId },
        payload,
        'processing'
      );
      await storeAuditEvent(supabase, eventHash, payload);
      await syncCheckoutIntentFromWebhook(supabase, {
        reference: update.paystackReference,
        paymentStatus: toIntentPaymentStatus(update.paymentStatus),
        billingStatus: update.billingStatus,
        payload,
        processedAt: new Date().toISOString(),
        eventHash,
      });
      await upsertPaymentsRecord(
        supabase,
        eventHash,
        { ...update, profileId },
        payload,
        'completed'
      );
      console.info('[paystack:webhook] audit-only event persisted', eventName, eventHash, {
        profileId,
      });
      return NextResponse.json({ received: true, ignored: true, event: eventName });
    } catch (error) {
      console.error('[paystack:webhook] audit-only persistence failed', error);
      return new NextResponse('Webhook processing failed', { status: 500 });
    }
  }

  if (!profileId) {
    console.warn('[paystack:webhook] could not resolve profile for event', eventName);
    try {
      await upsertPaymentsRecord(
        supabase,
        eventHash,
        { ...update, profileId: null },
        payload,
        'processing'
      );
      await storeAuditEvent(supabase, eventHash, payload);
      await syncCheckoutIntentFromWebhook(supabase, {
        reference: update.paystackReference,
        paymentStatus: toIntentPaymentStatus(update.paymentStatus),
        billingStatus: update.billingStatus,
        payload,
        processedAt: new Date().toISOString(),
        eventHash,
      });
      await upsertPaymentsRecord(
        supabase,
        eventHash,
        { ...update, profileId: null },
        payload,
        'completed'
      );
      return NextResponse.json({ received: true, unresolved_profile: true, event: eventName });
    } catch (error) {
      console.error('[paystack:webhook] unresolved profile persistence failed', error);
      return new NextResponse('Webhook processing failed', { status: 500 });
    }
  }

  const profilePatch = deriveProfilePatch(payload, { ...update, profileId }, profileId);

  try {
    console.info('[paystack:webhook] event received', eventName, {
      profileId,
      paymentStatus: update.paymentStatus,
      billingStatus: update.billingStatus,
    });

    await upsertPaymentsRecord(
      supabase,
      eventHash,
      { ...update, profileId },
      payload,
      'processing'
    );

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePatch, { onConflict: 'id' });
    if (profileError) throw profileError;

    console.info('[paystack:webhook] profile updated', profileId, update.billingStatus);

    await storeAuditEvent(supabase, eventHash, payload);
    await syncCheckoutIntentFromWebhook(supabase, {
      reference: update.paystackReference,
      paymentStatus: toIntentPaymentStatus(update.paymentStatus),
      billingStatus: update.billingStatus,
      payload,
      processedAt: new Date().toISOString(),
      eventHash,
    });
    await upsertPaymentsRecord(supabase, eventHash, { ...update, profileId }, payload, 'completed');

    console.info('[paystack:webhook] audit stored', eventName, fingerprintPayload(rawBody));

    return NextResponse.json({ received: true, event: eventName });
  } catch (error) {
    const duplicate = duplicateError(error);
    if (duplicate) {
      console.info('[paystack:webhook] duplicate write ignored', eventName, error);
      return NextResponse.json({ received: true, duplicate: true, event: eventName });
    }

    console.error('[paystack:webhook] processing failed', eventName, error);
    try {
      await upsertPaymentsRecord(supabase, eventHash, { ...update, profileId }, payload, 'failed');
    } catch (persistError) {
      console.error('[paystack:webhook] failed to persist failure state', persistError);
    }
    return new NextResponse('Webhook processing failed', { status: 500 });
  }
}
