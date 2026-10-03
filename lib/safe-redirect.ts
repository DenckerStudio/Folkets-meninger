import { routes } from '@/lib/routes';

const ALLOWED_PREFIXES = [
  '/dashboard',
  '/auth/login',
  '/innspill',
  '/',
] as const;

function isLoginPath(path: string): boolean {
  return (
    path === routes.login ||
    path.startsWith(`${routes.login}?`) ||
    path.startsWith(`${routes.login}/`)
  );
}

/** Prevent open redirects after OAuth — only allow same-origin relative paths. */
export function sanitizePostLoginPath(next: string | null | undefined): string {
  const fallback = routes.utforsk;
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

/** Login URL with a sanitized `next` return path. Never emits an open redirect. */
export function loginWithNext(next?: string | null): string {
  const safe = sanitizePostLoginPath(next);
  const dest = isLoginPath(safe) ? routes.utforsk : safe;
  return `${routes.login}?next=${encodeURIComponent(dest)}`;
}
