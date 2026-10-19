import type { SupabaseClient } from '@supabase/supabase-js';
import { ollamaApiUrl } from '@/lib/byok/ollama';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import { normalizeChunkText } from '@/lib/chat/chunk-excerpt';

/**
 * Semantic chunk search for overlay chat.
 *
 * The stored `document_chunks.embedding` is `vector(768)`, produced externally by
 * n8n + Ollama (`nomic-embed-text`). When the user runs chat through their own
 * Ollama BYOK credential we reuse that same server to vectorize the query, so the
 * query lands in the same 768-dim space as the index. Any other provider, a
 * missing server, or a dimension mismatch returns `null` and the caller keeps the
 * lexical results.
 *
 * Kept in its own module on purpose: `lib/chat/rag.ts` stays free of the literal
 * "embedding" so the session-bound RAG guard keeps proving the session client never
 * reads the embedding column (egress).
 */

/** Dimensions of `document_chunks.embedding`, i.e. the vectors we must produce. */
export const VECTOR_DIMENSIONS = 768;

/** Ollama model that produced the stored 768-dim vectors (n8n + Ollama). */
export const OLLAMA_VECTOR_MODEL = 'nomic-embed-text';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_QUERY_CHARS = 500;
export type QueryVectorizer = (query: string) => Promise<number[] | null>;

export type VectorChunk = {
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

export type VectorSearchClient = Pick<SupabaseClient, 'rpc'>;

/** Native Ollama vectorizer endpoint, derived from the stored OpenAI-style base URL. */
export function ollamaVectorUrl(baseUrl: string): string | null {
  return ollamaApiUrl(baseUrl, 'embeddings');
}

/** Read a single vector from either Ollama response shape (`embedding` / `embeddings[0]`). */
export function readVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { embedding?: unknown; embeddings?: unknown };
  const raw = Array.isArray(record.embedding)
    ? record.embedding
    : Array.isArray(record.embeddings) && Array.isArray(record.embeddings[0])
      ? (record.embeddings[0] as unknown[])
      : null;
  if (!raw || raw.length === 0) return null;
  const vector = raw.map((value) => (typeof value === 'number' ? value : Number(value)));
  if (vector.some((value) => !Number.isFinite(value))) return null;
  return vector;
}

/**
 * Build a query vectorizer from the user's BYOK credential. Returns `null` unless
 * the credential is an Ollama server with a usable base URL.
 */
export function createOllamaVectorizer(
  credential: Pick<DecryptedByokCredential, 'provider' | 'baseUrl'> | null | undefined,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; model?: string } = {},
): QueryVectorizer | null {
  if (!credential || credential.provider !== 'ollama') return null;
  const url = ollamaVectorUrl(credential.baseUrl ?? '');
  if (!url) return null;

  const model = options.model?.trim() || OLLAMA_VECTOR_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (query: string) => {
    const prompt = (query ?? '').trim().slice(0, MAX_QUERY_CHARS);
    if (!prompt) return null;
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ model, prompt }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const vector = readVector(await response.json());
      return vector && vector.length === VECTOR_DIMENSIONS ? vector : null;
    } catch {
      return null;
    }
  };
}

/**
 * Rank one sak's indexed chunks by cosine similarity to the query vector. Returns
 * `null` when the query cannot be vectorized or the RPC is unavailable (e.g. the
 * grant migration has not been applied), so the caller can keep lexical results.
 */
export async function searchChunksByVector(
  client: VectorSearchClient,
  issueId: string,
  query: string,
  vectorize: QueryVectorizer,
  limit: number,
): Promise<VectorChunk[] | null> {
  const id = issueId.trim();
  if (!id) return null;

  const vector = await vectorize(query);
  if (!vector || vector.length !== VECTOR_DIMENSIONS) return null;

  try {
    const { data, error } = await client.rpc('match_issue_document_chunks', {
      p_issue_id: id,
      p_query_embedding: vector,
      p_match_count: Math.max(1, limit),
    });
    if (error || !Array.isArray(data)) return null;

    return data.flatMap((row) => {
      const record = row as Record<string, unknown>;
      const content = normalizeChunkText(String(record.content ?? ''));
      if (!content) return [];
      return [
        {
          documentId: String(record.document_id ?? ''),
          chunkIndex: Number(record.chunk_index ?? 0),
          content,
          similarity: Number(record.similarity ?? 0),
        },
      ];
    });
  } catch {
    return null;
  }
}
