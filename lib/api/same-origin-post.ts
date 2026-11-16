/** Reject cross-site POSTs (CSRF) while allowing same-origin browser fetches. */
export function isSameOriginPost(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite === 'cross-site') {
    return false;
  }
  if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
    return true;
  }

  const origin = request.headers.get('origin')?.trim();
  if (!origin) {
    return fetchSite !== 'cross-site';
  }

  const hostRaw = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const host = hostRaw?.split(',')[0]?.trim();
  if (!host) {
    return false;
  }

  const proto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
  const expectedOrigin = `${proto}://${host}`;

  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}