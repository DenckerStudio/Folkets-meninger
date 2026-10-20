import { z } from 'zod';
import {
  ADMIN_CONTENT_FEEDBACK_TYPES,
  CONTENT_FEEDBACK_ASPECT_KEYS,
  CONTENT_FEEDBACK_REASON_TAGS,
  hasNegativeAspect,
} from '@/lib/content-feedback/constants';
import type { ContentFeedbackAspects, ContentFeedbackVerdict } from '@/lib/content-feedback/types';

const aspectValueSchema = z.union([z.literal('+'), z.literal('-'), z.null()]).optional();

const aspectsSchema = z
  .object(
    Object.fromEntries(
      CONTENT_FEEDBACK_ASPECT_KEYS.map((key) => [key, aspectValueSchema]),
    ) as Record<(typeof CONTENT_FEEDBACK_ASPECT_KEYS)[number], typeof aspectValueSchema>,
  )
  .partial()
  .optional()
  .transform((value) => (value ?? {}) as ContentFeedbackAspects);

const reasonTagSchema = z.enum(
  CONTENT_FEEDBACK_REASON_TAGS.map((item) => item.tag) as [
    (typeof CONTENT_FEEDBACK_REASON_TAGS)[number]['tag'],
    ...(typeof CONTENT_FEEDBACK_REASON_TAGS)[number]['tag'][],
  ],
);

export const adminContentFeedbackBodySchema = z.object({
  content_type: z.enum(ADMIN_CONTENT_FEEDBACK_TYPES),
  content_id: z.string().trim().min(1).max(200),
  verdict: z.enum(['approve', 'reject', 'neutral']),
  aspects: aspectsSchema,
  reason_tags: z.array(reasonTagSchema).max(20).optional().default([]),
  note: z
    .string()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  snapshot: z.record(z.string(), z.unknown()).optional().default({}),
});

export type AdminContentFeedbackBody = z.infer<typeof adminContentFeedbackBodySchema>;

export function rejectionRequiresDetail(
  verdict: ContentFeedbackVerdict,
  aspects: ContentFeedbackAspects,
  reasonTags: string[],
): boolean {
  if (verdict !== 'reject') return false;
  return hasNegativeAspect(aspects) || reasonTags.length > 0;
}

export function validateRejectionDetail(
  verdict: ContentFeedbackVerdict,
  aspects: ContentFeedbackAspects,
  reasonTags: string[],
): string | null {
  if (!rejectionRequiresDetail(verdict, aspects, reasonTags)) {
    if (verdict === 'reject') {
      return 'Ved avvisning må minst ett aspekt merkes med 👎 eller minst én grunn velges.';
    }
  }
  return null;
}
