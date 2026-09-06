import type { PollRecord } from '@/lib/polls/types';

export const POLL_DRAFT_POLL_INTERVAL_MS = 2_500;
export const POLL_DRAFT_TIMEOUT_MS = 90_000;

export type PollDraftGenerationStatus = 'generating' | 'ready' | 'timeout';

export type PollDraftGenerationJob = {
  key: string;
  issueId: string | null;
  startedAt: number;
  status: PollDraftGenerationStatus;
  knownDraftIds: string[];
  draftId?: string;
};

export function pollDraftGenerationKey(issueId?: string): string {
  return issueId?.trim() ? issueId.trim() : '__next__';
}

export function findCompletedDraft(
  job: PollDraftGenerationJob,
  drafts: PollRecord[],
): PollRecord | null {
  if (job.issueId) {
    return drafts.find((draft) => draft.stortingetIssueId === job.issueId) ?? null;
  }

  const knownIds = new Set(job.knownDraftIds);
  return drafts.find((draft) => !knownIds.has(draft.id)) ?? null;
}

export function isPollDraftGenerationTimedOut(job: PollDraftGenerationJob, now = Date.now()): boolean {
  return now - job.startedAt >= POLL_DRAFT_TIMEOUT_MS;
}

export function pollDraftGenerationStatusLabel(status: PollDraftGenerationStatus): string {
  switch (status) {
    case 'generating':
      return 'Genererer utkast…';
    case 'ready':
      return 'Utkast klart';
    case 'timeout':
      return 'Tidsavbrudd — sjekk n8n eller prøv igjen';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
