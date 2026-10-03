import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGateway } from 'ai';
import type { DecryptedByokCredential } from '@/lib/byok/service';

export function createUserLanguageModel(credential: DecryptedByokCredential) {
  switch (credential.provider) {
    case 'openai':
      return createOpenAI({ apiKey: credential.apiKey })(credential.model);
    case 'anthropic':
      return createAnthropic({ apiKey: credential.apiKey })(credential.model);
    case 'openai_compatible':
      return createOpenAI({
        apiKey: credential.apiKey,
        baseURL: credential.baseUrl ?? undefined,
        name: 'openai-compatible',
      })(credential.model);
    case 'ai_gateway':
      return createGateway({ apiKey: credential.apiKey })(credential.model);
    default: {
      const exhaustive: never = credential.provider;
      throw new Error(`Ukjent leverandør: ${String(exhaustive)}`);
    }
  }
}
