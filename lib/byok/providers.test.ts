import assert from 'node:assert/strict';
import {
  DEFAULT_MODELS,
  isLlmProvider,
  looksLikeApiKey,
  normalizeBaseUrl,
  normalizeModel,
  providerNeedsApiKey,
  providerNeedsBaseUrl,
} from './providers';

assert.equal(isLlmProvider('openai'), true);
assert.equal(isLlmProvider('google'), true);
assert.equal(isLlmProvider('grok'), true);
assert.equal(isLlmProvider('ollama'), true);
assert.equal(isLlmProvider('gemini'), false);
assert.equal(looksLikeApiKey('sk-abcdefghijklmnopqrstuvwxyz'), true);
assert.equal(looksLikeApiKey('too short'), false);
assert.equal(looksLikeApiKey('has space in key value here123'), false);
assert.equal(normalizeModel('openai', ' gpt-4o '), 'gpt-4o');
assert.equal(normalizeModel('anthropic', ''), 'claude-sonnet-4-5');
assert.equal(normalizeModel('google', ''), DEFAULT_MODELS.google);
assert.equal(normalizeModel('grok', ''), DEFAULT_MODELS.grok);
assert.equal(normalizeModel('ollama', ''), DEFAULT_MODELS.ollama);
assert.equal(normalizeBaseUrl('openai', 'https://example.com'), null);
assert.equal(normalizeBaseUrl('openai_compatible', 'http://insecure.local'), null);
assert.equal(
  normalizeBaseUrl('openai_compatible', 'https://api.example.com/v1'),
  'https://api.example.com/v1',
);
assert.equal(
  normalizeBaseUrl('ollama', 'http://localhost:11434/v1'),
  'http://localhost:11434/v1',
);
assert.equal(
  normalizeBaseUrl('ollama', 'https://ollama.example.com/v1'),
  'https://ollama.example.com/v1',
);
assert.equal(normalizeBaseUrl('ollama', 'ftp://localhost:11434'), null);
assert.equal(normalizeBaseUrl('ollama', ''), null);
assert.equal(providerNeedsBaseUrl('ollama'), true);
assert.equal(providerNeedsBaseUrl('openai_compatible'), true);
assert.equal(providerNeedsBaseUrl('openai'), false);
assert.equal(providerNeedsApiKey('ollama'), false);
assert.equal(providerNeedsApiKey('google'), true);
assert.equal(providerNeedsApiKey('grok'), true);

console.log('byok/providers.test.ts: ok');
