import assert from 'node:assert/strict';
import {
  canUseRealtimeAlerts,
  clampNotificationFrequencyForTier,
  digestItemLimit,
} from './gates';

const plus = {
  subscription_tier: 'stemme_plus',
  subscription_status: 'active',
  subscription_period_end: '2099-01-01T00:00:00.000Z',
};

const free = { subscription_tier: 'free' };

assert.equal(canUseRealtimeAlerts(plus), true);
assert.equal(canUseRealtimeAlerts(free), false);
assert.equal(digestItemLimit(plus), 50);
assert.equal(digestItemLimit(free), 5);
assert.equal(clampNotificationFrequencyForTier('realtime', free), 'daily');
assert.equal(clampNotificationFrequencyForTier('realtime', plus), 'realtime');

console.log('stemme-plus/gates.test.ts: ok');
