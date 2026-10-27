import { z } from 'zod';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';

export type BlogDraftEditFieldKey = 'title' | 'excerpt' | 'bodyMarkdown';

export type BlogDraftEditFieldErrors = Partial<Record<BlogDraftEditFieldKey, string>>;

export const BLOG_DRAFT_EDIT_NOT_CONFIGURED_MESSAGE =
  'Redigering i admin er ikke satt opp ennå.';

export const BLOG_DRAFT_EDIT_PANEL_DISABLED_NOTE =
  'Redigering i admin er ikke satt opp ennå. Bruk lenken til Payload.';

const trimmedMin = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message);

export const blogDraftEditContentSchema = z.object({
  title: trimmedMin('Tittel er påkrevd.').max(
    BLOG_TITLE_MAX,
    `Tittel kan være maks ${BLOG_TITLE_MAX} tegn.`,
  ),
  excerpt: trimmedMin('Ingress er påkrevd.').max(
    BLOG_EXCERPT_MAX,
    `Ingress kan være maks ${BLOG_EXCERPT_MAX} tegn.`,
  ),
  bodyMarkdown: z
    .string()
    .min(1, 'Brødtekst er påkrevd.')
    .refine((value) => value.trim().length > 0, 'Brødtekst kan ikke være tom.'),
});

export type BlogDraftEditContent = z.infer<typeof blogDraftEditContentSchema>;

export function fieldErrorsFromZod(error: z.ZodError): BlogDraftEditFieldErrors {
  const fields: BlogDraftEditFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === 'title' || key === 'excerpt' || key === 'bodyMarkdown') {
      if (!fields[key]) {
        fields[key] = issue.message;
      }
    }
  }
  return fields;
}

export function firstFieldErrorKey(fields: BlogDraftEditFieldErrors): BlogDraftEditFieldKey | null {
  if (fields.title) return 'title';
  if (fields.excerpt) return 'excerpt';
  if (fields.bodyMarkdown) return 'bodyMarkdown';
  return null;
}

export function summarizeValidationError(
  error: z.ZodError,
  fallback = 'Ugyldig forespørsel.',
): { error: string; fields: BlogDraftEditFieldErrors } {
  const fields = fieldErrorsFromZod(error);
  const firstIssue = error.issues[0]?.message;
  const errorMessage =
    firstIssue && firstIssue.endsWith('.') ? firstIssue : `${firstIssue ?? fallback}`;
  return {
    error: errorMessage.endsWith('.') ? errorMessage : `${errorMessage}.`,
    fields,
  };
}

export function validateBlogDraftEditContent(
  values: BlogDraftEditContent,
): { ok: true } | { ok: false; error: string; fields: BlogDraftEditFieldErrors } {
  const parsed = blogDraftEditContentSchema.safeParse(values);
  if (parsed.success) {
    return { ok: true };
  }
  const { error, fields } = summarizeValidationError(parsed.error);
  return { ok: false, error, fields };
}

export function mapApiFieldErrors(
  fields: Record<string, unknown> | undefined,
): BlogDraftEditFieldErrors {
  if (!fields || typeof fields !== 'object') {
    return {};
  }
  const mapped: BlogDraftEditFieldErrors = {};
  for (const key of ['title', 'excerpt', 'bodyMarkdown'] as const) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) {
      mapped[key] = value.endsWith('.') ? value : `${value}.`;
    }
  }
  return mapped;
}
