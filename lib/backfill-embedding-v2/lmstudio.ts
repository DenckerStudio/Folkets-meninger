import { OLLAMA_EMBED_API_MODEL } from './provider';
import { validateEmbeddingVector, type EmbedRow } from './embed-batch';

export function buildOpenAiEmbeddingsUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl.trim());
  const path = parsed.pathname.replace(/\/$/, '');
  if (path.endsWith('/v1/embeddings')) {
    parsed.pathname = path;
  } else if (path.endsWith('/v1')) {
    parsed.pathname = `${path}/embeddings`;
  } else {
    parsed.pathname = `${path === '' ? '' : path}/v1/embeddings`;
  }
  return parsed.toString();
}

export type LmStudioEmbedOptions = {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  apiModel?: string;
};

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = apiKey?.trim();
  if (key) {
    headers.authorization = `Bearer ${key}`;
  }
  return headers;
}

function parseOpenAiEmbeddingsResponse(
  payload: unknown,
  expectedCount: number,
): { vectors: number[][]; reportedModel?: string } {
  const body = payload as {
    data?: { embedding?: unknown; index?: number }[];
    model?: string;
  };
  if (!Array.isArray(body.data) || body.data.length !== expectedCount) {
    throw new Error('LM Studio embeddings returnerte feil antall vektorer');
  }

  const ordered = [...body.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const vectors: number[][] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const vec = validateEmbeddingVector({ embedding: ordered[i].embedding });
    if (!vec) {
      throw new Error(`Ugyldig LM Studio-vektor for input ${i}`);
    }
    vectors.push(vec);
  }

  const reportedModel = typeof body.model === 'string' ? body.model : undefined;
  return { vectors, reportedModel };
}

export async function fetchLmStudioEmbedVectors(
  baseUrl: string,
  texts: string[],
  options: LmStudioEmbedOptions = {},
): Promise<{ vectors: number[][]; reportedModel?: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = buildOpenAiEmbeddingsUrl(baseUrl);
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  const res = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: authHeaders(options.apiKey),
    body: JSON.stringify({
      model,
      input: texts,
    }),
  });

  if (!res.ok) {
    throw new Error(`LM Studio embed feilet: HTTP ${res.status}`);
  }

  const payload = await res.json();
  return parseOpenAiEmbeddingsResponse(payload, texts.length);
}

export async function fetchLmStudioEmbedBatch(
  baseUrl: string,
  rows: EmbedRow[],
  options: LmStudioEmbedOptions = {},
): Promise<{ vectors: Map<string, number[]>; latencyMs: number; reportedModel?: string }> {
  const started = Date.now();
  const { vectors: list, reportedModel } = await fetchLmStudioEmbedVectors(
    baseUrl,
    rows.map((r) => r.content),
    options,
  );

  const vectors = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    vectors.set(rows[i].id, list[i]);
  }

  return { vectors, latencyMs: Date.now() - started, reportedModel };
}

/** Map OpenAI/LM Studio model string to embedding_v2_model tag when quant is visible. */
export function inferModelTagFromApiModel(reportedModel: string | undefined): string | undefined {
  const m = reportedModel?.trim();
  if (!m || m === OLLAMA_EMBED_API_MODEL) {
    return undefined;
  }
  if (/Q8_0/i.test(m)) {
    return 'bge-m3:Q8_0 (gpustack GGUF, lmstudio)';
  }
  if (m.includes('(') || m.includes(':')) {
    return m;
  }
  return undefined;
}
