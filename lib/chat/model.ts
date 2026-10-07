import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGateway } from 'ai';
import { OLLAMA_PLACEHOLDER_API_KEY } from '@/lib/byok/providers';
import type { DecryptedByokCredential } from '@/lib/byok/service';

function requireApiKey(credential: DecryptedByokCredential): string {
  const key = credential.apiKey?.trim() ?? '';
  if (!key) {
    throw new Error(`API-nøkkel mangler for ${credential.provider}`);
  }
  return key;
}

export function createUserLanguageModel(credential: DecryptedByokCredential) {
  switch (credential.provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey: requireApiKey(credential) })(credential.model);
    case 'openai':
      return createOpenAI({ apiKey: requireApiKey(credential) })(credential.model);
    case 'grok':
      return createXai({ apiKey: requireApiKey(credential) })(credential.model);
    case 'ollama': {
      const baseURL = credential.baseUrl?.trim();
      if (!baseURL) {
        throw new Error('Ollama krever en base-URL (f.eks. http://localhost:11434/v1)');
      }
      const apiKey = credential.apiKey?.trim() || OLLAMA_PLACEHOLDER_API_KEY;
      return createOpenAI({
        apiKey,
        baseURL,
        name: 'ollama',
      })(credential.model);
    }
    case 'anthropic':
      return createAnthropic({ apiKey: requireApiKey(credential) })(credential.model);
    case 'openai_compatible':
      return createOpenAI({
        apiKey: requireApiKey(credential),
        baseURL: credential.baseUrl ?? undefined,
        name: 'openai-compatible',
      })(credential.model);
    case 'ai_gateway':
      return createGateway({ apiKey: requireApiKey(credential) })(credential.model);
    default: {
      const exhaustive: never = credential.provider;
      throw new Error(`Ukjent leverandør: ${String(exhaustive)}`);
    }
  }
}
