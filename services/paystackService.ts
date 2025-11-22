
// Declare process for Vite build compatibility
declare const process: { env: { PAYSTACK_PUBLIC_KEY: string } };

export const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const scriptId = 'paystack-script';
    if (document.getElementById(scriptId)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface PaystackProps {
  email: string;
  amount: number; // Actual amount (e.g. 19.99)
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

  const handler = (window as any).PaystackPop.setup({
    key: publicKey,
    email,
    amount: Math.round(amount * 100), // Convert to lowest currency unit (cents/kobo)
    currency,
    ref: '' + Math.floor((Math.random() * 1000000000) + 1),
    callback: function(response: any) {
      onSuccess(response);
    },
    onClose: function() {
      onClose();
    },
  });

  handler.openIframe();
};
