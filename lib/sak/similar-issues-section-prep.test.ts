import assert from 'node:assert/strict';
import { prepareSimilarIssuesSectionInitialState } from '@/components/sak/similar-issues-section';
import { similarIssuesShowsInToc } from '@/lib/sak/sak-oversikt-related-toc';

const emptySimilar = prepareSimilarIssuesSectionInitialState(
  { status: 'ok', items: [] },
  '200186',
  [],
);
assert.deepEqual(emptySimilar, { initialItems: [], initialStatus: 'ok' });
assert.equal(similarIssuesShowsInToc({ loadStatus: 'ok', itemCount: 0 }), false);

const failedSimilar = prepareSimilarIssuesSectionInitialState({ status: 'error' }, '200186', []);
assert.deepEqual(failedSimilar, { initialItems: [], initialStatus: 'error' });
assert.equal(
  similarIssuesShowsInToc({ loadStatus: failedSimilar.initialStatus, itemCount: 0 }),
  true,
);
assert.notEqual(failedSimilar.initialStatus, 'ok');

console.log('lib/sak/similar-issues-section-prep.test.ts: ok');