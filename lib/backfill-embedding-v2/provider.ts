export type BackfillProvider = 'lmstudio' | 'ollama';

export const DEFAULT_LMSTUDIO_MODEL_TAG = 'bge-m3:Q8_0 (gpustack GGUF, lmstudio)';

export const OLLAMA_EMBED_API_MODEL = 'bge-m3';

export function parseBackfillProvider(raw: string | undefined): BackfillProvider {
  const value = (raw ?? 'lmstudio').trim().toLowerCase();
  if (value === 'lmstudio' || value === 'ollama') {
    return value;
  }
  throw new Error(
    `Ugyldig backfill-provider «${raw}». Bruk lmstudio eller ollama (EMBED_BACKFILL_PROVIDER / --provider).`,
  );
}

export function defaultBatchForProvider(provider: BackfillProvider): number {
  return provider === 'lmstudio' ? 32 : 16;
}

/** Stored in embedding_v2_model — never bare «bge-m3» for lmstudio backfill. */
export function resolveEmbeddingV2ModelTag(options: {
  provider: BackfillProvider;
  cliModelTag?: string;
  envModelTag?: string;
  apiReportedModel?: string;
}): string {
  if (options.provider === 'ollama') {
    return (options.envModelTag ?? options.cliModelTag ?? 'bge-m3').trim() || 'bge-m3';
  }

  const fromApi = options.apiReportedModel?.trim();
  if (fromApi && fromApi !== OLLAMA_EMBED_API_MODEL) {
    return fromApi;
  }

  const explicit = (options.cliModelTag ?? options.envModelTag ?? '').trim();
  if (explicit) {
    return explicit;
  }

  return DEFAULT_LMSTUDIO_MODEL_TAG;
}

export function requireBackfillUrl(provider: BackfillProvider, url: string | undefined): string {
  const trimmed = url?.trim() ?? '';
  if (trimmed) {
    return trimmed;
  }
  if (provider === 'lmstudio') {
    throw new Error(
      'EMBED_BACKFILL_URL mangler. For lmstudio må du sette full base-URL til OpenAI-kompatible embeddings ' +
        '(f.eks. Traefik/proxy mot LM Studio — ingen forhåndsvalgt host eller port i scriptet).',
    );
  }
  throw new Error('Mangler miljøvariabel EMBED_BACKFILL_URL');
}
