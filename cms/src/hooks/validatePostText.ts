import type { CollectionBeforeValidateHook } from 'payload';
import { APIError } from 'payload';
import { graphemeCount, truncateToGraphemes } from '@/lib/graphemes';

const MAX_EXCERPT = 300;
const MAX_BLUESKY = 300;

export const validatePostText: CollectionBeforeValidateHook = ({ data }) => {
  if (!data || typeof data !== 'object') return data;

  if (typeof data.excerpt === 'string' && data.excerpt.length > MAX_EXCERPT) {
    throw new APIError(`excerpt kan være maks ${MAX_EXCERPT} tegn`, 400);
  }

  const social = data.social;
  if (social && typeof social === 'object' && typeof social.blueskyText === 'string') {
    const text = social.blueskyText;
    if (graphemeCount(text) > MAX_BLUESKY) {
      throw new APIError(`blueskyText kan være maks ${MAX_BLUESKY} grafemer`, 400);
    }
  }

  return data;
};

export function normalizeDraftSocialText(excerpt: string, blueskyText?: string | null): {
  excerpt: string;
  blueskyText: string;
} {
  const trimmedExcerpt = excerpt.trim().slice(0, MAX_EXCERPT);
  const rawBluesky = (blueskyText?.trim() || trimmedExcerpt).trim();
  const bluesky = truncateToGraphemes(rawBluesky, MAX_BLUESKY);
  return { excerpt: trimmedExcerpt, blueskyText: bluesky };
}
