import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakTreatmentStatus } from '@/lib/sak-status';
import { getSakTreatmentLabel } from '@/lib/sak-status';
import {
  getLastPastVoteEventDate,
  getNextVoteCloseDate,
} from '@/lib/sak-voting-window';
import { findHoringerForSak, isHoringOpen, type StortingetHoring } from '@/lib/stortinget-horinger';
import { routes } from '@/lib/routes';

export type SakStatusHighlight = {
  statusLabel: string;
  statusKind: SakTreatmentStatus;
  nextStepLabel: string | null;
  nextStepDateLabel: string | null;
  hearingHref: string | null;
  hearingLinkLabel: string | null;
  vedtakExcerpt: string | null;
};

function formatNbDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

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

  const lastVote = detail ? getLastPastVoteEventDate(detail) : null;
  const nextVote = detail ? getNextVoteCloseDate(detail) : null;

  let nextStepLabel: string | null = null;
  let nextStepDateLabel: string | null = null;

  if (treatmentStatus === 'pending') {
    if (nextVote && nextVote.getTime() > Date.now()) {
      nextStepLabel = 'Planlagt behandling';
      nextStepDateLabel = formatNbDate(nextVote);
    }
  }

  const hearingLink = input.sakId
    ? pickNextHearingLink(input.sakId, input.linkedHearings)
    : null;

  const vedtakExcerpt =
    treatmentStatus === 'closed'
      ? (kortvedtak?.trim() || vedtakstekst?.trim()?.slice(0, 280) || null)
      : null;

  return {
    statusLabel,
    statusKind: treatmentStatus,
    nextStepLabel,
    nextStepDateLabel,
    hearingHref: hearingLink?.href ?? null,
    hearingLinkLabel: hearingLink?.label ?? null,
    vedtakExcerpt,
  };
}