import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import type { CreateBlogDraftInput } from '@/lib/blog/service';
import {
  BLOG_EXCERPT_MAX,
  BLOG_TITLE_MAX,
  normalizeBlogExcerpt,
  normalizeBlogTitle,
  normalizeBlueskyText,
  validateBlueskyGraphemes,
} from '@/lib/blog/text-limits';

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseCreateBlogDraftBody(
  body: unknown,
): { ok: true; input: CreateBlogDraftInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig JSON-body' };
  }
  const record = body as Record<string, unknown>;
  const slugRaw = typeof record.slug === 'string' ? record.slug : '';
  const slug = normalizeBlogSlug(slugRaw);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, error: 'slug må være 2–120 tegn (a-z, 0-9, bindestrek)' };
  }

  const titleRaw = typeof record.title === 'string' ? record.title.trim() : '';
  const title = normalizeBlogTitle(titleRaw);
  const excerptRaw = typeof record.excerpt === 'string' ? record.excerpt.trim() : '';
  const excerpt = normalizeBlogExcerpt(excerptRaw);
  const body_md = typeof record.body_md === 'string' ? record.body_md : '';
  if (!title) return { ok: false, error: 'title er påkrevd' };
  if (titleRaw.length > BLOG_TITLE_MAX) {
    return { ok: false, error: `title kan være maks ${BLOG_TITLE_MAX} tegn` };
  }
  if (!excerpt) return { ok: false, error: 'excerpt er påkrevd' };
  if (excerptRaw.length > BLOG_EXCERPT_MAX) {
    return { ok: false, error: `excerpt kan være maks ${BLOG_EXCERPT_MAX} tegn` };
  }
  if (!body_md.trim()) return { ok: false, error: 'body_md er påkrevd' };

  const bluesky_raw =
    typeof record.bluesky_text === 'string' ? record.bluesky_text.trim() : '';
  if (bluesky_raw) {
    const blueskyError = validateBlueskyGraphemes(bluesky_raw);
    if (blueskyError) return { ok: false, error: blueskyError };
  }

  const source_event =
    record.source_event === undefined || record.source_event === null
      ? null
      : typeof record.source_event === 'string'
        ? record.source_event.trim()
        : '';

  if (record.source_event != null && !source_event) {
    return { ok: false, error: 'source_event må være en streng' };
  }

  const suggested_tags = asStringArray(record.suggested_tags, 12);
  const legacyTags = asStringArray(record.tags, 12);

  const aiRecord =
    record.ai && typeof record.ai === 'object' ? (record.ai as Record<string, unknown>) : null;

  const review_note =
    record.review_note === undefined || record.review_note === null
      ? undefined
      : typeof record.review_note === 'string'
        ? record.review_note.trim()
        : '';

  if (record.review_note != null && review_note === '') {
    return { ok: false, error: 'review_note må være en streng' };
  }

  return {
    ok: true,
    input: {
      slug,
      title,
      excerpt,
      body_md,
      tags: legacyTags,
      suggested_tags: suggested_tags.length ? suggested_tags : legacyTags,
      category: typeof record.category === 'string' ? record.category.trim() : undefined,
      related_sak_ids: asStringArray(record.related_sak_ids, 8),
      related_horing_ids: asStringArray(record.related_horing_ids, 8),
      source_event,
      review_note,
      bluesky_text: bluesky_raw
        ? normalizeBlueskyText(excerpt, bluesky_raw)
        : normalizeBlueskyText(excerpt),
      ai: aiRecord
        ? {
            model_family:
              typeof aiRecord.model_family === 'string' ? aiRecord.model_family : undefined,
            prompt_version:
              typeof aiRecord.prompt_version === 'string' ? aiRecord.prompt_version : undefined,
            generated_at:
              typeof aiRecord.generated_at === 'string' ? aiRecord.generated_at : undefined,
          }
        : undefined,
    },
  };
}

export function parseSocialPostedBody(
  body: unknown,
): { ok: true; slug: string; bluesky_uri?: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig JSON-body' };
  }
  const record = body as Record<string, unknown>;
  const slugRaw = typeof record.slug === 'string' ? record.slug : '';
  const slug = normalizeBlogSlug(slugRaw);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, error: 'slug er påkrevd' };
  }
  const bluesky_uri =
    typeof record.bluesky_uri === 'string' ? record.bluesky_uri.trim() : undefined;
  return { ok: true, slug, bluesky_uri };
}
