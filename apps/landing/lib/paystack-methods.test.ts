import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCheckoutCountry,
  getCountryDisplayName,
  normalizeCountryCode,
} from './paystack/country';
import {
  getDefaultPaystackMethodRules,
  getPaystackChannelsForCountry,
  getPaystackMethodsForCountry,
  selectPreferredPaystackMethod,
} from './paystack/payment-methods';

test('detectCheckoutCountry prefers manual selection over profile and headers', () => {
  assert.equal(
    detectCheckoutCountry({
      manualCountry: 'ke',
      profileCountry: 'ng',
      billingCountry: 'za',
      shippingCountry: 'gh',
      headerCountry: 'us',
    }),
    'KE'
  );
});

test('detectCheckoutCountry falls back through profile, billing, shipping, then headers', () => {
  assert.equal(
    detectCheckoutCountry({
      profileCountry: 'gh',
      billingCountry: 'za',
      shippingCountry: 'ke',
      headerCountry: 'ng',
    }),
    'GH'
  );
});

test('normalizeCountryCode rejects invalid or global markers', () => {
  assert.equal(normalizeCountryCode('*'), null);
  assert.equal(normalizeCountryCode('global'), null);
  assert.equal(normalizeCountryCode('not-a-country'), null);
});

test('country-aware Paystack methods always include card as fallback', () => {
  const methods = getPaystackMethodsForCountry('NG', getDefaultPaystackMethodRules());
  assert.ok(methods.some((method) => method.methodKey === 'card'));
  assert.ok(methods.some((method) => method.methodKey === 'bank_transfer'));
  assert.ok(getPaystackChannelsForCountry('NG', getDefaultPaystackMethodRules()).includes('card'));
});

test('unsupported markets fall back to card only', () => {
  const methods = getPaystackMethodsForCountry('JP', getDefaultPaystackMethodRules());
  assert.deepEqual(
    methods.map((method) => method.methodKey),
    ['card']
  );
});

test('preferred method is selected when available', () => {
  const selection = selectPreferredPaystackMethod('ZA', getDefaultPaystackMethodRules(), 'qr');
  assert.equal(selection.selectedMethodKey, 'qr');
});

test('country display names remain readable', () => {
  assert.equal(getCountryDisplayName('NG'), 'Nigeria');
});

