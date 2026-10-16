/** Modeller og flyt verifisert fra workflows/n8n (ikke brukerens BYOK). */

export type AiPipelineRow = {
  feature: string;
  model: string;
  where: string;
  trigger: string;
};

export const PLATFORM_AI_PIPELINES: AiPipelineRow[] = [
  {
    feature: 'Saksammendrag (AI-sammendrag på sakssider)',
    model: 'qwen3:4b-q4_K_M (Ollama, JSON-output)',
    where: 'Self-hosted Ollama på Coolify, orkestrert av n8n',
    trigger: 'Webhook N8N_AI_SUMMARY_WEBHOOK_URL → workflows/n8n/ai-summary-backfill',
  },
  {
    feature: 'Dokument-embeddings (RAG)',
    model: 'nomic-embed-text:v1.5 (Ollama embeddings API)',
    where: 'Self-hosted Ollama på Coolify',
    trigger: 'N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL → document-embeddings.workflow',
  },
  {
    feature: 'Systempoll-utkast (Utforsk / Reels)',
    model: 'gemma4:e2b-it-qat (Ollama chat)',
    where: 'Self-hosted Ollama på Coolify',
    trigger: 'N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL → system-poll-draft.workflow',
  },
  {
    feature: 'Konsekvens-kalkulator på saksside',
    model: 'Ingen LLM — regelbasert tolkning av dokumentutdrag og lagret sammendrag',
    where: 'Next.js API /api/sak/[id]/impact',
    trigger: 'Brukerens valg i nettleseren',
  },
  {
    feature: 'Stemme+ chat',
    model: 'Brukerens valgte modell (BYOK) eller gateway',
    where: 'Leverandør brukeren konfigurerer; nøkkel kryptert i Supabase',
    trigger: 'POST /api/chat (kun Stemme+)',
  },
];

export const AI_SUMMARY_LABEL = 'AI-generert sammendrag';
