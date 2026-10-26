import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGateway } from 'ai';
import { normalizeOllamaBaseUrl } from '@/lib/byok/ollama';
import { OLLAMA_PLACEHOLDER_API_KEY } from '@/lib/byok/providers';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import { createByokPinnedFetch } from '@/lib/byok/pinned-fetch.server';
import {
  BYOK_OLLAMA_UNREACHABLE_NB,
  type ByokOutboundAccess,
  assertSafeByokBaseUrl,
} from '@/lib/byok/url-guard';

function requireApiKey(credential: DecryptedByokCredential): string {
  const key = credential.apiKey?.trim() ?? '';
  if (!key) {
    throw new Error(`API-nøkkel mangler for ${credential.provider}`);
  }
  return key;
}

export async function createUserLanguageModel(
  credential: DecryptedByokCredential,
  outbound: ByokOutboundAccess,
) {
  switch (credential.provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey: requireApiKey(credential) })(credential.model);
    case 'openai':
      return createOpenAI({ apiKey: requireApiKey(credential) })(credential.model);
    case 'grok':
      return createXai({ apiKey: requireApiKey(credential) })(credential.model);
    case 'ollama': {
      const rawBase = credential.baseUrl?.trim();
      if (!rawBase) {
        throw new Error('Ollama krever en base-URL (f.eks. https://din-ollama.example.no/v1)');
      }
      const baseURL = normalizeOllamaBaseUrl(rawBase);
      if (!baseURL) {
        throw new Error('Ollama krever en gyldig base-URL (http:// eller https://).');
      }
      try {
        await assertSafeByokBaseUrl(baseURL, outbound);
      } catch (error) {
        console.warn(
          '[chat/model] blocked ollama base url:',
          error instanceof Error ? error.message : error,
        );
        throw new Error(BYOK_OLLAMA_UNREACHABLE_NB);
      }
      const apiKey = credential.apiKey?.trim() || OLLAMA_PLACEHOLDER_API_KEY;
      const pinnedFetch = createByokPinnedFetch(outbound, baseURL);
      return createOpenAI({
        apiKey,
        baseURL,
        name: 'ollama',
        fetch: pinnedFetch,
      }).chat(credential.model);
    }
    case 'anthropic':
      return createAnthropic({ apiKey: requireApiKey(credential) })(credential.model);
    case 'openai_compatible': {
      const baseURL = credential.baseUrl?.trim();
      if (!baseURL) {
        throw new Error('OpenAI-kompatibel leverandør krever en https-base-URL.');
      }
      try {
        await assertSafeByokBaseUrl(baseURL, outbound);
      } catch (error) {
        console.warn(
          '[chat/model] blocked openai_compatible base url:',
          error instanceof Error ? error.message : error,
        );
        throw new Error(BYOK_OLLAMA_UNREACHABLE_NB);
      }
      const pinnedFetch = createByokPinnedFetch(outbound, baseURL);
      return createOpenAI({
        apiKey: requireApiKey(credential),
        baseURL,
        name: 'openai-compatible',
        fetch: pinnedFetch,
      }).chat(credential.model);
    }
    case 'ai_gateway':
      return createGateway({ apiKey: requireApiKey(credential) })(credential.model);
    default: {
      const exhaustive: never = credential.provider;
      throw new Error(`Ukjent leverandør: ${String(exhaustive)}`);
    }
  }
}
