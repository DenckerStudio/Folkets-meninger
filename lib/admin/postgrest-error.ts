type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  return Boolean(error && typeof error === 'object' && 'code' in error);
}

export function postgrestErrorCode(error: unknown): string | null {
  if (isPostgrestLikeError(error) && typeof error.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  return null;
}

/** Server logs only — never return details to the client if they may contain sensitive data. */
export function logPostgrestError(logTag: string, error: unknown): void {
  if (isPostgrestLikeError(error)) {
    console.error(logTag, {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
    });
    return;
  }
  console.error(logTag, error);
}

export function adminLoadErrorMessage(fallback: string, error: unknown): string {
  const code = postgrestErrorCode(error);
  return code ? `${fallback} (kode ${code})` : fallback;
}

export function adminLoadErrorJson(
  fallback: string,
  error: unknown,
): { error: string; errorCode?: string } {
  const code = postgrestErrorCode(error);
  if (code) {
    return { error: `${fallback} (kode ${code})`, errorCode: code };
  }
  return { error: fallback };
}
