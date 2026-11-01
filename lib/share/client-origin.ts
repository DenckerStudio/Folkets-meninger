import { getSiteUrl } from '@/lib/seo/metadata';

function isLocalHost(host: string): boolean {
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  );
}

/**
 * Canonical origin for share/copy links in the browser.
 * Mirrors {@link resolveShareOrigin} on the server: configured public URL in prod,
 * request origin on local dev only.
 */
export function resolveClientShareOrigin(): string {
  if (typeof window === 'undefined') return getSiteUrl();
  if (isLocalHost(window.location.host)) return window.location.origin;
  return getSiteUrl();
}
