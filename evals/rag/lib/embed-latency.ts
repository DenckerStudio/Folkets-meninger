import { fetchCentralQueryEmbedding } from '@/lib/chat/query-embed';
import {
  BYOK_OLLAMA_VECTOR_TIMEOUT_MS_DEFAULT,
  OLLAMA_VECTOR_TIMEOUT_MS,
  createOllamaVectorizer,
} from '@/lib/chat/vector-search';
import { embedBgeM3 } from './embed';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

async function timeEmbed(fn: () => Promise<unknown>): Promise<{ ms: number; ok: boolean }> {
  const start = performance.now();
  try {
    const v = await fn();
    return { ms: performance.now() - start, ok: v !== null && v !== undefined };
  } catch {
    return { ms: performance.now() - start, ok: false };
  }
}

function ollamaByokBaseUrl(): string {
  const base = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  return `${base}/v1`;
}

/**
 * Micro-benchmark: central bge-m3 (EMBED_QUERY_URL / Ollama embed) vs BYOK nomic vectorizer.
 * BYOK "off" uses legacy 800 ms cap; BYOK "on" uses configured BYOK timeout (default 3 s).
 */
export async function measureEmbedLatencies(queries: string[]): Promise<{
  centralEmbedMsP50: number;
  centralEmbedMsP95: number;
  byokEmbedOffMsP50: number;
  byokEmbedOffMsP95: number;
  byokEmbedOnMsP50: number;
  byokEmbedOnMsP95: number;
  byokSuccessRateOff: number;
  byokSuccessRateOn: number;
  byokTimeoutMsOn: number;
  byokTimeoutMsOff: number;
}> {
  const samples = queries.filter((q) => q.trim().length > 0).slice(0, 12);
  if (samples.length === 0) {
    return {
      centralEmbedMsP50: 0,
      centralEmbedMsP95: 0,
      byokEmbedOffMsP50: 0,
      byokEmbedOffMsP95: 0,
      byokEmbedOnMsP50: 0,
      byokEmbedOnMsP95: 0,
      byokSuccessRateOff: 0,
      byokSuccessRateOn: 0,
      byokTimeoutMsOn: BYOK_OLLAMA_VECTOR_TIMEOUT_MS_DEFAULT,
      byokTimeoutMsOff: OLLAMA_VECTOR_TIMEOUT_MS,
    };
  }

  const embedBase = (process.env.EMBED_QUERY_URL ?? process.env.OLLAMA_BASE_URL ?? '').trim();

  async function centralEmbed(query: string): Promise<number[] | null> {
    const fromCentral = await fetchCentralQueryEmbedding(query, { embedBaseUrl: embedBase || null });
    if (fromCentral) return fromCentral;
    try {
      return await embedBgeM3(query);
    } catch {
      return null;
    }
  }
  const credential = { provider: 'ollama' as const, baseUrl: ollamaByokBaseUrl() };
  const vectorizerOff = createOllamaVectorizer(credential, { timeoutMs: OLLAMA_VECTOR_TIMEOUT_MS });
  const vectorizerOn = createOllamaVectorizer(credential);

  const centralMs: number[] = [];
  const byokOffMs: number[] = [];
  const byokOnMs: number[] = [];
  let offOk = 0;
  let onOk = 0;

  for (const q of samples) {
    const central = await timeEmbed(() => centralEmbed(q));
    if (central.ok) centralMs.push(central.ms);

    if (vectorizerOff) {
      const off = await timeEmbed(() => vectorizerOff(q));
      byokOffMs.push(off.ms);
      if (off.ok) offOk += 1;
    }
    if (vectorizerOn) {
      const on = await timeEmbed(() => vectorizerOn(q));
      byokOnMs.push(on.ms);
      if (on.ok) onOk += 1;
    }
  }

  centralMs.sort((a, b) => a - b);
  byokOffMs.sort((a, b) => a - b);
  byokOnMs.sort((a, b) => a - b);

  const n = samples.length;
  return {
    centralEmbedMsP50: percentile(centralMs, 0.5),
    centralEmbedMsP95: percentile(centralMs, 0.95),
    byokEmbedOffMsP50: percentile(byokOffMs, 0.5),
    byokEmbedOffMsP95: percentile(byokOffMs, 0.95),
    byokEmbedOnMsP50: percentile(byokOnMs, 0.5),
    byokEmbedOnMsP95: percentile(byokOnMs, 0.95),
    byokSuccessRateOff: n ? offOk / n : 0,
    byokSuccessRateOn: n ? onOk / n : 0,
    byokTimeoutMsOn: Number(process.env.BYOK_OLLAMA_VECTOR_TIMEOUT_MS ?? BYOK_OLLAMA_VECTOR_TIMEOUT_MS_DEFAULT),
    byokTimeoutMsOff: OLLAMA_VECTOR_TIMEOUT_MS,
  };
}
