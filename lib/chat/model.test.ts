import assert from 'node:assert/strict';
import { createUserLanguageModel } from './model';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import { DEFAULT_MODELS, LLM_PROVIDERS, type LlmProvider } from '@/lib/byok/providers';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const outbound = { isAdmin: false, lookup: publicLookup };

function credential(
  provider: LlmProvider,
  overrides: Partial<DecryptedByokCredential> = {},
): DecryptedByokCredential {
  return {
    provider,
    model: DEFAULT_MODELS[provider],
    baseUrl:
      provider === 'ollama' || provider === 'openai_compatible'
        ? 'https://ollama.example.com/v1'
        : null,
    keyLast4: 'test',
    updatedAt: new Date().toISOString(),
    apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234',
    ...overrides,
  };
}

async function main() {
  for (const provider of LLM_PROVIDERS) {
    const baseUrl =
      provider === 'ollama'
        ? 'https://ollama.example.com/v1'
        : provider === 'openai_compatible'
          ? 'https://api.example.com/v1'
          : null;
    const model = await createUserLanguageModel(credential(provider, { baseUrl }), outbound);
    assert.ok(model, `factory should return a model for ${provider}`);
  }

  await assert.rejects(
    () => createUserLanguageModel(credential('google', { apiKey: '' }), outbound),
    /API-nøkkel mangler/,
  );
  await assert.rejects(
    () => createUserLanguageModel(credential('grok', { apiKey: '   ' }), outbound),
    /API-nøkkel mangler/,
  );
  await assert.rejects(
    () => createUserLanguageModel(credential('ollama', { baseUrl: null }), outbound),
    /Ollama krever en base-URL/,
  );

  for (const provider of ['ollama', 'openai_compatible'] as const) {
    const model = await createUserLanguageModel(credential(provider), outbound);
    assert.equal(
      model.constructor.name,
      'OpenAIChatLanguageModel',
      `${provider} should use the OpenAI Chat Completions model`,
    );
  }

  const ollamaNoKey = await createUserLanguageModel(
    credential('ollama', { apiKey: '', baseUrl: 'https://ollama.example.com/v1' }),
    outbound,
  );
  assert.ok(ollamaNoKey, 'ollama should accept empty API key');

  console.log('chat/model.test.ts: ok');
}

void main();
