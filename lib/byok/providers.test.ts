import assert from 'node:assert/strict';
import {
  isLlmProvider,
  looksLikeApiKey,
  normalizeBaseUrl,
  normalizeModel,
} from './providers';

assert.equal(isLlmProvider('openai'), true);
assert.equal(isLlmProvider('gemini'), false);
assert.equal(looksLikeApiKey('sk-abcdefghijklmnopqrstuvwxyz'), true);
assert.equal(looksLikeApiKey('too short'), false);
assert.equal(looksLikeApiKey('has space in key value here123'), false);
assert.equal(normalizeModel('openai', ' gpt-4o '), 'gpt-4o');
assert.equal(normalizeModel('anthropic', ''), 'claude-sonnet-4-5');
assert.equal(normalizeBaseUrl('openai', 'https://example.com'), null);
assert.equal(normalizeBaseUrl('openai_compatible', 'http://insecure.local'), null);
assert.equal(
  normalizeBaseUrl('openai_compatible', 'https://api.example.com/v1'),
  'https://api.example.com/v1',
);

console.log('byok/providers.test.ts: ok');
