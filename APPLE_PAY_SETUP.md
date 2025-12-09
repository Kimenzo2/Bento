# 🍎 Apple Pay Integration: Monetize Your Empire

> *Seamless payments for a seamless experience.*

## Overview

Genesis integrates **Apple Pay** via Paystack to provide a frictionless checkout experience for your users. This allows users on iOS and macOS devices to subscribe to your **Creator**, **Studio**, or **Empire** tiers with a single touch.

---

## 🛠️ Configuration Steps

### 1. Paystack Dashboard Setup
To enable Apple Pay, you must first activate it in your payment processor settings.

1. Log in to your [Paystack Dashboard](https://dashboard.paystack.com).
2. Navigate to **Settings > Preferences**.
3. Under **Payment Channels**, ensure **Apple Pay** is checked.
4. Save your changes.

### 2. Domain Verification
Apple requires you to verify that you own the domain where Apple Pay will be used.

1. In Paystack, go to **Settings > Apple Pay**.
2. Download the **Domain Verification File**.
3. Upload this file to your server at: `https://your-domain.com/.well-known/apple-developer-merchantid-domain-association`.
4. Click **Verify** in the Paystack dashboard.

### 3. Codebase Integration
Genesis comes pre-wired for Apple Pay.

- **Service File**: `services/paystackService.ts`
- **Implementation**: Uses Paystack Inline JS v2 (`https://js.paystack.co/v2/inline.js`).
- **Trigger**: The `initializeApplePayCheckout` function automatically detects Apple Pay availability.

```typescript
// Example usage in PricingPage.tsx
if (isApplePayAvailable()) {
  await initializeApplePayCheckout({
    email: user.email,
    amount: plan.price,
    // ...
  });
}
```

---

## 🧪 Testing

1. Use a compatible device (iPhone with FaceID/TouchID or Mac with TouchID).
2. Use the **Safari** browser.
3. Ensure you are in **Test Mode** in Paystack if developing locally.
4. Click "Upgrade" on a plan. The native Apple Pay sheet should slide up.

---

*Unlock the revenue stream of the future.*
