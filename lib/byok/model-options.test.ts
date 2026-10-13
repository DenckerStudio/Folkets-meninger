import assert from 'node:assert/strict';
import { buildModelOptions, modelOptionLabel } from './model-options';

assert.deepEqual(
  buildModelOptions({ serverModels: ['qwen3:4b', 'llama3.2'], presets: [], current: 'llama3.2' }),
  ['qwen3:4b', 'llama3.2'],
);

assert.deepEqual(
  buildModelOptions({ serverModels: [], presets: ['gpt-4o', 'gpt-4o-mini'], current: 'gpt-4o' }),
  ['gpt-4o', 'gpt-4o-mini'],
);

assert.deepEqual(
  buildModelOptions({ presets: ['gpt-4o-mini'], current: 'custom-model-42' }),
  ['gpt-4o-mini', 'custom-model-42'],
);

assert.deepEqual(
  buildModelOptions({ serverModels: ['a', 'a', ' b '], presets: ['b', 'c'], current: 'c' }),
  ['a', 'b', 'c'],
);

assert.deepEqual(buildModelOptions({}), []);
assert.deepEqual(
  buildModelOptions({ presets: ['', '   '], current: '' }),
  [],
);

// The recommended Ollama chat model is surfaced first and deduped.
assert.deepEqual(
  buildModelOptions({
    serverModels: ['llama3.2', 'stemme-chat:latest'],
    presets: [],
    current: 'llama3.2',
    recommended: 'stemme-chat:latest',
  }),
  ['stemme-chat:latest', 'llama3.2'],
);

assert.equal(modelOptionLabel('stemme-chat:latest'), 'stemme-chat:latest (anbefalt)');
assert.equal(modelOptionLabel('llama3.2'), 'llama3.2');

console.log('byok/model-options.test.ts: ok');
