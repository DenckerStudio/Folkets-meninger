import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import type { CreateBlogDraftInput } from '@/lib/blog/service';

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

  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const excerpt = typeof record.excerpt === 'string' ? record.excerpt.trim() : '';
  const body_md = typeof record.body_md === 'string' ? record.body_md : '';
  if (!title) return { ok: false, error: 'title er påkrevd' };
  if (!body_md.trim()) return { ok: false, error: 'body_md er påkrevd' };

  const source_event =
    record.source_event === undefined || record.source_event === null
      ? null
      : typeof record.source_event === 'string'
        ? record.source_event.trim()
        : '';

  if (record.source_event != null && !source_event) {
    return { ok: false, error: 'source_event må være en streng' };
  }

  return {
    ok: true,
    input: {
      slug,
      title,
      excerpt,
      body_md,
      tags: asStringArray(record.tags, 12),
      related_sak_ids: asStringArray(record.related_sak_ids, 8),
      related_horing_ids: asStringArray(record.related_horing_ids, 8),
      source_event,
    },
  };
}

export function parseSocialPostedBody(
  body: unknown,
): { ok: true; slug: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig JSON-body' };
  }
  const record = body as Record<string, unknown>;
  const slugRaw = typeof record.slug === 'string' ? record.slug : '';
  const slug = normalizeBlogSlug(slugRaw);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, error: 'slug er påkrevd' };
  }
  return { ok: true, slug };
}
