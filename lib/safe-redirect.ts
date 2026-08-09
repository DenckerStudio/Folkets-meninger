const ALLOWED_PREFIXES = [
  '/dashboard',
  '/auth/login',
  '/innspill',
  '/',
] as const;

/** Default post-login destination: utforsk (path to first vote). */
export const DEFAULT_POST_LOGIN_PATH = '/dashboard/utforsk';

/** Prevent open redirects after OAuth — only allow same-origin relative paths. */
export function sanitizePostLoginPath(next: string | null | undefined): string {
  const fallback = DEFAULT_POST_LOGIN_PATH;
  if (!next || typeof next !== 'string') return fallback;

  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('\\') || trimmed.includes('\0')) return fallback;

  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}/`)
  );
  if (!allowed) return fallback;

  return trimmed;
}
