import { moderateForumPost, moderateForumText } from '@/lib/forum/moderation';
import { sanitizeForumBody, validateUrlsInText } from '@/lib/forum/sanitize-links';

export const FORUM_LIMITS = {
  titleMin: 3,
  titleMax: 200,
  bodyMax: 10_000,
} as const;

export type ForumTargetType = 'thread' | 'reply';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function validateContent(title: string, body: string): { ok: true; title: string; body: string } | { ok: false; error: string } {
  const sanitizedTitle = sanitizeForumBody(title);
  const sanitizedBody = sanitizeForumBody(body);

  const moderation = moderateForumPost(sanitizedTitle, sanitizedBody);
  if (!moderation.ok) {
    return { ok: false, error: moderation.reason };
  }

  const urlCheck = validateUrlsInText(`${sanitizedTitle}\n${sanitizedBody}`);
  if (!urlCheck.ok) {
    return { ok: false, error: urlCheck.error };
  }

  return { ok: true, title: sanitizedTitle, body: sanitizedBody };
}

export function validateCreateThread(payload: {
  title?: unknown;
  body?: unknown;
  stortinget_issue_id?: unknown;
  context_items?: unknown;
}): { ok: true; title: string; body: string; stortingetIssueId: string | null; contextItems: unknown } | { ok: false; error: string } {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (title.length < FORUM_LIMITS.titleMin || title.length > FORUM_LIMITS.titleMax) {
    return { ok: false, error: `Tittel må være mellom ${FORUM_LIMITS.titleMin} og ${FORUM_LIMITS.titleMax} tegn` };
  }

  if (body.length < 1 || body.length > FORUM_LIMITS.bodyMax) {
    return { ok: false, error: `Innhold må være mellom 1 og ${FORUM_LIMITS.bodyMax} tegn` };
  }

  const content = validateContent(title, body);
  if (!content.ok) return content;

  let stortingetIssueId: string | null = null;
  if (payload.stortinget_issue_id != null && payload.stortinget_issue_id !== '') {
    if (typeof payload.stortinget_issue_id !== 'string' || !payload.stortinget_issue_id.trim()) {
      return { ok: false, error: 'Ugyldig stortingssak' };
    }
    stortingetIssueId = payload.stortinget_issue_id.trim();
  }

  return {
    ok: true,
    title: content.title,
    body: content.body,
    stortingetIssueId,
    contextItems: payload.context_items ?? [],
  };
}

export function validateCreateReply(payload: {
  thread_id?: unknown;
  body?: unknown;
  parent_reply_id?: unknown;
}): { ok: true; threadId: string; body: string } | { ok: false; error: string } {
  if (!isValidUuid(payload.thread_id)) {
    return { ok: false, error: 'Ugyldig tråd' };
  }

  if (payload.parent_reply_id != null && payload.parent_reply_id !== '') {
    return { ok: false, error: 'Nestede svar støttes ikke' };
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (body.length < 1 || body.length > FORUM_LIMITS.bodyMax) {
    return { ok: false, error: `Innhold må være mellom 1 og ${FORUM_LIMITS.bodyMax} tegn` };
  }

  const sanitized = sanitizeForumBody(body);
  const moderation = moderateForumText(sanitized);
  if (!moderation.ok) {
    return { ok: false, error: moderation.reason };
  }

  const urlCheck = validateUrlsInText(sanitized);
  if (!urlCheck.ok) {
    return { ok: false, error: urlCheck.error };
  }

  return { ok: true, threadId: payload.thread_id, body: sanitized };
}

export function validateToggleLike(payload: {
  target_type?: unknown;
  target_id?: unknown;
}): { ok: true; targetType: ForumTargetType; targetId: string } | { ok: false; error: string } {
  if (payload.target_type !== 'thread' && payload.target_type !== 'reply') {
    return { ok: false, error: 'Ugyldig måltype' };
  }

  if (!isValidUuid(payload.target_id)) {
    return { ok: false, error: 'Ugyldig mål' };
  }

  return {
    ok: true,
    targetType: payload.target_type,
    targetId: payload.target_id,
  };
}
