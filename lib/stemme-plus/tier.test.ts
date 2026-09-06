import assert from 'node:assert/strict';
import { isStemmePlusActive, parseSubscriptionTier } from './tier';

assert.equal(parseSubscriptionTier('stemme_plus'), 'stemme_plus');
assert.equal(parseSubscriptionTier('free'), 'free');
assert.equal(parseSubscriptionTier(null), 'free');

assert.equal(
  isStemmePlusActive({
    subscription_tier: 'stemme_plus',
    subscription_status: 'active',
    subscription_period_end: '2099-01-01T00:00:00.000Z',
  }),
  true,
);

assert.equal(
  isStemmePlusActive({
    subscription_tier: 'stemme_plus',
    subscription_status: 'canceled',
  }),
  false,
);

assert.equal(
  isStemmePlusActive({
    subscription_tier: 'stemme_plus',
    subscription_status: 'active',
    subscription_period_end: '2020-01-01T00:00:00.000Z',
  }),
  false,
);

console.log('stemme-plus/tier.test.ts: ok');
