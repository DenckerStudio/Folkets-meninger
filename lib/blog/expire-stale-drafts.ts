import { DRAFT_SOFT_EXPIRY_MS, isDraftPastSoftExpiry } from '@/lib/admin/draft-expiry';
import { payloadPatchPost } from '@/lib/cms/payload-update';
import { getCmsAgentKey, payloadFetchList } from '@/lib/cms/payload-client';
import type { PayloadPost } from '@/lib/cms/types';

export type ExpireStaleBlogDraftsResult = {
  count: number;
  ids: string[];
};

const REVIEW_STATES = 'til_vurdering,ny';

function parsePostCreatedAt(post: PayloadPost): string | null {
  const raw = post.createdAt;
  if (!raw || typeof raw !== 'string') return null;
  return raw;
}

export function postsEligibleForBlogDraftExpiry(
  docs: PayloadPost[],
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): PayloadPost[] {
  return docs.filter((post) => {
    if (post._status === 'published') return false;
    if (post.expiredAt) return false;
    const createdAt = parsePostCreatedAt(post);
    if (!createdAt) return false;
    return isDraftPastSoftExpiry(createdAt, nowMs, maxAgeMs);
  });
}

export async function expireStaleBlogDrafts(options: {
  dryRun?: boolean;
  nowMs?: number;
} = {}): Promise<ExpireStaleBlogDraftsResult> {
  const dryRun = options.dryRun === true;
  const nowMs = options.nowMs ?? Date.now();
  const cutoffIso = new Date(nowMs - DRAFT_SOFT_EXPIRY_MS).toISOString();

  if (!getCmsAgentKey()) {
    throw new Error('CMS er ikke konfigurert');
  }

  const eligible: PayloadPost[] = [];
  let page = 1;
  const limit = 50;

  for (;;) {
    const data = await payloadFetchList<PayloadPost>(
      'posts',
      {
        depth: 0,
        limit,
        page,
        sort: 'createdAt',
        'where[_status][equals]': 'draft',
        'where[review.state][in]': REVIEW_STATES,
        'where[expiredAt][exists]': 'false',
        'where[createdAt][less_than]': cutoffIso,
      },
      {
        revalidate: 0,
        tags: ['blog-expire-drafts'],
        apiKey: getCmsAgentKey() ?? undefined,
      },
    );

    const docs = data?.docs ?? [];
    eligible.push(...postsEligibleForBlogDraftExpiry(docs, nowMs));

    if (!data?.hasNextPage) break;
    page += 1;
    if (page > 40) break;
  }

  const ids = eligible.map((post) => String(post.id));

  if (dryRun) {
    return { count: ids.length, ids };
  }

  const expiredAt = new Date(nowMs).toISOString();
  for (const id of ids) {
    const patched = await payloadPatchPost(id, { expiredAt });
    if (!patched.ok) {
      throw new Error(patched.error);
    }
  }

  return { count: ids.length, ids };
}
