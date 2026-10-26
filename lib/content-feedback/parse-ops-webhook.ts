import type { BlogContentFeedbackEvent, BlogContentFeedbackPayload } from '@/lib/content-feedback/blog-auto';

const EVENTS: BlogContentFeedbackEvent[] = ['published', 'deleted', 'archived'];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBlogContentFeedbackWebhook(
  body: unknown,
): { ok: true; payload: BlogContentFeedbackPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Ugyldig JSON-body' };
  }

  const record = body as Record<string, unknown>;
  const event = record.event;
  if (typeof event !== 'string' || !EVENTS.includes(event as BlogContentFeedbackEvent)) {
    return { ok: false, error: 'Ugyldig event' };
  }

  const postId = typeof record.post_id === 'string' ? record.post_id.trim() : '';
  if (!postId) {
    return { ok: false, error: 'post_id er påkrevd' };
  }

  const eventId = typeof record.event_id === 'string' ? record.event_id.trim() : '';
  if (!eventId || !UUID_RE.test(eventId)) {
    return { ok: false, error: 'event_id er påkrevd' };
  }

  const categories = Array.isArray(record.categories)
    ? record.categories
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const occurredAt =
    typeof record.occurred_at === 'string' && record.occurred_at.trim()
      ? record.occurred_at.trim()
      : new Date().toISOString();

  return {
    ok: true,
    payload: {
      event: event as BlogContentFeedbackEvent,
      event_id: eventId,
      post_id: postId,
      slug: typeof record.slug === 'string' ? record.slug.trim() : '',
      title: typeof record.title === 'string' ? record.title.trim() : '',
      excerpt: typeof record.excerpt === 'string' ? record.excerpt.trim() : '',
      categories,
      origin: typeof record.origin === 'string' ? record.origin.trim() : 'manual',
      occurred_at: occurredAt,
    },
  };
}
