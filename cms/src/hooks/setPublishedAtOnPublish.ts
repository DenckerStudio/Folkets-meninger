import type { CollectionBeforeChangeHook } from 'payload';
import type { PayloadRequest } from 'payload';

type StatusDoc = {
  _status?: string;
  publishedAt?: string | null;
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

function hasPublishedAt(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * When a document is published, ensure `publishedAt` is set once (editors may omit it in admin).
 */
export function applyPublishedAtOnPublish(
  data: StatusDoc,
  originalDoc: StatusDoc | null | undefined,
  options: { skip?: boolean } = {},
): StatusDoc {
  if (options.skip) return data;
  if (data._status !== 'published') return data;

  const previousStatus = originalDoc?._status;
  const isPublishTransition = previousStatus !== 'published';
  if (!isPublishTransition) return data;

  if (hasPublishedAt(data.publishedAt) || hasPublishedAt(originalDoc?.publishedAt)) {
    return data;
  }

  data.publishedAt = new Date().toISOString();
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
