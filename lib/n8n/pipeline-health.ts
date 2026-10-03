export type PipelineHealth = {
  pendingChunks: number;
  missingSummaries: number;
  thinSummaries: number;
  draftPolls: number;
  recentOpsEvents: number;
};

export function normalizePipelineHealth(raw: unknown): PipelineHealth {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  };
  return {
    pendingChunks: num(row.pending_chunks ?? row.pendingChunks),
    missingSummaries: num(row.missing_summaries ?? row.missingSummaries),
    thinSummaries: num(row.thin_summaries ?? row.thinSummaries),
    draftPolls: num(row.draft_polls ?? row.draftPolls),
    recentOpsEvents: num(row.recent_ops_events ?? row.recentOpsEvents),
  };
}

export function pipelineHealthNeedsAttention(health: PipelineHealth): boolean {
  return (
    health.pendingChunks >= 40 ||
    health.missingSummaries >= 15 ||
    health.thinSummaries >= 20 ||
    health.draftPolls >= 8
  );
}
