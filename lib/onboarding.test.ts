import assert from 'node:assert/strict';
import {
  buildOnboardingUserMetadata,
  formatOnboardingStepIndex,
  getOnboardingStep,
  isNewAuthUser,
  needsOnboarding,
  nextOnboardingStepId,
  ONBOARDING_STEPS,
  onboardingPathWithNext,
  postOnboardingDestination,
  previousOnboardingStepId,
  PRODUCT_TOUR_STEPS,
  readOnboardingMetadata,
  shouldStartSignupOnboarding,
  stripProductTourQuery,
  utforskWithTour,
} from './onboarding';

assert.equal(formatOnboardingStepIndex(1), '01');
assert.equal(formatOnboardingStepIndex(3), '03');
assert.equal(ONBOARDING_STEPS.length, 3);
assert.deepEqual(
  ONBOARDING_STEPS.map((step) => step.id),
  ['welcome', 'interests', 'fylke'],
);

assert.equal(getOnboardingStep('interests').label, 'Hjertesaker');
assert.equal(nextOnboardingStepId('welcome'), 'interests');
assert.equal(nextOnboardingStepId('fylke'), null);
assert.equal(previousOnboardingStepId('welcome'), null);
assert.equal(previousOnboardingStepId('fylke'), 'interests');

assert.equal(
  needsOnboarding({
    metadata: { pending: true, completed: false, skipped: false, tourCompleted: false },
    hasPublicIdentity: true,
  }),
  true,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: false, completed: false, skipped: false, tourCompleted: false },
    hasPublicIdentity: true,
  }),
  false,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: false, completed: false, skipped: false, tourCompleted: false },
    hasPublicIdentity: false,
  }),
  true,
);

assert.equal(
  needsOnboarding({
    metadata: { pending: true, completed: false, skipped: true, tourCompleted: false },
    hasPublicIdentity: false,
  }),
  false,
);

const meta = readOnboardingMetadata({
  user_metadata: { onboarding_pending: true, onboarding_completed: false },
});
assert.equal(meta.pending, true);
assert.equal(meta.completed, false);
assert.equal(meta.tourCompleted, false);

const patch = buildOnboardingUserMetadata({ pending: false, completed: true, skipped: false });
assert.equal(patch.onboarding_pending, false);
assert.equal(patch.onboarding_completed, true);
assert.equal(patch.onboarding_skipped, false);

assert.equal(utforskWithTour(true), '/dashboard/utforsk?tour=1');
assert.equal(utforskWithTour(false), '/dashboard/utforsk');
assert.equal(stripProductTourQuery('/dashboard/utforsk?tour=1'), '/dashboard/utforsk');
assert.equal(stripProductTourQuery('/dashboard/sak/1?tour=1&x=2'), '/dashboard/sak/1?x=2');
assert.equal(postOnboardingDestination('/auth/onboarding'), '/dashboard/utforsk');
assert.equal(postOnboardingDestination('/dashboard/min-side?tour=1'), '/dashboard/min-side');
assert.equal(
  postOnboardingDestination('/dashboard/min-side', { startTour: true }),
  '/dashboard/min-side?tour=1',
);
assert.equal(postOnboardingDestination('/innspill', { startTour: true }), '/dashboard/utforsk?tour=1');
assert.equal(
  onboardingPathWithNext('/dashboard/utforsk'),
  '/auth/onboarding?next=%2Fdashboard%2Futforsk',
);
assert.equal(postOnboardingDestination('/del/abc?valg=ja'), '/del/abc?valg=ja');
assert.equal(
  onboardingPathWithNext('/del/abc?valg=ja'),
  '/auth/onboarding?next=%2Fdel%2Fabc%3Fvalg%3Dja',
);

const fresh = { user_metadata: { onboarding_pending: true }, created_at: new Date().toISOString() };
assert.equal(shouldStartSignupOnboarding(fresh), true);
assert.equal(
  shouldStartSignupOnboarding({ user_metadata: { onboarding_completed: true }, created_at: null }),
  false,
);
assert.equal(
  shouldStartSignupOnboarding({
    user_metadata: { onboarding_pending: true, onboarding_skipped: true },
    created_at: new Date().toISOString(),
  }),
  false,
);
assert.equal(
  shouldStartSignupOnboarding({ user_metadata: {}, created_at: new Date().toISOString() }),
  true,
);
assert.equal(shouldStartSignupOnboarding(null), false);

assert.equal(isNewAuthUser(new Date().toISOString()), true);
assert.equal(isNewAuthUser(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()), false);
assert.equal(isNewAuthUser(null), false);

const tourIds = PRODUCT_TOUR_STEPS.map((step) => step.id);
assert.deepEqual(tourIds, ['utforsk', 'reels', 'varsler', 'stemme']);
assert.ok(PRODUCT_TOUR_STEPS.every((step) => step.selector.length > 0));

console.log('onboarding tests passed');
