import { buildSignedHeaders } from '@/lib/cms/hmac';
import { getCmsAgentKey, getCmsBaseUrl } from '@/lib/cms/payload-client';

export type BlogPostCmsStatus = 'draft' | 'published' | 'unknown';

export type BlogOpsLookupResult =
  | { found: false }
  | { found: true; id: string; slug: string; adminUrl: string; cmsStatus: BlogPostCmsStatus };

export type BlogOpsListedDraft = {
  id: string;
  slug: string;
  adminUrl: string;
  cmsStatus: BlogPostCmsStatus;
  sourceEvent: string | null;
  updatedAt: string | null;
};

export async function cmsBlogOpsListBySourceEventPrefix(
  prefix: string,
): Promise<BlogOpsListedDraft[] | null> {
  const base = getCmsBaseUrl();
  const agentKey = getCmsAgentKey();
  if (!base || !agentKey) return null;

  try {
    const res = await fetch(`${base}/api/blog-ops/list-by-source-event`, {
      method: 'POST',
      headers: {
        Authorization: `users API-Key ${agentKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceEventPrefix: prefix }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { drafts?: BlogOpsListedDraft[] };
    if (!json || !Array.isArray(json.drafts)) return null;
    return json.drafts.map((row) => ({
      id: row.id,
      slug: row.slug,
      adminUrl: row.adminUrl,
      cmsStatus:
        row.cmsStatus === 'published'
          ? 'published'
          : row.cmsStatus === 'draft'
            ? 'draft'
            : 'unknown',
      sourceEvent: row.sourceEvent ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
  } catch (error) {
    console.error('[cms] blog-ops list-by-source-event failed', error);
    return null;
  }
}

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
    const json = (await res.json()) as BlogOpsLookupResult & { cmsStatus?: string };
    if (!json || typeof json !== 'object') return null;
    if (json.found !== true) return { found: false };
    return {
      found: true,
      id: json.id,
      slug: json.slug,
      adminUrl: json.adminUrl,
      cmsStatus:
        json.cmsStatus === 'published'
          ? 'published'
          : json.cmsStatus === 'draft'
            ? 'draft'
            : 'unknown',
    };
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
