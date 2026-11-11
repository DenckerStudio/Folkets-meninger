import { buildEmbedApiUrl } from './urls';
import { OLLAMA_EMBED_API_MODEL } from './provider';
import { VECTOR_V2_DIMENSIONS } from '@/lib/chat/vector-search';
import { validateEmbeddingVector, type EmbedRow } from './embed-batch';
import { DEFAULT_EMBED_HTTP_TIMEOUT_MS } from './progress-watchdog';
import { fetchJsonWithTimeout } from './fetch-with-timeout';

export type OllamaEmbedOptions = {
  fetchImpl?: typeof fetch;
  keepAlive?: string;
  probeText?: string | null;
  apiModel?: string;
  httpTimeoutMs?: number;
};

function resolveEmbedHttpTimeoutMs(options: OllamaEmbedOptions): number {
  return options.httpTimeoutMs ?? DEFAULT_EMBED_HTTP_TIMEOUT_MS;
}

async function ollamaEmbedJson(
  apiUrl: string,
  body: Record<string, unknown>,
  options: OllamaEmbedOptions,
  httpErrorLabel: string,
): Promise<unknown> {
  const timeoutMs = resolveEmbedHttpTimeoutMs(options);
  try {
    return await fetchJsonWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      { timeoutMs, fetchImpl: options.fetchImpl },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('HTTP ')) {
      throw new Error(`${httpErrorLabel}: ${message}`);
    }
    throw err;
  }
}

export async function fetchOllamaEmbedVectors(
  baseUrl: string,
  texts: string[],
  options: OllamaEmbedOptions = {},
): Promise<{ vectors: number[][]; reportedModel?: string }> {
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  const payload = await ollamaEmbedJson(
    apiUrl,
    {
      model,
      input: texts,
      truncate: true,
      keep_alive: options.keepAlive ?? '30m',
    },
    options,
    'Ollama embed feilet',
  );
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
    const probeJson = await ollamaEmbedJson(
      apiUrl,
      {
        model,
        input: [options.probeText],
        truncate: true,
        keep_alive: options.keepAlive ?? '30m',
      },
      options,
      'Probe embed feilet',
    );
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
