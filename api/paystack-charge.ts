/**
 * Paystack Charge API Endpoint
 * Securely handles Charge API calls with server-side secret key
 * 
 * Supported payment methods:
 * - M-PESA (Kenya)
 * - Mobile Money (Ghana, Côte d'Ivoire)
 * - Pesalink Bank Transfer (Kenya)
 * - USSD (Nigeria)
 * - QR Code (South Africa)
 * - EFT (South Africa)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_CHARGE_URL = 'https://api.paystack.co/charge';

interface ChargeRequest {
  email: string;
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  // Payment method specific fields
  mobile_money?: {
    phone: string;
    provider: string;
    account?: string;
  };
  bank_transfer?: {
    account_expires_at?: string | null;
  };
  ussd?: {
    type: string;
  };
  qr?: {
    provider: string;
  };
  eft?: {
    provider: string;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers — restrict to app origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
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

  try {
    const chargeData: ChargeRequest = req.body;

    // Validate required fields
    if (!chargeData.email || !chargeData.amount) {
      return res.status(400).json({
        status: false,
        message: 'Email and amount are required',
      });
    }

    // Validate at least one payment method is specified
    const hasPaymentMethod = 
      chargeData.mobile_money || 
      chargeData.bank_transfer || 
      chargeData.ussd || 
      chargeData.qr || 
      chargeData.eft;

    if (!hasPaymentMethod) {
      return res.status(400).json({
        status: false,
        message: 'A payment method must be specified',
      });
    }

    // Make request to Paystack Charge API
    const response = await fetch(PAYSTACK_CHARGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargeData),
    });

    const data = await response.json();

    // Log for debugging (remove in production or use proper logging)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Paystack Charge Response:', {
        status: data.status,
        message: data.message,
        dataStatus: data.data?.status,
        reference: data.data?.reference,
      });
    }

    // Return Paystack response to client
    return res.status(response.ok ? 200 : 400).json(data);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Paystack Charge API Error:', error);
    return res.status(500).json({
      status: false,
      message: errorMessage,
    });
  }
}
