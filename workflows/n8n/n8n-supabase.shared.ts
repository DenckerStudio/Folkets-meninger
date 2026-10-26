/** Shared Supabase credential and PostgREST helpers for Folkets n8n workflows. */

export const FOLKETS_SUPABASE_CRED = 'Folkets Meninger Self-hosted';

export const FOLKETS_SUPABASE_REST = 'https://supabase.heyklever.app/rest/v1';

export const FOLKETS_APP_BASE = 'https://www.folkets-meninger.no';

export const FOLKETS_N8N_BASE = 'https://n8n.heyklever.app';

/** Header Auth (X-FM-Webhook-Token) for POST to /webhook/folkets-ai-summary — credential name only. */
export const FOLKETS_AI_SUMMARY_WEBHOOK_CRED = 'FM AI Summary Webhook Token';

/** Placeholder only — live n8n keeps the real Ollama embeddings URL in the workflow node. */
export const FOLKETS_OLLAMA_EMBEDDINGS_URL = 'http://127.0.0.1:11434/api/embeddings';

export const FOLKETS_OLLAMA_EMBED_MODEL = 'nomic-embed-text:v1.5';

export function rpcUrl(name: string): string {
  return `${FOLKETS_SUPABASE_REST}/rpc/${name}`;
}
