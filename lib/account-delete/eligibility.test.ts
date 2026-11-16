import assert from 'node:assert/strict';
import { stemmePlusBlockMessageWithPeriodEnd } from '@/lib/account-delete/constants';
import {
  evaluateLastAdminDeleteBlock,
  evaluateStemmePlusDeleteBlock,
  formatSubscriptionPeriodEndNb,
  mergeDeleteEligibility,
} from '@/lib/account-delete/eligibility';

assert.match(stemmePlusBlockMessageWithPeriodEnd('1. desember 2026'), /1\. desember 2026/);

const blockedActive = evaluateStemmePlusDeleteBlock(
  {
    subscription_tier: 'stemme_plus',
    subscription_status: 'active',
    subscription_period_end: '2026-12-01T12:00:00.000Z',
  },
  new Date('2026-11-01T00:00:00.000Z'),
);
assert.equal(blockedActive.allowed, false);
assert.equal(blockedActive.reason, 'stemme_plus');
assert.ok(blockedActive.message?.includes('Du kan slette kontoen etter'));

const ended = evaluateStemmePlusDeleteBlock(
  {
    subscription_tier: 'stemme_plus',
    subscription_status: 'active',
    subscription_period_end: '2026-10-01T12:00:00.000Z',
  },
  new Date('2026-11-01T00:00:00.000Z'),
);
assert.equal(ended.allowed, true);

const canceled = evaluateStemmePlusDeleteBlock({
  subscription_tier: 'stemme_plus',
  subscription_status: 'canceled',
  subscription_period_end: '2099-01-01T12:00:00.000Z',
});
assert.equal(canceled.allowed, true);

assert.equal(evaluateLastAdminDeleteBlock(true).allowed, false);
assert.equal(evaluateLastAdminDeleteBlock(false).allowed, true);

const merged = mergeDeleteEligibility([
  { allowed: true },
  evaluateLastAdminDeleteBlock(true),
]);
assert.equal(merged.allowed, false);
assert.equal(merged.reason, 'last_admin');

const formatted = formatSubscriptionPeriodEndNb('2026-06-15T10:00:00.000Z');
assert.ok(formatted);

console.log('lib/account-delete/eligibility.test.ts: ok');