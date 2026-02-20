/**
 * Paystack Payment Service
 * Uses Paystack Inline JS (loaded from CDN)
 * 
 * Supported Payment Channels by Region:
 * 
 * KENYA (KES):
 * - Cards (Visa, Mastercard, Amex)
 * - Apple Pay (Safari/iOS)
 * - M-PESA (STK Push) - Mobile money
 * - M-PESA Offline - Pay later via Paybill
 * - Airtel Money
 * - Pesalink - Instant bank transfers
 * 
 * GHANA (GHS):
 * - Cards (Visa, Mastercard)
 * - MTN Mobile Money
 * - Telecel (Vodafone)
 * - Airtel Money
 * 
 * NIGERIA (NGN):
 * - Cards (Visa, Mastercard, Verve)
 * - USSD (GTBank *737#)
 * - Bank Account
 * - Pay with Transfer
 * 
 * SOUTH AFRICA (ZAR):
 * - Cards (Visa, Mastercard, Amex)
 * - EFT (Ozow)
 * - QR Code (SnapScan, Scan to Pay)
 * 
 * CÔTE D'IVOIRE (XOF):
 * - MTN Mobile Money
 * - Orange Money
 * - Wave
 * 
 * WORLDWIDE:
 * - Cards (Visa, Mastercard)
 * - Apple Pay (Safari/iOS)
 * - Google Pay (Chrome/Android) - via Payment Request API
 * 
 * Documentation: https://paystack.com/docs/payments/accept-payments/#popup
 * Payment Channels: https://paystack.com/docs/payments/payment-channels/
 */

// =============================================================================
// IMPORTS
// =============================================================================

import { authenticatedFetch } from './api/authenticatedFetch';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type PaystackCurrency = 'NGN' | 'GHS' | 'ZAR' | 'KES' | 'USD' | 'XOF';

export type MobileMoneyProvider = 
  | 'mtn'      // Ghana, Côte d'Ivoire
  | 'atl'      // Airtel Money - Ghana, Kenya
  | 'vod'      // Telecel (Vodafone) - Ghana
  | 'mpesa'    // M-PESA STK Push - Kenya
  | 'mpesa_offline' // M-PESA Paybill - Kenya
  | 'mptill'   // M-PESA Till (B2B) - Kenya
  | 'orange'   // Orange Money - Côte d'Ivoire
  | 'wave';    // Wave - Côte d'Ivoire

export type PaymentChannel = 
  | 'card'
  | 'bank'
  | 'ussd'
  | 'qr'
  | 'mobile_money'
  | 'bank_transfer'
  | 'eft'
  | 'apple_pay';

export interface CountryPaymentMethods {
  country: string;
  currency: PaystackCurrency;
  channels: PaymentChannel[];
  mobileMoneyProviders?: MobileMoneyProvider[];
}

// Available payment methods by country
export const COUNTRY_PAYMENT_METHODS: Record<string, CountryPaymentMethods> = {
  KE: {
    country: 'Kenya',
    currency: 'KES',
    channels: ['card', 'mobile_money', 'bank_transfer'],
    mobileMoneyProviders: ['mpesa', 'mpesa_offline', 'atl'],
  },
  GH: {
    country: 'Ghana',
    currency: 'GHS',
    channels: ['card', 'mobile_money'],
    mobileMoneyProviders: ['mtn', 'atl', 'vod'],
  },
  NG: {
    country: 'Nigeria',
    currency: 'NGN',
    channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    mobileMoneyProviders: [],
  },
  ZA: {
    country: 'South Africa',
    currency: 'ZAR',
    channels: ['card', 'eft', 'qr'],
    mobileMoneyProviders: [],
  },
  CI: {
    country: "Côte d'Ivoire",
    currency: 'XOF',
    channels: ['card', 'mobile_money'],
    mobileMoneyProviders: ['mtn', 'orange', 'wave'],
  },
};

// =============================================================================
// SCRIPT LOADING
// =============================================================================

