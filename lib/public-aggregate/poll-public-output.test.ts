import assert from 'node:assert/strict';
import {
  POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL,
  redactPublicPollTotals,
} from '@/lib/public-aggregate/poll-public-output';

assert.equal(POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL, 'For få stemmer til å vise fordeling');

const below = redactPublicPollTotals({ ja: 2, nei: 1, blank: 0, total: 3 });
assert.equal(below.ja, null);
assert.equal(below.total, 3);

const ok = redactPublicPollTotals({ ja: 3, nei: 2, blank: 0, total: 5 });
assert.equal(ok.ja, 3);

console.log('lib/public-aggregate/poll-public-output.test.ts: ok');