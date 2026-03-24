import type { VercelRequest, VercelResponse } from '@vercel/node';

type SupabaseClient<T = any> = any;

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;

// Lazily load Supabase client factory at runtime to avoid cold-start invocation crashes
// when transitive packages are unavailable in the serverless bundle.
let supabaseAdmin: SupabaseClient<any> | null | undefined;
let supabaseAuth: SupabaseClient<any> | null | undefined;
let supabaseInitError: Error | null = null;
let supabaseClientFactory:
  | ((url: string, key: string) => SupabaseClient<any>)
  | null = null;

async function ensureSupabaseClientsLoaded(): Promise<void> {
  if (supabaseAdmin !== undefined || supabaseAuth !== undefined || supabaseInitError) {
    return;
  }

  if (!supabaseUrl) {
    supabaseAdmin = null;
    supabaseAuth = null;
    return;
  }

  try {
    if (!supabaseClientFactory) {
      const mod = await import('@supabase/supabase-js');
      supabaseClientFactory = mod.createClient;
    }

    supabaseAdmin =
      supabaseServiceKey && supabaseClientFactory
        ? supabaseClientFactory(supabaseUrl, supabaseServiceKey)
        : null;

    supabaseAuth =
      (supabaseServiceKey || supabaseAnonKey) && supabaseClientFactory
        ? supabaseClientFactory(supabaseUrl, supabaseServiceKey || supabaseAnonKey!)
        : null;
  } catch (error) {
    supabaseAdmin = null;
    supabaseAuth = null;
    supabaseInitError = error instanceof Error ? error : new Error(String(error));
    console.error('[dodo] Failed to initialize Supabase clients:', supabaseInitError.message);
  }
}

type DodoEnvironment = 'live_mode' | 'test_mode';

type DodoApiKeyCandidate = {
  source: string;
  value: string;
};

const DODO_API_KEY_CANDIDATES: DodoApiKeyCandidate[] = [
  { source: 'DODO_PAYMENTS_API_KEY', value: process.env.DODO_PAYMENTS_API_KEY || '' },
  { source: 'DODO_API_KEY', value: process.env.DODO_API_KEY || '' },
].filter((candidate, index, candidates) => {
  if (!candidate.value) {
    return false;
  }

  return candidates.findIndex((other) => other.value === candidate.value) === index;
});

const DODO_WEBHOOK_KEY =
  process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
  process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
  process.env.DODO_WEBHOOK_KEY ||
  process.env.DODO_WEBHOOK_SECRET ||
  null;

const DODO_ENV: DodoEnvironment =
  process.env.DODO_PAYMENTS_ENV === 'test_mode' ||
  process.env.DODO_PAYMENTS_ENVIRONMENT === 'test_mode' ||
  process.env.DODO_ENV === 'test_mode'
    ? 'test_mode'
    : 'live_mode';

const SUPPORTED_TIERS = ['CREATOR', 'STUDIO', 'EMPIRE'] as const;
const SUPPORTED_INTERVALS = ['MONTHLY', 'YEARLY'] as const;

