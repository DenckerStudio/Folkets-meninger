import assert from 'node:assert/strict';
import { getUserPointTier, getUserPointsProgress } from './user-points-levels';

assert.equal(getUserPointTier(0).id, 'new');
assert.equal(getUserPointTier(24).id, 'new');
assert.equal(getUserPointTier(25).id, 'active');
assert.equal(getUserPointTier(400).id, 'veteran');

const early = getUserPointsProgress(12);
assert.equal(early.progressLabel, '12/25');
assert.equal(early.nextTier?.id, 'active');
assert.equal(early.nextUnlock, early.nextTier?.unlocks);

const mid = getUserPointsProgress(80);
assert.equal(mid.progressLabel, '80/150');
assert.equal(mid.nextTier?.id, 'curator');

const max = getUserPointsProgress(420);
assert.equal(max.isMaxTier, true);
assert.equal(max.progressPercent, 100);
assert.equal(max.nextUnlock, null);

console.log('user-points-levels tests passed');
