import { getServiceSupabase } from '@/lib/supabase';

export type AiSummaryReviewSource = {
  title: string;
  url: string | null;
};

export type SummaryReviewMark = 'approve' | 'reject' | 'neutral';

export type AiSummaryReviewItem = {
  issueId: string;
  title: string;
  narrative: string;
  updatedAt: string | null;
  labels: string[];
  sources: AiSummaryReviewSource[];
  /** Null when no admin review exists. The row is still listed. */
  reviewMark: SummaryReviewMark | null;
  /** False when content_feedback could not be read. Then reviewMark stays null and no badge is shown. */
  reviewLookupOk: boolean;
};

export type SummaryDocumentRow = {
  issueId: string;
  title: string | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
}

export function summaryNarrative(narrative: unknown, hva: unknown): string {
  return asTrimmedString(narrative) ?? asTrimmedString(hva) ?? '';
}

export function parseSummaryReviewMark(value: unknown): SummaryReviewMark | null {
  switch (value) {
    case 'approve':
    case 'reject':
    case 'neutral':
      return value;
    default:
      return null;
  }
}

/** Only an admin verdict counts as reviewed. Missing feedback is not a reason to hide the summary. */
export function adminReviewMark(source: unknown, verdict: unknown): SummaryReviewMark | null {
  if (source !== 'admin') return null;
  return parseSummaryReviewMark(verdict);
}

export function summaryReviewLabel(
  mark: SummaryReviewMark | null,
  lookupOk: boolean,
): string | null {
  if (!lookupOk) return null;
  switch (mark) {
    case 'approve':
      return 'Godkjent';
    case 'reject':
      return 'Avvist';
    case 'neutral':
      return 'Vurdert';
    case null:
      return 'Ikke vurdert';
    default: {
      const unreachable: never = mark;
      return unreachable;
    }
  }
}

export function summaryLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const item of value) {
    const label = asTrimmedString(item);
    if (!label || labels.includes(label)) continue;
    labels.push(label);
    if (labels.length >= 8) break;
  }
  return labels;
}

