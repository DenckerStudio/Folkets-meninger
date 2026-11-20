import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakDocumentRef } from '@/lib/stortinget-documents';
import { type SakTreatmentStatus } from '@/lib/sak-status';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';
import { formatSakDate } from '@/lib/sak/date-format';
import { nextPlannedSaksgangDate, saksgangDecisionDate } from '@/lib/sak/saksgang-steps';

export type SakStortingetOversiktExtras = {
  decisionDateLabel: string | null;
  nextMilestoneLabel: string | null;
  stortingetSakUrl: string;
};

export function buildSakStortingetOversiktExtras(input: {
  sakId: string;
  detail: StortingetSakDetail | null | undefined;
  treatmentStatus: SakTreatmentStatus;
  documents: readonly SakDocumentRef[];
}): SakStortingetOversiktExtras | null {
  const { sakId, detail, treatmentStatus } = input;
  if (!detail) return null;

  const steps = detail.saksgang?.saksgang_steg_liste;
  const decision = treatmentStatus === 'closed' ? saksgangDecisionDate(steps) : null;
  const nextPlanned = treatmentStatus === 'pending' ? nextPlannedSaksgangDate(steps) : null;
  const decisionDateLabel = decision ? formatSakDate(decision) : null;
  const nextMilestoneLabel = nextPlanned ? formatSakDate(nextPlanned) : null;

  if (!decisionDateLabel && !nextMilestoneLabel) return null;

  return {
    decisionDateLabel,
    nextMilestoneLabel,
    stortingetSakUrl: getStortingetSakUrl(sakId),
  };
}