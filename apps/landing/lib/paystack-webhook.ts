import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PRICING_PLANS, findPlanByCode, type BillingPeriod, type BillingTier, type PricingPlanCode } from './billing';

export const SUPPORTED_PAYSTACK_EVENTS = [
  'charge.dispute.create',
  'charge.dispute.remind',
  'charge.dispute.resolve',
  'charge.success',
  'customeridentification.failed',
  'customeridentification.success',
  'dedicatedaccount.assign.failed',
  'dedicatedaccount.assign.success',
  'invoice.create',
  'invoice.payment_failed',
  'invoice.update',
  'paymentrequest.pending',
  'paymentrequest.success',
  'refund.failed',
  'refund.pending',
  'refund.processed',
  'refund.processing',
  'subscription.create',
  'subscription.disable',
  'subscription.expiring_cards',
  'subscription.not_renew',
  'transfer.failed',
  'transfer.success',
  'transfer.reversed',
] as const;

export type SupportedPaystackEventName = (typeof SUPPORTED_PAYSTACK_EVENTS)[number];

const BILLING_RELEVANT_PAYSTACK_EVENTS = new Set<SupportedPaystackEventName>([
  'charge.success',
  'invoice.create',
  'invoice.payment_failed',
  'invoice.update',
  'paymentrequest.pending',
  'paymentrequest.success',
  'subscription.create',
  'subscription.disable',
  'subscription.not_renew',
]);

export type PaystackEventName = SupportedPaystackEventName | string;

export type PaystackPayload = {
  event?: PaystackEventName;
  data?: Record<string, unknown>;
};

export type BillingStatus =
  | 'free'
  | 'processing'
  | 'active'
  | 'pending'
  | 'past_due'
  | 'non_renewing'
  | 'cancelled'
  | 'expired';

export type PaymentStatus = 'processing' | 'succeeded' | 'pending' | 'failed' | 'ignored';

export type BillingUpdate = {
  profileId: string | null;
  affectsBilling: boolean;
  paymentStatus: PaymentStatus;
  billingStatus: BillingStatus;
  billingPeriod: BillingPeriod | null;
  planCode: PricingPlanCode | null;
  tier: BillingTier | null;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  paystackEventId: string | null;
  paystackReference: string | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  paystackInvoiceCode: string | null;
  amountKobo: number | null;
  currency: string | null;
  paymentProvider: 'paystack';
};

