
// Declare process for Vite build compatibility
declare const process: { env: { PAYSTACK_PUBLIC_KEY: string } };

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
  currency?: string;
  onSuccess: (reference: any) => void;
  onClose: () => void;
}

export const initializePayment = async ({ email, amount, currency = 'USD', onSuccess, onClose }: PaystackProps) => {
  const isScriptLoaded = await loadPaystackScript();
  if (!isScriptLoaded) {
    alert('Failed to load payment provider. Please check your internet connection.');
    onClose();
    return;
  }

  // Use provided env key or a placeholder for development safety
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || ''; 
  
  if (!publicKey) {
      console.warn("Paystack Public Key not found in environment variables (PAYSTACK_PUBLIC_KEY).");
      alert("Payment system configuration is missing. Please check console.");
      onClose();
      return;
  }

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
  }
};
