import { routes } from '@/lib/routes';

const ALLOWED_PREFIXES = [
  '/dashboard',
  '/auth/login',
  '/auth/onboarding',
  '/innspill',
  '/del',
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

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Reduce a `next` value to a safe same-origin relative path. Absolute URLs
 * (for example an absolute share URL pasted into `?next=`) are converted to
 * their path/query/hash before the allow-list check, so the post-login hop is
 * always a single relative navigation on this origin — never an absolute
 * redirect that dumps the user back on the default landing page.
 */
export function toRelativeNext(next: string | null | undefined): string {
  const fallback = routes.utforsk;
  if (!next || typeof next !== 'string') return fallback;

  const trimmed = next.trim();
  if (!trimmed || trimmed.startsWith('//')) return fallback;

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = `${url.pathname}${url.search}${url.hash}`;
      if (path === '/' || path === '') return fallback;
      return sanitizePostLoginPath(path);
    } catch {
      return fallback;
    }
  }

  return sanitizePostLoginPath(trimmed);
}

/** Login URL with a sanitized `next` return path. Never emits an open redirect. */
export function loginWithNext(next?: string | null): string {
  const safe = toRelativeNext(next);
  const dest = isLoginPath(safe) ? routes.utforsk : safe;
  return `${routes.login}?next=${encodeURIComponent(dest)}`;
}