async function requireSupabaseAdmin(): Promise<SupabaseClient<any>> {
  await ensureSupabaseClientsLoaded();

  if (supabaseInitError) {
    throw new Error(`Supabase client failed to load: ${supabaseInitError.message}`);
  }

  if (!supabaseAdmin) {
    throw new Error(
      'Supabase client not initialised - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return supabaseAdmin;
}

async function requireSupabaseAuth(): Promise<SupabaseClient<any>> {
  await ensureSupabaseClientsLoaded();

  if (supabaseInitError) {
    throw new Error(`Supabase auth client failed to load: ${supabaseInitError.message}`);
  }

  if (!supabaseAuth) {
    throw new Error(
      'Supabase auth client not initialised - missing SUPABASE_URL and a Supabase API key'
    );
  }

  return supabaseAuth;
}

function getPrimaryDodoApiKey(): string | null {
  return DODO_API_KEY_CANDIDATES[0]?.value || null;
}

async function getRawBody(req: VercelRequest): Promise<string> {
  return await new Promise((resolve, reject) => {
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

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (origin) {
    return origin.replace(/\/$/, '');
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

function getRequestHostname(req: VercelRequest): string | null {
  const forwardedHost =
    typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0]?.trim()
      : undefined;
  const host = forwardedHost || req.headers.host;
  if (!host) {
    return null;
  }

  return host.split(':')[0]?.toLowerCase() || null;
}

function isLocalHostname(hostname: string | null): boolean {
  return Boolean(
    hostname &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost'))
  );
}

function isProductionCheckoutRequest(req: VercelRequest): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production';
  }

  return !isLocalHostname(getRequestHostname(req));
}

function assertCheckoutEnvironment(req: VercelRequest): void {
  if (isProductionCheckoutRequest(req) && DODO_ENV !== 'live_mode') {
    throw new Error('Production checkout cannot run with Dodo test mode enabled');
  }
}

function assertCheckoutUrlEnvironment(checkoutUrl: string, req: VercelRequest): void {
  const url = new URL(checkoutUrl);
  const hostname = url.hostname.toLowerCase();
  const isTestCheckout = hostname === 'test.checkout.dodopayments.com' || hostname.startsWith('test.');

  if (isProductionCheckoutRequest(req) && isTestCheckout) {
    throw new Error('Production checkout returned a Dodo test checkout URL');
  }

  if (DODO_ENV === 'live_mode' && isTestCheckout) {
    throw new Error('Live Dodo configuration returned a test checkout URL');
  }

  if (DODO_ENV === 'test_mode' && !isTestCheckout) {
    throw new Error('Test Dodo configuration returned a live checkout URL');
  }
}

function parsePlan(plan: string): { tier: string; interval: string } | null {
  const [tierRaw, intervalRaw] = plan.trim().toUpperCase().split('_');

  if (!SUPPORTED_TIERS.includes(tierRaw as (typeof SUPPORTED_TIERS)[number])) {
    return null;
  }

  if (!SUPPORTED_INTERVALS.includes(intervalRaw as (typeof SUPPORTED_INTERVALS)[number])) {
    return null;
  }

  return {
    tier: tierRaw,
    interval: intervalRaw,
  };
}

function resolveProductId(plan: string): { productId: string; tier: string; interval: string } | null {
  const parsedPlan = parsePlan(plan);
  if (!parsedPlan) {
    return null;
  }

  const envKey = `DODO_PRODUCT_ID_${parsedPlan.tier}_${parsedPlan.interval}`;
  const productId = process.env[envKey];

  if (!productId) {
    return null;
  }

  return {
    productId,
    tier: parsedPlan.tier,
    interval: parsedPlan.interval,
  };
}

function buildProductIdToTier(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const tier of SUPPORTED_TIERS) {
    for (const interval of SUPPORTED_INTERVALS) {
      const productId = process.env[`DODO_PRODUCT_ID_${tier}_${interval}`];
      if (productId) {
        map[productId] = tier;
      }
    }
  }

  return map;
}

function productIdToTier(productId: string): string | null {
  return buildProductIdToTier()[productId] ?? null;
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

type VerifiedCheckoutUser = {
  userId: string;
  email?: string;
  name?: string;
};

type ResolvedWebhookUser = {
  userId: string | null;
  email: string | null;
};

function readNestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const nestedValue = (value as Record<string, unknown>)[key];
  return typeof nestedValue === 'string' ? nestedValue : undefined;
}

async function verifyCheckoutUser(req: VercelRequest): Promise<VerifiedCheckoutUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!jwtSecret) {
    console.warn('[dodo-checkout] SUPABASE_JWT_SECRET is not configured, falling back to Auth API validation');
  } else {
    try {
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
        algorithms: ['HS256'],
      });

      const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
      if (userId) {
        return {
          userId,
          email: typeof payload.email === 'string' ? payload.email : undefined,
          name:
            readNestedString(payload.user_metadata, 'full_name') ||
            readNestedString(payload.user_metadata, 'name'),
        };
      }
    } catch (error) {
      console.warn(
        '[dodo-checkout] Local JWT verification failed, falling back to Auth API validation:',
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    const db = await requireSupabaseAuth();
    const {
      data: { user },
      error,
    } = await db.auth.getUser(token);

    if (error || !user) {
      console.error('[dodo-checkout] Supabase Auth API rejected token:', error?.message);
      return null;
    }

    return {
      userId: user.id,
      email: user.email ?? undefined,
      name:
        readNestedString(user.user_metadata, 'full_name') ||
        readNestedString(user.user_metadata, 'name'),
    };
  } catch (error) {
    console.error(
      '[dodo-checkout] Failed to validate token with Supabase Auth API:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function parseCheckoutBody(
  req: VercelRequest
): Promise<{ plan?: string }> {
  const rawBody = await getRawBody(req);

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as { plan?: string };
}

function buildDodoClient(apiKey: string, webhookKey?: string | null) {
  return import('dodopayments').then(({ default: DodoPayments }) => {
    return new DodoPayments({
      bearerToken: apiKey,
      environment: DODO_ENV,
      webhookKey: webhookKey ?? undefined,
    });
  });
}

function getProviderStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const value = (error as { status?: unknown }).status;
  return typeof value === 'number' ? value : undefined;
}

function getProviderMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to create checkout session';
}

