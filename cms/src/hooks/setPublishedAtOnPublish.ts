import type { CollectionBeforeChangeHook } from 'payload';
import type { PayloadRequest } from 'payload';

type StatusDoc = {
  _status?: string;
  publishedAt?: string | null;
  createdAt?: string | null;
};

function queryFlag(value: unknown): boolean {
  return value === true || value === 'true';
}

export function isAutosaveRequest(req: PayloadRequest): boolean {
  return queryFlag(req.query?.autosave);
}

export function isDraftContentSave(data: StatusDoc, req: PayloadRequest): boolean {
  if (data._status === 'draft') return true;
  if (queryFlag(req.query?.draft) && data._status !== 'published') return true;
  return false;
}

function isEmptyPublishedAt(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

/**
 * Pick a non-empty publish timestamp when the post is (or stays) published.
 * Order: explicit incoming value → previous publish date → document createdAt → now.
 */
export function resolvePublishedAtForPublishedPost(
  data: StatusDoc,
  originalDoc: StatusDoc | null | undefined,
): string {
  if (!isEmptyPublishedAt(data.publishedAt) && typeof data.publishedAt === 'string') {
    return data.publishedAt.trim();
  }
  if (
    !isEmptyPublishedAt(originalDoc?.publishedAt) &&
    typeof originalDoc?.publishedAt === 'string'
  ) {
    return originalDoc.publishedAt.trim();
  }
  if (!isEmptyPublishedAt(originalDoc?.createdAt) && typeof originalDoc?.createdAt === 'string') {
    return originalDoc.createdAt.trim();
  }
  return new Date().toISOString();
}

/**
 * When a document is published, ensure `publishedAt` is never left empty (editors may clear the field).
 */
export function applyPublishedAtOnPublish(
  data: StatusDoc,
  originalDoc: StatusDoc | null | undefined,
  options: { skip?: boolean } = {},
): StatusDoc {
  if (options.skip) return data;
  if (data._status !== 'published') return data;

  data.publishedAt = resolvePublishedAtForPublishedPost(data, originalDoc);
  return data;
}

export const setPublishedAtOnPublish: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  req,
}) => {
  if (!data || typeof data !== 'object') return data;

  const skip = isAutosaveRequest(req) || isDraftContentSave(data as StatusDoc, req);
  return applyPublishedAtOnPublish(data as StatusDoc, originalDoc as StatusDoc | undefined, {
    skip,
  });
};
