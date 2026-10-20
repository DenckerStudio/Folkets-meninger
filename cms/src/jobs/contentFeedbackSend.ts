import type { TaskConfig } from 'payload';
import {
  sendContentFeedbackWebhook,
  type ContentFeedbackWebhookEvent,
} from '@/lib/contentFeedbackWebhook';

export type ContentFeedbackSendInput = {
  postId: string;
  event: ContentFeedbackWebhookEvent;
  eventId: string;
  occurredAt: string;
  snapshot: {
    slug: string;
    title: string;
    excerpt: string;
    categories: string[];
    origin: string;
  };
};

export const contentFeedbackSendTask: TaskConfig = {
  slug: 'contentFeedbackSend',
  label: 'Send content-feedback webhook',
  retries: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
  inputSchema: [
    { name: 'postId', type: 'text', required: true },
    {
      name: 'event',
      type: 'select',
      required: true,
      options: ['published', 'archived', 'deleted'],
    },
    { name: 'eventId', type: 'text', required: true },
    { name: 'occurredAt', type: 'text', required: true },
    { name: 'snapshot', type: 'json', required: true },
  ],
  handler: async ({ input, req }) => {
    if (!input) {
      throw new Error('contentFeedbackSend: missing job input');
    }
    const snapshot = input.snapshot as ContentFeedbackSendInput['snapshot'];
    sendContentFeedbackWebhook(
      {
        event: input.event as ContentFeedbackWebhookEvent,
        event_id: input.eventId,
        post_id: input.postId,
        slug: snapshot.slug ?? '',
        title: snapshot.title ?? '',
        excerpt: snapshot.excerpt ?? '',
        categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
        origin: snapshot.origin ?? 'n8n',
        occurred_at: input.occurredAt,
      },
      req.payload.logger,
    );
    return { output: { ok: true } };
  },
};
