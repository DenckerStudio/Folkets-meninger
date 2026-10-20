import { JobCancelledError, type TaskConfig } from 'payload';
import {
  ContentFeedbackWebhookError,
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
  handler: async ({ input, req, job }) => {
    if (!input) {
      throw new Error('contentFeedbackSend: missing job input');
    }
    const snapshot = input.snapshot as ContentFeedbackSendInput['snapshot'];

    try {
      await sendContentFeedbackWebhook(
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
    } catch (error) {
      if (error instanceof ContentFeedbackWebhookError && error.kind !== 'retryable') {
        await req.payload.update({
          collection: 'payload-jobs',
          id: job.id,
          data: {
            hasError: true,
            processing: false,
            waitUntil: null,
            error: {
              cancelled: true,
              message: error.message,
            },
          },
          overrideAccess: true,
          req,
        });
        throw new JobCancelledError(error.message);
      }
      throw error;
    }

    return { output: { ok: true } };
  },
};
