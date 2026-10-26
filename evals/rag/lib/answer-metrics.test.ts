import assert from 'node:assert/strict';
import {
  auditAnswerCitationSupport,
  extractSourceKeys,
  isRefusalAnswer,
  scoreDeterministicRow,
  scoreGoldFactsInAnswer,
} from './answer-metrics';

assert.equal(scoreGoldFactsInAnswer('nullutslipp i transport', ['nullutslipp']).hit, true);
assert.equal(scoreGoldFactsInAnswer('co2 utslipp', ['co2-utslipp']).hit, true);
assert.equal(isRefusalAnswer('Kildene inneholder ikke informasjon om havvind.'), true);

const row = scoreDeterministicRow({
  id: 't',
  query: 'q',
  answer: 'Kildene inneholder ikke informasjon om X.',
  excerpts: ['avløpsdirektiv i EU'],
  goldFacts: ['avløpsdirektiv'],
});
assert.equal(row.incorrectRefusal, true);

const miss = scoreDeterministicRow({
  id: 't2',
  query: 'q',
  answer: 'Kildene inneholder ikke informasjon om havvind.',
  excerpts: ['kun co2 og forurensning'],
  goldFacts: ['havvind'],
});
assert.equal(miss.incorrectRefusal, false);
assert.equal(miss.retrievalMissRefusal, true);

const keys = extractSourceKeys('Dokument 8:15 S (2025-2026), Innst. 100 S');
assert.ok(keys.includes('dok:8:15:S'));
assert.ok(keys.includes('innst:100:S'));

const citeFail = auditAnswerCitationSupport('Beløpet er 500 millioner kr.', ['Ingen beløp nevnt.']);
assert.equal(citeFail.citationSupportPass, false);
assert.ok(citeFail.unsupportedNumbers.some((n) => n.includes('500')));

const citeOk = auditAnswerCitationSupport('Saken gjelder 2025.', ['Stortinget behandlet saken i 2025.']);
assert.equal(citeOk.citationSupportPass, true);

const substringFail = auditAnswerCitationSupport('Kostnaden er 500 kr.', ['Beløpet var 1500 kr totalt.']);
assert.equal(substringFail.citationSupportPass, false);

const curlyOk = auditAnswerCitationSupport('De skrev \u201cfolkevalgt demokrati\u201d i teksten.', [
  'Innledningen sier folkevalgt demokrati er viktig.',
]);
assert.equal(curlyOk.citationSupportPass, true);

console.log('answer-metrics.test.ts: ok');
