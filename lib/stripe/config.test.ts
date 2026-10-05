import assert from 'node:assert/strict';
import { getStripeRuntimeConfig } from './config';

const keys = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_STEMME_PLUS_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const;

const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

for (const key of keys) {
  delete process.env[key];
}

assert.equal(getStripeRuntimeConfig().checkoutConfigured, false);

process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_STEMME_PLUS_PRICE_ID = 'price_123';
assert.equal(getStripeRuntimeConfig().checkoutConfigured, true);
assert.equal(getStripeRuntimeConfig().webhookConfigured, false);

for (const key of keys) {
  const value = previous[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

console.log('stripe/config.test.ts: ok');
