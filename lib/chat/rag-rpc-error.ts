export type RpcErrorLike = { message?: string; code?: string } | null | undefined;

export function warnChatRpcError(scope: string, error: RpcErrorLike): void {
  if (!error) return;
  console.warn(`[chat-rpc] ${scope}`, {
    code: error.code ?? 'unknown',
    message: error.message ?? 'unknown',
  });
}

function messageText(error: RpcErrorLike): string {
  return error?.message ?? '';
}

function messageLower(error: RpcErrorLike): string {
  return messageText(error).toLowerCase();
}

/**
 * True when PostgREST/Postgres indicates the named RPC is absent or an older signature
 * (e.g. missing filter_hearing_id). Permission denied and other errors are not "missing".
 */
export function isMissingRpcByName(error: RpcErrorLike, functionName: string): boolean {
  if (!error) return false;
  const name = functionName.toLowerCase();
  const msg = messageLower(error);
  const raw = messageText(error);

  if (error.code === 'PGRST202') {
    return raw.includes(functionName) || /could not find the function/i.test(raw);
  }

  if (msg.includes('could not find the function') && msg.includes(name)) return true;
  if (msg.includes('schema cache') && msg.includes(name)) return true;
  if (error.code === '42883' && msg.includes(name)) return true;

  if (
    name === 'search_chunks_hybrid' &&
    /unknown argument/i.test(raw) &&
    /filter_hearing_id/i.test(raw)
  ) {
    return true;
  }

  return false;
}

export function isMissingSearchIssuesFtsRpcError(error: RpcErrorLike): boolean {
  return isMissingRpcByName(error, 'search_issues_fts');
}

export function isMissingSearchChunksHybridRpcError(error: RpcErrorLike): boolean {
  return isMissingRpcByName(error, 'search_chunks_hybrid');
}

/** @deprecated Prefer the function-specific helpers at call sites. */
export function isMissingHybridRpcError(error: RpcErrorLike): boolean {
  return (
    isMissingSearchIssuesFtsRpcError(error) || isMissingSearchChunksHybridRpcError(error)
  );
}
