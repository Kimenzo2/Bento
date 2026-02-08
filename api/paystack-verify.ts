/**
 * Paystack Transaction Verification API Endpoint
 * Securely verifies transaction status with server-side secret key
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers — restrict to app origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: false, 
      message: 'Method not allowed' 
    });
  }

  // Validate secret key is configured
  if (!PAYSTACK_SECRET_KEY) {
    console.error('PAYSTACK_SECRET_KEY not configured');
    return res.status(500).json({ 
      status: false, 
      message: 'Payment service not configured' 
    });
  }

  // Get reference from URL path
  const { reference } = req.query;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({
      status: false,
      message: 'Transaction reference is required',
    });
  }

  try {
    // Make request to Paystack Verify API
    const response = await fetch(`${PAYSTACK_VERIFY_URL}/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Log for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Paystack Verify Response:', {
        status: data.status,
        dataStatus: data.data?.status,
        reference: data.data?.reference,
        amount: data.data?.amount,
        channel: data.data?.channel,
      });
    }

    // Return Paystack response to client
    return res.status(response.ok ? 200 : 400).json(data);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Verification failed';
    console.error('Paystack Verify API Error:', error);
    return res.status(500).json({
      status: false,
      message: errorMessage,
    });
  }
}
