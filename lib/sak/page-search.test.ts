import assert from 'node:assert/strict';
import { sakDocumentListAnchorId, sakOpinionAnchorId } from '@/lib/sak/anchors';
import { searchSakPage } from '@/lib/sak/page-search';

const hits = searchSakPage({
  query: 'innstilling',
  title: 'Eksempelsak om skole',
  summary: 'Kort sammendrag',
  documents: [{ id: '1', title: 'Innstilling' }],
  opinions: [],
  innstillingSnippet: 'Innstillingen: Stortinget tilrår vedtak.',
  argumentSnippets: [],
});

assert.ok(hits.some((hit) => hit.kind === 'dokument'));
assert.ok(hits.some((hit) => hit.kind === 'innstilling'));

const docHit = hits.find((hit) => hit.kind === 'dokument');
assert.equal(docHit?.anchorId, sakDocumentListAnchorId('1'));

const opinionHits = searchSakPage({
  query: 'lokaldemokrati',
  title: 'Sak',
  summary: null,
  documents: [],
  opinions: [{ id: 'op-9', title: 'Lokaldemokrati', body: 'Lokaldemokrati i praksis.' }],
  innstillingSnippet: null,
  argumentSnippets: [],
});
assert.equal(opinionHits[0]?.anchorId, sakOpinionAnchorId('op-9'));
assert.equal(opinionHits[0]?.tab, 'diskusjon');

const innstHit = hits.find((hit) => hit.kind === 'innstilling');
assert.equal(innstHit?.anchorId, 'sak-oversikt-innstilling');

console.log('lib/sak/page-search.test.ts: ok');