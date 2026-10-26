import assert from 'node:assert/strict';
import { assertJudgeDiffersFromAnswerModel } from './judge-model-guard';

const prev = process.env.ALLOW_SAME_JUDGE;
const prevAnswer = process.env.ANSWER_LLM_MODEL;
delete process.env.ALLOW_SAME_JUDGE;
process.env.ANSWER_LLM_MODEL = 'gemma4:26b';

assert.throws(
  () => assertJudgeDiffersFromAnswerModel({ judgeModel: 'gemma4:26b', answerModel: 'gemma4:26b' }),
  /must differ/,
);

process.env.ALLOW_SAME_JUDGE = '1';
assert.doesNotThrow(() =>
  assertJudgeDiffersFromAnswerModel({ judgeModel: 'gemma4:26b', answerModel: 'gemma4:26b' }),
);

if (prev === undefined) delete process.env.ALLOW_SAME_JUDGE;
else process.env.ALLOW_SAME_JUDGE = prev;
if (prevAnswer === undefined) delete process.env.ANSWER_LLM_MODEL;
else process.env.ANSWER_LLM_MODEL = prevAnswer;

console.log('judge-model-guard.test.ts: ok');
