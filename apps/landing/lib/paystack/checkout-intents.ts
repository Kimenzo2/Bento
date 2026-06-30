import type { BillingPeriod, PricingPlanCode } from '../billing';
import type { PaystackMethodKey } from './payment-methods';

export type CheckoutIntentSource = 'web' | 'desktop' | 'manual';

export type CheckoutIntentRecord = {
  reference: string;
  profileId: string;
  email: string;
  countryCode: string;
  billingCountry: string | null;
  shippingCountry: string | null;
  selectedMethodKey: PaystackMethodKey;
  selectedChannels: string[];
  planCode: PricingPlanCode;
  billingPeriod: BillingPeriod;
  source: CheckoutIntentSource;
  paymentStatus: 'pending' | 'succeeded' | 'failed' | 'ignored';
  billingStatus:
    | 'free'
    | 'processing'
    | 'active'
    | 'pending'
    | 'past_due'
    | 'non_renewing'
    | 'cancelled'
    | 'expired';
  paystackAccessCode: string | null;
  paystackAuthorizationUrl: string | null;
  payload: Record<string, unknown>;
  processedAt: string | null;
  expectedCurrency: string;
  expectedAmountSmallestUnit: number;
};

export function buildCheckoutIntentRecord(input: {
  reference: string;
  profileId: string;
  email: string;
  countryCode: string;
  billingCountry?: string | null;
  shippingCountry?: string | null;
  selectedMethodKey: PaystackMethodKey;
  selectedChannels: string[];
  planCode: PricingPlanCode;
  billingPeriod: BillingPeriod;
  source: CheckoutIntentSource;
  paystackAccessCode?: string | null;
  paystackAuthorizationUrl?: string | null;
  payload?: Record<string, unknown>;
  expectedCurrency?: string;
  expectedAmountSmallestUnit?: number;
}): CheckoutIntentRecord {
  return {
    reference: input.reference,
    profileId: input.profileId,
    email: input.email,
    countryCode: input.countryCode,
    billingCountry: input.billingCountry ?? null,
    shippingCountry: input.shippingCountry ?? null,
    selectedMethodKey: input.selectedMethodKey,
    selectedChannels: input.selectedChannels,
    planCode: input.planCode,
    billingPeriod: input.billingPeriod,
    source: input.source,
    paymentStatus: 'pending',
    billingStatus: 'pending',
    paystackAccessCode: input.paystackAccessCode ?? null,
    paystackAuthorizationUrl: input.paystackAuthorizationUrl ?? null,
    payload: input.payload ?? {},
    processedAt: null,
    expectedCurrency: input.expectedCurrency ?? 'USD',
    expectedAmountSmallestUnit: input.expectedAmountSmallestUnit ?? 0,
  };
}

export async function persistCheckoutIntent(supabase: any, intent: CheckoutIntentRecord) {
  const { error } = await supabase.from('paystack_checkout_intents').upsert(
    {
      reference: intent.reference,
      profile_id: intent.profileId,
      email: intent.email,
      country_code: intent.countryCode,
      billing_country: intent.billingCountry,
      shipping_country: intent.shippingCountry,
      selected_method_key: intent.selectedMethodKey,
      selected_channels: intent.selectedChannels,
      plan_code: intent.planCode,
      billing_period: intent.billingPeriod,
      source: intent.source,
      payment_status: intent.paymentStatus,
      billing_status: intent.billingStatus,
      paystack_access_code: intent.paystackAccessCode,
      paystack_authorization_url: intent.paystackAuthorizationUrl,
      payload: intent.payload,
      processed_at: intent.processedAt,
      expected_currency: intent.expectedCurrency,
      expected_amount_smallest_unit: intent.expectedAmountSmallestUnit,
    },
    { onConflict: 'reference' }
  );

  if (error) throw error;
  console.info('[paystack:intent] checkout intent persisted', intent.reference);
}

export async function syncCheckoutIntentFromWebhook(
  supabase: any,
  input: {
    reference: string | null;
    paymentStatus: CheckoutIntentRecord['paymentStatus'];
    billingStatus: CheckoutIntentRecord['billingStatus'];
    payload: Record<string, unknown>;
    processedAt: string;
    eventHash: string;
  }
) {
  if (!input.reference) return;

  const { error } = await supabase
    .from('paystack_checkout_intents')
    .update({
      payment_status: input.paymentStatus,
      billing_status: input.billingStatus,
      payload: input.payload,
      processed_at: input.processedAt,
    })
    .eq('reference', input.reference);

  if (error) throw error;
  console.info('[paystack:intent] checkout intent synced', input.reference);
}
