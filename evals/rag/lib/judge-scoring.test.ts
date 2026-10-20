import assert from 'node:assert/strict';
import { scoreDeterministicRow } from './answer-metrics';
import { applyParsedJudgeScores, summarizeLlmJudged } from './judge-scoring';

const det = scoreDeterministicRow({
  id: 't',
  query: 'q',
  answer: 'svar',
  excerpts: ['e'],
  goldFacts: ['fact'],
});

const ok = applyParsedJudgeScores({ id: 't', goldFacts: ['fact'] }, det, {
  faithfulness: 0.8,
  quality: 0.9,
  justification: 'ok',
});
assert.equal(ok.judgeError, undefined);
assert.equal(ok.faithfulness, 0.75);

const stats = summarizeLlmJudged([
  ok,
  { id: 'e', deterministic: det, judgeError: 'JSON.parse failed' },
]);
assert.equal(stats.judgeErrorCount, 1);
assert.equal(stats.count, 1);
assert.equal(stats.judgeErrorRate, 0.5);

console.log('judge-scoring.test.ts: ok');
