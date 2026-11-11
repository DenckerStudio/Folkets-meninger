import { buildEmbedApiUrl } from './urls';
import { DEFAULT_EMBED_HTTP_TIMEOUT_MS } from './progress-watchdog';
import { fetchJsonWithTimeout } from './fetch-with-timeout';

export function buildOllamaShowUrl(baseUrl: string): string {
  const embed = buildEmbedApiUrl(baseUrl);
  const parsed = new URL(embed);
  parsed.pathname = parsed.pathname.replace(/\/api\/embed$/, '/api/show');
  return parsed.toString();
}

/** Human-readable model / quantisation for logs (no secrets). */
export function formatOllamaShowForLog(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'ukjent modell';
  }
  const body = payload as {
    model?: string;
    details?: { family?: string; parameter_size?: string; quantization_level?: string };
    modelfile?: string;
  };
  const parts: string[] = [];
  if (body.model) parts.push(body.model);
  const q = body.details?.quantization_level;
  if (q) parts.push(`quant=${q}`);
  const ps = body.details?.parameter_size;
  if (ps) parts.push(ps);
  if (parts.length > 0) return parts.join(', ');
  return 'ukjent modell';
}

export async function fetchOllamaShowSummary(
  queryBaseUrl: string,
  model: string,
  options: { fetchImpl?: typeof fetch; httpTimeoutMs?: number } = {},
): Promise<string> {
  const url = buildOllamaShowUrl(queryBaseUrl);
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  };
  const timeoutMs = options.httpTimeoutMs ?? DEFAULT_EMBED_HTTP_TIMEOUT_MS;
  try {
    const json = await fetchJsonWithTimeout(url, init, {
      timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    return formatOllamaShowForLog(json);
  } catch {
    return 'show feilet (timeout eller nettverk)';
  }
}
