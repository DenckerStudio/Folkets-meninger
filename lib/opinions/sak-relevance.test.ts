import assert from 'node:assert/strict';
import {
  buildSakPickerResultList,
  filterSakPickerOptions,
  rankSakOptions,
  tokenizeOpinionQuery,
} from './sak-relevance';
import type { SakPickerOption } from './types';

const options: SakPickerOption[] = [
  {
    id: '1',
    title: 'Endringer i skatteloven for elbil',
    category: 'Skatt',
    henvisning: 'Prop. 1 L',
    status: 'pending',
  },
  {
    id: '2',
    title: 'Ny E6 gjennom Gudbrandsdalen',
    category: 'Samferdsel',
    henvisning: null,
    status: 'pending',
  },
  {
    id: '3',
    title: 'Styrking av kollektivtilbudet i distriktene',
    category: 'Samferdsel',
    henvisning: 'Innst. 40 S',
    status: 'pending',
  },
  {
    id: '4',
    title: 'Nasjonal helse- og samhandlingsplan',
    category: 'Helse',
    henvisning: null,
    status: 'closed',
  },
  {
    id: '5',
    title: 'Asaksbehandlingsregler for kollektiv beskyttelse',
    category: 'Justis',
    henvisning: null,
    status: 'closed',
  },
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
assert.equal(empty.length, 0);

const pendingOnly = filterSakPickerOptions(options, { status: 'pending' });
assert.equal(pendingOnly.length, 3);

const browse = buildSakPickerResultList({
  options,
  searchQuery: '',
  titleContext: '',
  statusFilter: 'pending',
  categoryFilter: null,
  visibleCount: 10,
});
assert.equal(browse.listLabel, 'Saker under behandling');
assert.equal(browse.rows[0]?.id, '1');

const titled = buildSakPickerResultList({
  options,
  searchQuery: '',
  titleContext: 'Kollektivtilbud i distriktene',
  statusFilter: 'all',
  categoryFilter: null,
  visibleCount: 10,
});
assert.equal(titled.listLabel, 'Forslag ut fra tittelen');
assert.equal(titled.rows[0]?.id, '3');
assert.equal(titled.suggestionIds.has('3'), true);

console.log('opinions/sak-relevance.test.ts: ok');