// Load Paystack Inline script from CDN (V2 for Apple Pay support)
const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if PaystackPop is already loaded and is the V2 constructor (function)
    // V1 was an object, V2 is a class constructor
    if ((window as any).PaystackPop && typeof (window as any).PaystackPop === 'function') {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

// =============================================================================
// TRANSACTION INTERFACES
// =============================================================================

interface PaystackTransactionOptions {
  email: string;
  amount: number; // Actual amount in currency (e.g., 19.99)
  currency?: PaystackCurrency;
  plan?: string; // Paystack plan code (e.g., 'PLN_xxx') — creates a recurring subscription
  reference?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, any>;
  channels?: PaymentChannel[];
  onSuccess: (transaction: any) => void;
  onCancel: () => void;
  onError?: (error: any) => void;
}

interface MobileMoneyOptions {
  email: string;
  amount: number;
  currency: 'GHS' | 'KES' | 'XOF';
  phone: string;
  provider: MobileMoneyProvider;
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (transaction: any) => void;
  onPending: (displayText: string, reference: string) => void;
  onError?: (error: any) => void;
}

interface MPesaOfflineOptions {
  email: string;
  amount: number;
  phone: string;
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (paybillDetails: { accountNumber: string; accountReference: string; displayText: string }) => void;
  onError?: (error: any) => void;
}

interface PesalinkOptions {
  email: string;
  amount: number;
  accountExpiresAt?: string; // ISO 8601 format, max 25 minutes
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (transferDetails: { accountNumber: string; transactionReference: string; bankName: string }) => void;
  onError?: (error: any) => void;
}

interface USSDOptions {
  email: string;
  amount: number;
  ussdType: '737'; // GTBank
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (ussdCode: string, reference: string) => void;
  onError?: (error: any) => void;
}

interface QRCodeOptions {
  email: string;
  amount: number;
  provider?: 'scan-to-pay';
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (qrCodeData: { qrCode: string; reference: string }) => void;
  onError?: (error: any) => void;
}

interface EFTOptions {
  email: string;
  amount: number;
  provider?: 'ozow';
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (redirectUrl: string, reference: string) => void;
  onError?: (error: any) => void;
}

// =============================================================================
// CORE PAYMENT FUNCTIONS
// =============================================================================

/**
 * Initialize a payment transaction using Paystack InlineJS V2
 * @param options - Transaction configuration options
 */
export const initializePayment = async ({
  email,
  amount,
  currency = 'USD',
  plan,
  reference,
  firstName,
  lastName,
  phone,
  metadata,
  channels,
  onSuccess,
  onCancel,
  onError,
}: PaystackTransactionOptions): Promise<void> => {
  // Load Paystack script first
  const scriptLoaded = await loadPaystackScript();
  if (!scriptLoaded) {
    alert('Failed to load payment provider. Please check your internet connection.');
    onCancel();
    return;
  }
  // Get Paystack public key from environment
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    const errorMessage =
      'Paystack Public Key not found. Please configure VITE_PAYSTACK_PUBLIC_KEY in your .env file.';
    console.error(errorMessage);
    alert('Payment system configuration is missing. Please contact support.');
    onCancel();
    return;
  }

  // Warn if using Live Key on localhost
  if (publicKey.startsWith('pk_live_') && window.location.hostname === 'localhost') {
    console.warn(
      'WARNING: You are using a Paystack LIVE KEY on localhost. Payments may fail or process real money!'
    );
  }

  // Validate required parameters — amount can be 0 when plan is provided (plan amount used)
  if (!email || (!amount && !plan)) {
    const errorMessage = 'Email and amount (or plan) are required for payment initialization.';
    console.error(errorMessage);
    alert('Invalid payment parameters. Please try again.');
    onCancel();
    return;
  }

  try {
    // Use Paystack Inline (loaded from CDN via script tag)
    // The @paystack/inline-js package provides TypeScript types but we use the global PaystackPop
    const PaystackPop = (window as any).PaystackPop;

    if (!PaystackPop) {
      throw new Error('Paystack library not loaded. Please refresh the page.');
    }

    const paystack = new PaystackPop();

    const paymentOptions: any = {
      key: publicKey,
      email,
      amount: Math.round(amount * 100),
      currency,
      ref: reference || generateReference(),
      metadata: {
        ...metadata,
        custom_fields: [],
      },
      onSuccess: (transaction: any) => {
        if (import.meta.env.DEV) console.log('Payment successful:', transaction);
        onSuccess(transaction);
      },
      onCancel: () => {
        if (import.meta.env.DEV) console.log('Payment modal closed');
        onCancel();
      },
      onError: (error: any) => {
        if (import.meta.env.DEV) console.log('Payment failed:', error);
        if (onError) onError(error);
      },
    };

    // If a plan code is provided, attach it for recurring subscription creation
    if (plan) paymentOptions.plan = plan;

    if (firstName) paymentOptions.firstname = firstName;
    if (lastName) paymentOptions.lastname = lastName;
    if (phone) paymentOptions.phone = phone;
    if (channels) paymentOptions.channels = channels;

    if (import.meta.env.DEV) console.log('Initializing Paystack payment with options:', paymentOptions);
    await paystack.checkout(paymentOptions);
  } catch (error: any) {
    console.error('Failed to initialize Paystack:', error);
    alert(`Unable to start payment. Please try again. Error: ${error.message || error}`);
    onCancel();
  }
};

