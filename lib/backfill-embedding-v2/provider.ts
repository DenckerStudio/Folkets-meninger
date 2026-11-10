export type BackfillProvider = 'ollama';

export const OLLAMA_EMBED_API_MODEL = 'bge-m3';

export const LMSTUDIO_DEPRECATED_MESSAGE =
  'LM Studio er ikke lenger støttet som embed-provider. Bruk Ollama /api/embed (EMBED_BACKFILL_PROVIDER=ollama).';

export function parseBackfillProvider(raw: string | undefined): BackfillProvider {
  const value = (raw ?? 'ollama').trim().toLowerCase();
  if (value === 'lmstudio') {
    throw new Error(LMSTUDIO_DEPRECATED_MESSAGE);
  }
  if (value === 'ollama') {
    return 'ollama';
  }
  throw new Error(
    `Ugyldig backfill-provider «${raw}». Bruk ollama (EMBED_BACKFILL_PROVIDER / --provider).`,
  );
}

export function defaultBatchForProvider(_provider: BackfillProvider): number {
  return 16;
}

/** Lagres i embedding_v2_model — standard bge-m3 på Ollama. */
export function resolveEmbeddingV2ModelTag(options: {
  provider: BackfillProvider;
  cliModelTag?: string;
  envModelTag?: string;
  apiReportedModel?: string;
}): string {
  const explicit = (options.cliModelTag ?? options.envModelTag ?? '').trim();
  if (explicit) {
    return explicit;
  }
  const fromApi = options.apiReportedModel?.trim();
  if (fromApi) {
    return fromApi;
  }
  return 'bge-m3';
}

export function requireBackfillUrl(_provider: BackfillProvider, url: string | undefined): string {
  const trimmed = url?.trim() ?? '';
  if (trimmed) {
    return trimmed;
  }
  throw new Error('Mangler miljøvariabel EMBED_BACKFILL_URL');
}
