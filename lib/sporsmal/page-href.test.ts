import assert from 'node:assert/strict';
import { buildSporsmalAlleTemaHref } from './page-href';

const base = new URLSearchParams({
  type: 'interpellasjoner',
  sesjonId: '2025-2026',
  tema: 'Helse',
  page: '2',
  parti: 'AP',
});

assert.equal(
  buildSporsmalAlleTemaHref('interpellasjoner', '2025-2026', base),
  '/dashboard/sporsmal?type=interpellasjoner&sesjonId=2025-2026&parti=AP',
);

const onlyTema = new URLSearchParams({ tema: 'Skole', type: 'sporretimesporsmal', sesjonId: '2024-2025' });
assert.equal(
  buildSporsmalAlleTemaHref('sporretimesporsmal', '2024-2025', onlyTema),
  '/dashboard/sporsmal?type=sporretimesporsmal&sesjonId=2024-2025',
);

console.log('lib/sporsmal/page-href.test.ts: ok');