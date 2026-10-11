/** Ollama discovery helpers for BYOK. Stored base URLs are OpenAI-compatible (`…/v1`). */

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_MODELS = 200;

export type OllamaModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

/**
 * Map an OpenAI-compatible Ollama base URL to a native API endpoint.
 * Strips a trailing `/v1`, `/api`, or `/api/tags` so proxied prefixes survive.
 */
export function ollamaApiUrl(baseUrl: string, suffix: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/(?:v1|api\/tags|api|tags)$/i, '');

  return `${url.origin}${path}/api/${suffix}`;
}

export function ollamaTagsUrl(baseUrl: string): string | null {
  return ollamaApiUrl(baseUrl, 'tags');
}

function readModelNames(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  const names = models
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as { name?: unknown; model?: unknown };
        const value = record.name ?? record.model;
        return typeof value === 'string' ? value.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);

  return Array.from(new Set(names)).slice(0, MAX_MODELS);
}

/** Ollama reports tagged names (`llama3.2:latest`); accept an untagged user entry too. */
export function modelExists(models: readonly string[], model: string): boolean {
  const wanted = model.trim();
  if (!wanted) return false;
  if (models.includes(wanted)) return true;
  return models.includes(`${wanted}:latest`);
}

export async function listOllamaModels(
  baseUrl: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<OllamaModelsResult> {
  const tagsUrl = ollamaTagsUrl(baseUrl);
  if (!tagsUrl) {
    return { ok: false, error: 'Ugyldig Ollama-URL. Bruk http:// eller https://.' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchImpl(tagsUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ok: false, error: `Ollama svarte ${response.status} på ${tagsUrl}.` };
    }

    const models = readModelNames(await response.json());
    if (models.length === 0) {
      return { ok: false, error: `Fant ingen modeller på Ollama-serveren (${tagsUrl}).` };
    }
    return { ok: true, models };
  } catch {
    return { ok: false, error: `Kunne ikke nå Ollama på ${tagsUrl}.` };
  }
}
