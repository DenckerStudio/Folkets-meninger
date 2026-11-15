import assert from 'node:assert/strict';
import type { SakListItem } from '@/lib/stortinget';
import {
  buildHybridRankMap,
  filterUtforskIssuesBySearch,
  isUtforskSearchQueryActive,
  resolveUtforskEffectiveSort,
  sortUtforskIssues,
  UTFORSK_DEFAULT_SEARCH_SESSION_SORT,
  utforskSortOptionsForQuery,
} from './utforsk-explore-display';

function sak(id: string, date: string, votes = 0): SakListItem {
  return {
    id,
    title: `Sak ${id}`,
    summary: '',
    category: '',
    date,
    votes: { for: 0, against: 0, abstain: 0, total: votes },
    status: 'pending',
    sakKind: null,
    henvisning: null,
    dokumentgruppe: null,
    votingOpen: false,
    votingDaysLeft: null,
  };
}

assert.equal(isUtforskSearchQueryActive(''), false);
assert.equal(isUtforskSearchQueryActive('a'), false);
assert.equal(isUtforskSearchQueryActive('ab'), true);

assert.equal(UTFORSK_DEFAULT_SEARCH_SESSION_SORT, 'Mest relevant');

assert.equal(resolveUtforskEffectiveSort(true, 'Nyeste først', 'Mest engasjement'), 'Nyeste først');
assert.equal(resolveUtforskEffectiveSort(true, null, 'Nyeste først'), 'Mest relevant');
assert.equal(resolveUtforskEffectiveSort(false, null, 'Nyeste først'), 'Nyeste først');
assert.equal(resolveUtforskEffectiveSort(false, null, 'Mest relevant'), 'Nyeste først');

const options = utforskSortOptionsForQuery(true);
assert.ok(options.includes('Mest relevant'));
assert.equal(utforskSortOptionsForQuery(false).includes('Mest relevant'), false);

const corpus = [sak('1', '2025-01-01'), sak('2', '2025-06-01'), sak('3', '2025-03-01')];

assert.deepEqual(
  filterUtforskIssuesBySearch(corpus, {
    trimmedQuery: 'x',
    hybridIssueIds: null,
    hybridCommittedQuery: null,
  }).map((i) => i.id),
  ['1', '2', '3'],
);

const hybridFiltered = filterUtforskIssuesBySearch(corpus, {
  trimmedQuery: 'test',
  hybridIssueIds: ['2', '3'],
  hybridCommittedQuery: 'test',
});
assert.deepEqual(hybridFiltered.map((i) => i.id), ['2', '3']);

const pendingLexical = filterUtforskIssuesBySearch(
  [
    { ...sak('9', '2025-01-01'), title: 'statsbudsjett', summary: 'statsbudsjett' },
    sak('2', '2025-06-01'),
  ],
  {
    trimmedQuery: 'stats',
    hybridIssueIds: ['2'],
    hybridCommittedQuery: 'other',
  },
);
assert.deepEqual(pendingLexical.map((i) => i.id), ['9']);

const rank = buildHybridRankMap(['3', '1']);
const sortedRelevance = sortUtforskIssues(
  [sak('1', '2025-01-01'), sak('3', '2025-03-01'), sak('2', '2025-06-01', 99)],
  'Mest relevant',
  rank,
);
assert.deepEqual(sortedRelevance.map((i) => i.id), ['3', '1', '2']);

const sortedEngagement = sortUtforskIssues(
  [sak('1', '2025-01-01', 1), sak('2', '2025-06-01', 50)],
  'Mest engasjement',
  rank,
);
assert.equal(sortedEngagement[0]?.id, '2');

console.log('lib/search/utforsk-explore-display.test.ts: ok');