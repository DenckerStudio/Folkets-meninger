import assert from 'node:assert/strict';
import {
  isChatCapableOllamaModel,
  listOllamaModels,
  modelExists,
  normalizeOllamaBaseUrl,
  ollamaTagsUrl,
} from './ollama';

assert.equal(
  ollamaTagsUrl('https://ollama.heyklever.app/v1'),
  'https://ollama.heyklever.app/api/tags',
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

// Base URL is canonicalized for the OpenAI-compatible client: no trailing slash,
// `/v1` appended when missing, native suffixes stripped.
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('https://host/ollama/v1/'), 'https://host/ollama/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/api'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('http://localhost:11434/api/tags'), 'http://localhost:11434/v1');
assert.equal(normalizeOllamaBaseUrl('ftp://localhost'), null);
assert.equal(normalizeOllamaBaseUrl('not a url'), null);
assert.equal(normalizeOllamaBaseUrl(''), null);

// Only models that can answer a chat turn are offered.
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

async function main() {
  const ok = await listOllamaModels('https://ollama.example/v1', {
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ models: [{ name: 'a' }, { model: 'b' }, { name: 'a' }] }),
        { status: 200 },
      )) as typeof fetch,
  });
  assert.deepEqual(ok, { ok: true, models: ['a', 'b'] });

  const down = await listOllamaModels('https://ollama.example/v1', {
    fetchImpl: (async () => new Response('nope', { status: 502 })) as typeof fetch,
  });
  assert.equal(down.ok, false);

  const empty = await listOllamaModels('https://ollama.example/v1', {
    fetchImpl: (async () =>
      new Response(JSON.stringify({ models: [] }), { status: 200 })) as typeof fetch,
  });
  assert.equal(empty.ok, false);

  const thrown = await listOllamaModels('https://ollama.example/v1', {
    fetchImpl: (async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch,
  });
  assert.equal(thrown.ok, false);

  const invalid = await listOllamaModels('not a url');
  assert.equal(invalid.ok, false);

  // A server with only embedding/code models reports no usable chat models.
  const nonChat = await listOllamaModels('https://ollama.example/v1', {
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ models: [{ name: 'nomic-embed-text' }, { name: 'qwen2.5-coder:7b' }] }),
        { status: 200 },
      )) as typeof fetch,
  });
  assert.equal(nonChat.ok, false);

  console.log('byok/ollama.test.ts: ok');
}

void main();
