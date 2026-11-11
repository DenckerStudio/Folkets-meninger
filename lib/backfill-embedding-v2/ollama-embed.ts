import { buildEmbedApiUrl } from './urls';
import { OLLAMA_EMBED_API_MODEL } from './provider';
import { VECTOR_V2_DIMENSIONS } from '@/lib/chat/vector-search';
import { validateEmbeddingVector, type EmbedRow } from './embed-batch';
import { fetchWithTimeout } from './fetch-with-timeout';

export type OllamaEmbedOptions = {
  fetchImpl?: typeof fetch;
  keepAlive?: string;
  probeText?: string | null;
  apiModel?: string;
  httpTimeoutMs?: number;
};

async function ollamaFetch(
  apiUrl: string,
  body: Record<string, unknown>,
  options: OllamaEmbedOptions,
): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  if (options.httpTimeoutMs != null) {
    return fetchWithTimeout(apiUrl, init, {
      timeoutMs: options.httpTimeoutMs,
      fetchImpl: options.fetchImpl,
    });
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  return fetchImpl(apiUrl, init);
}

export async function fetchOllamaEmbedVectors(
  baseUrl: string,
  texts: string[],
  options: OllamaEmbedOptions = {},
): Promise<{ vectors: number[][]; reportedModel?: string }> {
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  const res = await ollamaFetch(
    apiUrl,
    {
      model,
      input: texts,
      truncate: true,
      keep_alive: options.keepAlive ?? '30m',
    },
    options,
  );

  if (!res.ok) {
    throw new Error(`Ollama embed feilet: HTTP ${res.status}`);
  }

  const payload = await res.json();
  const embeddings = (payload as { embeddings?: unknown[][] }).embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error('Ollama embed returnerte feil antall vektorer');
  }

  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += 1) {
    const vec = validateEmbeddingVector({ embeddings: [embeddings[i]] });
    if (!vec) {
      const raw = embeddings[i];
      const dim = Array.isArray(raw) ? raw.length : 0;
      throw new Error(
        `Ugyldig Ollama-vektor for input ${i}: forventet ${VECTOR_V2_DIMENSIONS} dim, fikk ${dim}`,
      );
    }
    vectors.push(vec);
  }

  return { vectors, reportedModel: model };
}

export async function fetchOllamaEmbedBatch(
  baseUrl: string,
  rows: EmbedRow[],
  options: OllamaEmbedOptions = {},
): Promise<{ vectors: Map<string, number[]>; latencyMs: number; reportedModel?: string }> {
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const started = Date.now();
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  if (options.probeText) {
    const probeRes = await ollamaFetch(
      apiUrl,
      {
        model,
        input: [options.probeText],
        truncate: true,
        keep_alive: options.keepAlive ?? '30m',
      },
      options,
    );
    if (!probeRes.ok) {
      throw new Error(`Probe embed feilet: HTTP ${probeRes.status}`);
    }
    const probeJson = await probeRes.json();
    if (!validateEmbeddingVector(probeJson)) {
      throw new Error('Probe embed returnerte ugyldig vektor');
    }
  }

  const { vectors: list, reportedModel } = await fetchOllamaEmbedVectors(baseUrl, rows.map((r) => r.content), {
    ...options,
    apiModel: model,
  });

  const vectors = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    vectors.set(rows[i].id, list[i]);
  }

  return { vectors, latencyMs: Date.now() - started, reportedModel };
}
