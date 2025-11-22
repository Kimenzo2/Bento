import Paystack from '@paystack/inline-js';

/**
 * Paystack Payment Service
 * Uses Paystack InlineJS V2 for secure payment processing
 * Documentation: https://paystack.com/docs/developer-tools/inlinejs/
 */

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
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    const errorMessage = 'Paystack Public Key not found. Please configure VITE_PAYSTACK_PUBLIC_KEY in your .env file.';
    console.error(errorMessage);
    alert('Payment system configuration is missing. Please contact support.');
    onCancel();
    return;
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
  }
};
