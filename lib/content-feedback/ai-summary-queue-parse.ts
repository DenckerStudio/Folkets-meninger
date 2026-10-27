import type { AiSummaryQueueGaveUpRow } from '@/lib/content-feedback/ai-summary-queue-types';

export function normalizeGaveUpRpcPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.gaveUp)) return record.gaveUp;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseGaveUpRows(raw: unknown): AiSummaryQueueGaveUpRow[] {
  const items = normalizeGaveUpRpcPayload(raw);
  return items
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const issueId = typeof item.issue_id === 'string' ? item.issue_id : null;
      const kind = item.kind;
      if (!issueId || typeof kind !== 'string') return null;
      if (kind !== 'mangler_sammendrag' && kind !== 'regenerering' && kind !== 'tynt_sammendrag') {
        return null;
      }
      return {
        issue_id: issueId,
        title: typeof item.title === 'string' ? item.title : null,
        kind,
        attempts: typeof item.attempts === 'number' ? item.attempts : Number(item.attempts) || 0,
        last_attempt_at:
          typeof item.last_attempt_at === 'string' ? item.last_attempt_at : null,
      } satisfies AiSummaryQueueGaveUpRow;
    })
    .filter((row): row is AiSummaryQueueGaveUpRow => row !== null);
}
