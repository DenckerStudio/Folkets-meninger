/**
 * Normalize request paths for Traefik / HTTP error aggregates.
 * Strips query strings, collapses UUIDs and long numeric IDs, buckets noisy prefixes.
 */

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const LONG_NUMERIC_RE = /\/\d{4,}(?=\/|$)/g;

export function normalizeAnalyticsPathTemplate(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return '/';
  }

  let path = trimmed;
  try {
    if (path.includes('://')) {
      path = new URL(path).pathname;
    } else {
      const q = path.indexOf('?');
      if (q >= 0) {
        path = path.slice(0, q);
      }
      const hash = path.indexOf('#');
      if (hash >= 0) {
        path = path.slice(0, hash);
      }
    }
  } catch {
    const q = path.indexOf('?');
    path = q >= 0 ? path.slice(0, q) : path;
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Collapse duplicate slashes
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  if (path.startsWith('/api/admin')) {
    return '/api/admin/*';
  }
  if (path.startsWith('/_next/')) {
    return '/_next/*';
  }
  if (path.startsWith('/dashboard/admin')) {
    return '/dashboard/admin/*';
  }

  path = path.replace(UUID_RE, ':id');
  path = path.replace(LONG_NUMERIC_RE, '/:id');

  if (path.length > 200) {
    return `${path.slice(0, 200)}…`;
  }

  return path || '/';
}
