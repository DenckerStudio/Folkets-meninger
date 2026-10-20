/**
 * Client IP for rate limiting behind Coolify/Traefik.
 *
 * Prefer `X-Real-Ip` (set by Traefik from the TCP connection). Otherwise use the
 * **rightmost** hop in `X-Forwarded-For` (the address Traefik appends), not the
 * leftmost value clients can spoof.
 */
export function trustedClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }

  return 'unknown';
}
