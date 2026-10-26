import 'server-only';
import {
  type ByokOutboundAccess,
  assertSafeByokBaseUrl,
  assertSafeOutboundUrl,
  BYOK_OLLAMA_UNREACHABLE_NB,
  createValidatingDnsLookup,
  resolveAllowPrivateForUrl,
} from '@/lib/byok/url-guard';
import { createByokPinnedFetch } from '@/lib/byok/pinned-fetch.server';
import {
  isChatCapableOllamaModel,
  ollamaTagsUrl,
  type OllamaModelsResult,
} from '@/lib/byok/ollama';
import { readModelNamesFromTagsPayload } from '@/lib/byok/ollama';

const DEFAULT_TIMEOUT_MS = 8000;

async function fetchOllamaChatModelsPinned(
  baseUrl: string,
  options: { fetchImpl: typeof fetch; timeoutMs?: number },
): Promise<OllamaModelsResult> {
  const tagsUrl = ollamaTagsUrl(baseUrl);
  if (!tagsUrl) {
    return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await options.fetchImpl(tagsUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      console.warn('[byok/ollama] redirect blocked for tags fetch');
      return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
    }
    if (!response.ok) {
      console.warn('[byok/ollama] tags fetch failed with status', response.status);
      return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
    }

    const models = readModelNamesFromTagsPayload(await response.json()).filter(
      isChatCapableOllamaModel,
    );
    if (models.length === 0) {
      return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
    }
    return { ok: true, models };
  } catch (error) {
    console.warn(
      '[byok/ollama] tags fetch error:',
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
  }
}

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
    const lookup = createValidatingDnsLookup(outbound, allowPrivate);
    await assertSafeOutboundUrl(tagsEndpoint, {
      allowPrivate,
      lookup,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[byok/ollama] blocked outbound url:', detail);
    return { ok: false, error: BYOK_OLLAMA_UNREACHABLE_NB };
  }

  const fetchImpl =
    options.fetchImpl ?? createByokPinnedFetch(outbound, baseUrl);

  return fetchOllamaChatModelsPinned(baseUrl, {
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
}
