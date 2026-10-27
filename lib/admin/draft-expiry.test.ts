import assert from 'node:assert/strict';
import {
  DRAFT_SOFT_EXPIRY_MS,
  draftExpiryHoursLeft,
  formatDraftExpiryLabel,
  isDraftPastSoftExpiry,
} from '@/lib/admin/draft-expiry';

const created = '2026-10-24T12:00:00.000Z';
const at48h = Date.parse(created) + 48 * 60 * 60 * 1000;
const at71h = Date.parse(created) + 71 * 60 * 60 * 1000 + 30 * 60 * 1000;
const at72h = Date.parse(created) + DRAFT_SOFT_EXPIRY_MS;

assert.equal(formatDraftExpiryLabel(created, at48h), 'Utløper om 24 t');
assert.equal(formatDraftExpiryLabel(created, at71h), 'Utløper snart');
assert.equal(formatDraftExpiryLabel(created, at72h), 'Utløper snart');
assert.equal(draftExpiryHoursLeft(created, at48h), 24);
assert.equal(draftExpiryHoursLeft(created, at71h), 0);
assert.equal(draftExpiryHoursLeft(created, at72h), 0);
assert.equal(isDraftPastSoftExpiry(created, at72h - 1), false);
assert.equal(isDraftPastSoftExpiry(created, at72h), true);

console.log('lib/admin/draft-expiry.test.ts: ok');
