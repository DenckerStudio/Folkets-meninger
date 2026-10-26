/** PostgREST cannot find the RPC in its schema cache (function missing, renamed, or stale cache). */
export function isPostgrestMissingRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as Record<string, unknown>;
  return row.code === 'PGRST202';
}
