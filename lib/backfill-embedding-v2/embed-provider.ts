import type { EmbedRow } from './embed-batch';
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
    httpTimeoutMs?: number;
  } = {},
): Promise<EmbedBatchOutcome> {
  return fetchOllamaEmbedBatch(endpoint.url, rows, {
    fetchImpl: options.fetchImpl,
    probeText: options.probeText,
    keepAlive: options.keepAlive,
    apiModel: endpoint.apiModel,
    httpTimeoutMs: options.httpTimeoutMs,
  });
}
