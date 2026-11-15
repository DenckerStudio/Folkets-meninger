import assert from 'node:assert/strict';
import {
  aggregateHybridChunksByIssue,
  mergeFtsAndHybridIssueRanks,
} from './stortinget-issue-ranking';
import { shouldFallbackUtforskToLexicalSearch } from './utforsk-search-fallback';

const rows = [
  { issue_id: '100', score_fused: 0.04, score_semantic: 0.5 },
  { issue_id: '100', score_fused: 0.09 },
  { issue_id: '200', score_fused: 0.07 },
  { issue_id: '', score_fused: 0.99 },
  { issue_id: '300', score_lexical: 0.2 },
];

const aggregated = aggregateHybridChunksByIssue(rows);
assert.deepEqual(
  aggregated.map((r) => r.id),
  ['300', '100', '200'],
);
assert.equal(aggregated[0]?.score, 0.2);

const merged = mergeFtsAndHybridIssueRanks(['200', '999'], aggregated, 4);
assert.ok(merged.includes('100'));
assert.ok(merged.includes('200'));
assert.equal(merged.length, 4);

assert.equal(shouldFallbackUtforskToLexicalSearch(null), true);
assert.equal(shouldFallbackUtforskToLexicalSearch([]), false);
assert.equal(shouldFallbackUtforskToLexicalSearch(['1']), false);

console.log('lib/search/stortinget-issue-ranking.test.ts: ok');