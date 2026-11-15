import { z } from 'zod';
import { isBlockedSourceUrl } from '@/lib/sources/blocklist';
import { formatBlogDraftSourceLabel } from '@/lib/blog/blog-draft-source-label';

const sourceRowSchema = z
  .object({
    title: z.string().trim().min(1, 'Kildetittel er påkrevd.'),
    publisher: z.string().trim().min(1, 'Utgiver eller domene er påkrevd.'),
    url: z.string().trim().url('Kilden må ha en gyldig URL.'),
    publishedAt: z.string().trim().optional(),
  })
  .superRefine((row, ctx) => {
    if (isBlockedSourceUrl(row.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Denne kilden kan ikke brukes i offentlig tekst.',
        path: ['url'],
      });
    }
  });

export type BlogDraftSourceEditRow = z.infer<typeof sourceRowSchema>;

export const blogDraftSourcesEditSchema = z.array(sourceRowSchema).max(24);

export function cmsSourcesFromEditRows(rows: readonly BlogDraftSourceEditRow[]): Array<{
  label: string;
  url: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ label: string; url: string }> = [];
  for (const row of rows) {
    const key = row.url.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: formatBlogDraftSourceLabel({
        title: row.title,
        publisher: row.publisher,
        publishedAt: row.publishedAt ?? null,
      }),
      url: row.url.trim(),
    });
  }
  return out;
}

const LABEL_WITH_PUBLISHER = /^(.*)\s+\(([^)]+)\)$/;

export function editRowFromCmsLabel(label: string, url: string): BlogDraftSourceEditRow | null {
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  if (!trimmedLabel || !trimmedUrl) return null;
  const match = LABEL_WITH_PUBLISHER.exec(trimmedLabel);
  if (!match) {
    return { title: trimmedLabel, publisher: 'Ukjent utgiver', url: trimmedUrl };
  }
  const publisherPart = match[2].trim();
  const dateMatch = /,\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(publisherPart);
  if (dateMatch) {
    const publisher = publisherPart.replace(dateMatch[0], '').trim();
    return {
      title: match[1].trim(),
      publisher: publisher || 'Ukjent utgiver',
      url: trimmedUrl,
      publishedAt: dateMatch[1],
    };
  }
  return {
    title: match[1].trim(),
    publisher: publisherPart || 'Ukjent utgiver',
    url: trimmedUrl,
  };
}

export function editRowsFromCmsSources(
  sources: ReadonlyArray<{ label?: string | null; url?: string | null }> | null | undefined,
): BlogDraftSourceEditRow[] {
  if (!sources?.length) return [];
  const rows: BlogDraftSourceEditRow[] = [];
  for (const row of sources) {
    const label = typeof row.label === 'string' ? row.label : '';
    const url = typeof row.url === 'string' ? row.url : '';
    const parsed = editRowFromCmsLabel(label, url);
    if (parsed) rows.push(parsed);
  }
  return rows;
}