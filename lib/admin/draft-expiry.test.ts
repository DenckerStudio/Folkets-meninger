import assert from 'node:assert/strict';
import {
  DRAFT_RESTORE_SUCCESS_MESSAGE,
  DRAFT_SOFT_EXPIRY_MS,
  draftExpiryHoursLeft,
  draftSoftExpiryStartMs,
  formatDraftExpiryLabel,
  isDraftPastSoftExpiry,
} from '@/lib/admin/draft-expiry';

const created = '2026-10-24T12:00:00.000Z';
const at48h = Date.parse(created) + 48 * 60 * 60 * 1000;
const at71h = Date.parse(created) + 71 * 60 * 60 * 1000 + 30 * 60 * 1000;
const at72h = Date.parse(created) + DRAFT_SOFT_EXPIRY_MS;

const clock = { createdAt: created };

assert.equal(formatDraftExpiryLabel(clock, at48h), 'Utløper om 24 t');
assert.equal(formatDraftExpiryLabel(clock, at71h), 'Utløper snart');
assert.equal(formatDraftExpiryLabel(clock, at72h), 'Utløper snart');
assert.equal(draftExpiryHoursLeft(clock, at48h), 24);
assert.equal(draftExpiryHoursLeft(clock, at71h), 0);
assert.equal(draftExpiryHoursLeft(clock, at72h), 0);
assert.equal(isDraftPastSoftExpiry(clock, at72h - 1), false);
assert.equal(isDraftPastSoftExpiry(clock, at72h), true);

const HOUR_MS = 60 * 60 * 1000;
const restoredAt = '2026-10-27T11:00:00.000Z';
const restoredClock = { createdAt: created, restoredAt };
const afterRestore = Date.parse(restoredAt) + 2 * HOUR_MS;

assert.equal(draftSoftExpiryStartMs(restoredClock), Date.parse(restoredAt));
assert.equal(formatDraftExpiryLabel(restoredClock, afterRestore), 'Utløper om 70 t');
assert.equal(isDraftPastSoftExpiry(restoredClock, at72h), false);
assert.match(DRAFT_RESTORE_SUCCESS_MESSAGE, /Til vurdering\.$/);

console.log('lib/admin/draft-expiry.test.ts: ok');
