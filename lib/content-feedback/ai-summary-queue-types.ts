export type AiSummaryQueueGaveUpRow = {
  issue_id: string;
  title: string | null;
  kind: 'mangler_sammendrag' | 'regenerering' | 'tynt_sammendrag';
  attempts: number;
  last_attempt_at: string | null;
};
