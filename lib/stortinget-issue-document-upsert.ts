import type { getServiceSupabase } from '@/lib/supabase';

type UpsertError = { code?: string; message?: string } | null;

export function logStortingetIssueDocumentUpsertError(
  issueId: string,
  documentId: string,
  error: UpsertError,
): void {
  if (!error) return;
  const code = error.code ?? 'unknown';
  const message = error.message ?? '';
  console.error(
    `[document-ingest] stortinget_issue_documents upsert failed issue_id=${issueId} document_id=${documentId} code=${code} message=${message}`,
  );
}

type IssueDocumentRow = Record<string, unknown>;

export async function upsertStortingetIssueDocument(
  service: ReturnType<typeof getServiceSupabase>,
  issueId: string,
  documentId: string,
  row: IssueDocumentRow,
): Promise<void> {
  const { error } = await service.from('stortinget_issue_documents').upsert(row, {
    onConflict: 'issue_id,document_id',
  });
  logStortingetIssueDocumentUpsertError(issueId, documentId, error);
}