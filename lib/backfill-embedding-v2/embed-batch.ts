import { VECTOR_V2_DIMENSIONS } from '@/lib/chat/vector-search';
import { buildEmbedApiUrl } from './urls';

export const EMBED_MODEL = 'bge-m3';

export type EmbedRow = { id: string; content: string };

export function validateEmbeddingVector(raw: unknown): number[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { embeddings?: unknown; embedding?: unknown };
  const candidate = Array.isArray(record.embeddings) && Array.isArray(record.embeddings[0])
    ? (record.embeddings as unknown[][])[0]
    : Array.isArray(record.embedding)
      ? record.embedding
      : null;
  if (!candidate?.length) return null;
  const vector = candidate.map((v) => (typeof v === 'number' ? v : Number(v)));
  if (vector.some((v) => !Number.isFinite(v))) return null;
  if (vector.length !== VECTOR_V2_DIMENSIONS) return null;
  return vector;
}

export function formatVectorForRpc(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export type EmbedBatchResult = {
  vectors: Map<string, number[]>;
  latencyMs: number;
};

export async function fetchEmbedBatch(
  baseUrl: string,
  rows: EmbedRow[],
  options: {
    fetchImpl?: typeof fetch;
    keepAlive?: string;
    probeText?: string | null;
  } = {},
): Promise<EmbedBatchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = buildEmbedApiUrl(baseUrl);
  const started = Date.now();

  if (options.probeText) {
    const probeRes = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
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

  const texts = rows.map((r) => r.content);
  const res = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      truncate: true,
      keep_alive: options.keepAlive ?? '30m',
    }),
  });

  if (!res.ok) {
    throw new Error(`Embed batch feilet: HTTP ${res.status}`);
  }

  const payload = await res.json();
  const embeddings = (payload as { embeddings?: unknown[][] }).embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== rows.length) {
    throw new Error('Embed batch returnerte feil antall vektorer');
  }

  const vectors = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    const vec = validateEmbeddingVector({ embeddings: [embeddings[i]] });
    if (!vec) {
      throw new Error(`Ugyldig vektor for chunk ${rows[i].id}`);
    }
    vectors.set(rows[i].id, vec);
  }

  return { vectors, latencyMs: Date.now() - started };
}

export function buildSaveRows(
  rows: EmbedRow[],
  vectors: Map<string, number[]>,
): { id: string; embedding: string }[] {
  const out: { id: string; embedding: string }[] = [];
  for (const row of rows) {
    const vector = vectors.get(row.id);
    if (!vector) {
      throw new Error(`Mangler embedding for ${row.id}`);
    }
    out.push({ id: row.id, embedding: formatVectorForRpc(vector) });
  }
  return out;
}
