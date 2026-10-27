import { headers } from 'next/headers';
import { resolveShareOrigin } from '@/lib/polls/share';

/**
 * Canonical site origin for share links on the server (`NEXT_PUBLIC_APP_URL`,
 * then `NEXT_PUBLIC_SITE_URL`, else the hard-coded production domain). Local dev may
 * use the request host when those env vars are unset.
 */
export async function resolveRequestShareOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveShareOrigin({
    configured: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    forwardedProto: headerList.get('x-forwarded-proto'),
    host: headerList.get('x-forwarded-host') ?? headerList.get('host'),
  });
}
