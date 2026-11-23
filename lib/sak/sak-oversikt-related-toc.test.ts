import assert from 'node:assert/strict';
import {
  sakOversiktRelatertTocLabel,
  shouldShowSakOversiktRelatertAnchor,
  similarIssuesShowsInToc,
} from '@/lib/sak/sak-oversikt-related-toc';

assert.equal(
  shouldShowSakOversiktRelatertAnchor({
    hasRelaterteSaker: false,
    similarShowsSection: false,
    hasTopicAround: false,
  }),
  false,
);

assert.equal(
  sakOversiktRelatertTocLabel({
    hasRelaterteSaker: false,
    similarShowsSection: false,
    hasTopicAround: false,
  }),
  null,
);

assert.equal(
  sakOversiktRelatertTocLabel({
    hasRelaterteSaker: false,
    similarShowsSection: true,
    hasTopicAround: false,
  }),
  'Liknende saker',
);

assert.equal(
  sakOversiktRelatertTocLabel({
    hasRelaterteSaker: true,
    similarShowsSection: false,
    hasTopicAround: false,
  }),
  'Relaterte saker',
);

assert.equal(
  sakOversiktRelatertTocLabel({
    hasRelaterteSaker: false,
    similarShowsSection: false,
    hasTopicAround: true,
  }),
  'Søk rundt temaet',
);

assert.equal(similarIssuesShowsInToc({ loadStatus: 'ok', itemCount: 0 }), false);
assert.equal(similarIssuesShowsInToc({ loadStatus: 'error', itemCount: 0 }), true);
assert.equal(
  similarIssuesShowsInToc({ loadStatus: 'ok', itemCount: 0, clientLoading: true }),
  true,
);

console.log('lib/sak/sak-oversikt-related-toc.test.ts: ok');