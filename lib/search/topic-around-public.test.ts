import assert from 'node:assert/strict';
import {
  dedupeTopicAroundHitsByIssueIds,
  resolvePublicTopicAroundSakSection,
} from './topic-around-public';
import type { TopicAroundSearchItem } from './topic-around-search';

const sampleItem = (issueId: string): TopicAroundSearchItem => ({
  issueId,
  issueTitle: `Sak ${issueId}`,
  excerpt: 'Utdrag',
  documentTitle: 'Prop.',
  documentKind: 'lovforslag',
  sourceUrl: 'https://www.stortinget.no/',
  relatedReason: 'Felles tema: test',
  relevanceScore: 0.5,
  publishedAt: null,
});

const fiveItems = ['a', 'b', 'c', 'd', 'e'].map(sampleItem);

assert.equal(
  resolvePublicTopicAroundSakSection({
    result: { ok: false, reason: 'rpc_failed' },
    issueId: '100',
  }),
  null,
);

assert.equal(
  resolvePublicTopicAroundSakSection({
    result: { ok: false, reason: 'embedding_unavailable' },
    issueId: '100',
  }),
  null,
);

assert.equal(
  resolvePublicTopicAroundSakSection({
    result: { ok: false, reason: 'disabled' },
    issueId: '100',
  }),
  null,
);

const sixItems = [...fiveItems, sampleItem('f')];
const visible = resolvePublicTopicAroundSakSection({
  result: { ok: true, items: sixItems, themeLabel: 'Tema' },
  issueId: '200',
  excludeIssueIds: ['a'],
});
assert.ok(visible);
assert.equal(visible?.length, 5);

assert.equal(
  resolvePublicTopicAroundSakSection({
    result: { ok: true, items: fiveItems.slice(0, 4), themeLabel: 'Tema' },
    issueId: '200',
  }),
  null,
);

assert.deepEqual(dedupeTopicAroundHitsByIssueIds(fiveItems, ['b', 'x']), [
  sampleItem('a'),
  sampleItem('c'),
  sampleItem('d'),
  sampleItem('e'),
]);

console.log('lib/search/topic-around-public.test.ts: ok');