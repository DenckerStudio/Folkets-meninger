import assert from 'node:assert/strict';
import {
  isStripeSubscriptionEntitled,
  resolveSubscriptionPeriodEndUnix,
  resolveSubscriptionTierPatch,
  shouldRevokeStemmePlusTier,
} from './subscription';

assert.equal(isStripeSubscriptionEntitled('active'), true);
assert.equal(isStripeSubscriptionEntitled('trialing'), true);
assert.equal(isStripeSubscriptionEntitled('incomplete'), false);
assert.equal(isStripeSubscriptionEntitled('canceled'), false);

assert.equal(shouldRevokeStemmePlusTier('canceled'), true);
assert.equal(shouldRevokeStemmePlusTier('unpaid'), true);
assert.equal(shouldRevokeStemmePlusTier('incomplete_expired'), true);
assert.equal(shouldRevokeStemmePlusTier('incomplete'), false);
assert.equal(shouldRevokeStemmePlusTier('past_due'), false);
assert.equal(shouldRevokeStemmePlusTier('active'), false);

assert.deepEqual(resolveSubscriptionTierPatch('active'), { subscription_tier: 'stemme_plus' });
assert.deepEqual(resolveSubscriptionTierPatch('trialing'), { subscription_tier: 'stemme_plus' });
assert.deepEqual(resolveSubscriptionTierPatch('canceled'), { subscription_tier: 'free' });
assert.deepEqual(resolveSubscriptionTierPatch('incomplete'), {});
assert.deepEqual(resolveSubscriptionTierPatch('past_due'), {});

assert.equal(
  resolveSubscriptionPeriodEndUnix({
    current_period_end: 1_700_000_000,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  } as never),
  1_700_000_000,
);
assert.equal(
  resolveSubscriptionPeriodEndUnix({
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  } as never),
  1_800_000_000,
);
assert.equal(
  resolveSubscriptionPeriodEndUnix({ items: { data: [] } } as never),
  null,
);

console.log('stripe/subscription.test.ts: ok');
