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
    model: 'qwen3',
    modelId: 'qwen3:4b-q4_K_M',
    where: 'Våre egne servere i Norge, orkestrert av n8n',
    trigger: 'Webhook N8N_AI_SUMMARY_WEBHOOK_URL → workflows/n8n/ai-summary-backfill',
  },
  {
    feature: 'Dokument-embeddings (søk i saksdokumenter)',
    model: 'nomic-embed-text',
    modelId: 'nomic-embed-text:v1.5',
    where: 'Våre egne servere i Norge',
    trigger: 'N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL → document-embeddings.workflow',
  },
  {
    feature: 'Systempoll-utkast (Utforsk / Reels)',
    model: 'gemma4',
    modelId: 'gemma4:e2b-it-qat',
    where: 'Våre egne servere i Norge',
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
