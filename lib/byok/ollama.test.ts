import assert from 'node:assert/strict';
import {
  isChatCapableOllamaModel,
  modelExists,
  normalizeOllamaBaseUrl,
  ollamaTagsUrl,
  readModelNamesFromTagsPayload,
} from './ollama';

assert.equal(
  ollamaTagsUrl('https://ollama.example.com/v1'),
  'https://ollama.example.com/api/tags',
);
assert.equal(ollamaTagsUrl('http://localhost:11434'), 'http://localhost:11434/api/tags');
assert.equal(ollamaTagsUrl('http://localhost:11434/api'), 'http://localhost:11434/api/tags');
assert.equal(ollamaTagsUrl('https://host/ollama/v1'), 'https://host/ollama/api/tags');
assert.equal(ollamaTagsUrl('https://host/api/tags'), 'https://host/api/tags');
assert.equal(ollamaTagsUrl('ftp://localhost'), null);
assert.equal(ollamaTagsUrl('not a url'), null);

assert.equal(modelExists(['llama3.2:latest'], 'llama3.2'), true);
assert.equal(modelExists(['llama3.2:latest'], 'llama3.2:latest'), true);
assert.equal(modelExists(['qwen3:4b'], 'llama3.2'), false);
assert.equal(modelExists(['qwen3:4b'], ''), false);

assert.equal(normalizeOllamaBaseUrl('http://localhost:11434'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('https://host/ollama/v1/'), 'https://host/ollama/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/api'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/api/tags'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('ftp://localhost'), null);
assert.equal(normalizeOllamaBaseUrl('not a url'), null);
assert.equal(normalizeOllamaBaseUrl(''), null);

assert.equal(isChatCapableOllamaModel('stemme-chat:latest'), true);
assert.equal(isChatCapableOllamaModel('llama3.2:latest'), true);
assert.equal(isChatCapableOllamaModel('qwen2.5:7b'), true);
assert.equal(isChatCapableOllamaModel('deepseek-r1:8b'), true);
assert.equal(isChatCapableOllamaModel('nomic-embed-text:latest'), false);
assert.equal(isChatCapableOllamaModel('mxbai-embed-large'), false);
assert.equal(isChatCapableOllamaModel('bge-m3'), false);
assert.equal(isChatCapableOllamaModel('qwen2.5-coder:7b'), false);
assert.equal(isChatCapableOllamaModel('codellama:7b'), false);
assert.equal(isChatCapableOllamaModel('llava:latest'), false);
assert.equal(isChatCapableOllamaModel('whisper:latest'), false);

assert.deepEqual(
  readModelNamesFromTagsPayload({
    models: [{ name: 'a' }, { model: 'b' }, { name: 'a' }],
  }),
  ['a', 'b'],
);

console.log('byok/ollama.test.ts: ok');
