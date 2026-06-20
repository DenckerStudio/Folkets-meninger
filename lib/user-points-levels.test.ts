import assert from 'node:assert/strict';
import { getUserPointTier, getUserPointsProgress } from './user-points-levels';

assert.equal(getUserPointTier(0).id, 'new');
assert.equal(getUserPointTier(249).id, 'new');
assert.equal(getUserPointTier(250).id, 'active');
assert.equal(getUserPointTier(5000).id, 'veteran');

const early = getUserPointsProgress(120);
assert.equal(early.progressLabel, '120/250');
assert.equal(early.nextTier?.id, 'active');
assert.equal(early.nextUnlock, early.nextTier?.unlocks);

const mid = getUserPointsProgress(412);
assert.equal(mid.progressLabel, '412/750');
assert.equal(mid.nextTier?.id, 'trusted');

const max = getUserPointsProgress(5200);
assert.equal(max.isMaxTier, true);
assert.equal(max.progressPercent, 100);
assert.equal(max.nextUnlock, null);

console.log('user-points-levels tests passed');
