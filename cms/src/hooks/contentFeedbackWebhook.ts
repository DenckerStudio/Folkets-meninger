import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload';
import {
  sendContentFeedbackWebhook,
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

function isAgentOrigin(doc: PostDoc | null | undefined): boolean {
  return doc?.origin === 'n8n';
}

async function categoryLabels(
  doc: PostDoc,
  req: PayloadRequest,
): Promise<string[]> {
  const category = doc.category;
  if (category && typeof category === 'object') {
    const label =
      category.name?.trim() ||
      category.title?.trim() ||
      category.slug?.trim();
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

function buildBody(
  event: ContentFeedbackWebhookEvent,
  doc: PostDoc,
  categories: string[],
): Parameters<typeof sendContentFeedbackWebhook>[0] {
  return {
    event,
    post_id: String(doc.id),
    slug: doc.slug?.trim() ?? '',
    title: doc.title?.trim() ?? '',
    excerpt: doc.excerpt?.trim() ?? '',
    categories,
    origin: doc.origin?.trim() ?? 'manual',
    occurred_at: new Date().toISOString(),
  };
}

function notify(
  event: ContentFeedbackWebhookEvent,
  doc: PostDoc,
  categories: string[],
  req: PayloadRequest,
): void {
  sendContentFeedbackWebhook(buildBody(event, doc, categories), req.payload.logger);
}

export const contentFeedbackAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  const post = doc as PostDoc;
  const prev = previousDoc as PostDoc | undefined;
  if (!isAgentOrigin(post) && !isAgentOrigin(prev)) {
    return doc;
  }

  const originDoc = isAgentOrigin(post) ? post : prev;
  if (!originDoc) return doc;

  const becamePublished =
    post._status === 'published' && prev?._status !== 'published';
  const becameArchived =
    prev?._status === 'published' && post._status === 'draft';

  if (!becamePublished && !becameArchived) {
    return doc;
  }

  const categories = await categoryLabels(post, req);
  if (becamePublished) {
    notify('published', { ...originDoc, ...post }, categories, req);
  } else if (becameArchived) {
    notify('archived', { ...originDoc, ...post }, categories, req);
  }

  return doc;
};

export const contentFeedbackAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const post = doc as PostDoc;
  if (!isAgentOrigin(post)) return doc;

  const categories = await categoryLabels(post, req);
  notify('deleted', post, categories, req);
  return doc;
};
