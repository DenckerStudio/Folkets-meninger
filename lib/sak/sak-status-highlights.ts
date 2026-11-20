import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakTreatmentStatus } from '@/lib/sak-status';
import { getSakTreatmentLabel } from '@/lib/sak-status';
import { findHoringerForSak, isHoringOpen, type StortingetHoring } from '@/lib/stortinget-horinger';
import { routes } from '@/lib/routes';
import { formatSakDate } from '@/lib/sak/date-format';
import { nextPlannedSaksgangDate, saksgangDecisionDate } from '@/lib/sak/saksgang-steps';
import { deriveSakOutcome, type SakOutcomeKind } from '@/lib/sak/sak-outcome';

export type SakStatusHighlight = {
  statusLabel: string;
  statusKind: SakTreatmentStatus;
  nextStepLabel: string | null;
  nextStepDateLabel: string | null;
  hearingHref: string | null;
  hearingLinkLabel: string | null;
  /** Stortingets egen utfallssetning, ellers et utdrag av vedtaket; kun for ferdigbehandlede saker. */
  vedtakExcerpt: string | null;
  /** Dagen Stortinget behandlet saken (fra saksgangen); kun for ferdigbehandlede saker. */
  decisionDateLabel: string | null;
  outcomeKind: SakOutcomeKind;
  outcomeLabel: string | null;
};

function pickNextHearingLink(
  sakId: string,
  linkedHearings: StortingetHoring[],
): { href: string; label: string } | null {
  const real = findHoringerForSak(linkedHearings, sakId);
  const open = real.find((h) => isHoringOpen(h) && h.id != null);
  if (open?.id != null) {
    return {
      href: routes.horing(String(open.id)),
      label: 'Gå til høringen',
    };
  }
  const latestWithId = real.find((h) => h.id != null);
  if (latestWithId?.id != null) {
    return {
      href: routes.horing(String(latestWithId.id)),
      label: 'Se høringen',
    };
  }
  return null;
}

export function buildSakStatusHighlight(input: {
  sakId: string;
  detail: StortingetSakDetail | null | undefined;
  treatmentStatus: SakTreatmentStatus;
  linkedHearings: StortingetHoring[];
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
}): SakStatusHighlight {
  const { detail, treatmentStatus, kortvedtak, vedtakstekst } = input;
  const statusLabel = getSakTreatmentLabel(treatmentStatus);

  const decisionDate =
    treatmentStatus === 'closed' ? saksgangDecisionDate(detail?.saksgang?.saksgang_steg_liste) : null;
  const nextVote = nextPlannedSaksgangDate(detail?.saksgang?.saksgang_steg_liste);

  let nextStepLabel: string | null = null;
  let nextStepDateLabel: string | null = null;

  if (treatmentStatus === 'pending') {
    if (nextVote) {
      nextStepLabel = 'Planlagt behandling';
      nextStepDateLabel = formatSakDate(nextVote);
    }
  }

  const hearingLink = input.sakId
    ? pickNextHearingLink(input.sakId, input.linkedHearings)
    : null;

  const outcome = deriveSakOutcome({ status: treatmentStatus, kortvedtak, vedtakstekst });
  const vedtakExcerpt =
    treatmentStatus === 'closed'
      ? (outcome.sentence ?? (kortvedtak?.trim() || vedtakstekst?.trim()?.slice(0, 280) || null))
      : null;

  return {
    statusLabel,
    statusKind: treatmentStatus,
    nextStepLabel,
    nextStepDateLabel,
    hearingHref: hearingLink?.href ?? null,
    hearingLinkLabel: hearingLink?.label ?? null,
    vedtakExcerpt,
    decisionDateLabel: decisionDate ? formatSakDate(decisionDate) : null,
    outcomeKind: outcome.kind,
    outcomeLabel: outcome.label,
  };
}