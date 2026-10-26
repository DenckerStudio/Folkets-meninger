/** When false (default), app cron / admin catch-up must not trigger legacy nomic embedding webhooks. */
export function isLegacyEmbeddingsRetryEnabled(): boolean {
  const raw = process.env.N8N_RETRY_LEGACY_EMBEDDINGS?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
