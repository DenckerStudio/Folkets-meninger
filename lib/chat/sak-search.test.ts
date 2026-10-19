import assert from 'node:assert/strict';
import {
  buildSearchTerms,
  escapeIlike,
  looksLikeIssueId,
  rankSakRows,
  scoreSakRow,
  significantTokens,
  type SakSearchRow,
} from './sak-search';

function row(partial: Partial<SakSearchRow>): SakSearchRow {
  return {
    id: '1',
    title: null,
    summary: null,
    henvisning: null,
    ferdigbehandlet: null,
    ...partial,
  };
}

assert.deepEqual(escapeIlike('50%_x\\y'), '50\\%\\_x\\\\y');
assert.deepEqual(escapeIlike('vektgrense'), 'vektgrense');

assert.deepEqual(significantTokens('Hva er loven om innvandring?'), [
  'innvandring',
]);
assert.deepEqual(significantTokens('Lov om bosted', 'bosted'), ['bosted']);

assert.deepEqual(buildSearchTerms('hva koster innvandringsloven'), [
  'koster',
  'innvandringsloven',
]);
assert.equal(buildSearchTerms('   ').length, 0);
assert.equal(buildSearchTerms('hva er loven?').length, 1);

assert.equal(looksLikeIssueId('200365'), true);
assert.equal(looksLikeIssueId('Prop. 103 L'), false);

const phrase = 'hva koster innvandringsloven';
const terms = buildSearchTerms(phrase);
const titleMatch = row({
  id: 'a',
  title: 'Innvandringsloven',
  summary: 'Lov om innvandring.',
  henvisning: 'Prop. 103 L',
});
const summaryOnly = row({
  id: 'b',
  title: 'Skattekutten for familier',
  summary: 'Omtaler innvandringsloven i enkelte tilfeller.',
});
const noMatch = row({ id: 'c', title: 'Vegrensaking', summary: 'Hastighet.' });

assert.ok(scoreSakRow(titleMatch, terms, phrase) > 0);
assert.ok(scoreSakRow(summaryOnly, terms, phrase) > 0);
assert.equal(scoreSakRow(noMatch, terms, phrase), 0);

const ranked = rankSakRows([noMatch, summaryOnly, titleMatch], terms, phrase, 6);
assert.deepEqual(ranked.map((r) => r.id), ['a', 'b']);

const limited = rankSakRows([titleMatch, summaryOnly], terms, phrase, 1);
assert.deepEqual(limited.map((r) => r.id), ['a']);

const deduped = rankSakRows([titleMatch, titleMatch], terms, phrase, 6);
assert.deepEqual(deduped.map((r) => r.id), ['a']);

console.log('chat/sak-search.test.ts: ok');