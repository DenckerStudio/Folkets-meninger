import { z } from 'zod';
import {
  BLOG_EXCERPT_MAX,
  BLOG_TITLE_MAX,
  normalizeBlogExcerpt,
  normalizeBlogTitle,
} from '@/lib/blog/text-limits';
import { getCmsBaseUrl, getCmsEditorKey } from '@/lib/cms/payload-client';
import { payloadPatchPost } from '@/lib/cms/payload-update';

export const BLOG_DRAFT_EDIT_NOT_CONFIGURED = 'Redigering er ikke satt opp ennå';

const nonEmptyTrimmed = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} er påkrevd`);

export const editBlogDraftBodySchema = z
  .object({
    id: nonEmptyTrimmed('id'),
    action: z.literal('edit'),
    title: nonEmptyTrimmed('title').max(
      BLOG_TITLE_MAX,
      `title kan være maks ${BLOG_TITLE_MAX} tegn`,
    ),
    excerpt: nonEmptyTrimmed('excerpt').max(
      BLOG_EXCERPT_MAX,
      `excerpt kan være maks ${BLOG_EXCERPT_MAX} tegn`,
    ),
    bodyMarkdown: z
      .string()
      .min(1, 'bodyMarkdown er påkrevd')
      .refine((value) => value.trim().length > 0, 'bodyMarkdown kan ikke være tom'),
    category: z.string().trim().min(1).optional(),
    review: z
      .object({
        note: z.string().optional(),
      })
      .optional(),
    _status: z.never().optional(),
  })
  .strict();

export type EditBlogDraftInput = z.infer<typeof editBlogDraftBodySchema>;

export type ParseEditBlogDraftResult =
  | { ok: true; input: EditBlogDraftInput }
  | { ok: false; status: number; error: string };

export function parseEditBlogDraftBody(body: unknown): ParseEditBlogDraftResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Ugyldig JSON-body' };
  }

  const record = body as Record<string, unknown>;
  if (record._status === 'published' || record._status === 'publish') {
    return { ok: false, status: 400, error: 'Kan ikke publisere via redigering' };
  }

  const parsed = editBlogDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Ugyldig forespørsel';
    return { ok: false, status: 400, error: message };
  }

  return { ok: true, input: parsed.data };
}

export function buildEditBlogDraftPatch(input: EditBlogDraftInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    title: normalizeBlogTitle(input.title),
    excerpt: normalizeBlogExcerpt(input.excerpt),
    bodyMarkdown: input.bodyMarkdown,
  };

  if (input.category) {
    patch.category = input.category;
  }

  if (input.review?.note !== undefined) {
    patch.review = { note: input.review.note };
  }

  return patch;
}

export type EditBlogDraftResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

export async function editBlogDraft(input: EditBlogDraftInput): Promise<EditBlogDraftResult> {
  const base = getCmsBaseUrl();
  if (!base) {
    return { ok: false, status: 503, error: 'Blogg er ikke tilgjengelig' };
  }

  const editorKey = getCmsEditorKey();
  if (!editorKey) {
    return { ok: false, status: 503, error: BLOG_DRAFT_EDIT_NOT_CONFIGURED };
  }

  const patch = buildEditBlogDraftPatch(input);
  const result = await payloadPatchPost(input.id, patch, editorKey, { draft: true });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  return { ok: true, id: input.id };
}
