import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakDocumentRef } from '@/lib/stortinget-documents';
import { type SakTreatmentStatus } from '@/lib/sak-status';
import {
  getLastPastVoteEventDate,
  getNextVoteCloseDate,
} from '@/lib/sak-voting-window';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';

export type SakStortingetOversiktExtras = {
  decisionDateLabel: string | null;
  nextMilestoneLabel: string | null;
  stortingetSakUrl: string;
};

function formatNbDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

export function buildSakStortingetOversiktExtras(input: {
  sakId: string;
  detail: StortingetSakDetail | null | undefined;
  treatmentStatus: SakTreatmentStatus;
  documents: readonly SakDocumentRef[];
}): SakStortingetOversiktExtras | null {
  const { sakId, detail, treatmentStatus } = input;
  if (!detail) return null;

  const lastVote = getLastPastVoteEventDate(detail);
  const nextVote = getNextVoteCloseDate(detail);
  const decisionDateLabel =
    treatmentStatus === 'closed' && lastVote ? formatNbDate(lastVote) : null;
  const nextMilestoneLabel =
    treatmentStatus === 'pending' && nextVote && nextVote.getTime() > Date.now()
      ? formatNbDate(nextVote)
      : null;

  if (!decisionDateLabel && !nextMilestoneLabel) return null;

  return {
    decisionDateLabel,
    nextMilestoneLabel,
    stortingetSakUrl: getStortingetSakUrl(sakId),
  };
}