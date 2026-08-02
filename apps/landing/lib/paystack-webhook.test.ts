// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  SUPPORTED_PAYSTACK_EVENTS,
  buildBillingUpdate,
  isSupportedPaystackEvent,
  normalizeEventName,
  verifyPaystackSignature,
} from './paystack-webhook';

const OFFICIAL_PAYSTACK_WEBHOOK_EVENTS = [
  'charge.dispute.create',
  'charge.dispute.remind',
  'charge.dispute.resolve',
  'charge.success',
  'customeridentification.failed',
  'customeridentification.success',
  'dedicatedaccount.assign.failed',
  'dedicatedaccount.assign.success',
  'invoice.create',
  'invoice.payment_failed',
  'invoice.update',
  'paymentrequest.pending',
  'paymentrequest.success',
  'refund.failed',
  'refund.pending',
  'refund.processed',
  'refund.processing',
  'subscription.create',
  'subscription.disable',
  'subscription.expiring_cards',
  'subscription.not_renew',
  'transfer.failed',
  'transfer.reversed',
  'transfer.success',
] as const;

test('verifyPaystackSignature accepts a valid signature', () => {
  const rawBody = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: 'TRX_123',
      amount: 1900,
      currency: 'NGN',
      metadata: {
        subscription_plan_code: 'pro_monthly',
        billing_period: 'monthly',
        customer_email: 'user@example.com',
      },
    },
  });
  const secret = 'whsec_test_secret';
  const signature = createHmac('sha512', secret).update(rawBody).digest('hex');

  assert.equal(verifyPaystackSignature(rawBody, signature, secret), true);
  assert.equal(verifyPaystackSignature(rawBody, 'deadbeef', secret), false);
});

test('normalizeEventName lowercases Paystack event names', () => {
  assert.equal(normalizeEventName('Charge.Success'), 'charge.success');
});

test('supported Paystack webhook events match the official documentation list', () => {
  assert.deepEqual(
    [...SUPPORTED_PAYSTACK_EVENTS].sort(),
    [...OFFICIAL_PAYSTACK_WEBHOOK_EVENTS].sort()
  );
  for (const eventName of OFFICIAL_PAYSTACK_WEBHOOK_EVENTS) {
    assert.equal(isSupportedPaystackEvent(eventName), true, eventName);
  }
  assert.equal(isSupportedPaystackEvent('made.up.event'), false);
});

test('buildBillingUpdate maps recurring success events', () => {
  const update = buildBillingUpdate({
    event: 'charge.success',
    data: {
      id: 'trx_123',
      reference: 'TRX_123',
      amount: 1900,
      currency: 'ngn',
      paid_at: '2026-06-25T10:00:00.000Z',
      metadata: {
        customer_email: 'user@example.com',
        billing_period: 'monthly',
        subscription_plan_code: 'pro_monthly',
      },
      customer: {
        email: 'user@example.com',
        customer_code: 'CUS_123',
      },
      subscription: {
        subscription_code: 'SUB_123',
        next_payment_date: '2026-07-25T10:00:00.000Z',
      },
    },
  });

  assert.ok(update);
  assert.equal(update?.billingStatus, 'active');
  assert.equal(update?.paymentStatus, 'succeeded');
  assert.equal(update?.planCode, 'pro_monthly');
  assert.equal(update?.billingPeriod, 'monthly');
  assert.equal(update?.paystackCustomerCode, 'CUS_123');
});

test('buildBillingUpdate handles paymentrequest.success as a billing event', () => {
  const update = buildBillingUpdate({
    event: 'paymentrequest.success',
    data: {
      id: 'prq_123',
      reference: 'PRQ_123',
      amount: 1900,
      currency: 'NGN',
      metadata: {
        customer_email: 'user@example.com',
        billing_period: 'monthly',
        subscription_plan_code: 'pro_monthly',
      },
      customer: {
        email: 'user@example.com',
        customer_code: 'CUS_123',
      },
    },
  });

  assert.ok(update);
  assert.equal(update?.paymentStatus, 'succeeded');
  assert.equal(update?.billingStatus, 'active');
  assert.equal(update?.planCode, 'pro_monthly');
});

test('buildBillingUpdate ignores unsupported webhook events safely', () => {
  assert.equal(
    buildBillingUpdate({
      event: 'wallet.balance.changed',
      data: {
        id: 'evt_123',
      },
    }),
    null
  );
});

test('buildBillingUpdate treats audit-only events as non-billing updates', () => {
  const update = buildBillingUpdate({
    event: 'transfer.success',
    data: {
      id: 'trf_123',
      reference: 'TRF_123',
      amount: 1900,
      currency: 'NGN',
      customer: {
        email: 'user@example.com',
        customer_code: 'CUS_123',
      },
    },
  });

  assert.ok(update);
  assert.equal(update?.paymentStatus, 'ignored');
  assert.equal(update?.billingStatus, 'free');
});

test('buildBillingUpdate marks failed invoices as past due or expired', () => {
  const update = buildBillingUpdate({
    event: 'invoice.payment_failed',
    data: {
      id: 'inv_123',
      reference: 'INV_123',
      amount: 1900,
      currency: 'NGN',
      metadata: {
        customer_email: 'user@example.com',
        billing_period: 'yearly',
        subscription_plan_code: 'power_yearly',
      },
      customer: {
        email: 'user@example.com',
        customer_code: 'CUS_123',
      },
      subscription: {
        subscription_code: 'SUB_123',
        next_payment_date: '2026-07-25T10:00:00.000Z',
      },
    },
  });

  assert.ok(update);
  assert.equal(update?.paymentStatus, 'failed');
  assert.equal(update?.billingStatus, 'past_due');
  assert.equal(update?.billingPeriod, 'yearly');
});
