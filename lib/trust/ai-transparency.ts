/** Modeller og flyt verifisert fra workflows/n8n (ikke brukerens BYOK). */

export type AiPipelineRow = {
  feature: string;
  model: string;
  where: string;
  trigger: string;
};

export const PLATFORM_AI_PIPELINES: AiPipelineRow[] = [
  {
    feature: 'Sammendrag på sakssider',
    model: 'qwen3:4b-q4_K_M (Ollama, JSON-output)',
    where: 'Vår egen server',
    trigger: 'Webhook N8N_AI_SUMMARY_WEBHOOK_URL → workflows/n8n/ai-summary-backfill',
  },
  {
    feature: 'Søk i saksdokumenter',
    model: 'nomic-embed-text:v1.5 (Ollama embeddings API)',
    where: 'Vår egen server',
    trigger: 'N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL → document-embeddings.workflow',
  },
  {
    feature: 'Utkast til avstemninger og Reels',
    model: 'gemma4:e2b-it-qat (Ollama chat)',
    where: 'Vår egen server',
    trigger: 'N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL → system-poll-draft.workflow',
  },
  {
    feature: 'Konsekvenskalkulatoren',
    model: 'Ingen AI. Faste regler leser dokumentene og sammendraget.',
    where: 'Vår server',
    trigger: 'Brukerens valg i nettleseren',
  },
  {
    feature: 'Stemme+-chat',
    model: 'Modellen du velger selv',
    where: 'Hos leverandøren du velger. Nøkkelen din lagres kryptert hos oss.',
    trigger: 'POST /api/chat (kun Stemme+)',
  },
];

export const AI_SUMMARY_LABEL = 'AI-generert sammendrag';
