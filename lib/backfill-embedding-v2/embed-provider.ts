import type { EmbedRow } from './embed-batch';
import { fetchLmStudioEmbedBatch } from './lmstudio';
import { fetchOllamaEmbedBatch } from './ollama-embed';
import type { ResolvedEndpoint } from './endpoints';

export type EmbedBatchOutcome = {
  vectors: Map<string, number[]>;
  latencyMs: number;
  reportedModel?: string;
};

export async function fetchEmbedBatchForEndpoint(
  endpoint: ResolvedEndpoint,
  rows: EmbedRow[],
  options: {
    fetchImpl?: typeof fetch;
    probeText?: string | null;
    keepAlive?: string;
  } = {},
): Promise<EmbedBatchOutcome> {
  if (endpoint.provider === 'lmstudio') {
    const res = await fetchLmStudioEmbedBatch(endpoint.url, rows, {
      fetchImpl: options.fetchImpl,
      apiKey: endpoint.apiKey,
      apiModel: endpoint.apiModel,
    });
    return res;
  }

  const res = await fetchOllamaEmbedBatch(endpoint.url, rows, {
    fetchImpl: options.fetchImpl,
    probeText: options.probeText,
    keepAlive: options.keepAlive,
    apiModel: endpoint.apiModel,
  });
  return res;
}
