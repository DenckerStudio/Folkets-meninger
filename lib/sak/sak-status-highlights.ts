import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakTreatmentStatus } from '@/lib/sak-status';
import { getSakTreatmentLabel } from '@/lib/sak-status';
import {
  getLastPastVoteEventDate,
  getNextVoteCloseDate,
} from '@/lib/sak-voting-window';
import { hearingsFromSaksgang } from '@/lib/chat/stortinget-tools';
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
  currentSaksgangStep: string | null;
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
  detail: StortingetSakDetail,
  linkedHearings: StortingetHoring[],
): { href: string; label: string } | null {
  const real = findHoringerForSak(linkedHearings, sakId);
  const open = real.find((h) => isHoringOpen(h));
  if (open?.id != null) {
    return {
      href: routes.horing(String(open.id)),
      label: 'Gå til høringen',
    };
  }
  const saksgang = hearingsFromSaksgang(detail);
  const upcoming = saksgang.find((h) => h.statusKind === 'open');
  if (upcoming) {
    return {
      href: routes.horinger,
      label: 'Se høringer',
    };
  }
  const held = saksgang[0];
  if (held) {
    return {
      href: routes.horinger,
      label: 'Høring i saksgangen',
    };
  }
  return null;
}

function inferCurrentSaksgangStep(detail: StortingetSakDetail | null | undefined): string | null {
  const steps = detail?.saksgang?.saksgang_steg_liste ?? [];
  let lastWithEvents: string | null = null;
  for (const step of steps) {
    const events = step.saksgang_hendelse_liste ?? [];
    const hasMeaningful = events.some((e) => {
      const hasDate = e.dato && !e.dato.startsWith('01.01.0001');
      return hasDate || Boolean(e.hendelse_tekst?.trim());
    });
    if (hasMeaningful) lastWithEvents = step.navn;
  }
  if (lastWithEvents) return lastWithEvents;
  return steps[steps.length - 1]?.navn ?? null;
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
    } else {
      const step = inferCurrentSaksgangStep(detail);
      if (step) {
        nextStepLabel = 'Nåværende steg';
        nextStepDateLabel = step;
      }
    }
  }

  const hearingLink =
    detail && input.sakId
      ? pickNextHearingLink(input.sakId, detail, input.linkedHearings)
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
    currentSaksgangStep: inferCurrentSaksgangStep(detail),
  };
}