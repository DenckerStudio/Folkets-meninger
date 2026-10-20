import assert from 'node:assert/strict';
import { extractJsonObject, parseJudgeScoresJson } from './judge-parse';

const wrapped = 'Here is the result:\n```json\n{"faithfulness":0.75,"quality":0.5,"justification":"ok"}\n```\n';
const parsed = parseJudgeScoresJson(wrapped);
assert.ok(parsed);
assert.equal(parsed!.faithfulness, 0.75);

const trailingGarbage =
  '{"faithfulness":1,"quality":0.25,"justification":"x"} extra text {broken';
assert.equal(extractJsonObject(trailingGarbage)?.includes('"faithfulness":1'), true);

const brokenInner = '{"faithfulness":1,"quality":0.5,"justification":"has " quote"}';
assert.equal(parseJudgeScoresJson(brokenInner), null);

const good = '{"faithfulness":0.5,"quality":0.5,"justification":"test"}';
assert.equal(parseJudgeScoresJson(good)?.quality, 0.5);

console.log('judge-parse.test.ts: ok');
