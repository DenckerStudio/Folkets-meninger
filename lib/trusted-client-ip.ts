/**
 * Client IP for rate limiting behind Coolify/Traefik.
 *
 * Prefer `X-Real-Ip`, which Traefik sets from the connection. Otherwise use
 * the rightmost non-empty `X-Forwarded-For` hop instead of a spoofable
 * leftmost value.
 */
export function trustedClientIp(request: Pick<Request, 'headers'>): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwardedHops = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);

  return forwardedHops?.at(-1) ?? 'unknown';
}
