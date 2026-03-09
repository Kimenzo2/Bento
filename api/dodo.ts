/**
 * Unified Dodo Payments API Handler
 *
 * Routes by ?action= query param:
 *   POST ?action=checkout → create a Dodo checkout session (returns checkout_url)
 *   POST ?action=webhook  → Dodo webhook (standardwebhooks signature verified)
 *
 * Vercel rewrites map URLs to this handler:
 *   /api/dodo-checkout → /api/dodo?action=checkout
 *   /api/dodo-webhook  → /api/dodo?action=webhook
 *
 * Architecture mirrors api/paystack.ts exactly:
 *   - Bearer token stays server-side (never in VITE_ env vars)
 *   - Webhook uses service-role Supabase for admin writes
 *   - Idempotency via processed_webhooks table
 *   - Payment history logged to payment_history table
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './_middleware';

// ---------------------------------------------------------------------------
// Disable Vercel body-parsing — we read rawBody for webhook signature verify
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

// ---------------------------------------------------------------------------
// Dodo config — all from server-side env vars (no VITE_ prefix)
// ---------------------------------------------------------------------------
const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_WEBHOOK_SECRET = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
const DODO_ENV = process.env.DODO_PAYMENTS_ENV || 'test_mode';

// Product ID → tier mapping
// Built dynamically from environment variables so it works for both
// test and live product IDs without hardcoding.
function buildProductIdToTier(): Record<string, string> {
  const map: Record<string, string> = {};

  // Read product IDs from env (set by .env.local for both test/live)
  const creator = process.env.DODO_PRODUCT_ID_CREATOR_MONTHLY;
  const studio = process.env.DODO_PRODUCT_ID_STUDIO_MONTHLY;
  const empire = process.env.DODO_PRODUCT_ID_EMPIRE_MONTHLY;

  if (creator) map[creator] = 'CREATOR';
  if (studio) map[studio] = 'STUDIO';
  if (empire) map[empire] = 'EMPIRE';

  return map;
}

function productIdToTier(productId: string): string | null {
  const tierMap = buildProductIdToTier();
  return tierMap[productId] ?? null;
}

function tierFromMetadataOrProduct(
  metadata?: Record<string, string>,
  productCart?: Array<{ product_id: string; quantity: number }>
): string | null {
  // Prefer metadata.plan (we set this during checkout)
  if (metadata?.plan) {
    return metadata.plan.toUpperCase();
  }
  // Fallback: resolve from product ID
  if (productCart?.[0]?.product_id) {
    return productIdToTier(productCart[0].product_id);
  }
  return null;
}

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

  if (action === 'checkout') {
    return createAuthenticatedHandler(handleCheckout, { protection: 'api', cors: true })(req, res);
  }

  return res.status(400).json({ status: false, message: 'Unknown action' });
}

// ---------------------------------------------------------------------------
// CHECKOUT  (POST /api/dodo?action=checkout)
// Creates a Dodo checkout session and returns the checkout URL.
// The Dodo bearerToken stays server-side.
// ---------------------------------------------------------------------------
async function handleCheckout(ctx: ApiContext) {
  const { req, res, log } = ctx;

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  if (!DODO_API_KEY) {
    log.error('DODO_PAYMENTS_API_KEY not configured');
    return res.status(500).json({ status: false, message: 'Payment service not configured' });
  }

  const rawBody = await getRawBody(req);
  let body: { plan?: string; email?: string; name?: string; userId?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ status: false, message: 'Invalid JSON body' });
  }

  const { plan, email, name, userId } = body;
  if (!plan || !email || !userId) {
    return res.status(400).json({ status: false, message: 'plan, email, and userId are required' });
  }

  // Dynamically import the SDK — only available server-side
  const DodoPayments = (await import('dodopayments')).default;

  const dodoClient = new DodoPayments({
    bearerToken: DODO_API_KEY,
    environment: DODO_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
  });

  // Resolve product ID from plan name
  // We read from env or the hardcoded map above
  const productIdEnvKey = `DODO_PRODUCT_ID_${plan.toUpperCase()}`;
  const productId = process.env[productIdEnvKey] || Object.entries(buildProductIdToTier()).find(([, tier]) => tier === plan.toUpperCase())?.[0];

  if (!productId) {
    return res.status(400).json({
      status: false,
      message: `No Dodo product ID configured for plan: ${plan}. Set ${productIdEnvKey} in environment variables.`,
    });
  }

  try {
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const tierName = plan.replace('_monthly', '').toUpperCase();

    const session = await dodoClient.subscriptions.create({
      payment_link: true,
      billing: {
        city: 'city',
        country: 'US',
        state: 'state',
        street: 'street',
        zipcode: '0',
      },
      customer: {
        email,
        name: name || email,
      },
      product_id: productId,
      quantity: 1,
      return_url: `${appUrl}/payment-callback?provider=dodo`,
      metadata: {
        supabase_user_id: userId,
        plan: tierName,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      log.info('Dodo Subscription Session Created', {
        plan,
        userId,
        subscriptionId: session.subscription_id,
        hasPaymentLink: !!session.payment_link,
      });
    }

    return res.status(200).json({
      status: true,
      checkout_url: session.payment_link,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    log.error('Dodo Checkout Error', error instanceof Error ? error : undefined);
    return res.status(500).json({ status: false, message });
  }
}

// ---------------------------------------------------------------------------
// WEBHOOK  (POST /api/dodo?action=webhook)
// Signature verified using standardwebhooks library.
// ---------------------------------------------------------------------------
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DODO_WEBHOOK_SECRET) {
    console.error('[dodo-webhook] DODO_PAYMENTS_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  // ── 1. READ RAW BODY ─────────────────────────────────────────────────────
  let rawBody: string;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[dodo-webhook] Failed to read request body:', err);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!rawBody) {
    return res.status(400).json({ error: 'Empty body' });
  }

  // ── 2. VERIFY SIGNATURE ──────────────────────────────────────────────────
  const webhookId = req.headers['webhook-id'] as string;
  const webhookSignature = req.headers['webhook-signature'] as string;
  const webhookTimestamp = req.headers['webhook-timestamp'] as string;

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  let payload: any;
  try {
    const { Webhook } = await import('standardwebhooks');
    const webhook = new Webhook(DODO_WEBHOOK_SECRET);
    payload = webhook.verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    });
  } catch (err) {
    console.error('[dodo-webhook] Signature verification failed:', err);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ── 3. IDEMPOTENCY CHECK ─────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('processed_webhooks')
    .select('id')
    .eq('webhook_id', webhookId)
    .maybeSingle();

  if (existing) {
    console.log(`[dodo-webhook] Already processed: ${webhookId}`);
    return res.status(200).json({ received: true });
  }

  const { type, data } = payload;
  const userId = data?.metadata?.supabase_user_id ?? null;

  console.log(`[dodo-webhook] Processing: ${type} | User: ${userId}`);

  try {
    // ── 4. HANDLE EVENTS ──────────────────────────────────────────────────
    switch (type) {

      case 'payment.succeeded': {
        const tier = tierFromMetadataOrProduct(data.metadata, data.product_cart);

        if (userId && tier) {
          // Update user tier via the existing RPC (same as Paystack)
          await supabase
            .from('profiles')
            .update({
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan: tier.toLowerCase(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment({
          userId,
          paymentId: data.payment_id,
          amount: data.amount,
          currency: data.currency,
          plan: tier?.toLowerCase(),
          status: 'succeeded',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'subscription.active': {
        const tier = tierFromMetadataOrProduct(data.metadata, data.product_cart);

        if (userId && tier) {
          await supabase
            .from('profiles')
            .update({
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              dodo_subscription_id: data.subscription_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan: tier.toLowerCase(),
              subscription_period_end: data.next_billing_date ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment({
          userId,
          subscriptionId: data.subscription_id,
          plan: tier?.toLowerCase(),
          status: 'active',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'subscription.renewed': {
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_period_end: data.next_billing_date ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment({
          userId,
          subscriptionId: data.subscription_id,
          status: 'renewed',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'subscription.cancelled': {
        if (userId) {
          if (data.cancel_at_next_billing_date && data.next_billing_date) {
            // Keep access until period end
            await supabase
              .from('profiles')
              .update({
                subscription_status: 'cancelled',
                subscription_period_end: data.next_billing_date,
                cancel_at_period_end: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
          } else {
            // Immediate revocation
            await supabase.rpc('downgrade_to_spark', { p_user_id: userId });
          }
        }

        await logPayment({
          userId,
          subscriptionId: data.subscription_id,
          status: 'cancelled',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'subscription.on_hold': {
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'on_hold',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }
        break;
      }

      case 'payment.failed': {
        // Log only — do not change tier. Dodo retries automatically.
        await logPayment({
          userId,
          paymentId: data.payment_id,
          status: 'failed',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'refund.succeeded': {
        // Log refund. Downgrade to Spark on refund.
        if (userId) {
          await supabase.rpc('downgrade_to_spark', { p_user_id: userId });
        }

        await logPayment({
          userId,
          paymentId: data.payment_id,
          amount: data.amount ? -data.amount : undefined,
          status: 'refunded',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'dispute.opened': {
        // Flag account for review — log but do not auto-downgrade
        await logPayment({
          userId,
          paymentId: data.payment_id,
          status: 'disputed',
          eventType: type,
          metadata: data.metadata,
        });
        console.warn(`[dodo-webhook] DISPUTE OPENED for user ${userId}. Manual review required.`);
        break;
      }

      default:
        console.log(`[dodo-webhook] Unhandled event type: ${type}`);
    }

    // ── 5. MARK PROCESSED (only after successful processing) ──────────────
    await supabase.from('processed_webhooks').insert({
      webhook_id: webhookId,
      event_type: type,
      payload,
    });

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error(
      `[dodo-webhook] Processing error for ${type}:`,
      error instanceof Error ? error.message : error
    );
    // Return 500 so Dodo retries — do NOT mark as processed on error
    return res.status(500).json({ error: 'Processing error' });
  }
}

// ---------------------------------------------------------------------------
// Payment history logger
// ---------------------------------------------------------------------------
async function logPayment(params: {
  userId: string | null;
  paymentId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  plan?: string;
  status: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('payment_history').insert({
    user_id: params.userId,
    provider: 'dodo',
    payment_id: params.paymentId ?? null,
    subscription_id: params.subscriptionId ?? null,
    amount: params.amount ?? null,
    currency: params.currency ?? 'USD',
    plan: params.plan ?? null,
    status: params.status,
    event_type: params.eventType,
    metadata: params.metadata ?? null,
  });

  if (error) {
    console.error('[dodo-webhook] Failed to log payment:', error.message);
  }
}
