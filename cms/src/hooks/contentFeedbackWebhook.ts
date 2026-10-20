import { randomUUID } from 'node:crypto';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterOperationHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  Payload,
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

const MAIN_STATUS_BEFORE_KEY = 'contentFeedbackMainStatusBefore';
const PENDING_BY_ID_KEY = 'contentFeedbackPendingById';

type MainStatusMap = Record<string, string>;
type PendingMap = Record<string, PendingContentFeedback>;

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

export function recordContentFeedbackMainStatusBefore(
  req: PayloadRequest,
  docId: string,
  status: string,
): void {
  const map = req.context[MAIN_STATUS_BEFORE_KEY] as MainStatusMap | undefined;
  if (!map) {
    req.context[MAIN_STATUS_BEFORE_KEY] = { [docId]: status };
    return;
  }
  map[docId] = status;
}

export function readContentFeedbackMainStatusBefore(
  req: PayloadRequest,
  docId: string,
  operation: 'create' | 'update',
): string {
  const map = req.context[MAIN_STATUS_BEFORE_KEY] as MainStatusMap | undefined;
  if (map && map[docId] !== undefined) {
    return map[docId];
  }
  return operation === 'create' ? 'draft' : 'draft';
}

export function detectContentFeedbackTransition(
  prevMainStatus: string,
  currentMainStatus: string,
): { becamePublished: boolean; becameArchived: boolean } {
  const becamePublished =
    currentMainStatus === 'published' && prevMainStatus !== 'published';
  const becameArchived =
    prevMainStatus === 'published' && currentMainStatus === 'draft';
  return { becamePublished, becameArchived };
}

async function captureMainStatusForId(
  req: PayloadRequest,
  id: string | number,
): Promise<void> {
  const status = await mainVersionStatus(req, id);
  recordContentFeedbackMainStatusBefore(req, String(id), status ?? 'draft');
}

export const contentFeedbackBeforeOperation: CollectionBeforeOperationHook<'posts'> = async ({
  operation,
  args,
  req,
}) => {
  try {
    if (isDraftOrAutosaveSave(req)) {
      return args;
    }
    if (operation === 'updateByID' && args && typeof args === 'object' && 'id' in args) {
      const id = (args as { id?: string | number }).id;
      if (id != null) {
        await captureMainStatusForId(req, id);
      }
    }
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback beforeOperation failed', error });
  }
  return args;
};

export const contentFeedbackCaptureMainStatusBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  try {
    if (isDraftOrAutosaveSave(req)) {
      return data;
    }
    const id = (data as PostDoc)?.id ?? (originalDoc as PostDoc)?.id;
    if (id != null) {
      await captureMainStatusForId(req, id);
    }
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback beforeChange capture failed', error });
  }
  return data;
};

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

export function queueContentFeedbackPending(
  req: PayloadRequest,
  docId: string | number,
  body: PendingContentFeedback,
): void {
  const key = String(docId);
  const existing = req.context[PENDING_BY_ID_KEY] as PendingMap | undefined;
  if (!existing) {
    req.context[PENDING_BY_ID_KEY] = { [key]: body };
    return;
  }
  existing[key] = body;
}

export function takeAllContentFeedbackPending(req: PayloadRequest): PendingContentFeedback[] {
  const map = req.context[PENDING_BY_ID_KEY] as PendingMap | undefined;
  if (!map) {
    return [];
  }
  delete req.context[PENDING_BY_ID_KEY];
  return Object.values(map);
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

export type DeferredSendFn = typeof sendContentFeedbackWebhook;

export async function runDeferredContentFeedbackSend(
  payload: Payload,
  body: PendingContentFeedback,
  send: DeferredSendFn = sendContentFeedbackWebhook,
): Promise<boolean> {
  const log = payload.logger;

  if (body.event === 'deleted') {
    try {
      await payload.findByID({
        collection: 'posts',
        id: body.post_id,
        draft: false,
        depth: 0,
      });
      return false;
    } catch {
      send(body, log);
      return true;
    }
  }

  const main = await payload.findByID({
    collection: 'posts',
    id: body.post_id,
    draft: false,
    depth: 0,
  });
  const post = main as PostDoc;
  if (!isAgentOrigin(post)) {
    return false;
  }

  const expectedStatus = body.event === 'published' ? 'published' : 'draft';
  if (post._status !== expectedStatus) {
    return false;
  }

  send(body, log);
  return true;
}

function scheduleSendAfterCommit(req: PayloadRequest, body: PendingContentFeedback): void {
  const payload = req.payload;
  setImmediate(() => {
    void runDeferredContentFeedbackSend(payload, body).catch((error) => {
      payload.logger.error({ msg: 'content-feedback deferred send failed', error });
    });
  });
}

export const contentFeedbackAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
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

    const prevMainStatus = readContentFeedbackMainStatusBefore(
      req,
      String(postId),
      operation,
    );
    const currentMainStatus = (await mainVersionStatus(req, postId)) ?? 'draft';

    const { becamePublished, becameArchived } = detectContentFeedbackTransition(
      prevMainStatus,
      currentMainStatus,
    );

    if (!becamePublished && !becameArchived) {
      return doc;
    }

    const categories = await categoryLabels(post, req);
    const merged = { ...originDoc, ...post, id: postId };

    if (becamePublished) {
      queueContentFeedbackPending(req, postId, buildBody('published', merged, categories));
    } else if (becameArchived) {
      queueContentFeedbackPending(req, postId, buildBody('archived', merged, categories));
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
    const pending = takeAllContentFeedbackPending(req);
    for (const body of pending) {
      scheduleSendAfterCommit(req, body);
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
