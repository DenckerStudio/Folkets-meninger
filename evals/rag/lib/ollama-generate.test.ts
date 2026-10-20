import assert from 'node:assert/strict';
import { buildOllamaGenerateBody } from './ollama-generate';

const body = buildOllamaGenerateBody({
  model: 'gemma4:26b',
  prompt: 'test',
  think: false,
  numPredict: 768,
});

const serialized = JSON.stringify(body);
assert.ok(serialized.includes('"think":false'), 'Ollama generate body must set think:false for gemma4');
assert.equal(body.think, false);

console.log('ollama-generate.test.ts: ok');
