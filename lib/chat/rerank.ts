/**
 * Local cross-encoder reranker (bge-reranker-v2-m3 via Ollama or HTTP). Graceful fallback to fused scores.
 */
import { DEFAULT_RAG_REJECTION_THRESHOLD } from '@/lib/chat/rejection-threshold-default';

export type RerankCandidate = {
  id: string;
  content: string;
  fusedScore?: number;
};

export type RerankResult = {
  scores: number[];
  usedReranker: boolean;
};

const RERANKER_MODEL = process.env.RERANKER_MODEL ?? 'bge-reranker-v2-m3';

let loggedRerankerMissing = false;

export function resetRerankerMissingLogForTests(): void {
  loggedRerankerMissing = false;
}

function logRerankerMissingOnce(): void {
  if (loggedRerankerMissing) return;
  loggedRerankerMissing = true;
  console.warn('[rerank] RERANKER_URL mangler – reranking er av');
}

/** Ollama rerank base URL from env only (no localhost or other fallback). */
export function resolveRerankerBaseUrl(): string | null {
  const raw = (process.env.RERANKER_URL || process.env.OLLAMA_BASE_URL || '').trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function rejectionThreshold(): number {
  const raw = process.env.RAG_REJECTION_THRESHOLD;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_RAG_REJECTION_THRESHOLD;
}

export function rerankerEnabled(): boolean {
  return process.env.RAG_RERANKER_ENABLED === '1' || process.env.RAG_RERANKER_ENABLED === 'true';
}

async function rerankViaHttp(query: string, docs: string[]): Promise<number[] | null> {
  const endpoint = process.env.RERANKER_HTTP_URL;
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, documents: docs }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { scores?: number[] };
    if (!Array.isArray(payload.scores) || payload.scores.length !== docs.length) return null;
    return payload.scores;
  } catch {
    return null;
  }
}

/** Ollama experimental rerank: POST /api/rerank when available. */
async function rerankViaOllama(query: string, docs: string[]): Promise<number[] | null> {
  const baseUrl = resolveRerankerBaseUrl();
  if (!baseUrl) {
    logRerankerMissingOnce();
    return null;
  }
  try {
    const res = await fetch(`${baseUrl}/api/rerank`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: RERANKER_MODEL, query, documents: docs }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { results?: Array<{ relevance_score?: number }> };
    if (!Array.isArray(payload.results) || payload.results.length !== docs.length) return null;
    return payload.results.map((r) => Number(r.relevance_score ?? 0));
  } catch {
    return null;
  }
}

export async function rerankCandidates(query: string, candidates: RerankCandidate[]): Promise<RerankResult> {
  if (candidates.length === 0) return { scores: [], usedReranker: false };

  const docs = candidates.map((c) => c.content.slice(0, 2000));
  let scores: number[] | null = null;
  if (rerankerEnabled()) {
    scores = await rerankViaHttp(query, docs);
    if (!scores) scores = await rerankViaOllama(query, docs);
  }

  if (scores) return { scores, usedReranker: true };

  return { scores: candidates.map((c) => c.fusedScore ?? 0), usedReranker: false };
}

export function shouldRejectRetrieval(topScore: number, threshold = rejectionThreshold()): boolean {
  return topScore < threshold;
}

/** Rejection threshold applies only to cross-encoder scores, not RRF fused fallbacks. */
export function shouldRejectAfterRerank(usedReranker: boolean, topScore: number): boolean {
  if (!usedReranker) return false;
  return shouldRejectRetrieval(topScore);
}
