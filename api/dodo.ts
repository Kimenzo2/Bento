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
 * Architecture:
 *   - Bearer token stays server-side (never in VITE_ env vars)
 *   - Webhook uses service-role Supabase for admin writes
 *   - Idempotency via processed_webhooks table
 *   - Payment history logged to payment_history table
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[dodo] Missing Supabase env vars:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    envKeys: Object.keys(process.env)
      .filter((k) => k.includes('SUPABASE'))
      .join(', '),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: SupabaseClient<any> | null =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

/** Guard — returns the Supabase client or throws so callers can 500 early. */
function requireSupabase(): SupabaseClient<any> {
  if (!supabase) {
    throw new Error(
      'Supabase client not initialised — missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return supabase;
}

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
  if (metadata?.plan) {
    return metadata.plan.toUpperCase();
  }
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

function getAppUrl(req: VercelRequest): string {
  const configuredUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const forwardedHost =
    typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0]?.trim()
      : undefined;
  const host = forwardedHost || req.headers.host;

  if (!host) {
    return 'http://localhost:3000';
  }

  const forwardedProto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0]?.trim()
      : undefined;
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
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
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return handleCheckout(req, res);
  }

  return res.status(400).json({ status: false, message: 'Unknown action' });
}

// ---------------------------------------------------------------------------
// CHECKOUT  (POST /api/dodo?action=checkout)
// Creates a Dodo subscription session and returns the payment link.
// ---------------------------------------------------------------------------
async function handleCheckout(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ status: false, message: 'Method not allowed' });
    }

    if (!DODO_API_KEY) {
      console.error('[dodo-checkout] DODO_PAYMENTS_API_KEY not configured. Available:',
        Object.keys(process.env).filter(k => k.includes('DODO')).join(', '));
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

    const productIdEnvKey = `DODO_PRODUCT_ID_${plan.toUpperCase()}`;
    const productId =
      process.env[productIdEnvKey] ||
      Object.entries(buildProductIdToTier()).find(([, tier]) => tier === plan.toUpperCase())?.[0];

    if (!productId) {
      return res.status(400).json({
        status: false,
        message: `No Dodo product ID configured for plan: ${plan}. Set ${productIdEnvKey} in environment variables.`,
      });
    }

    const DodoPayments = (await import('dodopayments')).default;
    const dodoClient = new DodoPayments({
      bearerToken: DODO_API_KEY,
      environment: DODO_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    });

    const appUrl = getAppUrl(req);
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

    console.log('[dodo-checkout] Session created:', session.subscription_id);

    return res.status(200).json({
      status: true,
      checkout_url: session.payment_link,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    console.error('[dodo-checkout] Error:', message);
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

  let db: SupabaseClient<any>;
  try {
    db = requireSupabase();
  } catch (err) {
    console.error('[dodo-webhook]', (err as Error).message);
    return res.status(500).json({ error: 'Database not configured' });
  }

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

  const { data: existing } = await db
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
    switch (type) {
      case 'payment.succeeded': {
        const tier = tierFromMetadataOrProduct(data.metadata, data.product_cart);

        if (userId && tier) {
          await db
            .from('profiles')
            .update({
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan_code: tier.toLowerCase(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment(db, {
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
          await db
            .from('profiles')
            .update({
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              dodo_subscription_id: data.subscription_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan_code: tier.toLowerCase(),
              subscription_end_date: data.next_billing_date ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment(db, {
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
          await db
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_end_date: data.next_billing_date ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment(db, {
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
            await db
              .from('profiles')
              .update({
                subscription_status: 'cancelled',
                subscription_end_date: data.next_billing_date,
                cancel_at_period_end: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
          } else {
            await db
              .from('profiles')
              .update({
                user_tier: 'SPARK',
                subscription_status: 'inactive',
                subscription_plan_code: null,
                subscription_end_date: null,
                cancel_at_period_end: false,
                dodo_subscription_id: null,
                payment_provider: 'none',
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
          }
        }

        await logPayment(db, {
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
          await db
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
        await logPayment(db, {
          userId,
          paymentId: data.payment_id,
          status: 'failed',
          eventType: type,
          metadata: data.metadata,
        });
        break;
      }

      case 'refund.succeeded': {
        if (userId) {
          await db
            .from('profiles')
            .update({
              user_tier: 'SPARK',
              subscription_status: 'inactive',
              subscription_plan_code: null,
              subscription_end_date: null,
              cancel_at_period_end: false,
              dodo_subscription_id: null,
              payment_provider: 'none',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        await logPayment(db, {
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
        await logPayment(db, {
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

    await db.from('processed_webhooks').insert({
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
    return res.status(500).json({ error: 'Processing error' });
  }
}

// ---------------------------------------------------------------------------
// Payment history logger
// ---------------------------------------------------------------------------
async function logPayment(
  db: SupabaseClient<any>,
  params: {
    userId: string | null;
    paymentId?: string;
    subscriptionId?: string;
    amount?: number;
    currency?: string;
    plan?: string;
    status: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await db.from('payment_history').insert({
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