async function createCheckoutSession(params: {
  productId: string;
  customerEmail: string;
  customerName: string;
  userId: string;
  tier: string;
  returnUrl: string;
  req: VercelRequest;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  if (DODO_API_KEY_CANDIDATES.length === 0) {
    throw new Error('Payment service not configured');
  }

  assertCheckoutEnvironment(params.req);

  let lastError: unknown;

  for (const candidate of DODO_API_KEY_CANDIDATES) {
    try {
      const client = await buildDodoClient(candidate.value, DODO_WEBHOOK_KEY);
      const { data } = await client.checkoutSessions
        .create({
          product_cart: [{ product_id: params.productId, quantity: 1 }],
          customer: {
            email: params.customerEmail,
            name: params.customerName,
          },
          return_url: params.returnUrl,
          feature_flags: {
            redirect_immediately: true,
          },
          metadata: {
            supabase_user_id: params.userId,
            supabase_email: params.customerEmail,
            plan: params.tier,
          },
        })
        .withResponse();

      if (!data.checkout_url) {
        throw new Error('Dodo did not return a checkout URL');
      }

      assertCheckoutUrlEnvironment(data.checkout_url, params.req);

      return {
        checkoutUrl: data.checkout_url,
        sessionId: data.session_id,
      };
    } catch (error) {
      lastError = error;
      const providerStatus = getProviderStatus(error);

      console.error('[dodo-checkout] Provider error', {
        providerStatus,
        source: candidate.source,
        message: getProviderMessage(error),
      });

      if (providerStatus !== 401) {
        break;
      }
    }
  }

  throw lastError ?? new Error('Failed to create checkout session');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  if (action === 'webhook') {
    return await handleWebhook(req, res);
  }

  if (action === 'checkout') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return await handleCheckout(req, res);
  }

  return res.status(400).json({ status: false, message: 'Unknown action' });
}

async function handleCheckout(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ status: false, message: 'Method not allowed' });
    }

    const authUser = await verifyCheckoutUser(req);
    if (!authUser) {
      return res.status(401).json({
        status: false,
        message: 'Authentication required to start checkout',
      });
    }

    const { plan } = await parseCheckoutBody(req);
    if (!plan) {
      return res.status(400).json({ status: false, message: 'plan is required' });
    }

    const resolvedPlan = resolveProductId(plan);
    if (!resolvedPlan) {
      return res.status(400).json({
        status: false,
        message: `No Dodo product is configured for plan: ${plan}`,
      });
    }

    const customerEmail = authUser.email?.trim();
    if (!customerEmail) {
      return res.status(400).json({
        status: false,
        message: 'Authenticated user email is required for checkout',
      });
    }

    const customerName = authUser.name?.trim() || customerEmail;
    const appUrl = getAppUrl(req);
    const session = await createCheckoutSession({
      productId: resolvedPlan.productId,
      customerEmail,
      customerName,
      userId: authUser.userId,
      tier: resolvedPlan.tier,
      returnUrl: `${appUrl}/payment-callback?plan=${resolvedPlan.tier.toLowerCase()}`,
      req,
    });

    return res.status(200).json({
      status: true,
      session_id: session.sessionId,
      checkout_url: session.checkoutUrl,
    });
  } catch (error) {
    const providerStatus = getProviderStatus(error);
    const providerMessage = getProviderMessage(error);

    const message =
      providerStatus === 401
        ? 'Dodo rejected the configured server API credentials. Update the production DODO payment environment variables and redeploy.'
        : providerMessage;

    console.error('[dodo-checkout] Error:', {
      providerStatus,
      message: providerMessage,
      environment: DODO_ENV,
      configuredKeySources: DODO_API_KEY_CANDIDATES.map((candidate) => candidate.source),
    });

    return res.status(500).json({
      status: false,
      message,
      provider_status: providerStatus,
    });
  }
}