// =============================================================================
// PAYMENT PAGES — now using direct Paystack Payment Page URLs (no server init)
// See paystackSubscription.ts for plan → URL mapping
// =============================================================================

/**
 * Generate a unique transaction reference
 * Format: PSK_timestamp_random
 */
const generateReference = (): string => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `PSK_${timestamp}_${randomStr}`;
};

/**
 * Verify a transaction server-side via /api/paystack-verify
 * @param reference - Paystack transaction reference
 * @returns Verified transaction data, or null on failure
 */
export const verifyTransaction = async (reference: string): Promise<any | null> => {
  try {
    // Use plain fetch — this endpoint is public because users may not be
    // authenticated yet (onboarding flow: pay before signup)
    const res = await fetch(`/api/paystack-verify?reference=${encodeURIComponent(reference)}`);
    const data = await res.json();
    if (data.status && data.data?.status === 'success') {
      return data.data;
    }
    if (import.meta.env.DEV) {
      console.warn('Transaction verification failed:', data.data?.gateway_response || data.message);
    }
    return null;
  } catch (error) {
    console.error('Verification request failed:', error);
    return null;
  }
};

/**
 * Resume a transaction that was initialized on the backend
 * @param accessCode - Access code from Paystack Initialize Transaction API
 * @param onSuccess - Success callback
 * @param onCancel - Cancel callback
 */
export const resumeTransaction = (
  accessCode: string,
  onSuccess: (transaction: any) => void,
  onCancel: () => void
): void => {
  if (!accessCode) {
    console.error('Access code is required to resume transaction');
    alert('Invalid transaction. Please try again.');
    onCancel();
    return;
  }

  try {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      throw new Error('Paystack library not loaded');
    }

    const paystack = new PaystackPop();
    paystack.resumeTransaction(accessCode);

    // Note: resumeTransaction doesn't support callbacks directly
    // You'll need to handle success/failure via webhooks or redirect
  } catch (error: any) {
    console.error('Failed to resume transaction:', error);
    alert('Unable to resume payment. Please try again.');
    onCancel();
  }
};

/**
 * Check if the current device/browser supports Apple Pay
 * @returns boolean indicating Apple Pay availability
 */
export const isApplePayAvailable = (): boolean => {
  // Check if running on Safari or iOS device
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Apple Pay is available on Safari (macOS/iOS) or any iOS browser
  return isSafari || isIOS || (isMacOS && isSafari);
};

