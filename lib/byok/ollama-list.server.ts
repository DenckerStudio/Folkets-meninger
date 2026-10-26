import 'server-only';
import {
  type ByokOutboundAccess,
  assertSafeByokBaseUrl,
  assertSafeOutboundUrl,
  BYOK_OLLAMA_UNREACHABLE_NB,
  resolveAllowPrivateForUrl,
} from '@/lib/byok/url-guard';
import { fetchOllamaChatModels, ollamaTagsUrl, type OllamaModelsResult } from '@/lib/byok/ollama';

export async function listOllamaModels(
  baseUrl: string,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    outbound?: ByokOutboundAccess;
  } = {},
): Promise<OllamaModelsResult> {
  const outbound = options.outbound ?? { isAdmin: false };
  const tagsEndpoint = ollamaTagsUrl(baseUrl);
  if (!tagsEndpoint) {
    return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
  }
  try {
    await assertSafeByokBaseUrl(baseUrl, outbound);
    const allowPrivate = resolveAllowPrivateForUrl(baseUrl, outbound);
    await assertSafeOutboundUrl(tagsEndpoint, {
      allowPrivate,
      lookup: outbound.lookup,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[byok/ollama] blocked outbound url:', detail);
    return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
  }

  return fetchOllamaChatModels(baseUrl, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
}
