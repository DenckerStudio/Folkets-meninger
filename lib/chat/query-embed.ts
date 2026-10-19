import { VECTOR_V2_DIMENSIONS } from '@/lib/chat/vector-search';

/** Default Ollama model on the central CPU embed service (P5). */
export const DEFAULT_EMBED_QUERY_MODEL = 'bge-m3';

const DEFAULT_TIMEOUT_MS = 800;
const MAX_QUERY_CHARS = 500;

let loggedCentralEmbedFailure = false;

export function resetCentralEmbedFailureLogForTests(): void {
  loggedCentralEmbedFailure = false;
}

function logCentralEmbedFailureOnce(reason: string): void {
  if (loggedCentralEmbedFailure) return;
  loggedCentralEmbedFailure = true;
  console.warn(`[chat] Sentral spørringsembedding utilgjengelig (${reason}). Bruker kun leksikalsk søk.`);
}

/** Build `POST …/api/embed` from `EMBED_QUERY_URL` (no trailing slash required). */
export function embedQueryApiUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const path = parsed.pathname.replace(/\/$/, '');
    parsed.pathname = path.endsWith('/api/embed') ? path : `${path}/api/embed`;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Parse Ollama bge-m3 `{ embeddings: [[…]] }` (also accepts legacy `embedding`). */
export function readBgeQueryVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { embedding?: unknown; embeddings?: unknown };
  const raw = Array.isArray(record.embeddings) && Array.isArray(record.embeddings[0])
    ? (record.embeddings[0] as unknown[])
    : Array.isArray(record.embedding)
      ? record.embedding
      : null;
  if (!raw || raw.length === 0) return null;
  const vector = raw.map((value) => (typeof value === 'number' ? value : Number(value)));
  if (vector.some((value) => !Number.isFinite(value))) return null;
  return vector.length === VECTOR_V2_DIMENSIONS ? vector : null;
}

export type CentralQueryEmbedOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  embedBaseUrl?: string | null;
  model?: string | null;
};

/**
 * Server-side bge-m3 query vector for `search_chunks_hybrid` when `EMBED_QUERY_URL`
 * is configured. Returns `null` on missing env, timeout, or invalid response so
 * callers keep lexical-only hybrid search.
 */
export async function fetchCentralQueryEmbedding(
  query: string,
  options: CentralQueryEmbedOptions = {},
): Promise<number[] | null> {
  const baseUrl = (options.embedBaseUrl ?? process.env.EMBED_QUERY_URL ?? '').trim();
  if (!baseUrl) return null;

  const url = embedQueryApiUrl(baseUrl);
  if (!url) {
    logCentralEmbedFailureOnce('ugyldig EMBED_QUERY_URL');
    return null;
  }

  const input = (query ?? '').trim().slice(0, MAX_QUERY_CHARS);
  if (!input) return null;

  const model = (options.model ?? process.env.EMBED_QUERY_MODEL ?? DEFAULT_EMBED_QUERY_MODEL).trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) {
      logCentralEmbedFailureOnce(`HTTP ${response.status}`);
      return null;
    }
    const vector = readBgeQueryVector(await response.json());
    if (!vector) {
      logCentralEmbedFailureOnce('ugyldig vektor eller dimensjon');
      return null;
    }
    return vector;
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'nettverksfeil';
    logCentralEmbedFailureOnce(reason);
    return null;
  }
}
