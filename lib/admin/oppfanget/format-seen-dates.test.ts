import assert from 'node:assert/strict';
import { normalizeSeenAtRange } from '@/lib/admin/oppfanget/format-seen-dates';

const older = '2026-10-29T04:11:00.000Z';
const newer = '2026-10-29T05:13:00.000Z';

assert.deepEqual(normalizeSeenAtRange(newer, older), {
  firstSeenAt: older,
  lastSeenAt: newer,
});

assert.deepEqual(normalizeSeenAtRange(older, newer), {
  firstSeenAt: older,
  lastSeenAt: newer,
});

console.log('admin/oppfanget/format-seen-dates.test.ts: ok');
