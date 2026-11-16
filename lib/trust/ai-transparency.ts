/** Modeller og flyt verifisert fra workflows/n8n (ikke brukerens BYOK). */

export type AiPipelineRow = {
  feature: string;
  /** User-facing model family name (no tags, quantization or parameter size). */
  model: string;
  /** Full model id as configured in n8n — for maintainers, not rendered. */
  modelId?: string;
  where: string;
  /** Internal trigger description — for maintainers, not rendered. */
  trigger: string;
};

export const PLATFORM_AI_PIPELINES: AiPipelineRow[] = [
  {
    feature: 'Saksammendrag (AI-sammendrag på sakssider)',
    model: 'Språkmodell for tekstsammendrag',
    modelId: 'qwen3:4b-q4_K_M',
    where: 'Kjører på våre egne servere i Norge',
    trigger: 'Webhook N8N_AI_SUMMARY_WEBHOOK_URL → workflows/n8n/ai-summary-backfill',
  },
  {
    feature: 'Dokument-embeddings (søk i saksdokumenter)',
    model: 'Embeddings-modell for dokumentsøk',
    modelId: 'nomic-embed-text:v1.5',
    where: 'Kjører på våre egne servere i Norge',
    trigger: 'N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL → document-embeddings.workflow',
  },
  {
    feature: 'Systempoll-utkast (Utforsk / Reels)',
    model: 'Språkmodell for spørsmålsutkast',
    modelId: 'gemma4:e2b-it-qat',
    where: 'Kjører på våre egne servere i Norge',
    trigger: 'N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL → system-poll-draft.workflow',
  },
  {
    feature: 'Konsekvens-kalkulator på saksside',
    model: 'Ingen språkmodell — regelbasert tolkning av dokumentutdrag og lagret sammendrag',
    where: 'Regelbasert behandling i appen',
    trigger: 'Brukerens valg i nettleseren',
  },
  {
    feature: 'Stemme+ chat',
    model: 'Brukerens valgte modell',
    where: 'Hos leverandøren brukeren konfigurerer; nøkkel kryptert i databasen',
    trigger: 'POST /api/chat (kun Stemme+)',
  },
];

export const AI_SUMMARY_LABEL = 'AI-generert sammendrag';

/** Landing / om-side: full setning uten modell-ID-er eller leverandørnavn. */
export function platformSummaryModelsSentence(): string {
  const onPremise = PLATFORM_AI_PIPELINES.filter(
    (row) =>
      row.where.includes('Norge') &&
      !row.model.startsWith('Brukerens') &&
      !row.model.includes('Ingen språkmodell'),
  );
  const labels = [...new Set(onPremise.map((row) => row.model))];
  if (labels.length === 0) {
    return 'Saksammendrag og dokumentsøk behandles på egne servere i Norge — ikke i nettleseren din.';
  }
  const modelList =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(', ')} og ${labels[labels.length - 1]}`;
  return `Til saksammendrag og dokumentsøk bruker vi ${modelList}, kjørende på egne servere i Norge. Teksten du leser behandles der — ikke lokalt i nettleseren.`;
}
