import type { VercelRequest, VercelResponse } from "@vercel/node";

type DodoEnvironment = "live_mode" | "test_mode";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const DODO_API_KEY =
  process.env.DODO_PAYMENTS_API_KEY || process.env.DODO_API_KEY || "";
const DODO_ENV: DodoEnvironment =
  process.env.DODO_PAYMENTS_ENV === "test_mode" ||
  process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode" ||
  process.env.DODO_ENV === "test_mode"
    ? "test_mode"
    : "live_mode";

async function buildDodoClient(apiKey: string) {
  const { default: DodoPayments } = (await import("dodopayments")) as {
    default: new (options: { bearerToken: string; environment: DodoEnvironment }) => any;
  };

  return new DodoPayments({
    bearerToken: apiKey,
    environment: DODO_ENV,
  });
}

async function requireAccessToken(req: VercelRequest): Promise<string> {
  const authorization = req.headers.authorization ?? "";
  const token = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = token.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Missing authorization token");
  }

  return match[1];
}

async function getSupabaseUserId(accessToken: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured for portal access");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to resolve authenticated user");
  }

  const user = (await response.json()) as { id?: string };
  if (!user.id) {
    throw new Error("Authenticated user id was not found");
  }

  return user.id;
}

async function getDodoCustomerId(accessToken: string, userId: string): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=dodo_customer_id`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Unable to load billing profile");
  }

  const profiles = (await response.json()) as Array<{ dodo_customer_id?: string | null }>;
  const customerId = profiles[0]?.dodo_customer_id?.trim();

  if (!customerId) {
    throw new Error("No Dodo customer profile is attached to this account yet.");
  }

  return customerId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!DODO_API_KEY) {
      throw new Error("Billing is not configured.");
    }

    const accessToken = await requireAccessToken(req);
    const userId = await getSupabaseUserId(accessToken);
    const customerId = await getDodoCustomerId(accessToken, userId);
    const client = await buildDodoClient(DODO_API_KEY);
    const portalSession = await client.customers.customerPortal.create(customerId);
    const portalUrl = (portalSession as { link?: string }).link;

    if (!portalUrl) {
      throw new Error("Customer portal did not return a link.");
    }

    return res.status(200).json({ portal_url: portalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open billing portal.";
    return res.status(400).json({ error: message });
  }
}
