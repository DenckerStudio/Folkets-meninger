import {
  cmsSourcesFromEditRows,
  editRowFromCmsLabel,
  type BlogDraftSourceEditRow,
} from '@/lib/admin/blog-draft-source-edit';
import { isBlockedSourceUrl } from '@/lib/sources/blocklist';
import type { BlogPostSourcePublic } from '@/lib/blog/types';
import type { ChatSourceLink } from '@/lib/chat/source-links';

export function mapPayloadSourcesToPublic(
  sources: ReadonlyArray<{ label?: string | null; url?: string | null }> | null | undefined,
): BlogPostSourcePublic[] {
  if (!sources?.length) return [];
  const out: BlogPostSourcePublic[] = [];
  let index = 0;
  for (const row of sources) {
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!label || !url) continue;
    const parsed = editRowFromCmsLabel(label, url);
    if (!parsed || isBlockedSourceUrl(parsed.url)) continue;
    index += 1;
    out.push({
      index,
      title: parsed.title,
      publisher: parsed.publisher,
      url: parsed.url,
      publishedAt: parsed.publishedAt?.trim() || null,
    });
  }
  return out;
}

/** Editor rows as shown in Vurder — drops incomplete rows and blocklisted URLs. */
export function mapEditorRowsToPublicSources(
  rows: readonly BlogDraftSourceEditRow[],
): BlogPostSourcePublic[] {
  const eligible: BlogDraftSourceEditRow[] = [];
  for (const row of rows) {
    const title = row.title?.trim() ?? '';
    const publisher = row.publisher?.trim() ?? '';
    const url = row.url?.trim() ?? '';
    if (!title || !publisher || !url) continue;
    if (isBlockedSourceUrl(url)) continue;
    eligible.push({ title, publisher, url, publishedAt: row.publishedAt?.trim() || undefined });
  }
  return mapPayloadSourcesToPublic(cmsSourcesFromEditRows(eligible));
}

export function blogCitationMapFromPostSources(
  sources: readonly BlogPostSourcePublic[],
): Map<number, ChatSourceLink> {
  const map = new Map<number, ChatSourceLink>();
  for (const source of sources) {
    map.set(source.index, {
      n: source.index,
      href: source.url,
      external: true,
      title: source.title,
      kind: 'nett',
    });
  }
  return map;
}