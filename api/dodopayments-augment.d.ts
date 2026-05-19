declare module 'dodopayments' {
  interface CheckoutSessionCreateParams {
    cancel_url?: string | null;
  }
}

declare module 'dodopayments/resources/checkout-sessions' {
  interface CheckoutSessionCreateParams {
    cancel_url?: string | null;
  }
}