import Paystack from '@paystack/inline-js';

/**
 * Paystack Payment Service
 * Uses Paystack InlineJS V2 for secure payment processing
 * Documentation: https://paystack.com/docs/developer-tools/inlinejs/
 */

<<<<<<< HEAD
interface PaystackTransactionOptions {
  email: string;
  amount: number; // Actual amount in currency (e.g., 19.99)
=======
export const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const scriptId = 'paystack-script-v2';
    if (document.getElementById(scriptId)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    // Upgrade to Paystack Inline JS V2
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => {
        console.log("Paystack V2 script loaded");
        resolve(true);
    };
    script.onerror = () => {
        console.error("Paystack V2 script failed to load");
        resolve(false);
    };
    document.body.appendChild(script);
  });
};

interface PaystackProps {
  email: string;
  amount: number; // Actual amount in dollars (e.g. 19.99)
>>>>>>> e187479d90b97d414132047e5f47540a1dbee875
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
export const initializePayment = ({
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
}: PaystackTransactionOptions): void => {
  // Get Paystack public key from environment
  // Support both VITE_ prefix (standard) and process.env polyfill (legacy)
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY;

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

<<<<<<< HEAD
  // Validate required parameters
  if (!email || !amount) {
    const errorMessage = 'Email and amount are required for payment initialization.';
    console.error(errorMessage);
    alert('Invalid payment parameters. Please try again.');
    onCancel();
    return;
  }

  try {
    // Create new Paystack instance
    const popup = new Paystack();

    // Initialize transaction using official Paystack InlineJS V2 API
    popup.newTransaction({
      key: publicKey,
      email,
      amount: Math.round(amount * 100), // Convert to kobo/cents (smallest currency unit)
      currency,
      ref: reference || generateReference(),
      firstName,
      lastName,
      phone,
      metadata: {
        ...metadata,
        custom_fields: []
      },
      channels: channels || ['card', 'bank', 'ussd', 'qr', 'bank_transfer'],

      // Success callback - called when payment is successful
      onSuccess: (transaction) => {
        console.log('Payment successful:', transaction);
        onSuccess(transaction);
      },

      // Load callback - called when checkout is loaded
      onLoad: (response) => {
        console.log('Paystack checkout loaded:', response);
      },

      // Cancel callback - called when user closes the payment modal
      onCancel: () => {
        console.log('Payment cancelled by user');
        onCancel();
      },

      // Error callback - called when an error occurs
      onError: (error) => {
        console.error('Payment error:', error);
        if (onError) {
          onError(error);
        } else {
          alert(`Payment error: ${error.message || 'An error occurred during payment processing'}`);
          onCancel();
        }
      }
    });
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
    const popup = new Paystack();
    popup.resumeTransaction(accessCode);

    // Note: resumeTransaction doesn't support callbacks directly
    // You'll need to handle success/failure via webhooks or redirect
  } catch (error: any) {
    console.error('Failed to resume transaction:', error);
    alert('Unable to resume payment. Please try again.');
    onCancel();
=======
  try {
      // @ts-ignore - PaystackPop is available globally from the V2 script
      const paystack = new window.PaystackPop();
      
      paystack.newTransaction({
        key: publicKey,
        email: email,
        amount: Math.round(amount * 100), // Convert to lowest currency unit (e.g. cents)
        currency: currency,
        onSuccess: (transaction: any) => {
          onSuccess(transaction);
        },
        onCancel: () => {
          onClose();
        },
        onError: (error: any) => {
          console.error("Paystack transaction error:", error);
          onClose();
        }
      });
  } catch (error) {
      console.error("Error initializing Paystack V2:", error);
      onClose();
>>>>>>> e187479d90b97d414132047e5f47540a1dbee875
  }
};
