import assert from 'node:assert/strict';
import {
  buildDigestCursorUpdate,
  digestEmailSubject,
  resolveDigestSinceIso,
  shouldSendDigestEmail,
  toAbsoluteNotificationUrl,
} from './digest';
import { normalizeEmailFrequencyByChannel, pickDigestChannels } from './preferences';

assert.deepEqual(normalizeEmailFrequencyByChannel(null), {
  categories: 'daily',
  labels: 'daily',
});

assert.deepEqual(
  normalizeEmailFrequencyByChannel({
    forum: 'realtime',
    mentions: 'realtime',
    categories: 'weekly',
    labels: 'realtime',
    unknown: 'daily',
  }),
  {
    categories: 'weekly',
    labels: 'realtime',
  },
);

assert.deepEqual(pickDigestChannels({ categories: 'daily', labels: 'weekly' }, 'daily'), ['categories']);
assert.deepEqual(pickDigestChannels({ categories: 'realtime', labels: 'daily' }, 'daily'), ['labels']);

const since = resolveDigestSinceIso('2026-01-01T00:00:00.000Z');
assert.equal(since, '2026-01-01T00:00:00.000Z');

const fallbackSince = resolveDigestSinceIso(undefined, Date.parse('2026-01-08T00:00:00.000Z'));
assert.equal(fallbackSince, '2026-01-01T00:00:00.000Z');

assert.equal(shouldSendDigestEmail([]), false);
assert.equal(shouldSendDigestEmail([{ title: 'Hei', createdAt: '2026-01-01' }]), true);

assert.equal(
  toAbsoluteNotificationUrl('/dashboard/sak/1', 'https://folkets-stemme.no'),
  'https://folkets-stemme.no/dashboard/sak/1',
);
assert.equal(toAbsoluteNotificationUrl('https://example.com', 'https://folkets-stemme.no'), 'https://example.com');

const cursor = buildDigestCursorUpdate({ categories: 'old' }, ['categories', 'labels'], '2026-02-01T00:00:00.000Z');
assert.equal(cursor.categories, '2026-02-01T00:00:00.000Z');
assert.equal(cursor.labels, '2026-02-01T00:00:00.000Z');

assert.equal(digestEmailSubject('daily'), 'Dine varsler (daglig oppsummering — Stemme+)');
assert.equal(digestEmailSubject('weekly'), 'Dine varsler (ukentlig oppsummering — Stemme+)');
assert.equal(digestEmailSubject('weekly', true), 'Dine varsler (ukentlig smakebit)');

console.log('notifications/preferences.test.ts: ok');
