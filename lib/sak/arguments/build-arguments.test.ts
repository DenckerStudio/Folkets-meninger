import assert from 'node:assert/strict';
import { buildSakArgumentsBundle } from '@/lib/sak/arguments/build-arguments';
import { extractInnstillingArguments } from '@/lib/sak/arguments/extract-innstilling';
import { extractMerknadArguments } from '@/lib/sak/arguments/extract-merknader';
import { aggregateOpinionArguments } from '@/lib/sak/arguments/extract-meninger';

const innst = extractInnstillingArguments(
  'Komiteen tilrår at Stortinget vedtar endringen. Enkelte medlemmer er uenige i at ordningen bør innføres uten evaluering.',
);
assert.equal(innst.length, 2);
assert.ok(innst.some((row) => row.side === 'for'));
assert.ok(innst.some((row) => row.side === 'mot'));

const merknad = extractMerknadArguments([
  {
    document_id: 'inns-1',
    chunk_index: 0,
    content: '## Komiteens merknader\n- Støtter hovedlinjen i forslaget om sikkerhet i nærskolen.\n- Er uenige i at ordningen bør innføres uten evaluering.',
    metadata: { section_title: 'Komiteens merknader', document_title: 'Innstilling' },
  },
]);
assert.ok(merknad.length >= 2);

const opinions = Array.from({ length: 6 }, (_, index) => ({
  id: String(index),
  title: `Mening ${index}`,
  body: 'Lang nok tekst for meningen.',
  stance: 'for' as const,
  points: [{ stance: 'for' as const, text: 'Dette styrker lokaldemokratiet i praksis.' }],
  stortingetIssueId: '200192',
  issueTitle: 'Test',
  createdAt: new Date().toISOString(),
  authorUserId: 'u1',
  authorName: null,
  authorInitials: 'AB',
  counts: { for: 1, imot: 0, blank: 0, total: 1 },
}));

const aggregated = aggregateOpinionArguments({
  sakId: '200192',
  opinions,
  totalOpinions: 6,
});
assert.equal(aggregated.length, 1);

const bundle = buildSakArgumentsBundle({
  sakId: '200192',
  innstillingstekst: null,
  merknadChunks: [],
  opinions,
  totalOpinions: 6,
});
assert.ok(bundle.for.length >= 1);

console.log('lib/sak/arguments/build-arguments.test.ts: ok');