/**
 * Paystack Payment Service
 * Uses Paystack Inline JS (loaded from CDN)
 * Documentation: https://paystack.com/docs/payments/accept-payments/#popup
 * Apple Pay: https://paystack.com/docs/payments/apple-pay/
 */

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

    const paystack = new PaystackPop();

    const paymentOptions: any = {
      key: publicKey,
      email,
      amount: Math.round(amount * 100),
      currency,
      ref: reference || generateReference(),
      metadata: {
        ...metadata,
        custom_fields: []
      },
      onSuccess: (transaction: any) => {
        console.log('Payment successful:', transaction);
        onSuccess(transaction);
      },
      onCancel: () => {
        console.log('Payment modal closed');
        onCancel();
      },
      onError: (error: any) => {
        console.log('Payment failed:', error);
        if (onError) onError(error);
      }
    };

    if (firstName) paymentOptions.firstname = firstName;
    if (lastName) paymentOptions.lastname = lastName;
    if (phone) paymentOptions.phone = phone;
    if (channels) paymentOptions.channels = channels;

    console.log('Initializing Paystack payment with options:', paymentOptions);
    await paystack.checkout(paymentOptions);
  } catch (error: any) {
    console.error('Failed to initialize Paystack:', error);
    alert(`Unable to start payment. Please try again. Error: ${error.message || error}`);
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
  onCancel
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
        custom_fields: []
      },
      onSuccess: (transaction: any) => {
        console.log('Payment successful:', transaction);
        onSuccess(transaction);
      },
      onCancel: () => {
        console.log('Payment cancelled');
        onCancel();
      }
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
  onElementsMount
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
        custom_fields: []
      },
      style: {
        theme,
        applePay: {
          margin: '10px',
          padding: '12px 24px',
          width: '100%',
          borderRadius: '8px',
          type: 'buy', // 'pay', 'buy', 'donate', 'checkout', 'book', 'subscribe'
          locale: 'en'
        }
      },
      onSuccess: (response: any) => {
        console.log('Apple Pay payment successful:', response);
        onSuccess(response);
      },
      onError: () => {
        console.error('Apple Pay payment error');
        onError?.({ message: 'Payment failed' });
      },
      onCancel: () => {
        console.log('Apple Pay payment cancelled');
        onCancel();
      },
      onElementsMount: (elements: { applePay: boolean } | null) => {
        console.log('Payment elements mounted:', elements);
        onElementsMount?.(elements);
      }
    });
  } catch (error: any) {
    console.error('Failed to mount Apple Pay button:', error);
    onError?.(error);
  }
};
