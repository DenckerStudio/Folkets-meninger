import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_CASE_AGE_DAYS,
  FREE_NOTIFICATION_PREFERENCES,
  capLastSeenMs,
  clampMaxCaseAgeDays,
  isMissingColumnError,
  normalizeNotificationPreferences,
  preferenceTypeForNotification,
  shouldSendNotification,
} from './filters';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-14T12:00:00Z');
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

// Free normalization ignores Stemme+ fields but keeps in-app/push toggles.
const free = normalizeNotificationPreferences(
  {
    skip_finished: false,
    max_case_age_days: 365,
    enabled_types: [],
    only_followed: true,
    channel_email: true,
    frequency: 'realtime',
    channel_push: false,
  },
  false,
);
assert.deepEqual(free, { ...FREE_NOTIFICATION_PREFERENCES, channel_push: false });
assert.equal(free.frequency, 'weekly');
assert.equal(free.channel_email, false);

// Missing columns fall back to defaults.
assert.equal(normalizeNotificationPreferences(null, true).max_case_age_days, DEFAULT_MAX_CASE_AGE_DAYS);
assert.equal(normalizeNotificationPreferences(null, true).frequency, 'weekly');

// Stemme+ keeps valid values and drops invalid ones.
const plus = normalizeNotificationPreferences(
  { enabled_types: ['new_case', 'bogus'], frequency: 'daily', max_case_age_days: 2 },
  true,
);
assert.deepEqual(plus.enabled_types, ['new_case']);
assert.equal(plus.frequency, 'daily');
assert.equal(plus.max_case_age_days, 7);
assert.equal(clampMaxCaseAgeDays(1000), 365);
assert.equal(clampMaxCaseAgeDays('x'), 30);

assert.equal(preferenceTypeForNotification('new_case_in_category'), 'new_case');
assert.equal(preferenceTypeForNotification('opinion_innspill_endorsed'), 'reply_to_opinion');
assert.equal(preferenceTypeForNotification('admin_message'), null);

// Free: ferdigbehandlet and >30 days are always skipped.
assert.equal(shouldSendNotification(free, false, 'new_case_in_category', { date: iso(1) }, now), true);
assert.equal(shouldSendNotification(free, false, 'new_case_in_category', { date: iso(31) }, now), false);
assert.equal(shouldSendNotification(free, false, 'new_case_in_category', { ferdigbehandlet: true }, now), false);
assert.equal(shouldSendNotification(free, false, 'new_case_in_category', { status: 'closed' }, now), false);
// Free cannot disable types.
assert.equal(
  shouldSendNotification({ ...free, enabled_types: [] }, false, 'new_case_in_category', { date: iso(1) }, now),
  true,
);

// Stemme+ can relax and tighten.
const relaxed = normalizeNotificationPreferences({ skip_finished: false, max_case_age_days: 90 }, true);
assert.equal(shouldSendNotification(relaxed, true, 'new_case_for_label', { date: iso(60), ferdigbehandlet: true }, now), true);
const strict = normalizeNotificationPreferences({ max_case_age_days: 7, enabled_types: ['reply_to_opinion'] }, true);
assert.equal(shouldSendNotification(strict, true, 'new_case_for_label', { date: iso(1) }, now), false);
assert.equal(shouldSendNotification(strict, true, 'opinion_innspill_endorsed', {}, now), true);
assert.equal(shouldSendNotification(strict, true, 'opinion_innspill_endorsed', { date: iso(8) }, now), false);
const followed = normalizeNotificationPreferences({ only_followed: true }, true);
assert.equal(shouldSendNotification(followed, true, 'admin_message', {}, now), false);
assert.equal(shouldSendNotification(followed, true, 'new_case_in_category', { date: iso(1) }, now), true);

// Cron cursor cap.
assert.equal(capLastSeenMs(0, now), now - 30 * DAY);
assert.equal(capLastSeenMs(null, now), now - 30 * DAY);
assert.equal(capLastSeenMs(now - DAY, now), now - DAY);

assert.equal(isMissingColumnError({ code: '42703' }), true);
assert.equal(isMissingColumnError({ message: 'column notification_preferences.frequency does not exist' }), true);
assert.equal(isMissingColumnError(null), false);

console.log('notifications/filters.test.ts: ok');
