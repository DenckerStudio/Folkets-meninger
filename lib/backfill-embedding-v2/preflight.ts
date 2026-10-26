import { validateEmbeddingVector } from './embed-batch';
import { cosineSimilarity } from './cosine';
import { fetchLmStudioEmbedVectors } from './lmstudio';
import { fetchOllamaEmbedVectors } from './ollama-embed';
import { safeErrorMessage } from './secrets';
import { fetchOllamaShowSummary } from './ollama-show';
import { PREFLIGHT_TEXTS, PREFLIGHT_TEXT_COUNT } from './preflight-texts';
import type { BackfillProvider } from './provider';
import { VECTOR_V2_DIMENSIONS } from '@/lib/chat/vector-search';
import { DEFAULT_EMBED_QUERY_MODEL } from '@/lib/chat/query-embed';

export const PREFLIGHT_MIN_COSINE = 0.99;

export type PreflightResult = {
  minCosine: number;
  dimensions: number;
  sampleCount: number;
  queryModelSummary: string;
};

export async function runEmbeddingPreflight(options: {
  provider: BackfillProvider;
  backfillUrl: string;
  queryUrl: string;
  apiModel?: string;
  apiKey?: string;
  texts?: string[];
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}): Promise<PreflightResult> {
  const texts = options.texts ?? PREFLIGHT_TEXTS.slice(0, PREFLIGHT_TEXT_COUNT);
  if (texts.length !== PREFLIGHT_TEXT_COUNT) {
    throw new Error(`Preflight: forventet ${PREFLIGHT_TEXT_COUNT} tekster, fikk ${texts.length}`);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiModel = options.apiModel;
  const secrets = options.apiKey?.trim() ? [options.apiKey.trim()] : [];

  let backfillVectors: number[][];
  let queryVectors: number[][];
  try {
    if (options.provider === 'lmstudio') {
      const res = await fetchLmStudioEmbedVectors(options.backfillUrl, texts, {
        fetchImpl,
        apiKey: options.apiKey,
        apiModel,
      });
      backfillVectors = res.vectors;
    } else {
      const res = await fetchOllamaEmbedVectors(options.backfillUrl, texts, {
        fetchImpl,
        apiModel,
      });
      backfillVectors = res.vectors;
    }

    const queryRes = await fetchOllamaEmbedVectors(options.queryUrl, texts, {
      fetchImpl,
      apiModel,
    });
    queryVectors = queryRes.vectors;
  } catch (err) {
    throw new Error(safeErrorMessage(err, secrets));
  }

  if (backfillVectors.length !== queryVectors.length) {
    throw new Error('Preflight: ulikt antall vektorer fra backfill og query');
  }

  for (let i = 0; i < texts.length; i += 1) {
    const backVec = validateEmbeddingVector({ embedding: backfillVectors[i] });
    const queryVec = validateEmbeddingVector({ embedding: queryVectors[i] });
    if (!backVec || !queryVec) {
      throw new Error(`Preflight: ugyldig eller ikke-finite vektor for tekst ${i}`);
    }
    backfillVectors[i] = backVec;
    queryVectors[i] = queryVec;
  }

  const dim = backfillVectors[0]?.length ?? 0;
  if (dim !== VECTOR_V2_DIMENSIONS) {
    throw new Error(`Preflight: forventet dim ${VECTOR_V2_DIMENSIONS}, fikk ${dim}`);
  }

  let minCosine = 1;
  for (let i = 0; i < texts.length; i += 1) {
    const c = cosineSimilarity(backfillVectors[i], queryVectors[i]);
    if (!Number.isFinite(c)) {
      throw new Error(`Preflight: ugyldig cosine for tekst ${i}`);
    }
    if (c < minCosine) {
      minCosine = c;
    }
  }

  if (minCosine < PREFLIGHT_MIN_COSINE) {
    throw new Error(
      `Preflight feilet: min cosine ${minCosine.toFixed(5)} < ${PREFLIGHT_MIN_COSINE} ` +
        `(backfill ${options.provider} vs Ollama query på EMBED_QUERY_URL)`,
    );
  }

  const queryModel = (options.apiModel ?? DEFAULT_EMBED_QUERY_MODEL).trim();
  const queryModelSummary = await fetchOllamaShowSummary(options.queryUrl, queryModel, {
    fetchImpl,
  });
  options.log?.(
    `[preflight] Ollama query-modell (${options.queryUrl}): ${queryModelSummary}`,
  );

  return {
    minCosine,
    dimensions: dim,
    sampleCount: texts.length,
    queryModelSummary,
  };
}
