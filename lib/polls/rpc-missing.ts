/** PostgREST cannot find the RPC in its schema cache (function missing, renamed, or stale cache). */
export function isPostgrestMissingRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as Record<string, unknown>;
  if (row.code === 'PGRST202') return true;
  const message = typeof row.message === 'string' ? row.message : '';
  return message.includes('schema cache') && message.toLowerCase().includes('could not find the function');
}
