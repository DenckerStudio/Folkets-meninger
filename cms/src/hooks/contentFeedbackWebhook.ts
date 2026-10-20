import { randomUUID } from 'node:crypto';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterOperationHook,
  PayloadRequest,
} from 'payload';
import {
  sendContentFeedbackWebhook,
  type ContentFeedbackWebhookBody,
  type ContentFeedbackWebhookEvent,
} from '@/lib/contentFeedbackWebhook';

type PostDoc = {
  id: string | number;
  slug?: string;
  title?: string;
  excerpt?: string;
  origin?: string;
  _status?: string;
  category?: { name?: string; slug?: string; title?: string } | string | number;
};

type PendingContentFeedback = ContentFeedbackWebhookBody;

const PENDING_KEY = 'contentFeedbackPending';

function isAgentOrigin(doc: PostDoc | null | undefined): boolean {
  return doc?.origin === 'n8n';
}

export function isDraftOrAutosaveSave(req: PayloadRequest): boolean {
  const q = req.query as Record<string, unknown>;
  if (q.draft === 'true' || q.draft === true) return true;
  if (q.autosave === 'true' || q.autosave === true) return true;
  return false;
}

async function mainVersionStatus(
  req: PayloadRequest,
  id: string | number,
): Promise<string | undefined> {
  try {
    const main = await req.payload.findByID({
      collection: 'posts',
      id,
      draft: false,
      depth: 0,
      req,
    });
    return (main as PostDoc)._status;
  } catch {
    return undefined;
  }
}

async function categoryLabels(doc: PostDoc, req: PayloadRequest): Promise<string[]> {
  const category = doc.category;
  if (category && typeof category === 'object') {
    const label =
      category.name?.trim() || category.title?.trim() || category.slug?.trim();
    if (label) return [label];
  }
  if (typeof category === 'string' || typeof category === 'number') {
    try {
      const found = await req.payload.findByID({
        collection: 'categories',
        id: category,
        depth: 0,
        req,
      });
      const name =
        (found as { name?: string; slug?: string; title?: string }).name?.trim() ||
        (found as { slug?: string }).slug?.trim() ||
        (found as { title?: string }).title?.trim();
      if (name) return [name];
    } catch {
      return [];
    }
  }
  return [];
}

function queuePending(req: PayloadRequest, body: PendingContentFeedback): void {
  req.context[PENDING_KEY] = body;
}

function takePending(req: PayloadRequest): PendingContentFeedback | null {
  const pending = req.context[PENDING_KEY] as PendingContentFeedback | undefined;
  if (pending) {
    delete req.context[PENDING_KEY];
  }
  return pending ?? null;
}

function buildBody(
  event: ContentFeedbackWebhookEvent,
  doc: PostDoc,
  categories: string[],
): PendingContentFeedback {
  return {
    event,
    event_id: randomUUID(),
    post_id: String(doc.id),
    slug: doc.slug?.trim() ?? '',
    title: doc.title?.trim() ?? '',
    excerpt: doc.excerpt?.trim() ?? '',
    categories,
    origin: doc.origin?.trim() ?? 'manual',
    occurred_at: new Date().toISOString(),
  };
}

function scheduleSendAfterCommit(req: PayloadRequest, body: PendingContentFeedback): void {
  setImmediate(() => {
    sendContentFeedbackWebhook(body, req.payload.logger);
  });
}

export const contentFeedbackAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  try {
    if (isDraftOrAutosaveSave(req)) {
      return doc;
    }

    const post = doc as PostDoc;
    const prev = previousDoc as PostDoc | undefined;
    if (!isAgentOrigin(post) && !isAgentOrigin(prev)) {
      return doc;
    }

    const originDoc = isAgentOrigin(post) ? post : prev;
    if (!originDoc) return doc;

    const postId = post.id ?? prev?.id;
    if (postId == null) return doc;

    const prevMainStatus = prev?._status ?? 'draft';
    const currentMainStatus = await mainVersionStatus(req, postId);

    const becamePublished =
      currentMainStatus === 'published' && prevMainStatus !== 'published';
    const becameArchived =
      prevMainStatus === 'published' && currentMainStatus === 'draft';

    if (!becamePublished && !becameArchived) {
      return doc;
    }

    const categories = await categoryLabels(post, req);
    const merged = { ...originDoc, ...post, id: postId };

    if (becamePublished) {
      queuePending(req, buildBody('published', merged, categories));
    } else if (becameArchived) {
      queuePending(req, buildBody('archived', merged, categories));
    }
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback afterChange failed', error });
  }

  return doc;
};

export const contentFeedbackAfterOperation: CollectionAfterOperationHook<'posts'> = ({
  req,
  result,
}) => {
  try {
    const pending = takePending(req);
    if (pending) {
      scheduleSendAfterCommit(req, pending);
    }
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback afterOperation failed', error });
  }
  return result;
};

export const contentFeedbackAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    const post = doc as PostDoc;
    if (!isAgentOrigin(post)) return doc;

    const categories = await categoryLabels(post, req);
    const body = buildBody('deleted', post, categories);
    scheduleSendAfterCommit(req, body);
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback afterDelete failed', error });
  }
  return doc;
};
