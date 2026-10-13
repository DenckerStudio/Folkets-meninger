import { headers } from 'next/headers';
import { resolveShareOrigin } from '@/lib/polls/share';

/**
 * Canonical site origin for share links on the server. Prefers
 * `NEXT_PUBLIC_APP_URL` (the canonical app origin used elsewhere), then
 * `NEXT_PUBLIC_SITE_URL`, then the incoming request host, then production.
 */
export async function resolveRequestShareOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveShareOrigin({
    configured: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    forwardedProto: headerList.get('x-forwarded-proto'),
    host: headerList.get('x-forwarded-host') ?? headerList.get('host'),
  });
}
