import { z } from 'zod';
import { normalizeBlogExcerpt, normalizeBlogTitle } from '@/lib/blog/text-limits';
import { getCmsBaseUrl, getCmsEditorKey } from '@/lib/cms/payload-client';
import { payloadPatchPost } from '@/lib/cms/payload-update';
import type { PayloadPost } from '@/lib/cms/types';
import { finalizeBlogDraftBodyWithSources } from '@/lib/blog/blog-citations';
import { mapPayloadSourcesToPublic } from '@/lib/blog/public-post-sources';
import {
  blogDraftSourcesEditSchema,
  cmsSourcesFromEditRows,
  type BlogDraftSourceEditRow,
} from '@/lib/admin/blog-draft-source-edit';
import {
  BLOG_DRAFT_EDIT_NOT_CONFIGURED_MESSAGE,
  blogDraftEditContentSchema,
  fieldErrorsFromZod,
  type BlogDraftEditFieldErrors,
} from '@/lib/admin/blog-draft-edit-fields';

export { BLOG_DRAFT_EDIT_NOT_CONFIGURED_MESSAGE as BLOG_DRAFT_EDIT_NOT_CONFIGURED };

const nonEmptyTrimmedId = z
  .string()
  .trim()
  .min(1, 'Utkast-id er påkrevd.');

export const editBlogDraftBodySchema = z
  .object({
    id: nonEmptyTrimmedId,
    action: z.literal('edit'),
    title: blogDraftEditContentSchema.shape.title,
    excerpt: blogDraftEditContentSchema.shape.excerpt,
    bodyMarkdown: blogDraftEditContentSchema.shape.bodyMarkdown,
    sources: blogDraftSourcesEditSchema.optional(),
    previous_cms_sources: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          url: z.string().trim().url(),
        }),
      )
      .max(24)
      .optional(),
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
  | { ok: false; status: number; error: string; fields?: BlogDraftEditFieldErrors };

export function isBlogDraftEditConfigured(): boolean {
  return Boolean(getCmsBaseUrl() && getCmsEditorKey());
}

export function parseEditBlogDraftBody(body: unknown): ParseEditBlogDraftResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Ugyldig forespørsel.' };
  }

  const record = body as Record<string, unknown>;
  if (record._status === 'published' || record._status === 'publish') {
    return { ok: false, status: 400, error: 'Kan ikke publisere via redigering.' };
  }

  const parsed = editBlogDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrorsFromZod(parsed.error);
    const firstMessage = parsed.error.issues[0]?.message ?? 'Ugyldig forespørsel.';
    const error = firstMessage.endsWith('.') ? firstMessage : `${firstMessage}.`;
    return { ok: false, status: 400, error, fields };
  }

  return { ok: true, input: parsed.data };
}

export function buildEditBlogDraftPatch(
  input: EditBlogDraftInput,
  options?: { previousCmsSources?: Array<{ label: string; url: string }> },
): Record<string, unknown> {
  const previousCms = options?.previousCmsSources ?? [];
  const previousPublic = mapPayloadSourcesToPublic(previousCms);

  let bodyMarkdown = input.bodyMarkdown;
  if (input.sources) {
    const cmsSources = cmsSourcesFromEditRows(input.sources);
    const nextPublic = mapPayloadSourcesToPublic(cmsSources);
    bodyMarkdown = finalizeBlogDraftBodyWithSources(bodyMarkdown, previousPublic, nextPublic);
  } else if (previousPublic.length > 0) {
    bodyMarkdown = finalizeBlogDraftBodyWithSources(bodyMarkdown, previousPublic, []);
  }

  const patch: Record<string, unknown> = {
    title: normalizeBlogTitle(input.title),
    excerpt: normalizeBlogExcerpt(input.excerpt),
    bodyMarkdown,
  };

  if (input.category) {
    patch.category = input.category;
  }

  if (input.sources) {
    patch.sources = cmsSourcesFromEditRows(input.sources);
  }

  if (input.review?.note !== undefined) {
    patch.review = { note: input.review.note };
  }

  return patch;
}

export type BlogDraftEditSaved = {
  id: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  sources: Array<{ label: string; url: string }>;
  updatedAt: string | null;
};

export function blogDraftEditSavedFromPayloadPost(post: PayloadPost): BlogDraftEditSaved {
  return {
    id: String(post.id),
    title: post.title,
    excerpt: post.excerpt,
    bodyMarkdown: post.bodyMarkdown ?? '',
    sources: (post.sources ?? [])
      .map((row) => {
        const label = typeof row.label === 'string' ? row.label.trim() : '';
        const url = typeof row.url === 'string' ? row.url.trim() : '';
        if (!label || !url) return null;
        return { label, url };
      })
      .filter((row): row is { label: string; url: string } => row !== null),
    updatedAt: post.updatedAt ?? null,
  };
}

export type { BlogDraftSourceEditRow };

export type EditBlogDraftResult =
  | { ok: true; id: string; draft: BlogDraftEditSaved }
  | { ok: false; status: number; error: string };

export async function editBlogDraft(input: EditBlogDraftInput): Promise<EditBlogDraftResult> {
  const base = getCmsBaseUrl();
  if (!base) {
    return { ok: false, status: 503, error: 'Blogg er ikke tilgjengelig.' };
  }

  const editorKey = getCmsEditorKey();
  if (!editorKey) {
    return { ok: false, status: 503, error: BLOG_DRAFT_EDIT_NOT_CONFIGURED_MESSAGE };
  }

  const patch = buildEditBlogDraftPatch(input, {
    previousCmsSources: input.previous_cms_sources,
  });
  const result = await payloadPatchPost(input.id, patch, editorKey, { draft: true });
  if (!result.ok) {
    const message = result.error?.trim();
    const error =
      message && message.endsWith('.')
        ? message
        : `${message || 'Kunne ikke lagre endringer'}.`;
    return { ok: false, status: result.status, error };
  }

  const draft = blogDraftEditSavedFromPayloadPost(result.doc);

  return { ok: true, id: input.id, draft };
}
