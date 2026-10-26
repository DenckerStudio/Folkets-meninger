import { buildEmbedApiUrl } from './urls';
import { OLLAMA_EMBED_API_MODEL, type BackfillProvider } from './provider';
import { validateEmbeddingVector, type EmbedRow } from './embed-batch';

export type OllamaEmbedOptions = {
  fetchImpl?: typeof fetch;
  keepAlive?: string;
  probeText?: string | null;
  apiModel?: string;
};

export async function fetchOllamaEmbedVectors(
  baseUrl: string,
  texts: string[],
  options: OllamaEmbedOptions = {},
): Promise<{ vectors: number[][]; reportedModel?: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  const res = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input: texts,
      truncate: true,
      keep_alive: options.keepAlive ?? '30m',
    }),
  });

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
      throw new Error(`Ugyldig Ollama-vektor for input ${i}`);
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const started = Date.now();
  const model = (options.apiModel ?? OLLAMA_EMBED_API_MODEL).trim();

  if (options.probeText) {
    const probeRes = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [options.probeText],
        truncate: true,
        keep_alive: options.keepAlive ?? '30m',
      }),
    });
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

export function providerUsesOllamaApi(provider: BackfillProvider): boolean {
  return provider === 'ollama';
}
