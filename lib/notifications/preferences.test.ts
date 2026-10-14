import assert from 'node:assert/strict';
import {
  buildDigestCursorUpdate,
  buildInAppDigestSummary,
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
  toAbsoluteNotificationUrl('/dashboard/sak/1', 'https://www.folkets-meninger.no'),
  'https://www.folkets-meninger.no/dashboard/sak/1',
);
assert.equal(toAbsoluteNotificationUrl('https://example.com', 'https://www.folkets-meninger.no'), 'https://example.com');

const cursor = buildDigestCursorUpdate({ categories: 'old' }, ['categories', 'labels'], '2026-02-01T00:00:00.000Z');
assert.equal(cursor.categories, '2026-02-01T00:00:00.000Z');
assert.equal(cursor.labels, '2026-02-01T00:00:00.000Z');

assert.equal(digestEmailSubject('daily'), 'Dine varsler (daglig oppsummering — Stemme+)');
assert.equal(digestEmailSubject('weekly'), 'Dine varsler (ukentlig oppsummering — Stemme+)');
assert.equal(digestEmailSubject('weekly', true), 'Dine varsler (ukentlig smakebit)');

{
  const s = buildInAppDigestSummary([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }]);
  assert.equal(s.title, 'Ukens oppsummering: 4 nye varsler');
  assert.equal(s.body, '• A\n• B\n• C\n… og 1 til');
  assert.equal(buildInAppDigestSummary([{ title: 'A' }]).title, 'Ukens oppsummering: 1 nytt varsel');
}

console.log('notifications/preferences.test.ts: ok');
