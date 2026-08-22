import assert from 'node:assert/strict';
import { earnedBadgeIds, getBadge, mergeBadgeState } from './badges';

assert.equal(getBadge('informert_borger').name, 'Informert borger');
assert.equal(getBadge('saksforsker').name, 'Saksforsker');
assert.equal(getBadge('fylkesekspert').name, 'Fylkesekspert');

assert.deepEqual(
  earnedBadgeIds({
    quizPasses: 0,
    documentReads: 0,
    counterProposals: 0,
    hearingComments: 0,
    hasFylke: false,
  }),
  [],
);

assert.deepEqual(
  earnedBadgeIds({
    quizPasses: 1,
    documentReads: 0,
    counterProposals: 0,
    hearingComments: 0,
    hasFylke: false,
  }),
  ['informert_borger'],
);

assert.deepEqual(
  earnedBadgeIds({
    quizPasses: 1,
    documentReads: 3,
    counterProposals: 0,
    hearingComments: 0,
    hasFylke: true,
  }),
  ['informert_borger', 'saksforsker', 'fylkesekspert'],
);

assert.deepEqual(
  earnedBadgeIds({
    quizPasses: 0,
    documentReads: 5,
    counterProposals: 1,
    hearingComments: 0,
    hasFylke: true,
  }),
  ['saksforsker'],
);

const merged = mergeBadgeState(
  [{ id: 'informert_borger', name: 'Informert borger', description: '', howToEarn: '' }],
  [{ id: 'informert_borger', earnedAt: '2026-08-22T00:00:00.000Z' }],
);
assert.equal(merged[0]?.earnedAt, '2026-08-22T00:00:00.000Z');

console.log('knowledge badges tests passed');