async function resolveWebhookUser(
  db: SupabaseClient<any>,
  data: Record<string, any> | null | undefined
): Promise<ResolvedWebhookUser> {
  const customerEmail =
    typeof data?.customer?.email === 'string' ? data.customer.email.trim().toLowerCase() : null;
  const metadataUserId =
    typeof data?.metadata?.supabase_user_id === 'string' ? data.metadata.supabase_user_id : null;

  if (customerEmail) {
    const { data: profileByEmail, error } = await db
      .from('profiles')
      .select('id, email')
      .eq('email', customerEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve profile by Dodo customer email: ${error.message}`);
    }

    if (profileByEmail?.id) {
      if (metadataUserId && metadataUserId !== profileByEmail.id) {
        console.warn('[dodo-webhook] Metadata/user email mismatch detected', {
          metadataUserId,
          customerEmail,
          resolvedUserId: profileByEmail.id,
        });
      }

      return {
        userId: profileByEmail.id,
        email: profileByEmail.email ?? customerEmail,
      };
    }
  }

  if (!metadataUserId) {
    return { userId: null, email: customerEmail };
  }

  const { data: profileById, error } = await db
    .from('profiles')
    .select('id, email')
    .eq('id', metadataUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve profile by metadata user id: ${error.message}`);
  }

  return {
    userId: profileById?.id ?? metadataUserId,
    email: profileById?.email ?? customerEmail,
  };
}

