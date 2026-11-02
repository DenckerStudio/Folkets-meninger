import { getMetadataBase } from '@/lib/seo/metadata';

/** Same-origin paths resolved against {@link getMetadataBase} (never `request.url`). */
export const SHARE_LINK_REDIRECT_HOME = '/';
export const SHARE_LINK_REDIRECT_EXPIRED = '/?lenke=utlopt';

export function buildShareLinkHomeRedirectUrl(): URL {
  return new URL(SHARE_LINK_REDIRECT_HOME, getMetadataBase());
}

export function buildShareLinkExpiredRedirectUrl(): URL {
  return new URL(SHARE_LINK_REDIRECT_EXPIRED, getMetadataBase());
}

/** Build absolute redirect URL on the public site origin with `fm_share` attribution. */
export function buildSameOriginShareLocation(path: string, code: string): URL | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('//')) {
    return null;
  }
  const metadataBase = getMetadataBase();
  let location: URL;
  try {
    location = new URL(path, metadataBase);
  } catch {
    return null;
  }
  if (location.origin !== metadataBase.origin) return null;
  if (!location.pathname.startsWith('/') || location.pathname.includes('//')) return null;
  location.search = '';
  location.searchParams.set('fm_share', code);
  return location;
}
