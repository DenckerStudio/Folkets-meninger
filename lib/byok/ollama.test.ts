import assert from 'node:assert/strict';
import { listOllamaModels, modelExists, ollamaTagsUrl } from './ollama';

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

  console.log('byok/ollama.test.ts: ok');
}

void main();
