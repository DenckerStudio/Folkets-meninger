import { buildEmbedApiUrl } from './urls';

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
  options: { fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildOllamaShowUrl(queryBaseUrl);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    return `show feilet HTTP ${res.status}`;
  }
  const json = await res.json();
  return formatOllamaShowForLog(json);
}
