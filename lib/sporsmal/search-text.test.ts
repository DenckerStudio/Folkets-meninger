import assert from 'node:assert/strict';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { getSporsmalSearchText } from './search-text';

const item: StortingetSporsmal = {
  tittel: 'Kort tittel',
  sporsmal: 'Lengre fritekst om sykehus og helse.',
};

assert.match(getSporsmalSearchText(item), /sykehus/i);
assert.match(getSporsmalSearchText({ tittel: 'Bare tittel' }), /bare tittel/i);

console.log('lib/sporsmal/search-text.test.ts: ok');