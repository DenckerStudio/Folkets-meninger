import assert from 'node:assert/strict';
import { displayModelName } from './model-display';

function run() {
  // Ollama library tags: family only.
  assert.equal(displayModelName('gemma4:27b-it-qat'), 'gemma4');
  assert.equal(displayModelName('qwen3.5:32b-instruct-q8_0'), 'qwen3.5');

  // Size / quant / context tokens are dropped.
  assert.equal(displayModelName('llama3.1-8b'), 'llama3.1');
  assert.equal(displayModelName('mistral-7b-q4_k_m'), 'mistral');
  assert.equal(displayModelName('phi4-14b-128k'), 'phi4');
  // Bare trailing number (dims, not a context size) is left alone.
  assert.equal(displayModelName('nomic-embed-text-v1.5-768'), 'nomic-embed-text-v1.5-768');

  // Parentheticals stripped before tokenizing.
  assert.equal(displayModelName('gemma4 (instruct, quantized)'), 'gemma4');

  // Colon tag always truncated at first colon, even without size.
  assert.equal(displayModelName('llama3:latest'), 'llama3');

  // Idempotent on already-clean family names.
  assert.equal(displayModelName('gemma4'), 'gemma4');
  assert.equal(displayModelName('qwen3.5'), 'qwen3.5');

  // Empty / nullish inputs.
  assert.equal(displayModelName(''), '');
  assert.equal(displayModelName(null), '');
  assert.equal(displayModelName(undefined), '');

  // Never returns an empty string for a non-empty raw value.
  assert.notEqual(displayModelName('q8_0'), '');

  console.log('model-display.test.ts: ok');
}

run();
