import assert from 'node:assert/strict';
import { getReelSubmissionAccess } from './reel-submission-access';

const locked = getReelSubmissionAccess(120);
assert.equal(locked.canSubmit, false);
assert.equal(locked.mode, 'locked');
assert.equal(locked.pointsNeeded, 630);

const trusted = getReelSubmissionAccess(800, 0);
assert.equal(trusted.canSubmit, true);
assert.equal(trusted.mode, 'trusted');
assert.equal(trusted.weeklyLimit, 2);
assert.equal(trusted.publishesWithoutAdmin, false);

const curator = getReelSubmissionAccess(2100, 1);
assert.equal(curator.mode, 'curator');
assert.equal(curator.weeklyLimit, 5);
assert.equal(curator.weeklyRemaining, 4);
assert.equal(curator.publishesWithoutAdmin, true);

console.log('reel-submission-access tests passed');
