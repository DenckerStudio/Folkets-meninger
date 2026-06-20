import assert from 'node:assert/strict';
import {
  canAwardProfileCompletePoints,
  getUserVerificationStatus,
  isProfileBioComplete,
} from './user-verification';

const unverified = getUserVerificationStatus({
  email_confirmed_at: undefined,
  phone_confirmed_at: undefined,
});
assert.equal(unverified.fullyVerified, false);

const verified = getUserVerificationStatus({
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone_confirmed_at: '2026-01-01T00:00:00Z',
});
assert.equal(verified.fullyVerified, true);

assert.equal(isProfileBioComplete('  kort  '), false);
assert.equal(isProfileBioComplete('a'.repeat(20)), true);

assert.equal(
  canAwardProfileCompletePoints({
    bio: 'a'.repeat(20),
    profileIsPublic: true,
    verification: verified,
  }),
  true,
);

assert.equal(
  canAwardProfileCompletePoints({
    bio: 'a'.repeat(20),
    profileIsPublic: true,
    verification: unverified,
  }),
  false,
);

console.log('user-verification tests passed');
