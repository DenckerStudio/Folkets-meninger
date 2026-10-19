import { buildSignedHeaders } from '@/lib/cms/hmac';
import { getCmsAgentKey, getCmsBaseUrl } from '@/lib/cms/payload-client';

export type BlogOpsLookupResult =
  | { found: false }
  | { found: true; id: string; slug: string; adminUrl: string };

export async function cmsBlogOpsLookup(args: {
  slug?: string;
  sourceEvent?: string;
}): Promise<BlogOpsLookupResult | null> {
  const base = getCmsBaseUrl();
  const agentKey = getCmsAgentKey();
  if (!base || !agentKey) return null;

  try {
    const res = await fetch(`${base}/api/blog-ops/lookup`, {
      method: 'POST',
      headers: {
        Authorization: `users API-Key ${agentKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: args.slug,
        sourceEvent: args.sourceEvent,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BlogOpsLookupResult;
    return json;
  } catch (error) {
    console.error('[cms] blog-ops lookup failed', error);
    return null;
  }
}

export async function cmsBlogOpsSocialPosted(
  slug: string,
  blueskyUri?: string | null,
): Promise<boolean> {
  const base = getCmsBaseUrl();
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!base || !secret) return false;

  const body = JSON.stringify({ slug, blueskyUri: blueskyUri ?? null });
  try {
    const res = await fetch(`${base}/api/blog-ops/social-posted`, {
      method: 'POST',
      headers: buildSignedHeaders(body, secret),
      body,
      cache: 'no-store',
    });
    return res.ok;
  } catch (error) {
    console.error('[cms] blog-ops social-posted failed', error);
    return false;
  }
}
