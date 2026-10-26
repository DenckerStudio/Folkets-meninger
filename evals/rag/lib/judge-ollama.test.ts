import assert from 'node:assert/strict';
import { resolveOllamaGenerateText } from './ollama-generate';
import { cascadeJudgeOllamaText } from './judge-ollama';

const jsonInThinking = '{"faithfulness":0.75,"quality":0.5,"justification":"ok"}';
assert.equal(
  resolveOllamaGenerateText({ response: '', thinking: jsonInThinking }),
  jsonInThinking,
);

async function run(): Promise<void> {
  let calls = 0;
  const text = await cascadeJudgeOllamaText(async ({ formatJson }) => {
    calls += 1;
    if (formatJson) {
      return { response: '', thinking: jsonInThinking, eval_count: 120, done_reason: 'stop' };
    }
    return { response: jsonInThinking, eval_count: 40, done_reason: 'stop' };
  });
  assert.equal(text.text, jsonInThinking);
  assert.equal(calls, 1);

  let calls2 = 0;
  await cascadeJudgeOllamaText(async ({ formatJson }) => {
    calls2 += 1;
    if (formatJson) return { response: '', thinking: '', eval_count: 1, done_reason: 'stop' };
    return { response: jsonInThinking, eval_count: 2, done_reason: 'stop' };
  });
  assert.equal(calls2, 2);
}

run()
  .then(() => {
    console.log('judge-ollama.test.ts: ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
