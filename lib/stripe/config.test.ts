import assert from 'node:assert/strict';
import {
  getStemmePlusAppBaseUrl,
  getStripeRuntimeConfig,
  STEMME_PLUS_DEFAULT_APP_BASE_URL,
} from './config';

const keys = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_STEMME_PLUS_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
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

assert.equal(getStemmePlusAppBaseUrl(undefined), STEMME_PLUS_DEFAULT_APP_BASE_URL);
assert.equal(getStemmePlusAppBaseUrl(''), STEMME_PLUS_DEFAULT_APP_BASE_URL);
assert.equal(getStemmePlusAppBaseUrl('not-a-url'), STEMME_PLUS_DEFAULT_APP_BASE_URL);
assert.equal(getStemmePlusAppBaseUrl('ftp://example.com'), STEMME_PLUS_DEFAULT_APP_BASE_URL);
assert.equal(
  getStemmePlusAppBaseUrl('https://www.folkets-stemme.no'),
  'https://www.folkets-stemme.no',
);
assert.equal(
  getStemmePlusAppBaseUrl('https://www.folkets-stemme.no/'),
  'https://www.folkets-stemme.no',
);
assert.equal(
  getStemmePlusAppBaseUrl('https://preview.example.com/path'),
  'https://preview.example.com',
);

for (const key of keys) {
  const value = previous[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

console.log('stripe/config.test.ts: ok');
