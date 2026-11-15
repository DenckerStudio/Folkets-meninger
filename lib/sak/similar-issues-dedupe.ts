import type { SimilarSakListItem } from '@/lib/sak/similar-issues';

export function dedupeSimilarSaker(
  items: readonly SimilarSakListItem[],
  currentIssueId: string,
  relatedIssueIds: readonly string[],
): SimilarSakListItem[] {
  const current = currentIssueId.trim();
  const exclude = new Set<string>();
  if (current) exclude.add(current);
  for (const raw of relatedIssueIds) {
    const id = String(raw ?? '').trim();
    if (id) exclude.add(id);
  }
  return items.filter((item) => !exclude.has(item.id.trim()));
}