/**
 * Paystack Payment Service
 * Uses Paystack Inline JS (loaded from CDN)
 * Documentation: https://paystack.com/docs/payments/accept-payments/#popup
 */

// Load Paystack Inline script from CDN
const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).PaystackPop) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

interface PaystackTransactionOptions {
  email: string;
  amount: number; // Actual amount in currency (e.g., 19.99)
  currency?: string;
  reference?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, any>;
  channels?: string[];
  onSuccess: (transaction: any) => void;
  onCancel: () => void;
  onError?: (error: any) => void;
}

/**
 * Initialize a payment transaction using Paystack InlineJS V2
 * @param options - Transaction configuration options
 */
export const initializePayment = async ({
  email,
  amount,
  currency = 'USD',
  reference,
  firstName,
  lastName,
  phone,
  metadata,
  channels,
  onSuccess,
  onCancel,
  onError
}: PaystackTransactionOptions): Promise<void> => {
  // Load Paystack script first
  const scriptLoaded = await loadPaystackScript();
  if (!scriptLoaded) {
    alert('Failed to load payment provider. Please check your internet connection.');
    onCancel();
    return;
  }
  // Get Paystack public key from environment
  // Get Paystack public key from environment
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    const errorMessage = 'Paystack Public Key not found. Please configure VITE_PAYSTACK_PUBLIC_KEY in your .env file.';
    console.error(errorMessage);
    alert('Payment system configuration is missing. Please contact support.');
    onCancel();
    return;
  }

  // Warn if using Live Key on localhost
  if (publicKey.startsWith('pk_live_') && window.location.hostname === 'localhost') {
    console.warn('WARNING: You are using a Paystack LIVE KEY on localhost. Payments may fail or process real money!');
  }

  // Validate required parameters
  if (!email || !amount) {
    const errorMessage = 'Email and amount are required for payment initialization.';
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

    const handler = PaystackPop.setup({
      key: publicKey,
      email,
      amount: Math.round(amount * 100), // Convert to kobo/cents (smallest currency unit)
      currency,
      ref: reference || generateReference(),
      firstname: firstName,
      lastname: lastName,
      phone,
      metadata: {
        ...metadata,
        custom_fields: []
      },
      channels: channels || ['card', 'bank', 'ussd', 'qr', 'bank_transfer'],

      // Success callback - called when payment is successful
      callback: (response: any) => {
        console.log('Payment successful:', response);
        onSuccess(response);
      },

      // Close callback - called when user closes the payment modal
      onClose: () => {
        console.log('Payment modal closed');
        onCancel();
      }
    });

    handler.openIframe();
  } catch (error: any) {
    console.error('Failed to initialize Paystack:', error);
    alert('Unable to start payment. Please try again.');
    onCancel();
  }
};

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

    PaystackPop.resumeTransaction(accessCode);

    // Note: resumeTransaction doesn't support callbacks directly
    // You'll need to handle success/failure via webhooks or redirect
  } catch (error: any) {
    console.error('Failed to resume transaction:', error);
    alert('Unable to resume payment. Please try again.');
    onCancel();
  }
};
