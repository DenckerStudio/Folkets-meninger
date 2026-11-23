import type { LocalAiFinishedRow } from '@/lib/admin/local-ai-hub/overview-types';

const inactiveRows = new Map<number, LocalAiFinishedRow>();

export function isPermanentlyCacheableFinishedRow(row: LocalAiFinishedRow): boolean {
  if (!row.pr) {
    return false;
  }
  return row.pr.merged || row.pr.state !== 'open';
}

export function readInactiveFinishedRowCache(taskId: number): LocalAiFinishedRow | null {
  return inactiveRows.get(taskId) ?? null;
}

export function writeInactiveFinishedRowCache(taskId: number, row: LocalAiFinishedRow): void {
  if (!isPermanentlyCacheableFinishedRow(row)) {
    return;
  }
  inactiveRows.set(taskId, row);
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