interface ApplePayCheckoutOptions {
  email: string;
  amount: number; // Actual amount in currency (e.g., 19.99)
  currency?: string;
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (transaction: any) => void;
  onCancel: () => void;
}

/**
 * Initialize payment with Apple Pay support using Paystack Checkout
 * This method shows a pre-checkout modal with Apple Pay button on Apple devices
 * and falls back to regular checkout on non-Apple devices
 *
 * @param options - Checkout configuration options
 */
export const initializeApplePayCheckout = async ({
  email,
  amount,
  currency = 'USD',
  reference,
  metadata,
  onSuccess,
  onCancel,
}: ApplePayCheckoutOptions): Promise<void> => {
  // Load Paystack script first
  const scriptLoaded = await loadPaystackScript();
  if (!scriptLoaded) {
    alert('Failed to load payment provider. Please check your internet connection.');
    onCancel();
    return;
  }

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    console.error('Paystack Public Key not found');
    alert('Payment system configuration is missing. Please contact support.');
    onCancel();
    return;
  }

  if (!email || !amount) {
    console.error('Email and amount are required');
    alert('Invalid payment parameters. Please try again.');
    onCancel();
    return;
  }

  try {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      throw new Error('Paystack library not loaded');
    }

    const paystackPop = new PaystackPop();

    // Use checkout() method which automatically shows Apple Pay on Apple devices
    await paystackPop.checkout({
      key: publicKey,
      email,
      amount: Math.round(amount * 100), // Convert to smallest currency unit
      currency,
      ref: reference || generateReference(),
      metadata: {
        ...metadata,
        custom_fields: [],
      },
      onSuccess: (transaction: any) => {
        if (import.meta.env.DEV) console.log('Payment successful:', transaction);
        onSuccess(transaction);
      },
      onCancel: () => {
        if (import.meta.env.DEV) console.log('Payment cancelled');
        onCancel();
      },
    });
  } catch (error: any) {
    console.error('Failed to initialize Apple Pay checkout:', error);
    alert('Unable to start payment. Please try again.');
    onCancel();
  }
};

interface PaymentRequestButtonOptions {
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  containerId: string; // ID of the div to mount Apple Pay button
  otherChannelsButtonId?: string; // ID of button to trigger other payment options
  metadata?: Record<string, any>;
  theme?: 'light' | 'dark';
  onSuccess: (transaction: any) => void;
  onCancel: () => void;
  onError?: (error: any) => void;
  onElementsMount?: (elements: { applePay: boolean } | null) => void;
}

/**
 * Mount an Apple Pay payment request button
 * This gives you more control over the button placement and styling
 *
 * @param options - Payment request button configuration
 */
export const mountApplePayButton = async ({
  email,
  amount,
  currency = 'USD',
  reference,
  containerId,
  otherChannelsButtonId,
  metadata,
  theme = 'dark',
  onSuccess,
  onCancel,
  onError,
  onElementsMount,
}: PaymentRequestButtonOptions): Promise<void> => {
  // Load Paystack script first
  const scriptLoaded = await loadPaystackScript();
  if (!scriptLoaded) {
    onError?.({ message: 'Failed to load payment provider' });
    return;
  }

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    onError?.({ message: 'Paystack Public Key not configured' });
    return;
  }

  try {
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      throw new Error('Paystack library not loaded');
    }

    const paystackPop = new PaystackPop();

    await paystackPop.paymentRequest({
      key: publicKey,
      email,
      amount: Math.round(amount * 100),
      currency,
      ref: reference || generateReference(),
      container: containerId,
      loadPaystackCheckoutButton: otherChannelsButtonId,
      metadata: {
        ...metadata,
        custom_fields: [],
      },
      style: {
        theme,
        applePay: {
          margin: '10px',
          padding: '12px 24px',
          width: '100%',
          borderRadius: '8px',
          type: 'buy', // 'pay', 'buy', 'donate', 'checkout', 'book', 'subscribe'
          locale: 'en',
        },
      },
      onSuccess: (response: any) => {
        if (import.meta.env.DEV) console.log('Apple Pay payment successful:', response);
        onSuccess(response);
      },
      onError: () => {
        console.error('Apple Pay payment error');
        onError?.({ message: 'Payment failed' });
      },
      onCancel: () => {
        if (import.meta.env.DEV) console.log('Apple Pay payment cancelled');
        onCancel();
      },
      onElementsMount: (elements: { applePay: boolean } | null) => {
        if (import.meta.env.DEV) console.log('Payment elements mounted:', elements);
        onElementsMount?.(elements);
      },
    });
  } catch (error: any) {
    console.error('Failed to mount Apple Pay button:', error);
    onError?.(error);
  }
};

