import assert from 'node:assert/strict';
import {
  buildOnboardingUserMetadata,
  canAdvanceOnboardingStep,
  formatOnboardingStepIndex,
  getOnboardingStep,
  needsOnboarding,
  nextOnboardingStepId,
  normalizePhoneNumber,
  ONBOARDING_STEPS,
  previousOnboardingStepId,
  readOnboardingMetadata,
  utforskWithTour,
} from './onboarding';
import { sanitizePostLoginPath } from './safe-redirect';

assert.equal(formatOnboardingStepIndex(1), '01');
assert.equal(formatOnboardingStepIndex(4), '04');
assert.ok(ONBOARDING_STEPS.every((step) => step.optional === false));

assert.equal(getOnboardingStep('sms').label, 'SMS');
assert.equal(nextOnboardingStepId('welcome'), 'name');
assert.equal(nextOnboardingStepId('bankid'), null);
assert.equal(previousOnboardingStepId('welcome'), null);
assert.equal(previousOnboardingStepId('sms'), 'name');

assert.equal(normalizePhoneNumber('41234567'), '+4741234567');
assert.equal(normalizePhoneNumber('+47 412 34 567'), '+4741234567');
assert.equal(normalizePhoneNumber('004741234567'), '+4741234567');
assert.equal(normalizePhoneNumber('47 41234567'), '+4741234567');
assert.equal(normalizePhoneNumber('123'), null);
assert.equal(normalizePhoneNumber(''), null);

assert.equal(
  needsOnboarding({
    metadata: { pending: true, completed: false, skipped: false, tourCompleted: false, bankIdVerified: false },
    hasPublicIdentity: true,
  }),
  true,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: false, completed: false, skipped: false, tourCompleted: false, bankIdVerified: false },
    hasPublicIdentity: true,
  }),
  false,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: false, completed: false, skipped: false, tourCompleted: false, bankIdVerified: false },
    hasPublicIdentity: false,
  }),
  true,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: true, completed: false, skipped: true, tourCompleted: false, bankIdVerified: false },
    hasPublicIdentity: false,
  }),
  false,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: true, completed: true, skipped: false, tourCompleted: false, bankIdVerified: true },
    hasPublicIdentity: false,
  }),
  false,
);

assert.equal(
  canAdvanceOnboardingStep('welcome', { hasName: false, phoneVerified: false, bankIdVerified: false }),
  true,
);
assert.equal(
  canAdvanceOnboardingStep('name', { hasName: false, phoneVerified: false, bankIdVerified: false }),
  false,
);
assert.equal(
  canAdvanceOnboardingStep('name', { hasName: true, phoneVerified: false, bankIdVerified: false }),
  true,
);
assert.equal(
  canAdvanceOnboardingStep('sms', { hasName: true, phoneVerified: false, bankIdVerified: false }),
  false,
);
assert.equal(
  canAdvanceOnboardingStep('sms', { hasName: true, phoneVerified: true, bankIdVerified: false }),
  true,
);
assert.equal(
  canAdvanceOnboardingStep('bankid', { hasName: true, phoneVerified: true, bankIdVerified: false }),
  false,
);
assert.equal(
  canAdvanceOnboardingStep('bankid', { hasName: true, phoneVerified: true, bankIdVerified: true }),
  true,
);

const meta = readOnboardingMetadata({
  user_metadata: { onboarding_pending: true, onboarding_completed: false },
});
assert.equal(meta.pending, true);
assert.equal(meta.completed, false);

const patch = buildOnboardingUserMetadata({ pending: false, completed: true, skipped: false });
assert.equal(patch.onboarding_pending, false);
assert.equal(patch.onboarding_completed, true);
assert.equal(patch.onboarding_skipped, false);

assert.equal(utforskWithTour(true), '/dashboard/utforsk?tour=1');
assert.equal(utforskWithTour(false), '/dashboard/utforsk');

assert.equal(sanitizePostLoginPath(null), '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath('/auth/onboarding'), '/auth/onboarding');
assert.equal(
  sanitizePostLoginPath('/auth/onboarding?next=%2Fdashboard%2Futforsk'),
  '/auth/onboarding?next=%2Fdashboard%2Futforsk',
);
assert.equal(sanitizePostLoginPath('https://evil.test'), '/dashboard/utforsk');

console.log('onboarding tests passed');
