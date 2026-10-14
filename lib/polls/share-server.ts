import { headers } from 'next/headers';
import { resolveShareOrigin } from '@/lib/polls/share';

/**
 * Canonical site origin for share links on the server. On production this is
 * `NEXT_PUBLIC_APP_URL` (falling back to `NEXT_PUBLIC_SITE_URL`); on previews
 * and local dev it is the request host (or the Vercel deployment URL) so links
 * never point at a domain where `/del` and `/embed` are not deployed.
 */
export async function resolveRequestShareOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveShareOrigin({
    configured: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    forwardedProto: headerList.get('x-forwarded-proto'),
    host: headerList.get('x-forwarded-host') ?? headerList.get('host'),
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
  });
}
