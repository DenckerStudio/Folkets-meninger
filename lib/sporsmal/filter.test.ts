import assert from 'node:assert/strict';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { filterSporsmalList, paginateList, sortSporsmalForDisplay } from './filter';

const sample: StortingetSporsmal[] = [
  {
    id: 1,
    tittel: 'Spørsmål om vegvedlikehold i Nord-Norge',
    sporsmal_til_minister_tittel: 'samferdselsministeren',
    sporsmal_nummer: 10,
    sporsmal_fra: { id: 'A', fornavn: 'Ola', etternavn: 'Nordmann', parti: { id: 'Ap', navn: 'Arbeiderpartiet' } },
  },
  {
    id: 2,
    tittel: 'Fastlegekrisen i distriktene',
    sporsmal_nummer: 9,
    besvart_dato: '/Date(1759989109780+0200)/',
    sporsmal_fra: { id: 'B', fornavn: 'Kari', etternavn: 'Vest', parti: { id: 'H', navn: 'Høyre' } },
  },
];

const sakById = new Map<string, string | null>([
  ['1', null],
  ['2', null],
]);

const filtered = filterSporsmalList(sample, {
  query: 'fastlege',
  theme: null,
  partyId: null,
  representativeId: null,
  answerFilter: 'alle',
}, sakById);
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.id, 2);

const byParty = filterSporsmalList(sample, {
  query: '',
  theme: null,
  partyId: 'Ap',
  representativeId: null,
  answerFilter: 'alle',
}, sakById);
assert.equal(byParty.length, 1);

const besvart = filterSporsmalList(sample, {
  query: '',
  theme: null,
  partyId: null,
  representativeId: null,
  answerFilter: 'besvart',
}, sakById);
assert.equal(besvart.length, 1);

const sorted = sortSporsmalForDisplay(
  filterSporsmalList(sample, {
    query: '',
    theme: null,
    partyId: null,
    representativeId: null,
    answerFilter: 'alle',
  }, sakById),
);
assert.ok(sorted[0]!.theme.localeCompare(sorted[1]!.theme, 'nb') <= 0);

const page = paginateList(sorted, 1, 1);
assert.equal(page.items.length, 1);
assert.equal(page.totalPages, 2);

console.log('lib/sporsmal/filter.test.ts: ok');