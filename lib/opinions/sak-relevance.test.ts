import assert from 'node:assert/strict';
import { rankSakOptions, tokenizeOpinionQuery } from './sak-relevance';
import type { SakPickerOption } from './types';

const options: SakPickerOption[] = [
  { id: '1', title: 'Endringer i skatteloven for elbil', category: 'Skatt', henvisning: 'Prop. 1 L' },
  { id: '2', title: 'Ny E6 gjennom Gudbrandsdalen', category: 'Samferdsel', henvisning: null },
  { id: '3', title: 'Styrking av kollektivtilbudet i distriktene', category: 'Samferdsel', henvisning: 'Innst. 40 S' },
  { id: '4', title: 'Nasjonal helse- og samhandlingsplan', category: 'Helse', henvisning: null },
  { id: '5', title: 'Asaksbehandlingsregler for kollektiv beskyttelse', category: 'Justis', henvisning: null },
];

assert.deepEqual(tokenizeOpinionQuery('Jeg vil ha bedre kollektiv i distriktene'), ['bedre', 'kollektiv', 'distriktene']);

const ranked = rankSakOptions(options, 'Kollektivtilbud i distriktene');
assert.equal(ranked[0]?.id, '3');
assert.equal(
  ranked.some((option) => option.id === '4'),
  false,
);

assert.equal(
  rankSakOptions(options, 'elbil og skatt')[0]?.id,
  '1',
);
assert.equal(
  rankSakOptions(options, 'kollektiv Kollektivtilbud i distriktene')[0]?.id,
  '3',
);

const empty = rankSakOptions(options, '');
assert.equal(empty.length, 5);
assert.equal(empty[0]?.id, '1');

console.log('opinions/sak-relevance.test.ts: ok');