function getString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function parseAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function addBillingPeriod(base: Date, period: BillingPeriod | null) {
  if (!period) return null;
  const next = new Date(base);
  if (period === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

export function normalizeEventName(value?: string | null): PaystackEventName {
  return (value ?? 'unknown').trim().toLowerCase();
}

export function isSupportedPaystackEvent(value?: string | null): value is SupportedPaystackEventName {
  const normalized = normalizeEventName(value);
  return (SUPPORTED_PAYSTACK_EVENTS as readonly string[]).includes(normalized);
}

export function fingerprintPayload(rawBody: string) {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function verifyPaystackSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(signature.trim().toLowerCase(), 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function planCodeFromPayload(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);
  const subscription = asRecord(data.subscription);
  const plan = asRecord(data.plan);
  const invoice = asRecord(data.invoice);

  return (
    getString(metadata, 'subscription_plan_code') ??
    getString(metadata, 'plan_code') ??
    getString(plan, 'plan_code') ??
    getString(subscription, 'plan_code') ??
    getString(invoice, 'plan_code') ??
    getString(data, 'plan_code')
  );
}

function resolveBillingPeriod(data: Record<string, unknown>, planCode: string | null): BillingPeriod | null {
  const metadata = asRecord(data.metadata);
  const direct = getString(metadata, 'billing_period') ?? getString(data, 'billing_period');
  if (direct === 'monthly' || direct === 'yearly') return direct;

  if (planCode?.toLowerCase().endsWith('_yearly')) return 'yearly';
  if (planCode?.toLowerCase().endsWith('_monthly')) return 'monthly';
  return null;
}

function getBillingStatusFromSubscriptionState(
  eventName: SupportedPaystackEventName,
  accessExpiresAt: string | null,
  currentBillingStatus: string | null,
  invoiceStatus?: string | null
): BillingStatus {
  const expired = Boolean(accessExpiresAt && Date.parse(accessExpiresAt) <= Date.now());
  const normalizedInvoiceStatus = invoiceStatus?.trim().toLowerCase() ?? null;

  if (eventName === 'charge.success' || eventName === 'paymentrequest.success' || eventName === 'subscription.create') {
    return 'active';
  }
  if (eventName === 'paymentrequest.pending' || eventName === 'invoice.create') {
    return currentBillingStatus === 'active' ? 'active' : 'pending';
  }
  if (eventName === 'invoice.payment_failed') return expired ? 'expired' : 'past_due';
  if (eventName === 'invoice.update') {
    if (normalizedInvoiceStatus === 'paid' || normalizedInvoiceStatus === 'success' || normalizedInvoiceStatus === 'active') {
      return 'active';
    }
    if (normalizedInvoiceStatus === 'failed') return expired ? 'expired' : 'past_due';
    return currentBillingStatus === 'active' ? 'active' : 'pending';
  }
  if (eventName === 'subscription.not_renew') return 'non_renewing';
  if (eventName === 'subscription.disable') return expired ? 'expired' : 'cancelled';
  if (currentBillingStatus === 'active' && expired) return 'expired';
  return (currentBillingStatus as BillingStatus) ?? 'free';
}

function getPaymentStatusFromSubscriptionState(
  eventName: SupportedPaystackEventName,
  invoiceStatus?: string | null
): PaymentStatus {
  const normalizedInvoiceStatus = invoiceStatus?.trim().toLowerCase() ?? null;
  if (eventName === 'charge.success' || eventName === 'paymentrequest.success' || eventName === 'subscription.create') {
    return 'succeeded';
  }
  if (eventName === 'paymentrequest.pending' || eventName === 'invoice.create') return 'pending';
  if (eventName === 'invoice.payment_failed') return 'failed';
  if (eventName === 'invoice.update') {
    if (normalizedInvoiceStatus === 'paid' || normalizedInvoiceStatus === 'success' || normalizedInvoiceStatus === 'active') {
      return 'succeeded';
    }
    if (normalizedInvoiceStatus === 'failed') return 'failed';
    return 'pending';
  }
  if (eventName === 'subscription.not_renew') return 'ignored';
  if (eventName === 'subscription.disable') return 'ignored';
  return 'ignored';
}

function resolveProfileIdentifiers(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);

  return {
    profileId:
      getString(metadata, 'profile_id') ??
      getString(metadata, 'user_id') ??
      getString(metadata, 'supabase_user_id') ??
      null,
  };
}

function resolveEventIdentity(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const invoice = asRecord(data.invoice);

  return (
    getString(metadata, 'paystack_event_id') ??
    getString(metadata, 'event_id') ??
    getString(data, 'id') ??
    getString(data, 'reference') ??
    getString(subscription, 'subscription_code') ??
    getString(customer, 'customer_code') ??
    getString(invoice, 'invoice_code') ??
    null
  );
}

function resolvePaymentReference(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const invoice = asRecord(data.invoice);

  return (
    getString(data, 'reference') ??
    getString(metadata, 'reference') ??
    getString(subscription, 'subscription_code') ??
    getString(customer, 'customer_code') ??
    getString(invoice, 'invoice_code') ??
    getString(data, 'authorization_code')
  );
}

function resolveAmountKobo(data: Record<string, unknown>) {
  return parseAmount(data.amount ?? data.gross_amount ?? data.paid_amount ?? data.total_amount);
}

function resolveCurrency(data: Record<string, unknown>) {
  const value = getString(data, 'currency');
  return value ? value.toUpperCase() : null;
}

function resolveAccessDates(
  eventName: SupportedPaystackEventName,
  data: Record<string, unknown>,
  billingPeriod: BillingPeriod | null
) {
  const subscription = asRecord(data.subscription);
  const metadata = asRecord(data.metadata);
  const createdAt =
    getString(data, 'paid_at') ??
    getString(data, 'created_at') ??
    getString(subscription, 'created_at') ??
    getString(metadata, 'processed_at');

  const startsAt = createdAt && !Number.isNaN(Date.parse(createdAt)) ? new Date(createdAt).toISOString() : null;

  const nextPaymentDate =
    getString(subscription, 'next_payment_date') ??
    getString(subscription, 'next_payment_at') ??
    getString(data, 'next_payment_date') ??
    getString(data, 'next_payment_at');

  const explicitEnd = nextPaymentDate && !Number.isNaN(Date.parse(nextPaymentDate))
    ? new Date(nextPaymentDate).toISOString()
    : null;

  if (explicitEnd) {
    return { startsAt, expiresAt: explicitEnd };
  }

  if (
    eventName === 'charge.success' ||
    eventName === 'paymentrequest.success' ||
    eventName === 'subscription.create' ||
    eventName === 'invoice.create'
  ) {
    const base = startsAt ? new Date(startsAt) : new Date();
    return {
      startsAt,
      expiresAt: addBillingPeriod(base, billingPeriod),
    };
  }

  return { startsAt, expiresAt: null };
}

function resolveTier(planCode: string | null) {
  const plan = findPlanByCode(planCode);
  return plan?.key ?? null;
}

export function buildBillingUpdate(payload: PaystackPayload): BillingUpdate | null {
  const data = asRecord(payload.data);
  if (!data) return null;

  const eventName = normalizeEventName(payload.event);
  if (!isSupportedPaystackEvent(eventName)) return null;

  const planCode = planCodeFromPayload(data);
  const tier = resolveTier(planCode);
  const billingPeriod = resolveBillingPeriod(data, planCode);
  const { profileId } = resolveProfileIdentifiers(data);
  const access = resolveAccessDates(eventName, data, billingPeriod);
  const paystackEventId = resolveEventIdentity(data);
  const invoiceStatus = getString(asRecord(data.invoice), 'status') ?? getString(data, 'status');
  const affectsBilling = BILLING_RELEVANT_PAYSTACK_EVENTS.has(eventName);

  const amountKobo = resolveAmountKobo(data);
  const receivedCurrency = resolveCurrency(data);

  const metadata = asRecord(data.metadata);
  const expectedCurrency = getString(metadata, 'expected_currency');
  const expectedAmountRaw = metadata?.['expected_amount_smallest_unit'];
  const expectedAmountSmallestUnit = parseAmount(expectedAmountRaw);

  if (affectsBilling && tier && amountKobo && expectedAmountSmallestUnit && expectedCurrency) {
    if (receivedCurrency && receivedCurrency !== expectedCurrency) {
      console.error('[paystack:webhook] CURRENCY MISMATCH - possible underpayment', {
        event: eventName,
        tier,
        planCode,
        expectedCurrency,
        receivedCurrency,
        expectedAmount: expectedAmountSmallestUnit,
        receivedAmount: amountKobo,
      });
    } else if (amountKobo < expectedAmountSmallestUnit) {
      console.error('[paystack:webhook] AMOUNT BELOW EXPECTED - possible underpayment', {
        event: eventName,
        tier,
        planCode,
        currency: receivedCurrency ?? expectedCurrency,
        expected: expectedAmountSmallestUnit,
        received: amountKobo,
        shortfall: expectedAmountSmallestUnit - amountKobo,
      });
    }
  } else if (affectsBilling && tier && amountKobo && !expectedAmountSmallestUnit) {
    const matchedPlan = PRICING_PLANS.find((p) => p.key === tier);
    if (matchedPlan) {
      const usdPriceFloat = parseFloat(matchedPlan.price[billingPeriod ?? 'monthly'].replace(/[^0-9.]/g, ''));
      const usdInSmallestUnit = Math.round(usdPriceFloat * 100);
      if (amountKobo < usdInSmallestUnit * 0.5) {
        console.warn('[paystack:webhook] amount too low (legacy check, no expected_currency in metadata)', {
          event: eventName,
          tier,
          planCode,
          expected: usdInSmallestUnit,
          received: amountKobo,
        });
      }
    }
  }

  return {
    profileId,
    affectsBilling,
    paymentStatus: getPaymentStatusFromSubscriptionState(eventName, invoiceStatus),
    billingStatus: affectsBilling ? getBillingStatusFromSubscriptionState(eventName, access.expiresAt, null, invoiceStatus) : 'free',
    billingPeriod,
    planCode: planCode as PricingPlanCode | null,
    tier,
    accessStartsAt: access.startsAt,
    accessExpiresAt: access.expiresAt,
    paystackEventId: paystackEventId ?? fingerprintPayload(JSON.stringify(payload.data ?? {})),
    paystackReference: resolvePaymentReference(data),
    paystackCustomerCode: getString(asRecord(data.customer), 'customer_code') ?? getString(asRecord(data.customer), 'id'),
    paystackSubscriptionCode:
      getString(asRecord(data.subscription), 'subscription_code') ?? getString(data, 'subscription_code'),
    paystackInvoiceCode: getString(asRecord(data.invoice), 'invoice_code') ?? getString(data, 'invoice_code'),
    amountKobo,
    currency: resolveCurrency(data),
    paymentProvider: 'paystack',
  };
}

export function deriveProfilePatch(
  payload: PaystackPayload,
  update: BillingUpdate,
  profileId: string
) {
  const data = asRecord(payload.data);
  const metadata = asRecord(data?.metadata);
  const eventName = normalizeEventName(payload.event);
  const currentStatus = update.billingStatus;
  const patch: Record<string, unknown> = {
    id: profileId,
    payment_provider: 'paystack' as const,
    subscription_status:
      currentStatus === 'active'
        ? 'active'
        : currentStatus === 'past_due'
          ? 'attention'
          : currentStatus === 'pending'
            ? 'pending'
            : currentStatus === 'non_renewing'
              ? 'non-renewing'
              : currentStatus === 'cancelled'
                ? 'cancelled'
                : currentStatus === 'expired'
                  ? 'cancelled'
                  : (asRecord(data?.subscription) ? 'active' : 'free'),
    billing_status: currentStatus,
    subscription_end_date: update.accessExpiresAt,
    access_expires_at: update.accessExpiresAt,
    billing_period: update.billingPeriod,
    billing_updated_at: new Date().toISOString(),
    cancel_at_period_end: eventName === 'subscription.not_renew',
    paystack_customer_id: update.paystackCustomerCode,
    paystack_subscription_id: update.paystackSubscriptionCode,
    paystack_authorization_code: getString(asRecord(data?.authorization), 'authorization_code'),
    paystack_email_token: getString(asRecord(data?.customer), 'email_token'),
    paystack_plan_code: update.planCode,
    paystack_last4: getString(asRecord(data?.authorization), 'last4'),
    paystack_card_type: getString(asRecord(data?.authorization), 'card_type'),
    paystack_card_expiry:
      getString(asRecord(data?.authorization), 'exp_month') && getString(asRecord(data?.authorization), 'exp_year')
        ? `${getString(asRecord(data?.authorization), 'exp_month')!.padStart(2, '0')}/${getString(asRecord(data?.authorization), 'exp_year')}`
        : null,
    paystack_next_payment_at: update.accessExpiresAt,
    paystack_last_event_at: new Date().toISOString(),
    paystack_last_event_id: update.paystackEventId,
    paystack_last_payment_reference: update.paystackReference,
  };

  if (update.tier) patch.user_tier = update.tier;
  if (update.planCode) patch.subscription_plan_code = update.planCode;

  const billingCountry = getString(metadata, 'billing_country');
  const shippingCountry = getString(metadata, 'shipping_country');
  const lastCheckoutCountry = getString(metadata, 'country');
  const lastCheckoutMethod = getString(metadata, 'selected_method');
  const lastCheckoutIntentAt = getString(metadata, 'checkout_intent_at');
  const lastCheckoutReference = getString(metadata, 'checkout_reference') ?? update.paystackReference;

  if (billingCountry) patch.billing_country = billingCountry;
  if (shippingCountry) patch.shipping_country = shippingCountry;
  if (lastCheckoutCountry) patch.last_checkout_country = lastCheckoutCountry;
  if (lastCheckoutMethod) patch.last_checkout_method = lastCheckoutMethod;
  if (lastCheckoutIntentAt) patch.last_checkout_intent_at = lastCheckoutIntentAt;
  if (lastCheckoutReference) patch.last_checkout_reference = lastCheckoutReference;

  return patch;
}