// =============================================================================
// GOOGLE PAY DETECTION
// =============================================================================

/**
 * Check if Google Pay is available on the current device/browser
 * Google Pay works via Payment Request API on Chrome/Android
 * @returns boolean indicating Google Pay availability
 */
export const isGooglePayAvailable = (): boolean => {
  // Check for Chrome browser and Android
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // Check if Payment Request API is available
  const hasPaymentRequest = 'PaymentRequest' in window;
  
  // Google Pay is available on Chrome (desktop/mobile) and Android browsers
  return hasPaymentRequest && (isChrome || isAndroid);
};

/**
 * Detect all available digital wallets on the current device
 * @returns Object with availability of each wallet type
 */
export const detectDigitalWallets = (): { applePay: boolean; googlePay: boolean } => {
  return {
    applePay: isApplePayAvailable(),
    googlePay: isGooglePayAvailable(),
  };
};

// =============================================================================
// M-PESA PAYMENTS (KENYA)
// =============================================================================

/**
 * Backend API endpoint for Charge API calls
 * These methods require server-side integration - the secret key must NOT be in frontend
 * See: /api/paystack-charge.ts and /api/paystack-verify.ts
 */
const CHARGE_API_ENDPOINT = '/api/paystack-charge';
const VERIFY_API_ENDPOINT = '/api/paystack-verify';

/**
 * Initialize M-PESA payment via STK Push
 * Customer receives a prompt on their phone to authorize payment
 * Phone number should include country code: +254XXXXXXXXX
 * 
 * NOTE: This function calls your backend API which then calls Paystack's Charge API
 * You must implement the backend endpoint at /api/paystack/charge
 * 
 * @param options - M-PESA payment options
 */
export const initializeMPesaPayment = async ({
  email,
  amount,
  phone,
  reference,
  metadata,
  onSuccess,
  onPending,
  onError,
}: Omit<MobileMoneyOptions, 'currency' | 'provider'>): Promise<void> => {
  // Normalize phone number to include Kenya country code
  const normalizedPhone = phone.startsWith('+254') 
    ? phone 
    : phone.startsWith('0') 
      ? `+254${phone.slice(1)}`
      : `+254${phone}`;

  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'KES',
        reference: reference || generateReference(),
        metadata,
        mobile_money: {
          phone: normalizedPhone,
          provider: 'mpesa',
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'M-PESA charge failed' });
      return;
    }

    if (data.data.status === 'pay_offline') {
      // Customer needs to authorize on their phone
      onPending(data.data.display_text, data.data.reference);
    } else if (data.data.status === 'success') {
      onSuccess(data.data);
    } else {
      onError?.({ message: data.data.message || 'Unexpected response' });
    }
  } catch (error: any) {
    console.error('M-PESA payment error:', error);
    onError?.(error);
  }
};

/**
 * Initialize M-PESA Offline payment
 * Creates a Paybill account number that customer can pay to anytime
 * Useful for pay-after-service scenarios
 * 
 * NOTE: Requires backend integration at /api/paystack/charge
 * 
 * @param options - M-PESA offline payment options
 */
