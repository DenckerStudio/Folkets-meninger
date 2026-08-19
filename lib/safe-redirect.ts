const ALLOWED_PREFIXES = [
  '/dashboard',
  '/auth/login',
  '/auth/onboarding',
  '/auth/complete-profile',
  '/innspill',
  '/',
] as const;

/** Prevent open redirects after OAuth — only allow same-origin relative paths. */
export function sanitizePostLoginPath(next: string | null | undefined): string {
  const fallback = '/dashboard/utforsk';
  if (!next || typeof next !== 'string') return fallback;

  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('\\') || trimmed.includes('\0')) return fallback;

  const pathOnly = trimmed.split('?')[0] ?? trimmed;
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  );
  if (!allowed) return fallback;

  return trimmed;
}