async function updateProfileStrict(
  db: SupabaseClient<any>,
  userId: string,
  updates: Record<string, unknown>,
  reason: string
): Promise<void> {
  const { data, error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update profile for ${reason}: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Profile update for ${reason} did not match an existing user`);
  }
}

async function insertProcessedWebhook(
  db: SupabaseClient<any>,
  webhookId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from('processed_webhooks').insert({
    webhook_id: webhookId,
    event_type: eventType,
    payload,
  });

  if (error) {
    throw new Error(`Failed to persist processed webhook: ${error.message}`);
  }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DODO_WEBHOOK_KEY) {
    console.error('[dodo-webhook] DODO webhook signing key not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let db: SupabaseClient<any>;
  try {
    db = await requireSupabaseAdmin();
  } catch (error) {
    console.error('[dodo-webhook]', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Database not configured' });
  }

  let rawBody: string;
  try {
    rawBody = await getRawBody(req);
  } catch (error) {
    console.error('[dodo-webhook] Failed to read request body:', error);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!rawBody) {
    return res.status(400).json({ error: 'Empty body' });
  }

  const webhookId = req.headers['webhook-id'];
  const webhookSignature = req.headers['webhook-signature'];
  const webhookTimestamp = req.headers['webhook-timestamp'];

  if (
    typeof webhookId !== 'string' ||
    typeof webhookSignature !== 'string' ||
    typeof webhookTimestamp !== 'string'
  ) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  let payload: any;
  try {
    const client = await buildDodoClient(
      getPrimaryDodoApiKey() || 'webhook-verification-only',
      DODO_WEBHOOK_KEY
    );

    payload = client.webhooks.unwrap(rawBody, {
      headers: {
        'webhook-id': webhookId,
        'webhook-signature': webhookSignature,
        'webhook-timestamp': webhookTimestamp,
      },
      key: DODO_WEBHOOK_KEY,
    });
  } catch (error) {
    console.error('[dodo-webhook] Signature verification failed:', error);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { data: existing } = await db
    .from('processed_webhooks')
    .select('id')
    .eq('webhook_id', webhookId)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ received: true });
  }

  const { type, data } = payload;

  try {
    const resolvedUser = await resolveWebhookUser(db, data);
    const userId = resolvedUser.userId;

    switch (type) {
      case 'payment.succeeded': {
        const tier = tierFromMetadataOrProduct(data.metadata, data.product_cart);

        if (userId && tier) {
          await updateProfileStrict(
            db,
            userId,
            {
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan_code: tier.toLowerCase(),
              updated_at: new Date().toISOString(),
            },
            'payment.succeeded'
          );
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
          await updateProfileStrict(
            db,
            userId,
            {
              user_tier: tier,
              dodo_customer_id: data.customer?.customer_id ?? null,
              dodo_subscription_id: data.subscription_id ?? null,
              payment_provider: 'dodo',
              subscription_status: 'active',
              subscription_plan_code: tier.toLowerCase(),
              subscription_end_date: data.next_billing_date ?? null,
              updated_at: new Date().toISOString(),
            },
            'subscription.active'
          );

          // Initialize usage_tracking for the current month (no reset if row exists)
          await initUsageTracking(db, userId);
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
          await updateProfileStrict(
            db,
            userId,
            {
              subscription_status: 'active',
              dodo_customer_id: data.customer?.customer_id ?? null,
              dodo_subscription_id: data.subscription_id ?? null,
              subscription_end_date: data.next_billing_date ?? null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            },
            'subscription.renewed'
          );

          // Reset usage counter for the new billing month
          await resetUsageTracking(db, userId);
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
            await updateProfileStrict(
              db,
              userId,
              {
                subscription_status: 'cancelled',
                subscription_end_date: data.next_billing_date,
                cancel_at_period_end: true,
                updated_at: new Date().toISOString(),
              },
              'subscription.cancelled'
            );
          } else {
            await updateProfileStrict(
              db,
              userId,
              {
                user_tier: 'SPARK',
                subscription_status: 'inactive',
                subscription_plan_code: null,
                subscription_end_date: null,
                cancel_at_period_end: false,
                dodo_subscription_id: null,
                payment_provider: 'none',
                updated_at: new Date().toISOString(),
              },
              'subscription.cancelled'
            );
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
          await updateProfileStrict(
            db,
            userId,
            {
              subscription_status: 'on_hold',
              updated_at: new Date().toISOString(),
            },
            'subscription.on_hold'
          );
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
          await updateProfileStrict(
            db,
            userId,
            {
              user_tier: 'SPARK',
              subscription_status: 'inactive',
              subscription_plan_code: null,
              subscription_end_date: null,
              cancel_at_period_end: false,
              dodo_subscription_id: null,
              payment_provider: 'none',
              updated_at: new Date().toISOString(),
            },
            'refund.succeeded'
          );
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
        break;
      }

      default:
        console.log(`[dodo-webhook] Unhandled event type: ${type}`);
    }

    await insertProcessedWebhook(db, webhookId, type, payload);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(
      `[dodo-webhook] Processing error for ${type}:`,
      error instanceof Error ? error.message : error
    );
    // Always return 200 so Dodo marks the webhook as received and does not retry
    return res.status(200).json({ received: true, error: 'Processing error' });
  }
}

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
    throw new Error(`Failed to log payment: ${error.message}`);
  }
}

/**
 * Initialize a usage_tracking row for the current month if one does not exist.
 * Does NOT reset books_created if the row already exists.
 */
async function initUsageTracking(
  db: SupabaseClient<any>,
  userId: string
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { error } = await db.from('usage_tracking').upsert(
    { user_id: userId, month, books_created: 0 },
    { onConflict: 'user_id,month', ignoreDuplicates: true }
  );
  if (error) {
    console.error('[dodo-webhook] Failed to init usage_tracking:', error.message);
  }
}

/**
 * Reset the usage counter for the new billing month.
 * Upserts a row with books_created = 0 for the current month.
 */
async function resetUsageTracking(
  db: SupabaseClient<any>,
  userId: string
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { error } = await db.from('usage_tracking').upsert(
    { user_id: userId, month, books_created: 0, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,month' }
  );
  if (error) {
    console.error('[dodo-webhook] Failed to reset usage_tracking:', error.message);
  }
}
