import assert from 'node:assert/strict';
import { buildOllamaGenerateBody, resolveOllamaGenerateText } from './ollama-generate';

const body = buildOllamaGenerateBody({
  model: 'gemma4:26b',
  prompt: 'test',
  think: false,
  numPredict: 768,
});

const serialized = JSON.stringify(body);
assert.ok(serialized.includes('"think":false'), 'Ollama generate body must set think:false for gemma4');
assert.equal(body.think, false);

const jsonBody = buildOllamaGenerateBody({
  model: 'gemma4:26b',
  prompt: 'test',
  think: false,
  format: 'json',
});
assert.equal(jsonBody.format, 'json');

assert.equal(
  resolveOllamaGenerateText({ response: '', thinking: '{"a":1}' }),
  '{"a":1}',
);

console.log('ollama-generate.test.ts: ok');
