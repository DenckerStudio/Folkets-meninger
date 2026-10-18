import assert from 'node:assert/strict';
import { foldNorwegianForSearch, issueMatchesStortingetSearch } from './stortinget-issue-search';

const arsrapport = {
  id: '200999',
  title: 'Datatilsynets og Personvernnemndas årsrapportar for 2025',
  summary: 'Om årsrapportane frå Datatilsynet og Personvernnemnda.',
  category: 'Justis',
  henvisning: 'Dokument 3:5 (2025–2026)',
  status: 'pending' as const,
};

assert.ok(issueMatchesStortingetSearch(arsrapport, 'årsrapport'));
assert.ok(issueMatchesStortingetSearch(arsrapport, 'arsrapportar'));
assert.ok(issueMatchesStortingetSearch(arsrapport, 'Datatilsynet'));
assert.ok(issueMatchesStortingetSearch(arsrapport, 'Personvernnemnd'));

assert.equal(foldNorwegianForSearch('årsrapportar'), 'arsrapportar');

console.log('stortinget-issue-search.test.ts: ok');
