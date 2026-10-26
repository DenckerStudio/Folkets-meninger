import { getServiceSupabase } from '@/lib/supabase';

export type AiSummaryReviewSource = {
  title: string;
  url: string | null;
};

export type AiSummaryReviewItem = {
  issueId: string;
  title: string;
  narrative: string;
  updatedAt: string | null;
  labels: string[];
  sources: AiSummaryReviewSource[];
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

export async function listAiSummariesForReview(limit = 30): Promise<AiSummaryReviewItem[]> {
  const supabase = getServiceSupabase();
  const capped = Math.min(Math.max(limit, 1), 50);
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

  return rows.map((row) => ({
    issueId: row.issueId,
    title: titles.get(row.issueId) ?? `Sak ${row.issueId}`,
    narrative: row.narrative,
    updatedAt: row.updatedAt,
    labels: row.labels,
    sources: sources.get(row.issueId) ?? [],
  }));
}
