import assert from 'node:assert/strict';
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

console.log('lib/sak/page-search.test.ts: ok');