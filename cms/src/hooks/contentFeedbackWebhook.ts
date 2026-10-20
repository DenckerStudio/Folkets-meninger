import { randomUUID } from 'node:crypto';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload';
import type { ContentFeedbackWebhookEvent } from '@/lib/contentFeedbackWebhook';
import type { ContentFeedbackSendInput } from '@/jobs/contentFeedbackSend';

type PostDoc = {
  id: string | number;
  slug?: string;
  title?: string;
  excerpt?: string;
  origin?: string;
  _status?: string;
  category?: { name?: string; slug?: string; title?: string } | string | number;
};

type MainDocSnapshot = {
  status: string;
  origin: string;
};

const MAIN_SNAPSHOT_KEY = 'contentFeedbackMainSnapshotBefore';
const CREATE_ORIGIN_KEY = 'contentFeedbackCreateOrigin';

export function isDraftOrAutosaveSave(req: PayloadRequest): boolean {
  const q = req.query as Record<string, unknown>;
  if (q.draft === 'true' || q.draft === true) return true;
  if (q.autosave === 'true' || q.autosave === true) return true;
  return false;
}

async function loadMainPost(req: PayloadRequest, id: string | number): Promise<PostDoc | null> {
  try {
    return (await req.payload.findByID({
      collection: 'posts',
      id,
      draft: false,
      depth: 0,
      req,
    })) as PostDoc;
  } catch {
    return null;
  }
}

function snapshotMap(req: PayloadRequest): Record<string, MainDocSnapshot> {
  const existing = req.context[MAIN_SNAPSHOT_KEY] as Record<string, MainDocSnapshot> | undefined;
  if (!existing) {
    req.context[MAIN_SNAPSHOT_KEY] = {};
    return req.context[MAIN_SNAPSHOT_KEY] as Record<string, MainDocSnapshot>;
  }
  return existing;
}

export function recordMainDocSnapshot(
  req: PayloadRequest,
  docId: string,
  snapshot: MainDocSnapshot,
): void {
  snapshotMap(req)[docId] = snapshot;
}

export function readMainDocSnapshot(
  req: PayloadRequest,
  docId: string,
  operation: 'create' | 'update',
): MainDocSnapshot {
  const snap = snapshotMap(req)[docId];
  if (snap) {
    return snap;
  }
  if (operation === 'create') {
    const origin = String(req.context[CREATE_ORIGIN_KEY] ?? 'manual');
    return { status: 'draft', origin };
  }
  return { status: 'draft', origin: 'manual' };
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

async function captureMainDocSnapshot(req: PayloadRequest, id: string | number): Promise<void> {
  const main = await loadMainPost(req, id);
  recordMainDocSnapshot(req, String(id), {
    status: main?._status ?? 'draft',
    origin: main?.origin ?? 'manual',
  });
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
    if (operation === 'update' && args && typeof args === 'object' && 'id' in args) {
      const id = (args as { id?: string | number }).id;
      if (id != null) {
        await captureMainDocSnapshot(req, id);
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
  operation,
}) => {
  try {
    if (isDraftOrAutosaveSave(req)) {
      return data;
    }

    const id = (data as PostDoc)?.id ?? (originalDoc as PostDoc)?.id;
    if (id == null) {
      if (operation === 'create') {
        req.context[CREATE_ORIGIN_KEY] = (data as PostDoc)?.origin ?? 'manual';
      }
      return data;
    }

    await captureMainDocSnapshot(req, id);
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

function buildJobInput(
  event: ContentFeedbackWebhookEvent,
  doc: PostDoc,
  categories: string[],
): ContentFeedbackSendInput {
  return {
    postId: String(doc.id),
    event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    snapshot: {
      slug: doc.slug?.trim() ?? '',
      title: doc.title?.trim() ?? '',
      excerpt: doc.excerpt?.trim() ?? '',
      categories,
      origin: doc.origin?.trim() ?? 'n8n',
    },
  };
}

async function queueContentFeedbackJob(
  req: PayloadRequest,
  input: ContentFeedbackSendInput,
): Promise<void> {
  await req.payload.jobs.queue({
    task: 'contentFeedbackSend',
    input,
    queue: 'content-feedback',
    req,
  });
}

export const contentFeedbackAfterChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
  try {
    if (isDraftOrAutosaveSave(req)) {
      return doc;
    }

    const post = doc as PostDoc;
    const postId = post.id;
    if (postId == null) {
      return doc;
    }

    const before = readMainDocSnapshot(req, String(postId), operation);
    if (before.origin !== 'n8n') {
      return doc;
    }

    const main = await loadMainPost(req, postId);
    const currentMainStatus =
      typeof post._status === 'string' ? post._status : (main?._status ?? 'draft');

    const { becamePublished, becameArchived } = detectContentFeedbackTransition(
      before.status,
      currentMainStatus,
    );

    if (!becamePublished && !becameArchived) {
      return doc;
    }

    const categories = await categoryLabels(post, req);
    const merged = { ...(main ?? post), ...post, id: postId, origin: before.origin };

    if (becamePublished) {
      await queueContentFeedbackJob(req, buildJobInput('published', merged, categories));
    } else if (becameArchived) {
      await queueContentFeedbackJob(req, buildJobInput('archived', merged, categories));
    }
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback afterChange failed', error });
  }

  return doc;
};

export const contentFeedbackAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    const post = doc as PostDoc;
    if (post.origin !== 'n8n') {
      return doc;
    }

    const categories = await categoryLabels(post, req);
    await queueContentFeedbackJob(req, buildJobInput('deleted', post, categories));
  } catch (error) {
    req.payload.logger.error({ msg: 'content-feedback afterDelete failed', error });
  }
  return doc;
};
