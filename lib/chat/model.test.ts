import assert from 'node:assert/strict';
import { createUserLanguageModel } from './model';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import { DEFAULT_MODELS, LLM_PROVIDERS, type LlmProvider } from '@/lib/byok/providers';

function credential(
  provider: LlmProvider,
  overrides: Partial<DecryptedByokCredential> = {},
): DecryptedByokCredential {
  return {
    provider,
    model: DEFAULT_MODELS[provider],
    baseUrl:
      provider === 'ollama' || provider === 'openai_compatible'
        ? 'http://localhost:11434/v1'
        : null,
    keyLast4: 'test',
    updatedAt: new Date().toISOString(),
    apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234',
    ...overrides,
  };
}

for (const provider of LLM_PROVIDERS) {
  const baseUrl =
    provider === 'ollama'
      ? 'http://localhost:11434/v1'
      : provider === 'openai_compatible'
        ? 'https://api.example.com/v1'
        : null;
  const model = createUserLanguageModel(credential(provider, { baseUrl }));
  assert.ok(model, `factory should return a model for ${provider}`);
}

assert.throws(
  () => createUserLanguageModel(credential('google', { apiKey: '' })),
  /API-nøkkel mangler/,
);
assert.throws(
  () => createUserLanguageModel(credential('grok', { apiKey: '   ' })),
  /API-nøkkel mangler/,
);
assert.throws(
  () => createUserLanguageModel(credential('ollama', { baseUrl: null })),
  /Ollama krever en base-URL/,
);

const ollamaNoKey = createUserLanguageModel(
  credential('ollama', { apiKey: '', baseUrl: 'http://127.0.0.1:11434/v1' }),
);
assert.ok(ollamaNoKey, 'ollama should accept empty API key');

console.log('chat/model.test.ts: ok');