export function groupSummarySources(
  docs: SummaryDocumentRow[],
  limitPerIssue = 8,
): Map<string, AiSummaryReviewSource[]> {
  const grouped = new Map<string, SummaryDocumentRow[]>();
  for (const doc of docs) {
    const issueId = doc.issueId.trim();
    if (!issueId) continue;
    const list = grouped.get(issueId) ?? [];
    list.push(doc);
    grouped.set(issueId, list);
  }

  const sources = new Map<string, AiSummaryReviewSource[]>();
  for (const [issueId, rows] of grouped) {
    const ordered = [...rows].sort((a, b) => {
      const aTime = a.fetchedAt ? Date.parse(a.fetchedAt) : 0;
      const bTime = b.fetchedAt ? Date.parse(b.fetchedAt) : 0;
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
    const seen = new Set<string>();
    const picked: AiSummaryReviewSource[] = [];
    for (const row of ordered) {
      const url = asTrimmedString(row.sourceUrl);
      const title = asTrimmedString(row.title) ?? url ?? 'Dokument';
      const key = url ?? title;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push({ title, url });
      if (picked.length >= limitPerIssue) break;
    }
    sources.set(issueId, picked);
  }
  return sources;
}

type SummaryQueryRow = {
  stortinget_issue_id?: unknown;
  narrative?: unknown;
  hva?: unknown;
  updated_at?: unknown;
  labels?: unknown;
};

function parseSummaryRow(row: SummaryQueryRow): { issueId: string; narrative: string; updatedAt: string | null; labels: string[] } | null {
  const issueId = asTrimmedString(row.stortinget_issue_id);
  if (!issueId) return null;
  return {
    issueId,
    narrative: summaryNarrative(row.narrative, row.hva),
    updatedAt: asTrimmedString(row.updated_at),
    labels: summaryLabels(row.labels),
  };
}

const REVIEW_LIST_MAX = 100;

/** Unreviewed rows first, then reviewed. Both groups stay in the list, newest first. */
export function orderSummariesForReview<
  T extends { updatedAt: string | null; reviewMark: SummaryReviewMark | null; reviewLookupOk: boolean },
>(items: T[]): T[] {
  const time = (value: string | null) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...items].sort((a, b) => {
    const aWaiting = a.reviewLookupOk && a.reviewMark == null ? 0 : 1;
    const bWaiting = b.reviewLookupOk && b.reviewMark == null ? 0 : 1;
    if (aWaiting !== bWaiting) return aWaiting - bWaiting;
    return time(b.updatedAt) - time(a.updatedAt);
  });
}

async function lookupAdminReviewMarks(
  supabase: ReturnType<typeof getServiceSupabase>,
  issueIds: string[],
): Promise<{ ok: true; marks: Map<string, SummaryReviewMark | null> } | { ok: false }> {
  const { data, error } = await supabase
    .from('content_feedback')
    .select('content_id, verdict, source')
    .eq('content_type', 'ai_summary')
    .in('content_id', issueIds)
    .is('superseded_at', null);

  if (error) {
    console.error('[ai-summary-review] vurdering kunne ikke leses. Sammendragene vises likevel.', error);
    return { ok: false };
  }

  const marks = new Map<string, SummaryReviewMark | null>();
  for (const row of data ?? []) {
    const record = row as { content_id?: unknown; verdict?: unknown; source?: unknown };
    const issueId = asTrimmedString(record.content_id);
    if (!issueId) continue;
    marks.set(issueId, adminReviewMark(record.source, record.verdict));
  }
  return { ok: true, marks };
}

export async function listAiSummariesForReview(limit = 80): Promise<AiSummaryReviewItem[]> {
  const supabase = getServiceSupabase();
  const capped = Math.min(Math.max(limit, 1), REVIEW_LIST_MAX);
  const { data, error } = await supabase
    .from('issue_ai_summaries')
    .select('stortinget_issue_id, narrative, hva, updated_at, labels')
    .order('updated_at', { ascending: false })
    .limit(capped);

  if (error) throw error;

  const rows = (Array.isArray(data) ? data : [])
    .map((row) => parseSummaryRow(row as SummaryQueryRow))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return [];

  const issueIds = rows.map((row) => row.issueId);
  const [{ data: issues, error: issueError }, { data: documents, error: documentError }] =
    await Promise.all([
      supabase.from('stortinget_issues').select('id, title').in('id', issueIds),
      supabase
        .from('stortinget_issue_documents')
        .select('issue_id, title, source_url, fetched_at')
        .in('issue_id', issueIds),
    ]);

  if (issueError) {
    console.error('[ai-summary-review] saker feilet', issueError);
  }
  if (documentError) {
    console.error('[ai-summary-review] dokumenter feilet', documentError);
  }

  const titles = new Map<string, string>();
  for (const issue of issues ?? []) {
    const id = asTrimmedString((issue as { id?: unknown }).id);
    const title = asTrimmedString((issue as { title?: unknown }).title);
    if (id && title) titles.set(id, title);
  }

  const documentRows: SummaryDocumentRow[] = documentError
    ? []
    : (documents ?? []).map((doc) => {
        const row = doc as {
          issue_id?: unknown;
          title?: unknown;
          source_url?: unknown;
          fetched_at?: unknown;
        };
        return {
          issueId: asTrimmedString(row.issue_id) ?? '',
          title: asTrimmedString(row.title),
          sourceUrl: asTrimmedString(row.source_url),
          fetchedAt: asTrimmedString(row.fetched_at),
        };
      });
  const sources = groupSummarySources(documentRows);
  const review = await lookupAdminReviewMarks(supabase, issueIds);

  return orderSummariesForReview(
    rows.map((row) => ({
      issueId: row.issueId,
      title: titles.get(row.issueId) ?? `Sak ${row.issueId}`,
      narrative: row.narrative,
      updatedAt: row.updatedAt,
      labels: row.labels,
      sources: sources.get(row.issueId) ?? [],
      reviewMark: review.ok ? (review.marks.get(row.issueId) ?? null) : null,
      reviewLookupOk: review.ok,
    })),
  );
}
