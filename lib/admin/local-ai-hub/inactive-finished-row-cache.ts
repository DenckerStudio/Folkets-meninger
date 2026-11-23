import type { ResolvedTaskPrLink } from '@/lib/admin/local-ai-hub/pr-link';
import type { LocalAiFinishedRow } from '@/lib/admin/local-ai-hub/overview-types';

const inactiveRows = new Map<string, LocalAiFinishedRow>();

export function buildInactiveFinishedRowCacheKey(taskId: number, link: ResolvedTaskPrLink): string {
  const repoKey = `${link.owner}/${link.repo}`;
  if (link.mode === 'branch' && link.branch) {
    return `${taskId}:${repoKey}:branch:${link.branch}`;
  }
  if (link.number !== undefined) {
    return `${taskId}:${repoKey}:pr:${link.number}`;
  }
  return `${taskId}:${repoKey}:link`;
}

export function isPermanentlyCacheableFinishedRow(row: LocalAiFinishedRow): boolean {
  if (!row.pr) {
    return false;
  }
  return row.pr.merged || row.pr.state !== 'open';
}

export function readInactiveFinishedRowCache(
  taskId: number,
  link: ResolvedTaskPrLink,
): LocalAiFinishedRow | null {
  return inactiveRows.get(buildInactiveFinishedRowCacheKey(taskId, link)) ?? null;
}

export function writeInactiveFinishedRowCache(
  taskId: number,
  link: ResolvedTaskPrLink,
  row: LocalAiFinishedRow,
): void {
  if (!isPermanentlyCacheableFinishedRow(row)) {
    return;
  }
  inactiveRows.set(buildInactiveFinishedRowCacheKey(taskId, link), row);
}

export function mergeInactiveFinishedRowFromCache(
  cached: LocalAiFinishedRow,
  task: { id: number; title: string },
  failed: boolean,
  failureComment: string | null,
): LocalAiFinishedRow {
  return {
    ...cached,
    taskId: task.id,
    title: task.title,
    failed,
    failureComment,
  };
}

export function clearInactiveFinishedRowCacheForTests(): void {
  inactiveRows.clear();
}
