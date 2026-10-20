import assert from 'node:assert/strict';
import {
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
  excerpts: ['foo'],
  goldFacts: ['avløpsdirektiv'],
});
assert.equal(row.incorrectRefusal, true);

const keys = extractSourceKeys('Dokument 8:15 S (2025-2026), Innst. 100 S');
assert.ok(keys.includes('dok:8:15:S'));
assert.ok(keys.includes('innst:100:S'));

console.log('answer-metrics.test.ts: ok');