export const initializeMPesaOfflinePayment = async ({
  email,
  amount,
  phone,
  reference,
  metadata,
  onSuccess,
  onError,
}: MPesaOfflineOptions): Promise<void> => {
  const normalizedPhone = phone.startsWith('+254') 
    ? phone 
    : phone.startsWith('0') 
      ? `+254${phone.slice(1)}`
      : `+254${phone}`;

  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'KES',
        reference: reference || generateReference(),
        metadata,
        mobile_money: {
          phone: normalizedPhone,
          provider: 'mpesa_offline',
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'M-PESA Offline charge failed' });
      return;
    }

    // Return the Paybill details for customer to use
    onSuccess({
      accountNumber: data.data.account_number,
      accountReference: data.data.account_reference,
      displayText: data.data.display_text,
    });
  } catch (error: any) {
    console.error('M-PESA Offline payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// MOBILE MONEY PAYMENTS (GHANA, CÔTE D'IVOIRE, KENYA)
// =============================================================================

/**
 * Initialize Mobile Money payment for any supported provider
 * Supported providers:
 * - MTN (Ghana, Côte d'Ivoire)
 * - Airtel/ATMoney (Ghana, Kenya)
 * - Telecel/Vodafone (Ghana)
 * - Orange (Côte d'Ivoire)
 * - Wave (Côte d'Ivoire)
 * 
 * @param options - Mobile money payment options
 */
export const initializeMobileMoneyPayment = async ({
  email,
  amount,
  currency,
  phone,
  provider,
  reference,
  metadata,
  onSuccess,
  onPending,
  onError,
}: MobileMoneyOptions): Promise<void> => {
  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency,
        reference: reference || generateReference(),
        metadata,
        mobile_money: {
          phone,
          provider,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'Mobile money charge failed' });
      return;
    }

    if (data.data.status === 'pay_offline') {
      onPending(data.data.display_text, data.data.reference);
    } else if (data.data.status === 'success') {
      onSuccess(data.data);
    } else {
      onError?.({ message: data.data.message || 'Unexpected response' });
    }
  } catch (error: any) {
    console.error('Mobile money payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// PESALINK BANK TRANSFERS (KENYA)
// =============================================================================

/**
 * Initialize Pesalink instant bank transfer for Kenya
 * Customer receives account details to make an instant transfer
 * Account is valid for 25 minutes
 * 
 * @param options - Pesalink payment options
 */
export const initializePesalinkPayment = async ({
  email,
  amount,
  accountExpiresAt,
  reference,
  metadata,
  onSuccess,
  onError,
}: PesalinkOptions): Promise<void> => {
  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'KES',
        reference: reference || generateReference(),
        metadata,
        bank_transfer: {
          account_expires_at: accountExpiresAt || null, // null defaults to 25 minutes
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'Pesalink charge failed' });
      return;
    }

    onSuccess({
      accountNumber: data.data.account_number,
      transactionReference: data.data.transaction_reference,
      bankName: data.data.bank_name || 'Pesalink',
    });
  } catch (error: any) {
    console.error('Pesalink payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// USSD PAYMENTS (NIGERIA)
// =============================================================================

/**
 * Initialize USSD payment for Nigeria
 * Returns a USSD code that the customer dials to complete payment
 * Currently supports GTBank (*737#)
 * 
 * @param options - USSD payment options
 */
export const initializeUSSDPayment = async ({
  email,
  amount,
  ussdType = '737',
  reference,
  metadata,
  onSuccess,
  onError,
}: USSDOptions): Promise<void> => {
  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'NGN',
        reference: reference || generateReference(),
        metadata,
        ussd: {
          type: ussdType,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'USSD charge failed' });
      return;
    }

    // Return the USSD code for customer to dial
    onSuccess(data.data.ussd_code, data.data.reference);
  } catch (error: any) {
    console.error('USSD payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// QR CODE PAYMENTS (SOUTH AFRICA)
// =============================================================================

/**
 * Initialize QR Code payment for South Africa
 * Works with SnapScan and Scan to Pay enabled apps
 * 
 * @param options - QR Code payment options
 */
export const initializeQRCodePayment = async ({
  email,
  amount,
  provider = 'scan-to-pay',
  reference,
  metadata,
  onSuccess,
  onError,
}: QRCodeOptions): Promise<void> => {
  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'ZAR',
        reference: reference || generateReference(),
        metadata,
        qr: {
          provider,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'QR Code charge failed' });
      return;
    }

    onSuccess({
      qrCode: data.data.qr_code,
      reference: data.data.reference,
    });
  } catch (error: any) {
    console.error('QR Code payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// EFT PAYMENTS (SOUTH AFRICA)
// =============================================================================

/**
 * Initialize EFT (Electronic Funds Transfer) payment for South Africa
 * Redirects customer to their bank's internet banking portal via Ozow
 * 
 * @param options - EFT payment options
 */
export const initializeEFTPayment = async ({
  email,
  amount,
  provider = 'ozow',
  reference,
  metadata,
  onSuccess,
  onError,
}: EFTOptions): Promise<void> => {
  try {
    const response = await authenticatedFetch(CHARGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'ZAR',
        reference: reference || generateReference(),
        metadata,
        eft: {
          provider,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      onError?.({ message: data.message || 'EFT charge failed' });
      return;
    }

    // Return the redirect URL for Ozow
    onSuccess(data.data.authorization_url, data.data.reference);
  } catch (error: any) {
    console.error('EFT payment error:', error);
    onError?.(error);
  }
};

// =============================================================================
// PAYMENT CHANNEL DETECTION & UTILITIES
// =============================================================================

/**
 * Get available payment methods for a given country
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'KE', 'NG', 'GH')
 * @returns Available payment methods for the country
 */
export const getPaymentMethodsForCountry = (countryCode: string): CountryPaymentMethods | null => {
  return COUNTRY_PAYMENT_METHODS[countryCode.toUpperCase()] || null;
};

/**
 * Detect the user's country based on various signals
 * Uses timezone and locale as hints
 * @returns Detected country code or null
 */
export const detectUserCountry = (): string | null => {
  try {
    // Try to get country from timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const timezoneToCountry: Record<string, string> = {
      'Africa/Nairobi': 'KE',
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'Africa/Johannesburg': 'ZA',
      'Africa/Abidjan': 'CI',
    };

    if (timezone in timezoneToCountry) {
      return timezoneToCountry[timezone];
    }

    // Try to get from browser language
    const language = navigator.language || (navigator as any).userLanguage;
    if (language) {
      const parts = language.split('-');
      if (parts.length > 1) {
        return parts[1].toUpperCase();
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Get all available payment options for the current user
 * Combines country detection with device capabilities
 * @param countryCode - Optional country code override
 * @returns Object with all available payment options
 */
export const getAvailablePaymentOptions = (countryCode?: string): {
  country: CountryPaymentMethods | null;
  wallets: { applePay: boolean; googlePay: boolean };
  detectedCountry: string | null;
} => {
  const detectedCountry = countryCode || detectUserCountry();
  const country = detectedCountry ? getPaymentMethodsForCountry(detectedCountry) : null;
  const wallets = detectDigitalWallets();

  return {
    country,
    wallets,
    detectedCountry,
  };
};

/**
 * Get recommended payment channels for Paystack checkout
 * Returns an array of channel strings to pass to the channels parameter
 * @param countryCode - Country code
 * @param includeWallets - Whether to include digital wallets
 * @returns Array of payment channel strings
 */
export const getRecommendedChannels = (
  countryCode: string,
  includeWallets: boolean = true
): PaymentChannel[] => {
  const countryMethods = getPaymentMethodsForCountry(countryCode);
  
  if (!countryMethods) {
    // Default to card payments
    return ['card'];
  }

  const channels: PaymentChannel[] = [...countryMethods.channels];

  if (includeWallets) {
    const wallets = detectDigitalWallets();
    if (wallets.applePay) {
      channels.push('apple_pay');
    }
  }

  return channels;
};
