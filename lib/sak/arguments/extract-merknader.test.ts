import assert from 'node:assert/strict';
import { classifyExplicitMerknadStance, extractMerknadArguments } from '@/lib/sak/arguments/extract-merknader';

assert.equal(
  classifyExplicitMerknadStance('Dette er et forslag for endringen i skolen.'),
  null,
  'preposition "for" alone is not a stance',
);

assert.equal(classifyExplicitMerknadStance('Ap: Vi går inn for hovedlinjen i forslaget.'), 'for');
assert.equal(classifyExplicitMerknadStance('SV – står imot å fjerne ordningen.'), 'mot');

const items = extractMerknadArguments('200192', [
  {
    document_id: 'inns-1',
    chunk_index: 0,
    content:
      '## Komiteens merknader\nStøtter hovedlinjen uten navngitt avsender.\nAp: Vi går inn for forslaget om tryggere skolevei.\nFrP – står imot finansieringsmodellen.',
    metadata: { section_title: 'Komiteens merknader', document_title: 'Innstilling' },
  },
]);

assert.equal(items.length, 2);
assert.ok(items.some((row) => row.side === 'for' && row.text.includes('Ap:')));
assert.ok(items.some((row) => row.side === 'mot'));
assert.match(items[0].source.href ?? '', /fane=dokumenter/);
assert.match(items[0].source.href ?? '', /dokument=inns-1/);

console.log('lib/sak/arguments/extract-merknader.test.ts: ok');